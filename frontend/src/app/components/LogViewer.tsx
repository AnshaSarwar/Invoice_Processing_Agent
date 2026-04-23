"use client";

import { useState } from 'react';
import { ProcessingLog, User } from '../api';

interface LogViewerProps {
  logs: ProcessingLog[];
  user: User;
  onDelete: (id: number) => void;
  viewMode: 'grid' | 'table';
}

function MetadataModal({ log, onClose }: { log: ProcessingLog; onClose: () => void }) {
  let parsed: any = null;
  try {
    parsed = log.metadata_json ? JSON.parse(log.metadata_json) : null;
  } catch { /* ignore */ }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-[#18181b] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-5 border-b border-white/10">
          <div>
            <h3 className="font-bold text-white text-sm">Processing Details</h3>
            <p className="text-[10px] text-zinc-300 mt-0.5">
              {log.filepath?.split(/[\/\\]/).pop()} • {log.po_number || 'No PO'}
            </p>
          </div>
          <button onClick={onClose} className="text-zinc-300 hover:text-white text-xl transition-colors">×</button>
        </div>
        <div className="p-5 overflow-y-auto max-h-[60vh] space-y-4">
          {/* Status Bar */}
          <div className="flex gap-3 flex-wrap">
            <span className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase ${
              log.status === 'completed' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
            }`}>
              {log.status}
            </span>
            {log.confidence_score != null && (
              <span className="px-3 py-1 rounded-lg text-[10px] font-bold bg-blue-500/20 text-blue-400">
                Confidence: {(log.confidence_score * 100).toFixed(0)}%
              </span>
            )}
            {log.processing_time_seconds != null && (
              <span className="px-3 py-1 rounded-lg text-[10px] font-bold bg-purple-500/20 text-purple-400">
                {log.processing_time_seconds.toFixed(1)}s
              </span>
            )}
          </div>

          {/* Error Message */}
          {log.error_message && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <p className="text-[10px] font-bold text-red-700 uppercase mb-1">Error</p>
              <p className="text-xs text-red-600">{log.error_message}</p>
            </div>
          )}

          {/* Invoice Data */}
          {parsed?.invoice_data && Object.keys(parsed.invoice_data).length > 0 && (
            <div className="bg-zinc-50 rounded-xl p-4 border border-zinc-200">
              <p className="text-[10px] font-bold text-zinc-500 uppercase mb-2">Extracted Invoice Data</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {Object.entries(parsed.invoice_data)
                  .filter(([k]) => !k.startsWith('_') && k !== 'line_items' && k !== 'is_invoice')
                  .map(([key, val]) => (
                    <div key={key} className="flex justify-between gap-2">
                      <span className="text-zinc-500 capitalize">{key.replace(/_/g, ' ')}</span>
                      <span className="text-zinc-950 font-mono text-right truncate max-w-[60%]">{String(val ?? '—')}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Comparison Result */}
          {parsed?.comparison_result && Object.keys(parsed.comparison_result).length > 0 && (
            <div className="bg-zinc-50 rounded-xl p-4 border border-zinc-200">
              <p className="text-[10px] font-bold text-zinc-500 uppercase mb-2">Comparison Result</p>
              <pre className="text-[11px] font-mono text-zinc-700 whitespace-pre-wrap">
                {JSON.stringify(parsed.comparison_result, null, 2)}
              </pre>
            </div>
          )}

          {/* Raw Metadata Fallback */}
          {!parsed && log.metadata_json && (
            <div className="bg-zinc-50 rounded-xl p-4 border border-zinc-200">
              <p className="text-[10px] font-bold text-zinc-500 uppercase mb-2">Raw Metadata</p>
              <pre className="text-[11px] font-mono text-zinc-600 whitespace-pre-wrap break-all">
                {log.metadata_json}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LogViewer({ logs, user, onDelete, viewMode }: LogViewerProps) {
  const [expandedLog, setExpandedLog] = useState<ProcessingLog | null>(null);

  if (logs.length === 0) return null;

  const isAdmin = user.role === 'Admin';
  const isManager = user.role === 'Manager';

  const canUserDelete = (log: ProcessingLog) => {
    if (isAdmin || isManager) return true;
    return log.owner_id === user.id;
  };

  if (viewMode === 'grid') {
    return (
      <>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {logs.slice(0, 12).map((log) => (
            <div
              key={log.id}
              className="bg-white p-5 group transition-all border border-zinc-200 hover:border-blue-500/30 cursor-pointer rounded-xl shadow-sm"
              onClick={() => setExpandedLog(log)}
            >
              <div className="flex justify-between items-start mb-3">
                <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                  log.status === 'completed' ? 'bg-green-500/20 text-green-700' : 'bg-red-500/20 text-red-700'
                }`}>
                  {log.status}
                </span>
                {canUserDelete(log) && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onDelete(log.id); }}
                    className="opacity-40 hover:opacity-100 text-red-600 transition-all text-sm p-1 hover:bg-red-50 rounded-md"
                    title="Delete Invoice"
                  >
                    🗑️
                  </button>
                )}
              </div>
              <h3 className="font-bold text-zinc-950 truncate text-sm mb-1">{log.filepath?.split(/[\/\\]/).pop()}</h3>
              <div className="text-[11px] text-zinc-500 mb-1">
                PO: <span className="text-blue-600">{log.po_number || '—'}</span>
              </div>
              {log.error_message && log.status !== 'completed' && (
                <p className="text-[10px] text-red-600/80 truncate mt-1">{log.error_message}</p>
              )}
              {log.uploader_name && (isAdmin || isManager) && (
                <div className="mt-2 flex items-center gap-1.5 opacity-60">
                  <span className="text-[10px] grayscale">👤</span>
                  <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-tighter">Uploaded by: {log.uploader_name}</span>
                </div>
              )}
              <div className="mt-4 flex gap-4 text-center">
                <div className="flex-1">
                  <span className="block text-[9px] text-zinc-400 uppercase">Confidence</span>
                  <span className="text-xs font-bold text-blue-600">
                    {log.confidence_score != null ? (log.confidence_score * 100).toFixed(0) : '—'}%
                  </span>
                </div>
                <div className="flex-1">
                  <span className="block text-[9px] text-zinc-400 uppercase">Time</span>
                  <span className="text-xs font-bold text-zinc-950">
                    {log.processing_time_seconds?.toFixed(1) ?? '—'}s
                  </span>
                </div>
                <div className="flex-1">
                  <span className="block text-[9px] text-zinc-400 uppercase">Date</span>
                  <span className="text-xs font-bold text-zinc-950">
                    {new Date(log.timestamp).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
        {expandedLog && <MetadataModal log={expandedLog} onClose={() => setExpandedLog(null)} />}
      </>
    );
  }

  // Table view
  return (
    <>
      <div className="bg-white rounded-xl overflow-hidden border border-zinc-200 shadow-sm">
        <div className="p-4 bg-zinc-50 border-b border-zinc-200 flex justify-between items-center">
          <span className="text-xs font-bold text-zinc-500">
            Processing History {user.role !== 'Operator' ? '(All Users)' : ''}
          </span>
          <span className="text-[10px] text-zinc-400">{logs.length} records</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-white text-zinc-500 uppercase font-bold tracking-tighter border-b border-zinc-200">
              <tr>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">File</th>
                <th className="px-6 py-4">PO</th>
                <th className="px-6 py-4">Confidence</th>
                <th className="px-6 py-4">Time</th>
                <th className="px-6 py-4">Date</th>
                {(isAdmin || isManager) && <th className="px-6 py-4">Operator</th>}
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {logs.map((log) => (
                <tr
                  key={log.id}
                  className="hover:bg-zinc-50 transition-colors group cursor-pointer"
                  onClick={() => setExpandedLog(log)}
                >
                  <td className="px-6 py-4">
                    <span className={`text-[10px] font-bold ${log.status === 'completed' ? 'text-green-700' : 'text-red-700'}`}>
                      ● {log.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-medium text-zinc-950">{log.filepath?.split(/[\/\\]/).pop()}</td>
                  <td className="px-6 py-4 font-mono text-blue-600">{log.po_number || '—'}</td>
                  <td className="px-6 py-4">
                    <span className="text-blue-700 font-bold">
                      {log.confidence_score != null ? `${(log.confidence_score * 100).toFixed(0)}%` : '—'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-zinc-500">{log.processing_time_seconds?.toFixed(1) ?? '—'}s</td>
                  <td className="px-6 py-4 text-zinc-500">{new Date(log.timestamp).toLocaleDateString()}</td>
                  {(isAdmin || isManager) && (
                    <td className="px-6 py-4">
                      <span className="text-[10px] font-bold text-zinc-500 px-2 py-0.5 bg-white/5 border border-white/5 rounded-full">
                        {log.uploader_name || '—'}
                      </span>
                    </td>
                  )}
                  <td className="px-6 py-4 text-right">
                    {canUserDelete(log) && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onDelete(log.id); }}
                        className="opacity-40 group-hover:opacity-100 text-red-500 hover:text-red-400 transition-all text-[10px] font-bold uppercase tracking-wider"
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {expandedLog && <MetadataModal log={expandedLog} onClose={() => setExpandedLog(null)} />}
    </>
  );
}
