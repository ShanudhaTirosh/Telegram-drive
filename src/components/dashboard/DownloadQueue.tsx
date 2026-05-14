import { DownloadItem } from '../../types';
import { X, RotateCcw, AlertCircle, Download, CheckCircle2, Layers } from 'lucide-react';
import { manifestToDisplayName, isManifestFile } from '../../hooks/useChunkedTransfer';

function formatBytes(bytes: number): string {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

interface DownloadQueueProps {
    items: DownloadItem[];
    onClearFinished: () => void;
    onCancelAll: () => void;
    onCancelItem: (id: string) => void;
    onRetryItem: (id: string) => void;
}

const STATUS_CONFIG = {
    pending:     { dot: '#f59e0b', label: 'Queued' },
    downloading: { dot: '#3b9eff', label: 'Downloading' },
    success:     { dot: '#22c55e', label: 'Done' },
    error:       { dot: '#ef4444', label: 'Error' },
    cancelled:   { dot: '#6b7280', label: 'Cancelled' },
};

export function DownloadQueue({ items, onClearFinished, onCancelAll, onCancelItem, onRetryItem }: DownloadQueueProps) {
    if (items.length === 0) return null;

    const hasPendingOrActive = items.some(i => i.status === 'pending' || i.status === 'downloading');
    const activeCount = items.filter(i => i.status === 'downloading' || i.status === 'pending').length;

    return (
        <div className="queue-panel fixed bottom-4 z-[100]"
             style={{ width: 340, right: items.length > 0 ? 360 : 16 }}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3"
                 style={{ borderBottom: '1px solid rgba(59,158,255,0.1)' }}>
                <div className="flex items-center gap-2">
                    <Download className="w-4 h-4" style={{ color: '#22c55e' }} />
                    <span className="text-sm font-semibold" style={{ color: 'var(--color-telegram-text)' }}>
                        Downloads
                    </span>
                    {activeCount > 0 && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                              style={{ background: 'rgba(34,197,94,0.12)', color: '#22c55e' }}>
                            {activeCount} active
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-3">
                    {hasPendingOrActive && (
                        <button onClick={onCancelAll} className="text-xs transition-colors"
                                style={{ color: '#f87171' }}>
                            Cancel All
                        </button>
                    )}
                    <button onClick={onClearFinished} className="text-xs transition-colors"
                            style={{ color: '#3b9eff' }}>
                        Clear Done
                    </button>
                </div>
            </div>

            {/* Items */}
            <div className="max-h-64 overflow-y-auto p-2 space-y-2">
                {items.map(item => {
                    const cfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;
                    const displayName = isManifestFile(item.filename)
                        ? manifestToDisplayName(item.filename)
                        : item.filename;
                    const isChunked = isManifestFile(item.filename) || !!item.chunkLabel;

                    return (
                        <div key={item.id} className="rounded-xl p-3 space-y-2"
                             style={{ background: 'rgba(34,197,94,0.03)', border: '1px solid rgba(34,197,94,0.07)' }}>
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full flex-shrink-0"
                                     style={{
                                         background: cfg.dot,
                                         boxShadow: item.status === 'downloading' ? `0 0 6px ${cfg.dot}` : 'none',
                                         animation: item.status === 'downloading' ? 'pulse 1.5s infinite' : 'none',
                                     }} />

                                <div className="flex-1 min-w-0">
                                    <div className="text-sm truncate font-medium" style={{ color: 'var(--color-telegram-text)' }} title={displayName}>
                                        {displayName}
                                    </div>
                                    {(isChunked) && (
                                        <div className="flex items-center gap-1 mt-0.5">
                                            <Layers className="w-3 h-3" style={{ color: '#a78bfa' }} />
                                            <span className="text-[11px]" style={{ color: '#a78bfa' }}>
                                                {item.chunkLabel ?? 'Multi-part file'}
                                            </span>
                                        </div>
                                    )}
                                </div>

                                {(item.status === 'downloading' || item.status === 'pending') && (
                                    <button onClick={() => onCancelItem(item.id)}
                                            className="p-1 rounded-lg transition-colors flex-shrink-0"
                                            style={{ color: 'var(--color-telegram-muted)' }}
                                            onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#f87171'}
                                            onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--color-telegram-muted)'}
                                            title="Cancel">
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                )}
                                {item.status === 'success' && <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: '#22c55e' }} />}
                                {(item.status === 'error' || item.status === 'cancelled') && (
                                    <button onClick={() => onRetryItem(item.id)}
                                            className="p-1 rounded-lg transition-colors flex-shrink-0"
                                            style={{ color: 'var(--color-telegram-muted)' }}
                                            onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#3b9eff'}
                                            onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--color-telegram-muted)'}
                                            title="Retry">
                                        <RotateCcw className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>

                            {item.status === 'downloading' && (
                                <>
                                    <div className="queue-progress-bar">
                                        {item.progress !== undefined ? (
                                            <div className="queue-progress-fill" style={{ width: `${item.progress}%`, background: 'linear-gradient(90deg,#22c55e,#10b981)', boxShadow: '0 0 8px rgba(34,197,94,0.5)' }} />
                                        ) : (
                                            <div className="queue-progress-fill animate-progress-indeterminate" style={{ width: '40%', background: 'linear-gradient(90deg,transparent,rgba(34,197,94,0.8),transparent)' }} />
                                        )}
                                    </div>
                                    <div className="flex justify-between text-[11px]" style={{ color: 'var(--color-telegram-muted)' }}>
                                        <span>
                                            {item.uploadedBytes !== undefined && item.totalBytes !== undefined
                                                ? `${formatBytes(item.uploadedBytes)} / ${formatBytes(item.totalBytes)}`
                                                : item.progress !== undefined ? `${item.progress}%` : 'Preparing…'}
                                        </span>
                                        <span>
                                            {item.speedBytesPerSec !== undefined && item.speedBytesPerSec > 0
                                                ? `${formatBytes(item.speedBytesPerSec)}/s` : ''}
                                        </span>
                                    </div>
                                </>
                            )}

                            {item.status === 'error' && item.error && (
                                <div className="flex items-start gap-1.5 text-xs rounded-lg px-2 py-1.5"
                                     style={{ background: 'rgba(239,68,68,0.07)', color: '#f87171' }}>
                                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                                    <span className="break-all">{item.error}</span>
                                </div>
                            )}
                            {item.status === 'cancelled' && (
                                <div className="text-[11px]" style={{ color: 'var(--color-telegram-muted)' }}>Download cancelled</div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
