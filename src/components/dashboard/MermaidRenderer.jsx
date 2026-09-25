// src/components/dashboard/MermaidRenderer.jsx
import React, { useEffect, useRef, useState, useCallback } from 'react';
import mermaid from 'mermaid';
import { ZoomIn, ZoomOut, RotateCcw, Maximize2, Minimize2, Code2, AlertCircle } from 'lucide-react';
import useAnalysisStore from '../../store/useAnalysisStore';

let renderCounter = 0;

// Strips emoji from Mermaid node labels — Mermaid v12 renders inconsistently with emoji in some paths
function sanitizeForMermaid(src) {
  if (!src) return src;
  return src
    .replace(/🎯/g, '[TARGET]')
    .replace(/📥/g, '[IN]')
    .replace(/📤/g, '[OUT]')
    .replace(/🗄️/g, '[DB]')
    .replace(/🌐/g, '[CLIENT]')
    .replace(/⚡/g, '[API]')
    .replace(/📁/g, '[DIR]')
    .replace(/📄/g, '[FILE]')
    .replace(/🔧/g, '[SRC]')
    .replace(/🧩/g, '[COMP]')
    .replace(/📦/g, '[PKG]')
    .replace(/🔌/g, '[SVC]')
    .replace(/🎨/g, '[STYLE]')
    .replace(/🖼/g, '[ASSET]')
    .replace(/🧪/g, '[TEST]')
    .replace(/📚/g, '[LIB]')
    .replace(/🛠/g, '[UTIL]')
    .replace(/🖥/g, '[SERVER]')
    .replace(/📱/g, '[CLIENT]')
    .replace(/⚙/g, '[CONFIG]')
    // Catch any remaining emoji in supplementary planes
    .replace(/[\u{1F300}-\u{1FAFF}]/gu, '')
    .replace(/[\u2600-\u26FF]/g, '')
    .replace(/[\u2700-\u27BF]/g, '');
}

export default function MermaidRenderer({ diagram, title = 'Diagram' }) {
  const containerRef = useRef(null);
  const modalContainerRef = useRef(null);
  const { theme } = useAnalysisStore();

  const [error, setError] = useState(null);
  const [showRaw, setShowRaw] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const isPanning = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });


  const isDark = theme === 'dark';

  // Initialize and render Mermaid SVG whenever diagram or theme changes
  useEffect(() => {
    if (!diagram) return;
    setError(null);
    setScale(1);
    setOffset({ x: 0, y: 0 });

    const isDarkMode = theme === 'dark';

    mermaid.initialize({
      startOnLoad: false,
      theme: isDarkMode ? 'dark' : 'neutral',
      themeVariables: isDarkMode ? {
        darkMode: true,
        background: '#0A0A0F',
        primaryColor: '#7C3AED',
        secondaryColor: '#06B6D4',
        tertiaryColor: '#1e1b4b',
        primaryTextColor: '#f8fafc',
        secondaryTextColor: '#94a3b8',
        lineColor: '#64748b',
        edgeLabelBackground: '#1e1b4b',
        clusterBkg: '#1e1b4b',
        nodeBorder: '#7C3AED',
        mainBkg: '#1e1b4b',
        classText: '#f8fafc',
      } : {
        darkMode: false,
        background: '#ffffff',
        primaryColor: '#7C3AED',
        secondaryColor: '#06B6D4',
        tertiaryColor: '#f1f5f9',
        primaryTextColor: '#0f172a',
        secondaryTextColor: '#475569',
        lineColor: '#94a3b8',
        edgeLabelBackground: '#f1f5f9',
        clusterBkg: '#f8fafc',
        nodeBorder: '#7C3AED',
        mainBkg: '#ffffff',
        classText: '#0f172a',
      },
      flowchart: { curve: 'basis', useMaxWidth: false },
      classDiagram: { useMaxWidth: false },
    });

    const renderId = `mermaid-${++renderCounter}`;
    const safeDiagram = sanitizeForMermaid(diagram);

    mermaid.render(renderId, safeDiagram)
      .then(({ svg }) => {
        if (containerRef.current) {
          containerRef.current.innerHTML = svg;
        }
        if (modalContainerRef.current) {
          modalContainerRef.current.innerHTML = svg;
        }
      })
      .catch((err) => {
        console.warn('[MermaidRenderer] Render error:', err);
        setError('Could not render diagram visually. Showing raw syntax below.');
        setShowRaw(true);
      });
  }, [diagram, theme]);

  // Pan handlers
  const onMouseDown = useCallback((e) => {
    isPanning.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
    e.preventDefault();
  }, []);

  const onMouseMove = useCallback((e) => {
    if (!isPanning.current) return;
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    lastPos.current = { x: e.clientX, y: e.clientY };
    setOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
  }, []);

  const onMouseUp = useCallback(() => { isPanning.current = false; }, []);

  // Wheel zoom
  const onWheel = useCallback((e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setScale(s => Math.max(0.3, Math.min(3.5, s + delta)));
  }, []);

  const resetView = () => { setScale(1); setOffset({ x: 0, y: 0 }); };

  return (
    <>
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/60 overflow-hidden shadow-sm dark:shadow-none transition-colors">
        {/* Header toolbar */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">{title}</h3>
          <div className="flex items-center gap-1">
            <ControlBtn onClick={() => setScale(s => Math.min(s + 0.2, 3.5))} title="Zoom in">
              <ZoomIn className="w-3.5 h-3.5" />
            </ControlBtn>
            <ControlBtn onClick={() => setScale(s => Math.max(s - 0.2, 0.3))} title="Zoom out">
              <ZoomOut className="w-3.5 h-3.5" />
            </ControlBtn>
            <ControlBtn onClick={resetView} title="Reset zoom & pan">
              <RotateCcw className="w-3.5 h-3.5" />
            </ControlBtn>
            <ControlBtn onClick={() => setShowRaw(r => !r)} title={showRaw ? 'Show diagram' : 'Show source code'}>
              <Code2 className="w-3.5 h-3.5" />
            </ControlBtn>
            <ControlBtn onClick={() => setIsFullscreen(true)} title="Expand Fullscreen Modal">
              <Maximize2 className="w-3.5 h-3.5" />
            </ControlBtn>
            <span className="ml-2 text-xs font-mono text-slate-500 dark:text-slate-400">{Math.round(scale * 100)}%</span>
          </div>
        </div>

        {/* Canvas area */}
        {showRaw ? (
          <pre className="p-5 text-xs text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-950 overflow-auto max-h-96 font-mono leading-relaxed whitespace-pre-wrap">
            {diagram}
          </pre>
        ) : (
          <div
            className="relative h-96 overflow-hidden cursor-grab active:cursor-grabbing bg-slate-50/50 dark:bg-[#0a0a0f] select-none"
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
            onWheel={onWheel}
          >
            <div
              ref={containerRef}
              className="flex justify-center items-center min-h-full"
              style={{
                transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
                transformOrigin: 'center center',
                transition: isPanning.current ? 'none' : 'transform 0.05s',
                padding: '1.5rem',
              }}
            />
            {/* Zoom hint */}
            <div className="absolute bottom-3 right-3 text-slate-400 dark:text-slate-500 text-xs pointer-events-none select-none">
              Scroll to zoom · Drag to pan · Click maximize for full view
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 px-5 py-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-500/10 border-t border-amber-500/20">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}
      </div>

      {/* Fullscreen Modal Dialog */}
      {isFullscreen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-slate-900/90 dark:bg-black/90 backdrop-blur-md p-6">
          <div className="flex items-center justify-between mb-4 text-white">
            <h2 className="text-lg font-bold">{title} — Fullscreen View</h2>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 bg-slate-800 rounded-xl p-1">
                <ControlBtn onClick={() => setScale(s => Math.min(s + 0.2, 4))} title="Zoom in">
                  <ZoomIn className="w-4 h-4 text-white" />
                </ControlBtn>
                <ControlBtn onClick={() => setScale(s => Math.max(s - 0.2, 0.3))} title="Zoom out">
                  <ZoomOut className="w-4 h-4 text-white" />
                </ControlBtn>
                <ControlBtn onClick={resetView} title="Reset view">
                  <RotateCcw className="w-4 h-4 text-white" />
                </ControlBtn>
              </div>
              <button
                onClick={() => setIsFullscreen(false)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-sm transition-colors"
              >
                <Minimize2 className="w-4 h-4" /> Close
              </button>
            </div>
          </div>
          <div
            className="flex-1 rounded-2xl overflow-hidden cursor-grab active:cursor-grabbing bg-white dark:bg-[#0a0a0f] border border-slate-700 flex justify-center items-center relative"
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
            onWheel={onWheel}
          >
            <div
              ref={modalContainerRef}
              style={{
                transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
                transformOrigin: 'center center',
                transition: isPanning.current ? 'none' : 'transform 0.05s',
                padding: '2rem',
              }}
            />
          </div>
        </div>
      )}
    </>
  );
}

function ControlBtn({ onClick, title, children }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
    >
      {children}
    </button>
  );
}
