// src/components/dashboard/FileRelationshipExplorer.jsx
import React, { useState, useMemo, useEffect } from 'react';
import {
  Network, Search, ArrowRight, ArrowLeft, ShieldAlert, CheckCircle,
  FileCode, Layers, Filter, X, Info, ExternalLink, Zap
} from 'lucide-react';
import Card, { CardHeader, CardBody } from '../ui/Card';
import Badge from '../ui/Badge';
import MermaidRenderer from './MermaidRenderer';

export default function FileRelationshipExplorer({
  files = [],
  selectedFile: externalSelectedFile,
  onSelectFile,
  couplingData = {}
}) {
  const [internalSelectedFile, setInternalSelectedFile] = useState('');
  const [search, setSearch] = useState('');
  const [hopDepth, setHopDepth] = useState(1); // 1-hop or 2-hop
  const [drawerFile, setDrawerFile] = useState(null); // per-file detail drawer

  const activeFile = externalSelectedFile || internalSelectedFile || (files[0]?.name || '');

  // ── Build Dependency Adjacency Map ──
  const { dependencyMap, consumerMap, fileList } = useMemo(() => {
    const depMap = new Map(); // file -> [importedFiles]
    const consMap = new Map(); // file -> [consumerFiles]
    const allFiles = files.map(f => f.name || '');

    for (const f of files) {
      depMap.set(f.name, []);
      consMap.set(f.name, []);
    }

    for (const f of files) {
      const content = f.content || '';
      const fname = f.name;

      for (const target of files) {
        if (target.name === fname) continue;
        const targetBase = target.name.split('/').pop().replace(/\.[^/.]+$/, '');

        // Check if f imports targetBase
        const importRegex = new RegExp(`(?:from\\s+['"][^'"]*${targetBase}['"]|require\\s*\\(\\s*['"][^'"]*${targetBase}['"]\\))`, 'i');
        if (importRegex.test(content) || (content.includes(targetBase) && content.includes('import'))) {
          depMap.get(fname)?.push(target.name);
          consMap.get(target.name)?.push(fname);
        }
      }
    }

    return { dependencyMap: depMap, consumerMap: consMap, fileList: allFiles };
  }, [files]);

  // Search filter for dropdown & file list
  const filteredFiles = useMemo(() => {
    if (!search.trim()) return fileList;
    return fileList.filter(f => f.toLowerCase().includes(search.toLowerCase()));
  }, [fileList, search]);

  // Fix: Auto-select single match or first match when searching
  useEffect(() => {
    if (search.trim() && filteredFiles.length > 0 && !filteredFiles.includes(activeFile)) {
      const first = filteredFiles[0];
      setInternalSelectedFile(first);
      onSelectFile?.(first);
    }
  }, [search, filteredFiles, activeFile, onSelectFile]);

  // ── Helper to calculate blast radius for any file ──
  const getFileBlastRadius = (filename) => {
    const directCons = consumerMap.get(filename) || [];
    const directDeps = dependencyMap.get(filename) || [];
    const totalImpact = directCons.length;

    if (totalImpact >= 6) {
      return {
        level: 'Critical',
        color: 'red',
        role: 'Core Anchor File',
        desc: `High blast radius (${totalImpact} dependents). Significant refactoring risk.`,
        directCons,
        directDeps
      };
    } else if (totalImpact >= 2) {
      return {
        level: 'Moderate',
        color: 'yellow',
        role: 'Intermediate Service Module',
        desc: `Moderate impact (${totalImpact} dependents). Test connected consumers when editing.`,
        directCons,
        directDeps
      };
    }
    return {
      level: 'Low',
      color: 'green',
      role: 'Leaf Component / Utility',
      desc: 'Minimal architectural impact. Safe to modify or refactor.',
      directCons,
      directDeps
    };
  };

  // ── Calculate Direct & Cascading Relationships for Active File ──
  const relationships = useMemo(() => {
    if (!activeFile) return null;

    const directConsumers = consumerMap.get(activeFile) || [];
    const directDependencies = dependencyMap.get(activeFile) || [];

    // 2-hop cascading consumers
    const secondaryConsumers = new Set();
    if (hopDepth > 1) {
      for (const c of directConsumers) {
        for (const sc of consumerMap.get(c) || []) {
          if (sc !== activeFile && !directConsumers.includes(sc)) {
            secondaryConsumers.add(sc);
          }
        }
      }
    }

    const blastRadius = getFileBlastRadius(activeFile);

    // ── Generate Isolated Subgraph Mermaid ──
    const cleanId = (name) => name.replace(/[^a-zA-Z0-9]/g, '_');
    const activeShort = activeFile.split('/').pop();
    const mermaidLines = ['graph LR'];

    // Target Node
    mermaidLines.push(`  TARGET["${activeShort}"]:::targetNode`);

    // Inbound Consumers
    if (directConsumers.length === 0) {
      mermaidLines.push('  NO_CONS["(No Inbound Consumers)"]:::mutedNode -.-> TARGET');
    } else {
      directConsumers.slice(0, 8).forEach((c, idx) => {
        const cShort = c.split('/').pop();
        mermaidLines.push(`  C_${idx}["[IN] ${cShort}"]:::consumerNode --> TARGET`);
      });
    }

    // Outbound Dependencies
    if (directDependencies.length === 0) {
      mermaidLines.push('  TARGET -.-> NO_DEPS["(No Local Dependencies)"]:::mutedNode');
    } else {
      directDependencies.slice(0, 8).forEach((d, idx) => {
        const dShort = d.split('/').pop();
        mermaidLines.push(`  TARGET --> D_${idx}["[OUT] ${dShort}"]:::depNode`);
      });
    }

    mermaidLines.push('  classDef targetNode fill:#7c3aed,stroke:#a78bfa,stroke-width:2px,color:#ffffff,font-weight:bold;');
    mermaidLines.push('  classDef consumerNode fill:#059669,stroke:#34d399,stroke-width:1px,color:#ffffff;');
    mermaidLines.push('  classDef depNode fill:#0284c7,stroke:#38bdf8,stroke-width:1px,color:#ffffff;');
    mermaidLines.push('  classDef mutedNode fill:#334155,stroke:#64748b,stroke-width:1px,stroke-dasharray: 5 5,color:#94a3b8;');

    return {
      directConsumers,
      secondaryConsumers: Array.from(secondaryConsumers),
      directDependencies,
      blastRadius,
      subgraph: mermaidLines.join('\n')
    };
  }, [activeFile, consumerMap, dependencyMap, hopDepth]);

  const handleSelect = (file) => {
    setInternalSelectedFile(file);
    onSelectFile?.(file);
  };

  // Lookup coupling info for drawer file
  const couplingMap = couplingData?.couplingMap || [];
  const drawerCoupling = useMemo(() => {
    if (!drawerFile) return null;
    return couplingMap.find(c => c.file === drawerFile);
  }, [drawerFile, couplingMap]);

  // Lookup raw file content for LOC & stats
  const drawerRawFile = useMemo(() => {
    if (!drawerFile) return null;
    return files.find(f => f.name === drawerFile);
  }, [drawerFile, files]);

  const drawerLoc = drawerRawFile?.content ? drawerRawFile.content.split('\n').length : 0;
  const drawerExt = drawerFile ? drawerFile.split('.').pop() : '';
  const drawerBlast = drawerFile ? getFileBlastRadius(drawerFile) : null;

  return (
    <Card glow className="overflow-hidden relative">
      <CardHeader>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Network className="w-5 h-5 text-violet-500 animate-pulse" />
            <div>
              <h2 className="font-semibold text-slate-900 dark:text-white text-base">
                Focused File Lineage & Blast Radius Explorer
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Isolate any file's direct consumers, dependencies, and architectural change risk
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Hop Filter */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
              <span className="text-[11px] text-slate-500 px-2 font-medium">Depth:</span>
              <button
                onClick={() => setHopDepth(1)}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                  hopDepth === 1 ? 'bg-violet-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-white'
                }`}
              >
                1-Hop
              </button>
              <button
                onClick={() => setHopDepth(2)}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                  hopDepth === 2 ? 'bg-violet-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-white'
                }`}
              >
                2-Hop
              </button>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardBody className="!p-5 space-y-6">
        {/* ── File Selector Search Bar ── */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search file to inspect relationships..."
              className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-violet-500 font-mono"
            />
            {search && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono text-slate-400">
                {filteredFiles.length} match{filteredFiles.length !== 1 ? 'es' : ''}
              </span>
            )}
          </div>

          <select
            value={activeFile}
            onChange={(e) => handleSelect(e.target.value)}
            className="bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-violet-500 max-w-xs"
          >
            {filteredFiles.map((f, i) => (
              <option key={i} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>

        {relationships && (
          <div className="space-y-6">
            {/* ── Blast Radius & Role Banner ── */}
            <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-violet-500/10 border border-violet-500/20">
                  <FileCode className="w-5 h-5 text-violet-500" />
                </div>
                <div>
                  <div className="flex items-center gap-2 font-mono">
                    <span className="font-bold text-slate-900 dark:text-white text-sm">
                      {activeFile.split('/').pop()}
                    </span>
                    <Badge color={relationships.blastRadius.color}>
                      {relationships.blastRadius.level} Risk
                    </Badge>
                    <button
                      onClick={() => setDrawerFile(activeFile)}
                      className="text-[10px] text-violet-500 hover:text-violet-400 hover:underline flex items-center gap-1 font-sans"
                    >
                      <Info className="w-3 h-3" /> View details
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Role: <strong className="text-slate-700 dark:text-slate-300">{relationships.blastRadius.role}</strong> — {relationships.blastRadius.desc}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4 text-xs font-mono">
                <div className="text-center">
                  <div className="text-emerald-500 font-bold text-base">{relationships.directConsumers.length}</div>
                  <div className="text-[10px] text-slate-400">Consumers</div>
                </div>
                <div className="w-px h-6 bg-slate-200 dark:bg-slate-800" />
                <div className="text-center">
                  <div className="text-cyan-500 font-bold text-base">{relationships.directDependencies.length}</div>
                  <div className="text-[10px] text-slate-400">Imports</div>
                </div>
              </div>
            </div>

            {/* ── Isolated Neighborhood Sub-Graph ── */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-100/40 dark:bg-slate-950/60 p-4">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center justify-between">
                <span>Isolated Neighborhood Sub-Graph</span>
                <span className="text-[10px] font-mono text-slate-400">Green = Consumers | Blue = Dependencies</span>
              </div>
              <MermaidRenderer
                diagram={relationships.subgraph}
                title={`Lineage Neighborhood: ${activeFile.split('/').pop()}`}
              />
            </div>

            {/* ── Inbound vs Outbound Lists ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Inbound Consumers */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Who Imports This? ({relationships.directConsumers.length})
                  </span>
                  <span className="text-[10px] text-slate-400">Inbound Consumers</span>
                </div>

                {relationships.directConsumers.length === 0 ? (
                  <p className="text-xs text-slate-500 py-2">No other files import this module directly.</p>
                ) : (
                  <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                    {relationships.directConsumers.map((c, i) => (
                      <div
                        key={i}
                        className="group p-2 rounded-lg bg-white dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 text-xs font-mono text-slate-700 dark:text-slate-300 hover:border-emerald-500/50 transition-all flex items-center justify-between gap-2"
                      >
                        <span
                          onClick={() => handleSelect(c)}
                          className="truncate cursor-pointer hover:text-emerald-500 flex-1"
                          title={c}
                        >
                          {c}
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => setDrawerFile(c)}
                            title="Inspect file details"
                            className="p-1 rounded text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
                          >
                            <Info className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleSelect(c)}
                            title="Switch lineage to this file"
                            className="p-1 rounded text-slate-400 hover:text-emerald-500 hover:bg-emerald-500/10"
                          >
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Outbound Dependencies */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-cyan-600 dark:text-cyan-400 flex items-center gap-1.5">
                    <ArrowRight className="w-3.5 h-3.5" />
                    What Does This Import? ({relationships.directDependencies.length})
                  </span>
                  <span className="text-[10px] text-slate-400">Outbound Dependencies</span>
                </div>

                {relationships.directDependencies.length === 0 ? (
                  <p className="text-xs text-slate-500 py-2">No internal local modules imported.</p>
                ) : (
                  <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                    {relationships.directDependencies.map((d, i) => (
                      <div
                        key={i}
                        className="group p-2 rounded-lg bg-white dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 text-xs font-mono text-slate-700 dark:text-slate-300 hover:border-cyan-500/50 transition-all flex items-center justify-between gap-2"
                      >
                        <span
                          onClick={() => handleSelect(d)}
                          className="truncate cursor-pointer hover:text-cyan-500 flex-1"
                          title={d}
                        >
                          {d}
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => setDrawerFile(d)}
                            title="Inspect file details"
                            className="p-1 rounded text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
                          >
                            <Info className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleSelect(d)}
                            title="Switch lineage to this file"
                            className="p-1 rounded text-slate-400 hover:text-cyan-500 hover:bg-cyan-500/10"
                          >
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Per-File Detail Slide-in Drawer ── */}
        {drawerFile && (
          <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-96 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/80">
              <div className="flex items-center gap-2">
                <FileCode className="w-4 h-4 text-violet-500" />
                <span className="font-bold text-sm text-slate-900 dark:text-white truncate max-w-[200px]" title={drawerFile}>
                  {drawerFile.split('/').pop()}
                </span>
              </div>
              <button
                onClick={() => setDrawerFile(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Drawer Content */}
            <div className="p-4 overflow-y-auto space-y-4 flex-1 text-xs">
              {/* Full Path */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">File Path</label>
                <p className="mt-0.5 p-2 rounded-lg bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono text-slate-700 dark:text-slate-300 break-all select-all">
                  {drawerFile}
                </p>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-center">
                  <div className="text-base font-bold font-mono text-slate-900 dark:text-white">{drawerLoc.toLocaleString()}</div>
                  <div className="text-[10px] text-slate-400">Lines of Code</div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-center">
                  <div className="text-base font-bold font-mono uppercase text-violet-500">{drawerExt || 'TXT'}</div>
                  <div className="text-[10px] text-slate-400">Extension</div>
                </div>
              </div>

              {/* Blast Radius Badge & Info */}
              {drawerBlast && (
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Blast Radius</span>
                    <Badge color={drawerBlast.color}>{drawerBlast.level} Risk</Badge>
                  </div>
                  <p className="text-slate-700 dark:text-slate-300 font-medium">{drawerBlast.role}</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">{drawerBlast.desc}</p>
                </div>
              )}

              {/* Coupling Metrics */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Coupling Analysis</span>
                  {drawerCoupling?.coupled && (
                    <Badge color="orange">High Coupling</Badge>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <span className="text-sm font-bold font-mono text-cyan-500">{drawerCoupling?.outDegree ?? drawerBlast?.directDeps?.length ?? 0}</span>
                    <p className="text-[10px] text-slate-400">Out-Degree (Imports)</p>
                  </div>
                  <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <span className="text-sm font-bold font-mono text-emerald-500">{drawerCoupling?.inDegree ?? drawerBlast?.directCons?.length ?? 0}</span>
                    <p className="text-[10px] text-slate-400">In-Degree (Used By)</p>
                  </div>
                </div>
              </div>

              {/* Consumers list */}
              {drawerBlast?.directCons && (
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Direct Dependents ({drawerBlast.directCons.length})
                  </label>
                  <div className="mt-1 space-y-1 max-h-32 overflow-y-auto">
                    {drawerBlast.directCons.length === 0 ? (
                      <p className="text-[11px] text-slate-400 italic">None</p>
                    ) : (
                      drawerBlast.directCons.map((c, i) => (
                        <div
                          key={i}
                          onClick={() => { setDrawerFile(c); }}
                          className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono text-[11px] text-slate-600 dark:text-slate-400 truncate cursor-pointer hover:text-emerald-400"
                        >
                          {c}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Drawer Actions */}
            <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center gap-2">
              <button
                onClick={() => {
                  handleSelect(drawerFile);
                  setDrawerFile(null);
                }}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-xs transition-colors"
              >
                <Zap className="w-3.5 h-3.5" /> Focus in Lineage
              </button>
              <button
                onClick={() => setDrawerFile(null)}
                className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
