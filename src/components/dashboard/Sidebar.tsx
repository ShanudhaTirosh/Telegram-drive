import { useState } from 'react';
import { HardDrive, Folder, Plus, RefreshCw, LogOut, Info, ChevronRight } from 'lucide-react';
import { SidebarItem } from './SidebarItem';
import { BandwidthWidget } from './BandwidthWidget';
import { TelegramFolder, BandwidthStats } from '../../types';

interface SidebarProps {
    folders: TelegramFolder[];
    activeFolderId: number | null;
    setActiveFolderId: (id: number | null) => void;
    onDrop: (e: React.DragEvent, folderId: number | null) => void;
    onDelete: (id: number, name: string) => void;
    onCreate: (name: string) => Promise<void>;
    isSyncing: boolean;
    isConnected: boolean;
    onSync: () => void;
    onLogout: () => void;
    onAbout: () => void;
    bandwidth: BandwidthStats | null;
}

export function Sidebar({
    folders, activeFolderId, setActiveFolderId, onDrop, onDelete, onCreate,
    isSyncing, isConnected, onSync, onLogout, onAbout, bandwidth
}: SidebarProps) {
    const [showNewFolderInput, setShowNewFolderInput] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');

    const submitCreate = async () => {
        if (!newFolderName.trim()) return;
        try {
            await onCreate(newFolderName);
            setNewFolderName('');
            setShowNewFolderInput(false);
        } catch { /* handled by parent */ }
    };

    return (
        <aside
            className="sidebar-container w-64 flex flex-col select-none"
            onClick={e => e.stopPropagation()}
        >
            {/* Logo area */}
            <div className="sidebar-logo-area px-4 py-4 flex items-center gap-3">
                <div className="relative">
                    <div className="w-9 h-9 rounded-xl overflow-hidden flex items-center justify-center"
                         style={{ background: 'linear-gradient(135deg, rgba(59,158,255,0.2), rgba(124,58,237,0.15))', border: '1px solid rgba(59,158,255,0.25)' }}>
                        <img src="/logo.svg" className="w-6 h-6 drop-shadow" alt="Logo" />
                    </div>
                </div>
                <div>
                    <span className="font-bold text-base tracking-tight" style={{ color: 'var(--color-telegram-text)' }}>
                        Telegram Drive
                    </span>
                    <div className="text-[10px] font-medium" style={{ color: 'var(--color-telegram-muted)', letterSpacing: '0.05em' }}>
                        by ShanuFx
                    </div>
                </div>
            </div>

            {/* Folder list */}
            <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto min-h-0">
                <div className="px-2 pb-2 pt-1">
                    <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--color-telegram-muted)' }}>
                        Storage
                    </span>
                </div>

                <SidebarItem
                    icon={HardDrive}
                    label="Saved Messages"
                    active={activeFolderId === null}
                    onClick={() => setActiveFolderId(null)}
                    onDrop={(e: React.DragEvent) => onDrop(e, null)}
                    folderId={null}
                />

                {folders.length > 0 && (
                    <div className="px-2 pb-1 pt-3">
                        <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--color-telegram-muted)' }}>
                            Folders
                        </span>
                    </div>
                )}

                {folders.map(folder => (
                    <SidebarItem
                        key={folder.id}
                        icon={Folder}
                        label={folder.name}
                        active={activeFolderId === folder.id}
                        onClick={() => setActiveFolderId(folder.id)}
                        onDrop={(e: React.DragEvent) => onDrop(e, folder.id)}
                        onDelete={() => onDelete(folder.id, folder.name)}
                        folderId={folder.id}
                    />
                ))}
            </nav>

            {/* Create Folder */}
            <div className="px-3 pb-2 border-t" style={{ borderColor: 'var(--color-telegram-border)' }}>
                <div className="pt-2">
                    {showNewFolderInput ? (
                        <div className="px-1 py-1">
                            <input
                                autoFocus
                                type="text"
                                className="w-full rounded-xl px-3 py-2 text-sm focus:outline-none"
                                style={{
                                    background: 'rgba(59,158,255,0.07)',
                                    border: '1px solid rgba(59,158,255,0.25)',
                                    color: 'var(--color-telegram-text)',
                                }}
                                placeholder="Folder name…"
                                value={newFolderName}
                                onChange={e => setNewFolderName(e.target.value)}
                                onKeyDown={e => {
                                    if (e.key === 'Enter') submitCreate();
                                    if (e.key === 'Escape') { setShowNewFolderInput(false); setNewFolderName(''); }
                                }}
                                onBlur={() => !newFolderName && setShowNewFolderInput(false)}
                            />
                        </div>
                    ) : (
                        <button
                            onClick={() => setShowNewFolderInput(true)}
                            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all"
                            style={{
                                color: 'var(--color-telegram-subtext)',
                                border: '1px dashed rgba(59,158,255,0.2)',
                                background: 'transparent',
                            }}
                            onMouseEnter={e => {
                                (e.currentTarget as HTMLElement).style.background = 'rgba(59,158,255,0.06)';
                                (e.currentTarget as HTMLElement).style.color = 'var(--color-telegram-primary)';
                            }}
                            onMouseLeave={e => {
                                (e.currentTarget as HTMLElement).style.background = 'transparent';
                                (e.currentTarget as HTMLElement).style.color = 'var(--color-telegram-subtext)';
                            }}
                        >
                            <Plus className="w-4 h-4" />
                            New Folder
                        </button>
                    )}
                </div>
            </div>

            {/* Footer */}
            <div className="px-3 pb-3 pt-2 space-y-3" style={{ borderTop: '1px solid var(--color-telegram-border)' }}>
                {/* Connection status */}
                <div className="flex items-center gap-2 px-1 pt-2">
                    <div className={isConnected ? 'status-dot-connected' : 'status-dot-disconnected'} />
                    <span className="text-xs" style={{ color: 'var(--color-telegram-subtext)' }}>
                        {isConnected ? 'Connected to Telegram' : 'Disconnected'}
                    </span>
                </div>

                {/* Bandwidth */}
                {bandwidth && (
                    <div className="bandwidth-widget px-3 py-2">
                        <BandwidthWidget bandwidth={bandwidth} />
                    </div>
                )}

                {/* Action buttons */}
                <div className="grid grid-cols-2 gap-2">
                    <button
                        onClick={onSync}
                        disabled={isSyncing}
                        className="flex items-center justify-center gap-1.5 px-2 py-2 rounded-xl text-xs font-medium transition-all"
                        style={{
                            background: 'rgba(59,158,255,0.08)',
                            color: '#3b9eff',
                            border: '1px solid rgba(59,158,255,0.15)',
                            opacity: isSyncing ? 0.6 : 1,
                        }}
                        title="Scan for existing folders"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                        {isSyncing ? 'Syncing' : 'Sync'}
                    </button>
                    <button
                        onClick={onLogout}
                        className="flex items-center justify-center gap-1.5 px-2 py-2 rounded-xl text-xs font-medium transition-all"
                        style={{
                            background: 'rgba(239,68,68,0.08)',
                            color: '#f87171',
                            border: '1px solid rgba(239,68,68,0.15)',
                        }}
                        title="Sign Out"
                    >
                        <LogOut className="w-3.5 h-3.5" />
                        Logout
                    </button>
                </div>

                {/* About button */}
                <button
                    onClick={onAbout}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-all"
                    style={{
                        background: 'rgba(124,58,237,0.07)',
                        color: 'var(--color-telegram-subtext)',
                        border: '1px solid rgba(124,58,237,0.12)',
                    }}
                    onMouseEnter={e => {
                        (e.currentTarget as HTMLElement).style.background = 'rgba(124,58,237,0.12)';
                        (e.currentTarget as HTMLElement).style.color = '#a78bfa';
                    }}
                    onMouseLeave={e => {
                        (e.currentTarget as HTMLElement).style.background = 'rgba(124,58,237,0.07)';
                        (e.currentTarget as HTMLElement).style.color = 'var(--color-telegram-subtext)';
                    }}
                >
                    <span className="flex items-center gap-2">
                        <Info className="w-3.5 h-3.5" />
                        About &amp; Developer
                    </span>
                    <ChevronRight className="w-3 h-3 opacity-50" />
                </button>
            </div>
        </aside>
    );
}
