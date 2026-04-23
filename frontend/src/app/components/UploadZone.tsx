"use client";

import { useState, useRef, useCallback } from 'react';
import { api, User } from '../api';

interface UploadZoneProps {
  user: User;
  onComplete: () => void;
  onFileSelect?: (file: File) => void;
  onOpenFile?: () => void;
}

export default function UploadZone({ user, onComplete, onFileSelect, onOpenFile }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [fileName, setFileName] = useState('');
  const [fileSize, setFileSize] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const processFile = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setStatusMsg('❌ Only PDF files are supported.');
      setTimeout(() => setStatusMsg(''), 4000);
      return;
    }

    setFileName(file.name);
    setFileSize(formatFileSize(file.size));
    setIsUploading(true);
    setStatusMsg('Processing...');
    
    if (onFileSelect) onFileSelect(file);

    try {
      const res = await api.uploadForStreaming(file, user);
      setStatusMsg('AI Extraction Live');
      
      if (res.task_id) {
        const es = api.streamProcessing(res.task_id, user);
        es.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.node === 'end' || data.node === 'error') {
              es.close();
              onComplete();
              setTimeout(() => {
                setStatusMsg('');
                setFileName('');
                setIsUploading(false);
              }, 4000);
            }
          } catch (e) {}
        };
        es.onerror = () => {
          es.close();
          onComplete();
          setTimeout(() => {
            setStatusMsg('Connection Lost');
            setFileName('');
            setIsUploading(false);
          }, 3000);
        };
      } else {
        onComplete();
        setTimeout(() => {
          setStatusMsg('');
          setFileName('');
          setIsUploading(false);
        }, 3000);
      }
    } catch (err: any) {
      setIsUploading(false);
      setStatusMsg(`Error: ${err.message || 'Failed'}`);
      setTimeout(() => { setStatusMsg(''); setFileName(''); }, 5000);
    }
  }, [user, onComplete]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = '';
  }, [processFile]);

  return (
    <div className="relative">
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf"
        className="hidden"
        onChange={handleFileSelect}
      />

      {fileName ? (
        <div className="flex items-center justify-between p-4 bg-zinc-50 border border-zinc-200 rounded-2xl animate-in fade-in slide-in-from-top-2 duration-500">
          <div 
            onClick={onOpenFile}
            className="flex items-center gap-4 cursor-pointer group"
          >
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20 group-hover:bg-blue-500/20 transition-all">
              <span className="text-xl">📄</span>
            </div>
            <div>
              <h3 className="text-xs font-black text-zinc-950 uppercase tracking-tight truncate max-w-[200px]">{fileName}</h3>
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">{fileSize} • {statusMsg}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {isUploading && (
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping mr-2" />
            )}
            <button 
              onClick={() => { setFileName(''); setIsUploading(false); }}
              className="text-zinc-400 hover:text-zinc-950 p-2 transition-colors"
            >
              <span className="text-lg">✕</span>
            </button>
          </div>
        </div>
      ) : (
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`flex items-center justify-center p-12 rounded-[2.5rem] border-2 border-dashed transition-all duration-500 ${
            isDragging ? 'border-blue-500 bg-blue-50 scale-[0.98]' : 'border-zinc-200 bg-zinc-50 hover:border-zinc-300 hover:bg-zinc-100'
          }`}
        >
          <div className="text-center">
            <div className="w-16 h-16 rounded-3xl bg-white/[0.03] flex items-center justify-center mx-auto mb-6 border border-white/5">
              <span className="text-3xl opacity-50 group-hover:opacity-100 transition-opacity">📂</span>
            </div>
            <h2 className="text-sm font-black text-zinc-700 uppercase tracking-[0.3em]">Drop Invoice</h2>
            <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mt-2">PDF Extraction Engine v1.0</p>
          </div>
        </div>
      )}
    </div>
  );
}
