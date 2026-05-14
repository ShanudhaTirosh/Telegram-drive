export interface TelegramFile {
    id: number;
    name: string;
    size: number;
    sizeStr: string;
    created_at?: string;
    type?: 'folder' | 'file';
    isChunked?: boolean;        // true when this is the logical merged view of a chunked file
    chunkCount?: number;        // number of parts for chunked files
}

export interface TelegramFolder {
    id: number;
    name: string;
    parent_id?: number;
}

export interface QueueItem {
    id: string;
    path: string;
    folderId: number | null;
    status: 'pending' | 'uploading' | 'success' | 'error' | 'cancelled';
    error?: string;
    progress?: number;
    uploadedBytes?: number;
    totalBytes?: number;
    speedBytesPerSec?: number;
    chunkLabel?: string;        // e.g. "Part 2 of 3" or "Merging parts…"
}

export interface BandwidthStats {
    up_bytes: number;
    down_bytes: number;
}

export interface DownloadItem {
    id: string;
    messageId: number;
    filename: string;
    folderId: number | null;
    status: 'pending' | 'downloading' | 'success' | 'error' | 'cancelled';
    error?: string;
    progress?: number;
    uploadedBytes?: number;
    totalBytes?: number;
    speedBytesPerSec?: number;
    chunkLabel?: string;        // e.g. "Downloading part 1 of 3" or "Merging parts…"
}
