import { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { save, open } from '@tauri-apps/plugin-dialog';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { toast } from 'sonner';
import { DownloadItem, TelegramFile } from '../types';
import type { Store } from '@tauri-apps/plugin-store';
import {
    isManifestFile,
    manifestToDisplayName,
    parseManifest,
    mergeChunks,
    deleteTempFiles,
    readTextFile,
} from './useChunkedTransfer';

interface ProgressPayload {
    id: string;
    percent: number;
    uploaded_bytes: number;
    total_bytes: number;
    speed_bytes_per_sec: number;
}

export function useFileDownload(store: Store | null) {
    const [downloadQueue, setDownloadQueue] = useState<DownloadItem[]>([]);
    const [processing, setProcessing] = useState(false);
    const [initialized, setInitialized] = useState(false);
    const cancelledRef = useRef<Set<string>>(new Set());

    useEffect(() => {
        let unlisten: UnlistenFn | undefined;
        listen<ProgressPayload>('download-progress', (event) => {
            setDownloadQueue(q => q.map(i =>
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
        store.get<DownloadItem[]>('downloadQueue').then((saved) => {
            if (saved && saved.length > 0) {
                const pending = saved.filter(i => i.status === 'pending');
                if (pending.length > 0) {
                    setDownloadQueue(pending);
                    toast.info(`Restored ${pending.length} pending downloads`);
                }
            }
            setInitialized(true);
        });
    }, [store, initialized]);

    useEffect(() => {
        if (!store || !initialized) return;
        const pending = downloadQueue.filter(i => i.status === 'pending');
        store.set('downloadQueue', pending).then(() => store.save());
    }, [store, downloadQueue, initialized]);

    useEffect(() => {
        if (processing) return;
        const nextItem = downloadQueue.find(i => i.status === 'pending');
        if (nextItem) { processItem(nextItem); }
    }, [downloadQueue, processing]);

    const processItem = async (item: DownloadItem) => {
        setProcessing(true);
        setDownloadQueue(q => q.map(i => i.id === item.id ? { ...i, status: 'downloading', progress: 0 } : i));

        try {
            // Manifest files trigger chunked reassembly
            if (isManifestFile(item.filename)) {
                await processChunkedDownload(item);
            } else {
                await processDirectDownload(item);
            }
        } catch (e) {
            if (!cancelledRef.current.has(item.id)) {
                const errMsg = String(e);
                if (errMsg.includes('Transfer cancelled')) {
                    setDownloadQueue(q => q.map(i => i.id === item.id ? { ...i, status: 'cancelled' } : i));
                } else {
                    setDownloadQueue(q => q.map(i => i.id === item.id ? { ...i, status: 'error', error: errMsg } : i));
                    toast.error(`Download failed: ${item.filename}`);
                }
            } else {
                cancelledRef.current.delete(item.id);
            }
        } finally {
            setProcessing(false);
        }
    };

    // Standard single-file download (unchanged)
    const processDirectDownload = async (item: DownloadItem) => {
        const savePath = await save({ defaultPath: item.filename });
        if (!savePath) {
            setDownloadQueue(q => q.filter(i => i.id !== item.id));
            setProcessing(false);
            return;
        }
        await invoke('cmd_download_file', {
            messageId: item.messageId,
            savePath,
            folderId: item.folderId,
            transferId: item.id,
        });
        if (cancelledRef.current.has(item.id)) {
            cancelledRef.current.delete(item.id);
        } else {
            setDownloadQueue(q => q.map(i => i.id === item.id ? { ...i, status: 'success', progress: 100 } : i));
            toast.success(`Downloaded: ${item.filename}`);
        }
    };

    // Chunked download: manifest → download each chunk → merge → cleanup
    const processChunkedDownload = async (item: DownloadItem) => {
        const displayName = manifestToDisplayName(item.filename);

        // ① Ask where to save the final assembled file
        const savePath = await save({ defaultPath: displayName });
        if (!savePath) {
            setDownloadQueue(q => q.filter(i => i.id !== item.id));
            setProcessing(false);
            return;
        }

        toast.info(`Downloading "${displayName}" in parts — will auto-merge when done.`, { duration: 5000 });

        // ② Download the manifest file to a temp location to read it
        const manifestTmpPath = await invoke<string>('cmd_download_to_temp', {
            messageId: item.messageId,
            folderId: item.folderId,
            transferId: `${item.id}_manifest`,
        });

        const manifestJson = await readTextFile(manifestTmpPath);
        const manifest = parseManifest(manifestJson);
        await deleteTempFiles([manifestTmpPath]).catch(() => {});

        const totalChunks = manifest.chunks.length;
        const chunkTempPaths: string[] = [];

        // ③ Download each chunk sequentially
        for (let i = 0; i < totalChunks; i++) {
            if (cancelledRef.current.has(item.id)) {
                await deleteTempFiles(chunkTempPaths).catch(() => {});
                cancelledRef.current.delete(item.id);
                setDownloadQueue(q => q.map(qi => qi.id === item.id ? { ...qi, status: 'cancelled' } : qi));
                return;
            }

            const chunk = manifest.chunks[i];

            setDownloadQueue(q => q.map(qi =>
                qi.id === item.id
                    ? { ...qi, chunkLabel: `Downloading part ${i + 1} of ${totalChunks}` }
                    : qi
            ));

            const chunkTmpPath = await invoke<string>('cmd_download_to_temp', {
                messageId: chunk.message_id,
                folderId: item.folderId,
                transferId: `${item.id}_chunk${i + 1}`,
            });

            chunkTempPaths.push(chunkTmpPath);

            const overallProgress = Math.round(((i + 1) / totalChunks) * 85);
            setDownloadQueue(q => q.map(qi => qi.id === item.id ? { ...qi, progress: overallProgress } : qi));
        }

        // ④ Merge all chunks into the final file
        setDownloadQueue(q => q.map(i =>
            i.id === item.id ? { ...i, progress: 90, chunkLabel: 'Merging parts…' } : i
        ));

        await mergeChunks(chunkTempPaths, savePath);

        // ⑤ Clean up temp chunk files
        await deleteTempFiles(chunkTempPaths).catch(() => {});

        setDownloadQueue(q => q.map(i =>
            i.id === item.id ? { ...i, status: 'success', progress: 100, chunkLabel: undefined } : i
        ));
        toast.success(`"${displayName}" downloaded and merged successfully!`);
    };

    // ─── Public API ────────────────────────────────────────────────────────────

    /**
     * Queue a download. If `filename` ends with MANIFEST_SUFFIX the download
     * engine automatically handles chunked reassembly.
     */
    const queueDownload = (messageId: number, filename: string, folderId: number | null) => {
        const newItem: DownloadItem = {
            id: Math.random().toString(36).substr(2, 9),
            messageId,
            filename,
            folderId,
            status: 'pending',
        };
        setDownloadQueue(prev => [...prev, newItem]);
    };

    const queueBulkDownload = async (files: TelegramFile[], folderId: number | null) => {
        const dirPath = await open({
            directory: true,
            multiple: false,
            title: 'Select Download Destination',
        });
        if (!dirPath) return;

        for (const file of files) {
            const newItem: DownloadItem = {
                id: Math.random().toString(36).substr(2, 9),
                messageId: file.id,
                filename: file.name,
                folderId,
                status: 'pending',
            };
            setDownloadQueue(prev => [...prev, newItem]);
        }

        toast.info(`Queued ${files.length} file(s) for download`);
    };

    const clearFinished = () => {
        setDownloadQueue(q => q.filter(i => i.status !== 'success'));
    };

    const cancelAll = () => {
        setDownloadQueue(q => {
            const downloading = q.find(i => i.status === 'downloading');
            if (downloading) {
                cancelledRef.current.add(downloading.id);
                invoke('cmd_cancel_transfer', { transferId: downloading.id }).catch(() => {});
            }
            return q
                .filter(i => i.status !== 'pending')
                .map(i => i.status === 'downloading' ? { ...i, status: 'cancelled' as const } : i);
        });
        toast.info('All downloads cancelled');
    };

    const cancelItem = (id: string) => {
        setDownloadQueue(q => {
            const item = q.find(i => i.id === id);
            if (item?.status === 'downloading') {
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
        setDownloadQueue(q => q.map(i =>
            i.id === id && (i.status === 'error' || i.status === 'cancelled')
                ? { ...i, status: 'pending' as const, error: undefined, progress: undefined, uploadedBytes: undefined, totalBytes: undefined, speedBytesPerSec: undefined, chunkLabel: undefined }
                : i
        ));
    };

    return { downloadQueue, queueDownload, queueBulkDownload, clearFinished, cancelAll, cancelItem, retryItem };
}
