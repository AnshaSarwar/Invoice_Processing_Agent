"use client";
import { useEffect, useRef } from 'react';

interface StreamEvent {
  node: string;
  status: string;
  update?: any;
  reason?: string;
}

interface AIStreamMonitorProps {
  events: StreamEvent[];
  isStreaming: boolean;
  onSelectNode: (event: StreamEvent) => void;
}

export default function AIStreamMonitor({ events, isStreaming, onSelectNode }: AIStreamMonitorProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ left: scrollRef.current.scrollWidth, behavior: 'smooth' });
    }
  }, [events]);

  const getStatusColor = (status: string) => {
    const s = status.toLowerCase();
    if (s === 'failed' || s === 'error') return 'bg-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.4)]';
    if (s === 'completed' || s === 'success') return 'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.4)]';
    return 'bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.4)]';
  };

  if (events.length === 0 && !isStreaming) {
    return (
      <div className="py-12 flex flex-col items-center justify-center border-t border-white/5 opacity-50">
        <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse mb-4" />
        <p className="text-[10px] text-zinc-400 font-black uppercase tracking-[0.4em]">System Link Standby</p>
      </div>
    );
  }

  return (
    <div className="relative py-12 border-t border-white/5">
      <div className="flex items-center gap-4 mb-10">
        <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
          <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
        </div>
        <div>
          <h2 className="text-sm font-black text-white uppercase tracking-widest italic">AI Processing Pipeline</h2>
          <p className="text-[9px] text-zinc-400 font-bold uppercase tracking-widest mt-0.5">Live Agent Orchestration</p>
        </div>
      </div>

      <div 
        ref={scrollRef} 
        className="flex items-start gap-0 overflow-x-auto pb-6 custom-scrollbar scroll-smooth px-2"
      >
        {events.map((evt, idx) => {
          const isLast = idx === events.length - 1 && isStreaming;
          const statusColor = getStatusColor(evt.status);
          
          return (
            <div key={idx} className="flex items-start flex-shrink-0">
              {/* Node Column */}
              <div 
                onClick={() => onSelectNode(evt)}
                className="group relative flex flex-col items-center w-48 transition-all duration-300 cursor-pointer"
              >
                {/* Connector Line (Behind) */}
                {idx > 0 && (
                  <div className="absolute top-[11px] right-[50%] w-full h-[1px] bg-gradient-to-r from-white/5 to-blue-500/30 -z-10" />
                )}

                {/* Pulse Dot */}
                <div className={`w-[22px] h-[22px] rounded-full flex items-center justify-center bg-[#09090b] border-2 transition-all duration-500 z-10 ${
                  isLast ? 'border-blue-500 scale-110 shadow-[0_0_20px_rgba(59,130,246,0.3)]' : 'border-zinc-800'
                }`}>
                  <div className={`w-2 h-2 rounded-full ${statusColor} ${isLast ? 'animate-pulse' : ''}`} />
                </div>

                {/* Node Label */}
                <div className="mt-6 text-center space-y-1.5 px-4 flex flex-col items-center">
                  <h4 className={`text-[10px] font-black uppercase tracking-widest transition-colors ${
                    isLast ? 'text-blue-400' : 'text-zinc-400 group-hover:text-white'
                  }`}>
                    {evt.node.replace('__', '').split('_').join(' ')}
                  </h4>

                  <div className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border transition-all ${
                    evt.status === 'failed' || evt.status === 'error'
                      ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' 
                      : evt.status === 'processing' 
                        ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                        : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  }`}>
                    {evt.status === 'parsed' ? 'Extracted' :
                     evt.status === 'validated' ? 'Validated' :
                     evt.status === 'po_found' ? 'PO Located' :
                     evt.status === 'completed' ? 'Success' :
                     evt.status}
                  </div>

                  <p className="text-[10px] text-zinc-300 font-medium leading-relaxed line-clamp-2 italic group-hover:opacity-100 transition-opacity mt-2">
                    {evt.reason || evt.update?.message || (
                      evt.node.includes('parse') ? "Extracting invoice data..." :
                      evt.node.includes('validate') ? "Verifying document structure..." :
                      evt.node.includes('po_lookup') ? "Searching for matching PO..." :
                      evt.node.includes('compare') ? "Checking line item parity..." :
                      "Processing..."
                    )}
                  </p>
                </div>

                {/* Active Indicator */}
                {isLast && (
                  <div className="absolute -top-6 animate-bounce">
                    <span className="text-[8px] font-black text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20 uppercase tracking-widest">Active</span>
                  </div>
                )}
              </div>

              {/* Spacing Connector */}
              {idx < events.length - 1 && (
                <div className="w-12 h-[1px] bg-white/10 mt-[11px] flex-shrink-0" />
              )}
            </div>
          );
        })}

        {isStreaming && (
          <div className="flex items-center flex-shrink-0">
            <div className="w-12 h-[1px] bg-gradient-to-r from-white/10 to-transparent mt-[11px]" />
            <div className="flex flex-col items-center w-24 opacity-20">
              <div className="w-1.5 h-1.5 rounded-full bg-zinc-800 animate-pulse mb-6" />
              <div className="text-[8px] font-black text-zinc-600 uppercase tracking-widest">Next Step</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
