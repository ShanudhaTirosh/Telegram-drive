import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { load } from "@tauri-apps/plugin-store";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthWizard } from "./components/AuthWizard";
import { Dashboard } from "./components/Dashboard";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { UpdateBanner } from "./components/UpdateBanner";
import { useUpdateCheck } from "./hooks/useUpdateCheck";
import "./App.css";

import { Toaster } from "sonner";
import { ConfirmProvider } from "./context/ConfirmContext";
import { ThemeProvider, useTheme } from "./context/ThemeContext";
import { SettingsProvider } from "./context/SettingsContext";
import { DropZoneProvider } from "./contexts/DropZoneContext";

const queryClient = new QueryClient();

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

function AppContent() {
  const [authStatus, setAuthStatus] = useState<AuthStatus>("loading");
  const { theme } = useTheme();
  const { available, version, downloading, progress, downloadAndInstall, dismissUpdate } = useUpdateCheck();

  // On mount: check for a saved session and auto-restore it.
  // This is the SINGLE source of truth for the initial connection.
  // useTelegramConnection (inside Dashboard) no longer calls cmd_connect on mount.
  useEffect(() => {
    const checkSession = async () => {
      try {
        const store = await load("config.json");
        const savedId = await store.get<string>("api_id");

        if (!savedId) {
          setAuthStatus("unauthenticated");
          return;
        }

        const apiId = parseInt(savedId, 10);
        if (isNaN(apiId)) {
          setAuthStatus("unauthenticated");
          return;
        }

        // Initialize the client with the saved API ID
        await invoke("cmd_connect", { apiId });

        // Verify the session is still valid with Telegram servers
        const ok = await invoke<boolean>("cmd_check_connection");
        if (ok) {
          setAuthStatus("authenticated");
        } else {
          setAuthStatus("unauthenticated");
        }
      } catch (err) {
        console.warn("Session restore failed, showing login:", err);
        // Session file is corrupt or revoked — clean up and show login
        try {
          const store = await load("config.json");
          await store.delete("api_id");
          await store.save();
        } catch {
          // best-effort cleanup
        }
        setAuthStatus("unauthenticated");
      }
    };

    checkSession();
  }, []);

  // Styled splash screen while verifying the session
  if (authStatus === "loading") {
    return (
      <main style={{ height:'100vh', width:'100vw', display:'flex', alignItems:'center', justifyContent:'center', background:'#080d14' }}>
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'1.25rem' }}>
          <div style={{
            width:64, height:64, borderRadius:20, display:'flex', alignItems:'center', justifyContent:'center',
            background:'linear-gradient(135deg,rgba(59,158,255,0.2),rgba(124,58,237,0.15))',
            border:'1px solid rgba(59,158,255,0.25)',
            boxShadow:'0 0 32px rgba(59,158,255,0.2)',
            animation:'pulse 2s infinite',
          }}>
            <img src="/logo.svg" style={{ width:36, height:36 }} alt="Logo" />
          </div>
          <div style={{ textAlign:'center' }}>
            <div style={{ fontSize:16, fontWeight:700, color:'#e8f0fe', letterSpacing:'-0.02em' }}>Telegram Drive</div>
            <div style={{ fontSize:12, color:'#6b85a3', marginTop:4, letterSpacing:'0.04em' }}>Restoring session…</div>
          </div>
          <div style={{ width:180, height:2, borderRadius:99, background:'rgba(59,158,255,0.1)', overflow:'hidden' }}>
            <div style={{
              height:'100%', width:'40%', borderRadius:99,
              background:'linear-gradient(90deg,#3b9eff,#00d4ff)',
              animation:'progress-indeterminate 1.5s infinite linear',
              boxShadow:'0 0 8px rgba(59,158,255,0.6)',
            }} />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="h-screen w-screen text-telegram-text overflow-hidden selection:bg-telegram-primary/30 relative">
      <UpdateBanner
        available={available}
        version={version}
        downloading={downloading}
        progress={progress}
        onUpdate={downloadAndInstall}
        onDismiss={dismissUpdate}
      />
      <Toaster theme={theme} position="bottom-center" />
      {authStatus === "authenticated" ? (
        <Dashboard onLogout={() => setAuthStatus("unauthenticated")} />
      ) : (
        <AuthWizard onLogin={() => setAuthStatus("authenticated")} />
      )}
    </main>
  );
}


function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <ConfirmProvider>
            <SettingsProvider>
              <DropZoneProvider>
                <AppContent />
              </DropZoneProvider>
            </SettingsProvider>
          </ConfirmProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
