import { X, Github, Globe, MessageCircle, Mail, Phone, MapPin, Code2, Shield, Layers } from 'lucide-react';

interface AboutModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function AboutModal({ isOpen, onClose }: AboutModalProps) {
    if (!isOpen) return null;

    const openLink = (url: string) => {
        import('@tauri-apps/plugin-shell').then(({ open }) => open(url)).catch(() => {
            window.open(url, '_blank');
        });
    };

    return (
        <div
            className="fixed inset-0 z-[200] flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
            onClick={onClose}
        >
            <div
                className="about-modal relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl"
                onClick={e => e.stopPropagation()}
                style={{
                    background: 'rgba(15, 23, 35, 0.95)',
                    border: '1px solid rgba(99, 179, 237, 0.2)',
                    backdropFilter: 'blur(24px)',
                }}
            >
                {/* Header gradient bar */}
                <div className="about-header-gradient rounded-t-2xl p-6 pb-8 relative overflow-hidden">
                    <div className="about-glow-orb" />
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-all z-10"
                    >
                        <X className="w-5 h-5" />
                    </button>

                    {/* App logo + title */}
                    <div className="flex flex-col items-center text-center gap-3 relative z-10">
                        <div className="about-icon-ring w-16 h-16 rounded-2xl flex items-center justify-center">
                            <img src="/logo.svg" className="w-10 h-10 drop-shadow-lg" alt="Logo" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-white tracking-tight">Telegram Drive</h1>
                            <p className="text-sm text-blue-300/80 mt-0.5">Secure Cloud Storage via Telegram</p>
                        </div>

                        {/* Feature badges */}
                        <div className="flex flex-wrap gap-2 justify-center mt-1">
                            {[
                                { icon: Shield, label: 'End-to-End via Telegram' },
                                { icon: Layers, label: 'Auto-Chunking >2 GB' },
                                { icon: Code2, label: 'Open Source' },
                            ].map(({ icon: Icon, label }) => (
                                <span key={label} className="about-badge flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium">
                                    <Icon className="w-3 h-3" />
                                    {label}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Developer info card */}
                <div className="p-6 space-y-5">
                    <div className="about-card rounded-xl p-5">
                        <div className="flex items-start gap-4">
                            {/* Avatar placeholder */}
                            <div className="about-avatar-ring w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0 text-xl font-bold text-white">
                                ST
                            </div>
                            <div className="flex-1 min-w-0">
                                <h2 className="text-base font-bold text-white">Shanudha Tirosh</h2>
                                <p className="text-sm text-blue-400 font-medium">@ShanudhaTirosh</p>
                                <p className="text-xs text-white/50 mt-0.5 flex items-center gap-1">
                                    <MapPin className="w-3 h-3" />
                                    Sri Lanka · ShanuFx
                                </p>
                            </div>
                        </div>

                        <p className="mt-4 text-sm text-white/65 leading-relaxed">
                            Student developer &amp; frontend engineer from Sri Lanka specialising in web applications,
                            desktop utilities, and modern UI/UX systems under the <span className="text-blue-400 font-medium">ShanuFx</span> brand.
                            Skilled in HTML, CSS, JavaScript, Python, Java, C++ and more.
                        </p>
                    </div>

                    {/* Contact links */}
                    <div>
                        <h3 className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-3 px-1">Contact &amp; Links</h3>
                        <div className="grid grid-cols-1 gap-2">
                            {[
                                {
                                    icon: Mail,
                                    label: 'Email',
                                    value: 'Tiroshbrot123@gmail.com',
                                    href: 'mailto:Tiroshbrot123@gmail.com',
                                    color: 'text-red-400',
                                    bg: 'rgba(239,68,68,0.1)',
                                },
                                {
                                    icon: Phone,
                                    label: 'WhatsApp',
                                    value: '+94 76 574 9332',
                                    href: 'https://wa.me/94765749332',
                                    color: 'text-green-400',
                                    bg: 'rgba(34,197,94,0.1)',
                                },
                                {
                                    icon: Github,
                                    label: 'GitHub',
                                    value: 'ShanudhaTirosh',
                                    href: 'https://github.com/ShanudhaTirosh',
                                    color: 'text-white',
                                    bg: 'rgba(255,255,255,0.07)',
                                },
                                {
                                    icon: MessageCircle,
                                    label: 'Discord',
                                    value: 'ShanuFx Community',
                                    href: 'https://discord.gg/B2CWJpKk',
                                    color: 'text-indigo-400',
                                    bg: 'rgba(99,102,241,0.1)',
                                },
                                {
                                    icon: Globe,
                                    label: 'Website',
                                    value: 'shanu-fx.web.app',
                                    href: 'https://shanu-fx.web.app',
                                    color: 'text-cyan-400',
                                    bg: 'rgba(6,182,212,0.1)',
                                },
                            ].map(({ icon: Icon, label, value, href, color, bg }) => (
                                <button
                                    key={label}
                                    onClick={() => openLink(href)}
                                    className="about-link-row flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all group"
                                    style={{ background: bg }}
                                >
                                    <div className={`flex-shrink-0 ${color}`}>
                                        <Icon className="w-4 h-4" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <span className="text-xs text-white/40 block leading-none mb-0.5">{label}</span>
                                        <span className={`text-sm font-medium ${color} truncate block group-hover:underline`}>{value}</span>
                                    </div>
                                    <svg className="w-4 h-4 text-white/20 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* App purpose */}
                    <div className="about-purpose-box rounded-xl p-4">
                        <h3 className="text-xs font-semibold text-cyan-400/80 uppercase tracking-widest mb-2">Application Purpose</h3>
                        <p className="text-xs text-white/55 leading-relaxed">
                            Telegram Drive is designed as a secure desktop cloud-storage utility that uses the Telegram API
                            for file management, synchronisation, and remote storage access — with a modern UI optimised for
                            productivity and speed. Files larger than 2 GB are automatically split and transparently
                            reassembled on download, working around Telegram's account limits.
                        </p>
                    </div>

                    {/* Version footer */}
                    <div className="flex items-center justify-between text-xs text-white/25 pt-1 border-t border-white/5">
                        <span>Telegram Drive v1.4.0</span>
                        <span>© 2024 ShanuFx · Shanudha Tirosh</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
