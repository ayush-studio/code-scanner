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
  const viewportRef = useRef(null);
  const modalContainerRef = useRef(null);
  const modalViewportRef = useRef(null);
  const { theme } = useAnalysisStore();

  const [error, setError] = useState(null);
  const [showRaw, setShowRaw] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const isPanning = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  // Auto-fit calculation
  const fitToView = useCallback((isModal = false) => {
    const container = isModal ? modalContainerRef.current : containerRef.current;
    const viewport = isModal ? modalViewportRef.current : viewportRef.current;
    if (!container || !viewport) return;

    const svgEl = container.querySelector('svg');
    if (!svgEl) return;

    svgEl.style.maxWidth = 'none';
    svgEl.style.height = 'auto';

    let svgW = 0;
    let svgH = 0;

    if (svgEl.viewBox && svgEl.viewBox.baseVal && svgEl.viewBox.baseVal.width > 0) {
      svgW = svgEl.viewBox.baseVal.width;
      svgH = svgEl.viewBox.baseVal.height;
    } else if (svgEl.getAttribute('viewBox')) {
      const parts = svgEl.getAttribute('viewBox').split(/[\s,]+/).map(Number);
      if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
        svgW = parts[2];
        svgH = parts[3];
      }
    }

    if (!svgW || !svgH) {
      if (typeof svgEl.getBBox === 'function') {
        try {
          const bbox = svgEl.getBBox();
          svgW = bbox.width;
          svgH = bbox.height;
        } catch (_) {}
      }
    }

    if (!svgW || !svgH) {
      const rect = svgEl.getBoundingClientRect();
      svgW = rect.width / (scale || 1);
      svgH = rect.height / (scale || 1);
    }

    const vpW = viewport.clientWidth;
    const vpH = viewport.clientHeight;

    if (svgW > 0 && svgH > 0 && vpW > 0 && vpH > 0) {
      const padX = isModal ? 64 : 48;
      const padY = isModal ? 64 : 48;
      const scaleX = (vpW - padX) / svgW;
      const scaleY = (vpH - padY) / svgH;
      const autoScale = Math.max(0.18, Math.min(Math.min(scaleX, scaleY), 1.05));
      setScale(Number(autoScale.toFixed(2)));
      setOffset({ x: 0, y: 0 });
    } else {
      setScale(1);
      setOffset({ x: 0, y: 0 });
    }
  }, [scale]);

  // Initialize and render Mermaid SVG whenever diagram or theme changes
  useEffect(() => {
    if (!diagram) return;
    setError(null);

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
        // Auto-fit diagram to viewport bounds so no nodes are clipped
        requestAnimationFrame(() => {
          fitToView(false);
        });
      })
      .catch((err) => {
        console.warn('[MermaidRenderer] Render error:', err);
        setError('Could not render diagram visually. Showing raw syntax below.');
        setShowRaw(true);
      });
  }, [diagram, theme, fitToView]);

  // Auto-fit when fullscreen is toggled or when expanded height changes
  useEffect(() => {
    const timer = setTimeout(() => {
      if (isFullscreen) {
        fitToView(true);
      } else {
        fitToView(false);
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [isFullscreen, isExpanded, fitToView]);

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
    setScale(s => Math.max(0.18, Math.min(3.5, Number((s + delta).toFixed(2)))));
  }, []);

  const resetView100 = () => { setScale(1); setOffset({ x: 0, y: 0 }); };

  return (
    <>
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/60 overflow-hidden shadow-sm dark:shadow-none transition-colors">
        {/* Header toolbar */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">{title}</h3>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-600 dark:text-violet-400 font-medium">
              {Math.round(scale * 100)}%
            </span>
          </div>
          <div className="flex items-center gap-1">
            <ControlBtn onClick={() => setScale(s => Math.min(Number((s + 0.2).toFixed(2)), 3.5))} title="Zoom in">
              <ZoomIn className="w-3.5 h-3.5" />
            </ControlBtn>
            <ControlBtn onClick={() => setScale(s => Math.max(Number((s - 0.2).toFixed(2)), 0.18))} title="Zoom out">
              <ZoomOut className="w-3.5 h-3.5" />
            </ControlBtn>
            <ControlBtn onClick={() => fitToView(false)} title="Fit whole diagram to viewport">
              <RotateCcw className="w-3.5 h-3.5" />
            </ControlBtn>
            <button
              onClick={resetView100}
              title="Reset to 100% scale"
              className="px-1.5 py-1 text-[11px] font-mono font-medium rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
            >
              1:1
            </button>
            <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-1" />
            <ControlBtn onClick={() => setIsExpanded(exp => !exp)} title={isExpanded ? 'Compact canvas' : 'Expand canvas height'}>
              {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </ControlBtn>
            <ControlBtn onClick={() => setShowRaw(r => !r)} title={showRaw ? 'Show diagram' : 'Show source code'}>
              <Code2 className="w-3.5 h-3.5" />
            </ControlBtn>
            <button
              onClick={() => setIsFullscreen(true)}
              title="Open full screen modal"
              className="flex items-center gap-1 px-2.5 py-1 ml-1 text-xs font-medium rounded-lg bg-violet-600/10 text-violet-600 dark:text-violet-400 hover:bg-violet-600 hover:text-white transition-colors"
            >
              <Maximize2 className="w-3 h-3" />
              <span>Fullscreen</span>
            </button>
          </div>
        </div>

        {/* Canvas area */}
        {showRaw ? (
          <pre className="p-5 text-xs text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-950 overflow-auto max-h-[520px] font-mono leading-relaxed whitespace-pre-wrap">
            {diagram}
          </pre>
        ) : (
          <div
            ref={viewportRef}
            className={`relative ${isExpanded ? 'h-[720px]' : 'h-[520px] md:h-[560px]'} overflow-hidden cursor-grab active:cursor-grabbing bg-slate-50/50 dark:bg-[#0a0a0f] select-none transition-[height] duration-200`}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
            onWheel={onWheel}
          >
            <div className="w-full h-full flex items-center justify-center pointer-events-none">
              <div
                ref={containerRef}
                className="pointer-events-auto inline-block"
                style={{
                  transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
                  transformOrigin: 'center center',
                  transition: isPanning.current ? 'none' : 'transform 0.08s ease-out',
                }}
              />
            </div>
            {/* Subtle Zoom hint pill */}
            <div className="absolute bottom-3 right-3 text-slate-400 dark:text-slate-500 text-[11px] font-medium px-2.5 py-1 rounded-lg bg-slate-900/40 dark:bg-slate-900/70 backdrop-blur-sm border border-slate-700/30 pointer-events-none select-none">
              Scroll to zoom · Drag to pan · Click ↺ to auto-fit
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
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-bold">{title}</h2>
              <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 font-medium">
                {Math.round(scale * 100)}%
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 bg-slate-800 rounded-xl p-1">
                <ControlBtn onClick={() => setScale(s => Math.min(Number((s + 0.2).toFixed(2)), 4))} title="Zoom in">
                  <ZoomIn className="w-4 h-4 text-white" />
                </ControlBtn>
                <ControlBtn onClick={() => setScale(s => Math.max(Number((s - 0.2).toFixed(2)), 0.18))} title="Zoom out">
                  <ZoomOut className="w-4 h-4 text-white" />
                </ControlBtn>
                <ControlBtn onClick={() => fitToView(true)} title="Fit to screen">
                  <RotateCcw className="w-4 h-4 text-white" />
                </ControlBtn>
                <button
                  onClick={resetView100}
                  title="Reset to 100% scale"
                  className="px-2 py-1 text-xs font-mono font-medium rounded-lg text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
                >
                  1:1
                </button>
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
            ref={modalViewportRef}
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
                transition: isPanning.current ? 'none' : 'transform 0.08s ease-out',
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
