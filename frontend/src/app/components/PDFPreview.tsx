"use client";

interface PDFPreviewProps {
  url: string | null;
  fileName: string | null;
}

export default function PDFPreview({ url, fileName }: PDFPreviewProps) {
  if (!url) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-white/[0.02] border border-dashed border-white/10 rounded-2xl p-12 text-center">
        <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-4 text-2xl">
          📄
        </div>
        <p className="text-sm font-medium text-zinc-300">No Document Selected</p>
        <p className="text-[11px] text-zinc-400 mt-1 max-w-[200px]">
          Upload an invoice to see a live preview here while the AI works.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#18181b] rounded-2xl border border-white/10 overflow-hidden shadow-2xl">
      {/* Viewer header */}
      <div className="px-4 py-3 bg-white/5 border-b border-white/10 flex justify-between items-center">
        <div className="flex items-center gap-2 overflow-hidden">
          <span className="text-xs">📄</span>
          <span className="text-[11px] font-bold text-zinc-300 truncate tracking-tight">{fileName}</span>
        </div>
        <div className="flex gap-1.5">
          <div className="w-2 h-2 rounded-full bg-emerald-500/50" />
          <div className="w-2 h-2 rounded-full bg-blue-500/50" />
        </div>
      </div>

      {/* PDF iframe */}
      <div className="flex-1 relative bg-[#2a2a2e]">
        <iframe
          src={`${url}#toolbar=0&navpanes=0&scrollbar=0`}
          className="w-full h-full border-0"
          title="Invoice Preview"
        />
        
        {/* Glass overlay */}
        <div className="absolute inset-0 pointer-events-none border border-white/5 rounded-b-2xl" />
      </div>
    </div>
  );
}
