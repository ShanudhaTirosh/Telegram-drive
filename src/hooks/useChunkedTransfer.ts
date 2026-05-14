/**
 * useChunkedTransfer.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Handles automatic splitting of large files (>2 GB) before Telegram upload
 * and transparent reassembly after download.
 *
 * ═══════════ REQUIRED RUST BACKEND COMMANDS ═══════════════════════════════
 * The following Tauri commands must be implemented in src-tauri/src/main.rs:
 *
 *   #[tauri::command]
 *   async fn cmd_get_file_size(path: String) -> Result<u64, String>
 *     — Returns the file size in bytes without loading the file into memory.
 *
 *   #[tauri::command]
 *   async fn cmd_split_file(path: String, chunk_size_bytes: u64) -> Result<Vec<String>, String>
 *     — Splits the file at `path` into sequential chunks of `chunk_size_bytes`.
 *     — Writes chunks to the OS temp directory as <filename>.chunk001, .chunk002 …
 *     — Returns a Vec of absolute paths to the created chunk files.
 *
 *   #[tauri::command]
 *   async fn cmd_merge_chunks(chunk_paths: Vec<String>, output_path: String) -> Result<(), String>
 *     — Concatenates `chunk_paths` (in order) into `output_path`.
 *     — Performs SHA-256 verification if a checksum is provided in the manifest.
 *
 *   #[tauri::command]
 *   async fn cmd_delete_temp_files(paths: Vec<String>) -> Result<(), String>
 *     — Deletes each path; ignores files that are already gone.
 *
 *   #[tauri::command]
 *   async fn cmd_write_temp_text_file(content: String) -> Result<String, String>
 *     — Writes `content` to a unique temp file and returns its absolute path.
 *     — Used to materialise the JSON manifest before uploading it to Telegram.
 *
 *   #[tauri::command]
 *   async fn cmd_read_text_file(path: String) -> Result<String, String>
 *     — Reads the full contents of `path` as a UTF-8 string.
 *     — Used to read downloaded manifests before merging chunks.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * CHUNK NAMING CONVENTION (files uploaded to Telegram)
 *   original.zip → original.zip.__tgchunk__001of003
 *                   original.zip.__tgchunk__002of003
 *                   original.zip.__tgchunk__003of003
 *                   original.zip.__tgmanifest__   (small JSON file)
 *
 * FILES HIDDEN FROM THE UI
 *   Any file whose name contains ".__tgchunk__" or ends with ".__tgmanifest__"
 *   is hidden in FileExplorer so the user only sees logical, unified files.
 *
 * MANIFEST FORMAT (JSON uploaded as .__tgmanifest__)
 * {
 *   "version": 1,
 *   "original_name": "bigfile.zip",
 *   "original_size": 3000000000,
 *   "chunk_count": 2,
 *   "chunk_size": 1900000000,
 *   "chunks": [
 *     { "name": "bigfile.zip.__tgchunk__001of002", "message_id": 1234, "size": 1900000000 },
 *     { "name": "bigfile.zip.__tgchunk__002of002", "message_id": 1235, "size": 1100000000 }
 *   ],
 *   "created_at": "2024-01-01T00:00:00.000Z"
 * }
 */

import { invoke } from '@tauri-apps/api/core';

// ─── Constants ────────────────────────────────────────────────────────────────
/** 1.9 GB in bytes – safely below Telegram's 2 GB account limit */
export const CHUNK_SIZE_BYTES = 1_900_000_000;

/** Sentinel suffix appended to each chunk file name uploaded to Telegram */
export const CHUNK_SUFFIX = '.__tgchunk__';

/** Suffix for the JSON manifest file uploaded to Telegram */
export const MANIFEST_SUFFIX = '.__tgmanifest__';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface ChunkEntry {
    name: string;
    message_id: number;
    size: number;
}

export interface ChunkManifest {
    version: 1;
    original_name: string;
    original_size: number;
    chunk_count: number;
    chunk_size: number;
    chunks: ChunkEntry[];
    created_at: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns the display name for a manifest file.
 * e.g.  "bigfile.zip.__tgmanifest__"  →  "bigfile.zip"
 */
export function manifestToDisplayName(manifestFileName: string): string {
    return manifestFileName.endsWith(MANIFEST_SUFFIX)
        ? manifestFileName.slice(0, -MANIFEST_SUFFIX.length)
        : manifestFileName;
}

/** True if this file name is an internal chunk and should be hidden from the UI */
export function isChunkFile(name: string): boolean {
    return name.includes(CHUNK_SUFFIX);
}

/** True if this file name is a manifest (displayed as the assembled logical file) */
export function isManifestFile(name: string): boolean {
    return name.endsWith(MANIFEST_SUFFIX);
}

/** Build the chunk suffix for chunk index `i` of `total` (1-indexed, zero-padded) */
function chunkSuffix(i: number, total: number): string {
    const pad = (n: number) => n.toString().padStart(3, '0');
    return `${CHUNK_SUFFIX}${pad(i)}of${pad(total)}`;
}

/** Build the Telegram display-name for chunk i */
export function buildChunkName(originalName: string, i: number, total: number): string {
    return `${originalName}${chunkSuffix(i, total)}`;
}

/** Build the Telegram display-name for the manifest */
export function buildManifestName(originalName: string): string {
    return `${originalName}${MANIFEST_SUFFIX}`;
}

// ─── Core API wrappers ────────────────────────────────────────────────────────

/** Returns the byte-size of the file at `path` without loading it. */
export async function getFileSize(path: string): Promise<number> {
    return invoke<number>('cmd_get_file_size', { path });
}

/**
 * Splits the file at `path` into chunks of `chunkSizeBytes`.
 * Returns the absolute paths of the temporary chunk files created on disk.
 */
export async function splitFile(path: string, chunkSizeBytes: number = CHUNK_SIZE_BYTES): Promise<string[]> {
    return invoke<string[]>('cmd_split_file', { path, chunkSizeBytes });
}

/**
 * Concatenates `chunkPaths` (in order) into `outputPath`.
 * Runs integrity verification internally.
 */
export async function mergeChunks(chunkPaths: string[], outputPath: string): Promise<void> {
    return invoke<void>('cmd_merge_chunks', { chunkPaths, outputPath });
}

/** Deletes a list of temporary files; silently ignores missing files. */
export async function deleteTempFiles(paths: string[]): Promise<void> {
    return invoke<void>('cmd_delete_temp_files', { paths });
}

/**
 * Writes `content` to a unique temp file on disk and returns its path.
 * Used to materialise the JSON manifest before it is uploaded to Telegram.
 */
export async function writeTempTextFile(content: string): Promise<string> {
    return invoke<string>('cmd_write_temp_text_file', { content });
}

/**
 * Reads the full UTF-8 contents of a local file.
 * Used to read a downloaded manifest before merging chunks.
 */
export async function readTextFile(path: string): Promise<string> {
    return invoke<string>('cmd_read_text_file', { path });
}

// ─── Upload helpers ───────────────────────────────────────────────────────────

/**
 * Checks whether `filePath` is large enough to require chunking.
 * Returns the file size; callers should chunk when size > CHUNK_SIZE_BYTES.
 */
export async function shouldChunk(filePath: string): Promise<{ needsChunk: boolean; size: number }> {
    try {
        const size = await getFileSize(filePath);
        return { needsChunk: size > CHUNK_SIZE_BYTES, size };
    } catch {
        // If we can't read the size, proceed without chunking (safe fallback)
        return { needsChunk: false, size: 0 };
    }
}

/**
 * Prepares a large file for chunked upload.
 * Returns the temporary chunk paths and the serialised manifest JSON.
 *
 * The caller is responsible for:
 *   1. Uploading each chunk path via cmd_upload_file and collecting the returned message IDs.
 *   2. Building the final manifest with those message IDs.
 *   3. Uploading the manifest JSON file via writeTempTextFile + cmd_upload_file.
 *   4. Calling deleteTempFiles(chunkPaths) when all uploads succeed.
 */
export async function prepareChunkedUpload(
    filePath: string,
    _originalSize: number,
): Promise<{ chunkPaths: string[]; originalName: string; chunkCount: number }> {
    const chunkPaths = await splitFile(filePath, CHUNK_SIZE_BYTES);
    const originalName = filePath.split(/[/\\]/).pop() ?? filePath;
    return {
        chunkPaths,
        originalName,
        chunkCount: chunkPaths.length,
    };
}

/**
 * Serialises a manifest object to JSON for storage/upload.
 */
export function buildManifestJson(manifest: ChunkManifest): string {
    return JSON.stringify(manifest, null, 2);
}

/**
 * Parses a manifest JSON string (as read from a downloaded manifest file).
 */
export function parseManifest(json: string): ChunkManifest {
    const data = JSON.parse(json);
    if (data.version !== 1) throw new Error(`Unsupported manifest version: ${data.version}`);
    return data as ChunkManifest;
}
