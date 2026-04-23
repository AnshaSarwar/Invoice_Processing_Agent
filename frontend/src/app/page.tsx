"use client";

import { useEffect, useState, useCallback, useRef } from 'react';
import { api, ProcessingLog, Stats, User } from './api';

// Components
import AuthCard from './components/AuthCard';
import StatsCards from './components/StatsCards';
import UploadZone from './components/UploadZone';
import AIStreamMonitor from './components/AIStreamMonitor';
import LogViewer from './components/LogViewer';
import DebuggerDrawer from './components/DebuggerDrawer';
import UserManager from './components/UserManager';
import PDFPreview from './components/PDFPreview';

interface StreamEvent {
  node: string;
  status: string;
  update?: any;
  reason?: string;
}

type TabId = 'dashboard' | 'history' | 'users';

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [logs, setLogs] = useState<ProcessingLog[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<StreamEvent | null>(null);

  const [activeFileUrl, setActiveFileUrl] = useState<string | null>(null);
  const [activeFileName, setActiveFileName] = useState<string | null>(null);

  const [streamEvents, setStreamEvents] = useState<StreamEvent[]>([]);
  const activeTaskIdRef = useRef<string | null>(null);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isPDFModalOpen, setIsPDFModalOpen] = useState(false);

  const handleFilePreview = (file: File) => {
    if (activeFileUrl) URL.revokeObjectURL(activeFileUrl);
    setActiveFileUrl(URL.createObjectURL(file));
    setActiveFileName(file.name);
  };

  // ── Session Restore ──────────────────────────────────────────
  useEffect(() => {
    const savedUser = localStorage.getItem('invosync_user');
    if (savedUser) {
      try { setUser(JSON.parse(savedUser)); } catch { /* ignore corrupt data */ }
    }
  }, []);

  const handleAuthSuccess = (userData: User) => {
    setUser(userData);
    localStorage.setItem('invosync_user', JSON.stringify(userData));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('invosync_user');
    setActiveTab('dashboard');
    setLogs([]);
    setStats(null);
    setStreamEvents([]);
  };

  // ── Data Fetching ────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    if (!user) return;
    try {
      const [newLogs, newStats] = await Promise.all([
        api.getLogs(user, 50),
        api.getStats(user).catch(() => null),
      ]);
      setLogs(newLogs || []);
      if (newStats) setStats(newStats);
    } catch (e) {
      console.error("Fetch error:", e);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    
    const es = api.globalStream(user);

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.node === 'system' || data.node === 'heartbeat') return;

        if (data.task_id && data.task_id !== activeTaskIdRef.current) {
          activeTaskIdRef.current = data.task_id;
          setActiveTaskId(data.task_id);
          setStreamEvents([]);
          setIsStreaming(true);
        }

        if (data.node === 'end' || data.node === 'error') {
          setStreamEvents((prev) => [...prev, data]);
          setIsStreaming(false);
          fetchData();
        } else {
          setStreamEvents((prev) => [...prev, data]);
          setIsStreaming(true);
        }
      } catch (err) {}
    };

    return () => es.close();
  }, [user, fetchData]);

  useEffect(() => {
    if (!user) return;
    fetchData();
    const interval = setInterval(() => {
      if (!isStreaming) fetchData();
    }, 10000);
    return () => clearInterval(interval);
  }, [isStreaming, user, fetchData]);

  const handleDelete = async (id: number) => {
    if (!user || !confirm("Delete this log entry?")) return;
    try {
      await api.deleteLog(id, user);
      fetchData();
    } catch (e: any) {
      alert("Error: " + e.message);
    }
  };

  const isAdmin = user?.role === 'Admin';
  const isOperator = user?.role === 'Operator';
  const canUpload = isOperator;

  const getTabs = (): { id: TabId; label: string; icon: string }[] => {
    const tabs: { id: TabId; label: string; icon: string }[] = [
      { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    ];
    if (isAdmin) tabs.push({ id: 'history', label: 'History', icon: '📋' });
    if (isAdmin) tabs.push({ id: 'users', label: 'Users', icon: '👥' });
    return tabs;
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center p-6">
        <AuthCard onAuthSuccess={handleAuthSuccess} />
      </div>
    );
  }

  const roleBadgeColor = isAdmin ? 'text-red-400' : 'text-blue-400';

  return (
    <div className="relative min-h-screen bg-[var(--background)] text-[var(--foreground)] transition-all duration-500 font-sans">
      {/* ── PDF MODAL ────────────────────────────────────────── */}
      {isPDFModalOpen && activeFileUrl && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/90 backdrop-blur-3xl animate-in fade-in duration-500">
          <div className="relative w-full max-w-6xl h-full bg-[var(--background)] rounded-[3rem] overflow-hidden border border-zinc-200 shadow-[0_0_100px_rgba(0,0,0,0.2)]">
            <div className="absolute top-8 right-8 z-[110]">
              <button 
                onClick={() => setIsPDFModalOpen(false)}
                className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-white hover:bg-white/10 transition-all border border-white/10"
              >
                ✕
              </button>
            </div>
            <div className="w-full h-full p-8">
              <PDFPreview url={activeFileUrl} fileName={activeFileName} />
            </div>
          </div>
        </div>
      )}

      <div className="container mx-auto px-6 py-12 max-w-5xl">
        {/* ── Header ──────────────────────────────────────────── */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-16 gap-6">
          <div>
            <h1 className="text-2xl font-black tracking-tight uppercase italic mb-1"
                style={{ background: 'linear-gradient(to right, #60a5fa, #a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              InvoSync
            </h1>
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400">
              <span>{user.username}</span>
              <span className="w-1 h-1 rounded-full bg-zinc-200" />
              <span className={roleBadgeColor}>{user.role}</span>
            </div>
          </div>

          <div className="flex items-center gap-6">
            {!isAdmin && (
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500 hover:text-blue-600 transition-colors flex items-center gap-3"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-zinc-200" />
                Diagnostics
              </button>
            )}
            <button
              onClick={handleLogout}
              className="bg-zinc-100 border border-zinc-200 text-zinc-500 hover:text-zinc-900 px-6 py-2 rounded-full text-[10px] transition-all font-black uppercase tracking-[0.2em]"
            >
              Logout
            </button>
          </div>
        </header>

        {/* tab navigation */}
        <div className="flex gap-12 mb-16 border-b border-zinc-100 pb-1 justify-center">
          {getTabs().map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-4 font-black text-[11px] uppercase tracking-[0.4em] transition-all relative ${
                activeTab === tab.id ? 'text-zinc-900' : 'text-zinc-400 hover:text-zinc-600'
              }`}
            >
              {tab.label}
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)]" />
              )}
            </button>
          ))}
        </div>

        {/* ── Dashboard Tab ──────────────────────────────────── */}
        {activeTab === 'dashboard' && (
          <div className="space-y-16 animate-in fade-in slide-in-from-bottom-4 duration-1000">
            <StatsCards stats={stats} />

            <div className="space-y-20">
              {canUpload && (
                <UploadZone
                  user={user}
                  onComplete={() => fetchData()}
                  onFileSelect={handleFilePreview}
                  onOpenFile={() => setIsPDFModalOpen(true)}
                />
              )}

              {(streamEvents.length > 0 || isOperator) && (
                <AIStreamMonitor
                  events={streamEvents}
                  isStreaming={isStreaming}
                  onSelectNode={(evt) => { setSelectedEvent(evt); setSidebarOpen(true); }}
                />
              )}
            </div>

            {logs.length > 0 && !isAdmin && (
              <div className="pt-20 border-t border-zinc-100">
                <h2 className="text-[10px] font-black text-zinc-700 uppercase tracking-[0.5em] mb-10 text-center">
                  Recent Processing Archive
                </h2>
                <LogViewer logs={logs} user={user} onDelete={handleDelete} viewMode="grid" />
              </div>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-16 animate-in fade-in duration-700">
            <StatsCards stats={stats} />
            {logs.length > 0 ? (
              <LogViewer logs={logs} user={user} onDelete={handleDelete} viewMode="table" />
            ) : (
              <div className="text-center py-24 opacity-30">
                <p className="text-[10px] font-black uppercase tracking-[0.5em]">No Data Archive</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'users' && isAdmin && (
          <UserManager currentUser={user} />
        )}
      </div>

      <DebuggerDrawer
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        events={streamEvents}
      />
    </div>
  );
}
