import { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { QueueItem } from '../types';
import { useFileDrop } from './useFileDrop';
import type { Store } from '@tauri-apps/plugin-store';
import {
    CHUNK_SIZE_BYTES,
    shouldChunk,
    splitFile,
    buildChunkName,
    buildManifestName,
    buildManifestJson,
    writeTempTextFile,
    deleteTempFiles,
    ChunkManifest,
    ChunkEntry,
} from './useChunkedTransfer';

interface ProgressPayload {
    id: string;
    percent: number;
    uploaded_bytes: number;
    total_bytes: number;
    speed_bytes_per_sec: number;
}

export function useFileUpload(activeFolderId: number | null, store: Store | null) {
    const queryClient = useQueryClient();
    const [uploadQueue, setUploadQueue] = useState<QueueItem[]>([]);
    const [processing, setProcessing] = useState(false);
    const [initialized, setInitialized] = useState(false);
    const cancelledRef = useRef<Set<string>>(new Set());

    useEffect(() => {
        let unlisten: UnlistenFn | undefined;
        listen<ProgressPayload>('upload-progress', (event) => {
            setUploadQueue(q => q.map(i =>
                i.id === event.payload.id ? {
                    ...i,
                    progress: event.payload.percent,
                    uploadedBytes: event.payload.uploaded_bytes,
                    totalBytes: event.payload.total_bytes,
                    speedBytesPerSec: event.payload.speed_bytes_per_sec,
                } : i
            ));
        }).then(fn => { unlisten = fn; });
        return () => { unlisten?.(); };
    }, []);

    useEffect(() => {
        if (!store || initialized) return;
        store.get<QueueItem[]>('uploadQueue').then((saved) => {
            if (saved && saved.length > 0) {
                const pending = saved.filter(i => i.status === 'pending');
                if (pending.length > 0) {
                    setUploadQueue(pending);
                    toast.info(`Restored ${pending.length} pending uploads`);
                }
            }
            setInitialized(true);
        });
    }, [store, initialized]);

    useEffect(() => {
        if (!store || !initialized) return;
        const pending = uploadQueue.filter(i => i.status === 'pending');
        store.set('uploadQueue', pending).then(() => store.save());
    }, [store, uploadQueue, initialized]);

    useEffect(() => {
        if (processing) return;
        const nextItem = uploadQueue.find(i => i.status === 'pending');
        if (nextItem) { processItem(nextItem); }
    }, [uploadQueue, processing]);

    const processItem = async (item: QueueItem) => {
        setProcessing(true);
        setUploadQueue(q => q.map(i => i.id === item.id ? { ...i, status: 'uploading', progress: 0 } : i));
        try {
            const { needsChunk, size } = await shouldChunk(item.path);
            if (needsChunk) {
                await processChunkedUpload(item, size);
            } else {
                await processDirectUpload(item);
            }
        } catch (e) {
            if (!cancelledRef.current.has(item.id)) {
                const errMsg = String(e);
                if (errMsg.includes('Transfer cancelled')) {
                    setUploadQueue(q => q.map(i => i.id === item.id ? { ...i, status: 'cancelled' } : i));
                } else {
                    setUploadQueue(q => q.map(i => i.id === item.id ? { ...i, status: 'error', error: errMsg } : i));
                    toast.error(`Upload failed for ${item.path.split('/').pop()}: ${e}`);
                }
            } else {
                cancelledRef.current.delete(item.id);
            }
        } finally {
            setProcessing(false);
        }
    };

    const processDirectUpload = async (item: QueueItem) => {
        await invoke('cmd_upload_file', { path: item.path, folderId: item.folderId, transferId: item.id });
        if (cancelledRef.current.has(item.id)) {
            cancelledRef.current.delete(item.id);
        } else {
            setUploadQueue(q => q.map(i => i.id === item.id ? { ...i, status: 'success', progress: 100 } : i));
            queryClient.invalidateQueries({ queryKey: ['files', item.folderId] });
        }
    };

    const processChunkedUpload = async (item: QueueItem, originalSize: number) => {
        const originalName = item.path.split(/[/\\]/).pop() ?? item.path;
        const totalChunks = Math.ceil(originalSize / CHUNK_SIZE_BYTES);

        toast.info(
            `"${originalName}" is ${(originalSize / 1e9).toFixed(1)} GB — splitting into ${totalChunks} parts automatically…`,
            { duration: 6000 }
        );

        setUploadQueue(q => q.map(i =>
            i.id === item.id ? { ...i, status: 'uploading', progress: 0, totalBytes: originalSize, uploadedBytes: 0 } : i
        ));

        let chunkPaths: string[] = [];
        try {
            chunkPaths = await splitFile(item.path, CHUNK_SIZE_BYTES);
        } catch (splitErr) {
            throw new Error(`Failed to split file: ${splitErr}`);
        }

        const uploadedChunks: ChunkEntry[] = [];

        for (let i = 0; i < chunkPaths.length; i++) {
            if (cancelledRef.current.has(item.id)) {
                await deleteTempFiles(chunkPaths).catch(() => {});
                cancelledRef.current.delete(item.id);
                setUploadQueue(q => q.map(qi => qi.id === item.id ? { ...qi, status: 'cancelled' } : qi));
                return;
            }

            const chunkPath = chunkPaths[i];
            const chunkName = buildChunkName(originalName, i + 1, chunkPaths.length);
            const chunkTransferId = `${item.id}_chunk${i + 1}`;

            setUploadQueue(q => q.map(qi =>
                qi.id === item.id ? { ...qi, chunkLabel: `Part ${i + 1} of ${chunkPaths.length}` } : qi
            ));

            const messageId = await invoke<number>('cmd_upload_file', {
                path: chunkPath,
                folderId: item.folderId,
                transferId: chunkTransferId,
                customName: chunkName,
            });

            const chunkSize = await invoke<number>('cmd_get_file_size', { path: chunkPath }).catch(() => 0);
            uploadedChunks.push({ name: chunkName, message_id: messageId ?? 0, size: chunkSize });

            const overallProgress = Math.round(((i + 1) / chunkPaths.length) * 90);
            setUploadQueue(q => q.map(qi => qi.id === item.id ? { ...qi, progress: overallProgress } : qi));
        }

        const manifest: ChunkManifest = {
            version: 1,
            original_name: originalName,
            original_size: originalSize,
            chunk_count: chunkPaths.length,
            chunk_size: CHUNK_SIZE_BYTES,
            chunks: uploadedChunks,
            created_at: new Date().toISOString(),
        };

        const manifestJson = buildManifestJson(manifest);
        const manifestName = buildManifestName(originalName);
        let manifestTmpPath: string;

        try {
            manifestTmpPath = await writeTempTextFile(manifestJson);
        } catch (e) {
            throw new Error(`Failed to write manifest: ${e}`);
        }

        await invoke('cmd_upload_file', {
            path: manifestTmpPath,
            folderId: item.folderId,
            transferId: `${item.id}_manifest`,
            customName: manifestName,
        });

        await deleteTempFiles([...chunkPaths, manifestTmpPath]).catch(() => {});

        setUploadQueue(q => q.map(i =>
            i.id === item.id ? { ...i, status: 'success', progress: 100, chunkLabel: undefined } : i
        ));
        queryClient.invalidateQueries({ queryKey: ['files', item.folderId] });
        toast.success(`"${originalName}" uploaded in ${chunkPaths.length} parts. Auto-merge on download is active.`);
    };

    const handleManualUpload = async () => {
        try {
            const selected = await open({ multiple: true, directory: false });
            if (selected) {
                const paths = Array.isArray(selected) ? selected : [selected];
                const newItems: QueueItem[] = paths.map((path: string) => ({
                    id: Math.random().toString(36).substr(2, 9),
                    path,
                    folderId: activeFolderId,
                    status: 'pending',
                }));
                setUploadQueue(prev => [...prev, ...newItems]);
                toast.info(`Queued ${paths.length} file(s) for upload`);
            }
        } catch {
            toast.error('Failed to open file dialog');
        }
    };

    const cancelAll = () => {
        setUploadQueue(q => {
            const uploading = q.find(i => i.status === 'uploading');
            if (uploading) {
                cancelledRef.current.add(uploading.id);
                invoke('cmd_cancel_transfer', { transferId: uploading.id }).catch(() => {});
            }
            return q
                .filter(i => i.status !== 'pending')
                .map(i => i.status === 'uploading' ? { ...i, status: 'cancelled' as const } : i);
        });
        toast.info('All uploads cancelled');
    };

    const cancelItem = (id: string) => {
        setUploadQueue(q => {
            const item = q.find(i => i.id === id);
            if (item?.status === 'uploading') {
                cancelledRef.current.add(id);
                invoke('cmd_cancel_transfer', { transferId: id }).catch(() => {});
                return q.map(i => i.id === id ? { ...i, status: 'cancelled' as const } : i);
            }
            if (item?.status === 'pending') {
                return q.filter(i => i.id !== id);
            }
            return q;
        });
    };

    const retryItem = (id: string) => {
        setUploadQueue(q => q.map(i =>
            i.id === id && (i.status === 'error' || i.status === 'cancelled')
                ? { ...i, status: 'pending' as const, error: undefined, progress: undefined, uploadedBytes: undefined, totalBytes: undefined, speedBytesPerSec: undefined, chunkLabel: undefined }
                : i
        ));
    };

    const { isDragging } = useFileDrop();

    return { uploadQueue, setUploadQueue, handleManualUpload, cancelAll, cancelItem, retryItem, isDragging };
}
