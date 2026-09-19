// src/components/scanner/DropZone.jsx
import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FolderOpen, X, FileCode, AlertCircle, CheckCircle2 } from 'lucide-react';
import Badge from '../ui/Badge';
import { shouldIgnoreFile, LANG_MAP } from '../../utils/fileFilter';

const MAX_FILE_BYTES = 500 * 1024;

function getExt(name) {
  return name.split('.').pop()?.toLowerCase() || 'txt';
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DropZone({ onFiles }) {
  const [files, setFiles] = useState([]);
  const [skipped, setSkipped] = useState(0);

  const onDrop = useCallback((accepted) => {
    const ok = [];
    let skip = 0;
    for (const f of accepted) {
      const relPath = f.webkitRelativePath || f.name;
      if (shouldIgnoreFile(relPath) || f.size > MAX_FILE_BYTES) {
        skip++;
        continue;
      }
      ok.push(f);
    }
    setFiles(ok);
    setSkipped(skip);
    onFiles?.(ok);
  }, [onFiles]);

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    noClick: false,
    multiple: true,
  });

  const clearFiles = (e) => {
    e.stopPropagation();
    setFiles([]);
    setSkipped(0);
    onFiles?.([]);
  };

  const extCounts = files.reduce((acc, f) => {
    const ext = '.' + getExt(f.name);
    acc[ext] = (acc[ext] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-3">
      <div
        {...getRootProps()}
        className={`
          relative flex flex-col items-center justify-center gap-4
          min-h-[220px] rounded-2xl border-2 border-dashed cursor-pointer
          transition-all duration-300 px-6 py-8
          ${isDragActive && !isDragReject
            ? 'border-violet-500 bg-violet-500/10 scale-[1.01]'
            : isDragReject
            ? 'border-red-500 bg-red-500/10'
            : files.length > 0
            ? 'border-emerald-500/50 bg-emerald-500/5 dark:bg-emerald-500/10'
            : 'border-slate-300 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 hover:border-violet-400 hover:bg-violet-500/5'
          }
        `}
      >
        <input {...getInputProps()} webkitdirectory="" directory="" />

        {files.length === 0 ? (
          <>
            <div className={`p-4 rounded-2xl transition-colors duration-300 ${isDragActive ? 'bg-violet-500/20' : 'bg-slate-100 dark:bg-slate-800'}`}>
              {isDragActive ? (
                <FolderOpen className="w-10 h-10 text-violet-500 dark:text-violet-400" />
              ) : (
                <Upload className="w-10 h-10 text-slate-400 dark:text-slate-500" />
              )}
            </div>
            <div className="text-center">
              <p className="font-semibold text-lg text-slate-900 dark:text-white">
                {isDragActive ? 'Drop your folder here' : 'Drop a project folder'}
              </p>
              <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                or <span className="text-violet-600 dark:text-violet-400 underline underline-offset-2">click to browse local repository</span>
              </p>
              <p className="text-slate-400 dark:text-slate-500 text-xs mt-3">
                Automatically ignores <code className="px-1 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">.git</code>, <code className="px-1 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">node_modules</code>, build artifacts & binaries
              </p>
            </div>
          </>
        ) : (
          <>
            <div className="w-full space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{files.length} valid source files loaded</span>
                </div>
                <button
                  onClick={clearFiles}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                  title="Clear files"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                {Object.entries(extCounts)
                  .sort(([,a],[,b]) => b - a)
                  .slice(0, 10)
                  .map(([ext, count]) => {
                    const info = LANG_MAP[ext];
                    return (
                      <Badge key={ext} color={info?.color || 'gray'}>
                        <FileCode className="w-3 h-3" />
                        {ext} ({count})
                      </Badge>
                    );
                  })
                }
              </div>

              <div className="max-h-36 overflow-y-auto rounded-xl bg-slate-100 dark:bg-slate-900/80 divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800">
                {files.slice(0, 30).map((f, i) => (
                  <div key={i} className="flex items-center justify-between px-3 py-1.5 text-xs">
                    <span className="text-slate-700 dark:text-slate-300 truncate max-w-[75%] font-mono">
                      {f.webkitRelativePath || f.name}
                    </span>
                    <span className="text-slate-400 dark:text-slate-500 ml-2 shrink-0">{formatSize(f.size)}</span>
                  </div>
                ))}
                {files.length > 30 && (
                  <div className="px-3 py-2 text-xs text-slate-500 text-center font-medium">
                    +{files.length - 30} more source files ready
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {skipped > 0 && (
        <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-xs bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          {skipped} ignored/oversized file{skipped !== 1 ? 's' : ''} filtered out automatically (.git, node_modules, build binaries, files &gt; 500KB)
        </div>
      )}
    </div>
  );
}
