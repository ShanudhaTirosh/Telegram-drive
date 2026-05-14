import { HardDrive, LayoutGrid, List, Sun, Moon, Settings, Search, Move, Download, Trash2 } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

interface TopBarProps {
    currentFolderName: string;
    selectedIds: number[];
    onShowMoveModal: () => void;
    onBulkDownload: () => void;
    onBulkDelete: () => void;
    onDownloadFolder: () => void;
    viewMode: 'grid' | 'list';
    setViewMode: (mode: 'grid' | 'list') => void;
    searchTerm: string;
    onSearchChange: (term: string) => void;
    onSettingsClick: () => void;
}

export function TopBar({
    currentFolderName, selectedIds, onShowMoveModal, onBulkDownload, onBulkDelete,
    onDownloadFolder, viewMode, setViewMode, searchTerm, onSearchChange, onSettingsClick
}: TopBarProps) {
    const { theme, toggleTheme } = useTheme();

    return (
        <header
            className="topbar-container h-14 flex items-center px-4 gap-3 sticky top-0 z-10"
            onClick={e => e.stopPropagation()}
        >
            {/* Breadcrumb */}
            <div className="flex items-center gap-1.5 text-sm min-w-0 flex-shrink-0">
                <span style={{ color: 'var(--color-telegram-muted)' }} className="text-xs">Drive</span>
                <span style={{ color: 'var(--color-telegram-muted)' }} className="text-xs">/</span>
                <span className="font-semibold text-sm truncate max-w-[120px]" style={{ color: 'var(--color-telegram-text)' }}>
                    {currentFolderName}
                </span>
            </div>

            {/* Bulk actions (animated in when files selected) */}
            {selectedIds.length > 0 && (
                <div
                    className="flex items-center gap-2 px-3 py-1.5 rounded-xl flex-shrink-0"
                    style={{ background: 'rgba(59,158,255,0.07)', border: '1px solid rgba(59,158,255,0.15)' }}
                >
                    <span className="text-xs font-semibold" style={{ color: '#3b9eff' }}>
                        {selectedIds.length} selected
                    </span>
                    <div className="w-px h-3 bg-white/10" />
                    <button
                        onClick={onShowMoveModal}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-all hover:bg-white/10"
                        style={{ color: 'var(--color-telegram-subtext)' }}
                        title="Move"
                    >
                        <Move className="w-3.5 h-3.5" />
                        Move
                    </button>
                    <button
                        onClick={onBulkDownload}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-all hover:bg-white/10"
                        style={{ color: 'var(--color-telegram-subtext)' }}
                        title="Download selected"
                    >
                        <Download className="w-3.5 h-3.5" />
                        Download
                    </button>
                    <button
                        onClick={onBulkDelete}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-all"
                        style={{ color: '#f87171' }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.1)'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                        title="Delete selected"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete
                    </button>
                </div>
            )}

            {/* Search */}
            <div className="flex-1 relative min-w-0 max-w-sm mx-auto">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: 'var(--color-telegram-muted)' }} />
                <input
                    type="text"
                    placeholder="Search files…"
                    className="topbar-search pl-9 text-sm"
                    value={searchTerm}
                    onChange={e => onSearchChange(e.target.value)}
                />
            </div>

            {/* Right icons */}
            <div className="flex items-center gap-1 flex-shrink-0">
                <Tooltip label="Download Folder">
                    <button onClick={onDownloadFolder} className="topbar-icon-btn">
                        <HardDrive className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} />
                    </button>
                </Tooltip>

                <Tooltip label={viewMode === 'grid' ? 'List View' : 'Grid View'}>
                    <button onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')} className="topbar-icon-btn">
                        {viewMode === 'grid'
                            ? <List style={{ width: 18, height: 18 }} />
                            : <LayoutGrid style={{ width: 18, height: 18 }} />
                        }
                    </button>
                </Tooltip>

                <div className="w-px h-5 mx-1" style={{ background: 'var(--color-telegram-border)' }} />

                <Tooltip label="Settings">
                    <button onClick={onSettingsClick} className="topbar-icon-btn">
                        <Settings style={{ width: 18, height: 18 }} />
                    </button>
                </Tooltip>

                <Tooltip label={theme === 'dark' ? 'Light Mode' : 'Dark Mode'}>
                    <button onClick={toggleTheme} className="topbar-icon-btn">
                        {theme === 'dark' ? <Sun style={{ width: 18, height: 18 }} /> : <Moon style={{ width: 18, height: 18 }} />}
                    </button>
                </Tooltip>
            </div>
        </header>
    );
}

function Tooltip({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="relative group">
            {children}
            <div className="tooltip absolute -bottom-9 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none">
                {label}
            </div>
        </div>
    );
}
