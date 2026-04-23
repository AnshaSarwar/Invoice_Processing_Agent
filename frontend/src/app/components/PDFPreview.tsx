"use client";

interface PDFPreviewProps {
  url: string | null;
  fileName: string | null;
}

export default function PDFPreview({ url, fileName }: PDFPreviewProps) {
  if (!url) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-zinc-50 border border-dashed border-zinc-200 rounded-2xl p-12 text-center">
        <div className="w-16 h-16 rounded-2xl bg-white border border-zinc-100 flex items-center justify-center mb-4 text-2xl shadow-sm">
          📄
        </div>
        <p className="text-sm font-medium text-zinc-950">No Document Selected</p>
        <p className="text-[11px] text-zinc-500 mt-1 max-w-[200px]">
          Upload an invoice to see a live preview here while the AI works.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-2xl">
      {/* viewer header */}
      <div className="px-4 py-3 bg-zinc-50 border-b border-zinc-200 flex justify-between items-center">
        <div className="flex items-center gap-2 overflow-hidden">
          <span className="text-xs">📄</span>
          <span className="text-[11px] font-bold text-zinc-950 truncate tracking-tight">{fileName}</span>
        </div>
        <div className="flex gap-1.5">
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          <div className="w-2 h-2 rounded-full bg-blue-500" />
        </div>
      </div>

      {/* pdf iframe */}
      <div className="flex-1 relative bg-zinc-100">
        <iframe
          src={`${url}#toolbar=0&navpanes=0&scrollbar=0`}
          className="w-full h-full border-0"
          title="Invoice Preview"
        />
        
        {/* overlay */}
        <div className="absolute inset-0 pointer-events-none border border-zinc-200 rounded-b-2xl" />
      </div>
    </div>
  );
}
