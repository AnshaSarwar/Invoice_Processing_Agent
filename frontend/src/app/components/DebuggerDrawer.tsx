"use client";
import { useRef, useEffect, useState } from 'react';

interface StreamEvent {
  node: string;
  status: string;
  update?: any;
  reason?: string;
}

interface DebuggerDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  events: StreamEvent[];
}

export default function DebuggerDrawer({ isOpen, onClose, events }: DebuggerDrawerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [expandedNodes, setExpandedNodes] = useState<Record<number, boolean>>({});

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [events]);

  const toggleNode = (idx: number) => {
    setExpandedNodes(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  return (
    <aside
      className={`fixed top-0 right-0 h-full w-full max-w-lg bg-white border-l border-zinc-200 shadow-2xl z-50 transform transition-transform duration-500 ease-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
    >
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-200">
          <div>
            <h2 className="text-lg font-black text-zinc-950 uppercase tracking-widest italic">Node Inspector</h2>
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-[0.2em] mt-0.5">Real-time signal analysis</p>
          </div>
          <button 
            onClick={onClose} 
            className="w-10 h-10 flex items-center justify-center rounded-2xl bg-zinc-100 text-zinc-600 hover:text-zinc-950 transition-all hover:bg-zinc-200 group"
          >
            <span className="text-2xl transition-transform group-hover:rotate-90">×</span>
          </button>
        </div>

        {/* Content */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar bg-white">
          {events.length > 0 ? (
            events.map((evt, idx) => (
              <div key={idx} className="relative group animate-in fade-in slide-in-from-right-4 duration-500" style={{ animationDelay: `${idx * 50}ms` }}>
                {/* Timeline connector */}
                {idx < events.length - 1 && (
                  <div className="absolute left-[7px] top-6 bottom-[-40px] w-[1px] bg-zinc-200" />
                )}
                
                <div className="flex items-start gap-6">
                  {/* Timeline marker */}
                  <div className="mt-1.5 relative flex-shrink-0">
                    <div className="w-[15px] h-[15px] rounded-full border-2 border-blue-500 bg-white z-10 relative" />
                    <div className="absolute inset-0 rounded-full bg-blue-500/20 blur-[4px]" />
                  </div>

                  <div className="flex-1 space-y-4">
                    <div className="flex justify-between items-center">
                      <div className="flex-1">
                        <h4 className="text-xs font-black text-zinc-950 uppercase tracking-widest mb-2">{evt.node}</h4>
                        <pre className="text-[10px] font-mono p-4 bg-zinc-50 border border-zinc-200 rounded-xl text-zinc-700 overflow-x-auto">
                          {JSON.stringify(evt.update || {}, null, 2)}
                        </pre>
                      </div>
                      <div className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${
                        evt.status === 'failed' || evt.status === 'error'
                          ? 'bg-rose-50 text-rose-600 border-rose-200' 
                          : 'bg-emerald-50 text-emerald-600 border-emerald-200'
                      }`}>
                        {evt.status}
                      </div>
                    </div>

                    <div className="bg-white/[0.02] rounded-[1.5rem] border border-white/5 p-5 group-hover:bg-white/[0.04] group-hover:border-white/10 transition-all shadow-2xl">
                      <div 
                        onClick={() => toggleNode(idx)}
                        className="flex justify-between items-center cursor-pointer mb-3 bg-blue-500/10 p-3 rounded-xl border border-blue-500/10 hover:bg-blue-500/20 transition-colors"
                      >
                        <p className="text-[11px] text-blue-400 font-bold leading-relaxed">
                          {evt.reason || evt.update?.message || (
                            evt.node.includes('parse') ? "Analyzing extraction metadata..." :
                            evt.node.includes('validate') ? "Analyzing validation rules..." :
                            evt.node.includes('po_lookup') ? "Analyzing database match results..." :
                            evt.node.includes('compare') ? "Analyzing reconciliation details..." :
                            "Analyzing step details..."
                          )}
                        </p>
                        <span className={`text-blue-400 text-xs transition-transform duration-300 ${expandedNodes[idx] ? 'rotate-180' : ''}`}>
                          ▼
                        </span>
                      </div>
                      
                      {expandedNodes[idx] && (
                        <div className="space-y-3 mt-4 animate-in fade-in slide-in-from-top-2 duration-300">
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] text-zinc-400 uppercase font-black tracking-widest">Raw Payload Data</span>
                            <span className="text-[8px] text-zinc-500 font-mono">ID: {evt.update?.task_id?.slice(-8) || 'N/A'}</span>
                          </div>
                          <pre className="text-[10px] font-mono leading-relaxed text-zinc-300 overflow-x-auto p-4 bg-black/60 rounded-2xl custom-scrollbar border border-white/5">
                            {JSON.stringify(evt.update, (k, v) => (k === '_original_text' ? undefined : v), 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="h-full flex flex-col items-center justify-center opacity-30">
              <div className="w-24 h-24 mb-6 rounded-full bg-blue-500/10 flex items-center justify-center border border-blue-500/20 animate-pulse">
                <span className="text-4xl">🛰️</span>
              </div>
              <p className="font-black uppercase tracking-[0.4em] text-[10px] text-zinc-300">Awaiting system activity...</p>
              <p className="text-[9px] text-zinc-400 mt-2 uppercase font-bold tracking-widest">Connect to global event stream</p>
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="p-6 border-t border-white/10 bg-black/40 backdrop-blur-2xl">
          <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-widest text-zinc-400">
            <span>InvoSync Engine v1.0.4</span>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              <span>TLS Secure Link</span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
