// src/components/dashboard/CommandPaletteModal.jsx
import React, { useState, useEffect } from 'react';
import { Search, File, Server, ShieldAlert, X, CornerDownLeft, Code } from 'lucide-react';

const SECTIONS = [
  { num: '1', label: '📊 Overview & Health', sec: 'overview' },
  { num: '2', label: '🗺️ Architecture Diagrams', sec: 'architecture' },
  { num: '3', label: '⚡ API Routes & Models', sec: 'api' },
  { num: '4', label: '🛡️ Code Quality & Smells', sec: 'health' },
  { num: '5', label: '📂 File Structure Explorer', sec: 'explorer' },
];

export default function CommandPaletteModal({ isOpen, onClose, result, onSelectSection }) {
  const [query, setQuery] = useState('');

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'Escape' && isOpen) {
        onClose();
      } else if (isOpen && !query.trim()) {
        const found = SECTIONS.find(s => s.num === e.key);
        if (found) {
          e.preventDefault();
          onSelectSection?.(found.sec);
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, onSelectSection, query]);

  if (!isOpen) return null;

  const rawFiles = result?.rawFiles || [];
  const routes = result?.pythonAnalysis?.apiRoutes || [];
  const security = [
    ...(result?.pythonAnalysis?.securityIssues || []),
    ...(result?.jsSecurityIssues || []),
  ];
  const functions = result?.pythonAnalysis?.pythonAST?.functions || [];

  const lowerQuery = query.toLowerCase().trim();

  const filteredFiles = rawFiles
    .filter(f => (f.name || '').toLowerCase().includes(lowerQuery))
    .slice(0, 5);

  const filteredRoutes = routes
    .filter(r => (r.path || '').toLowerCase().includes(lowerQuery) || (r.method || '').toLowerCase().includes(lowerQuery))
    .slice(0, 5);

  const filteredSecurity = security
    .filter(s => (s.rule || '').toLowerCase().includes(lowerQuery) || (s.file || '').toLowerCase().includes(lowerQuery))
    .slice(0, 4);

  const filteredFunctions = functions
    .filter(fn => (fn.name || '').toLowerCase().includes(lowerQuery) || (fn.file || '').toLowerCase().includes(lowerQuery))
    .slice(0, 4);

  const handleSelect = (section) => {
    onSelectSection?.(section);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-xl rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-slate-200 dark:border-slate-800 gap-3">
          <Search className="w-5 h-5 text-slate-400 shrink-0" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search files, API routes, functions, or security alerts..."
            className="w-full bg-transparent text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none"
          />
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results List */}
        <div className="overflow-y-auto p-3 space-y-4 text-xs">
          {/* Quick Section Shortcuts */}
          {!query && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 mb-1.5 flex items-center justify-between">
                <span>Quick Jump To Section</span>
                <span className="font-mono text-slate-500">Press 1–5</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {SECTIONS.map((s) => (
                  <button
                    key={s.sec}
                    onClick={() => handleSelect(s.sec)}
                    className="flex items-center justify-between p-2 rounded-lg bg-slate-100 dark:bg-slate-800/60 hover:bg-violet-500/10 hover:text-violet-600 dark:hover:text-violet-400 text-left transition-colors text-slate-700 dark:text-slate-300 font-medium"
                  >
                    <span className="flex items-center gap-2">
                      <kbd className="w-4 h-4 flex items-center justify-center rounded bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-[10px] font-mono text-slate-500 dark:text-slate-300">
                        {s.num}
                      </kbd>
                      {s.label}
                    </span>
                    <CornerDownLeft className="w-3 h-3 text-slate-400" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Files */}
          {filteredFiles.length > 0 && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 mb-1">
                Source Files
              </div>
              <div className="space-y-1">
                {filteredFiles.map((f, i) => (
                  <button
                    key={i}
                    onClick={() => handleSelect('explorer')}
                    className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-left transition-colors font-mono"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <File className="w-3.5 h-3.5 text-cyan-500 shrink-0" />
                      <span className="text-slate-800 dark:text-slate-200 truncate">{f.name}</span>
                    </div>
                    <span className="text-[10px] text-slate-400">View in Explorer</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* API Routes */}
          {filteredRoutes.length > 0 && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 mb-1">
                Discovered Endpoints
              </div>
              <div className="space-y-1">
                {filteredRoutes.map((r, i) => (
                  <button
                    key={i}
                    onClick={() => handleSelect('api')}
                    className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-left transition-colors font-mono"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Server className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">{r.method}</span>
                      <span className="text-slate-800 dark:text-slate-200 truncate">{r.path}</span>
                    </div>
                    <span className="text-[10px] text-slate-400">{r.framework}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Security Findings */}
          {filteredSecurity.length > 0 && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 mb-1">
                Security & Risks
              </div>
              <div className="space-y-1">
                {filteredSecurity.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => handleSelect('health')}
                    className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-left transition-colors"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <ShieldAlert className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      <span className="text-slate-800 dark:text-slate-200 font-bold truncate">{s.rule}</span>
                      <span className="text-[10px] font-mono text-slate-400 truncate">({s.file})</span>
                    </div>
                    <span className="text-[10px] font-bold text-amber-500">{s.severity}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Functions */}
          {filteredFunctions.length > 0 && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 mb-1">
                Functions & Methods
              </div>
              <div className="space-y-1">
                {filteredFunctions.map((fn, i) => (
                  <button
                    key={i}
                    onClick={() => handleSelect('health')}
                    className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-left transition-colors font-mono"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Code className="w-3.5 h-3.5 text-violet-500 shrink-0" />
                      <span className="text-slate-800 dark:text-slate-200">{fn.name}()</span>
                      <span className="text-[10px] text-slate-400 truncate">in {fn.file}</span>
                    </div>
                    <span className="text-[10px] text-violet-400 font-bold">Score: {fn.complexity}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-2.5 bg-slate-50 dark:bg-slate-950/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400 px-4">
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline">Navigate:</span>
            <kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-[10px] font-mono">1–5</kbd>
            <span className="text-[10px]">Jump section</span>
          </div>
          <div className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-[10px] font-mono">ESC</kbd> to close
          </div>
        </div>
      </div>
    </div>
  );
}
