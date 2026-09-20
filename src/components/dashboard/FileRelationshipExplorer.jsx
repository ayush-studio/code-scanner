// src/components/dashboard/FileRelationshipExplorer.jsx
import React, { useState, useMemo } from 'react';
import { Network, Search, ArrowRight, ArrowLeft, ShieldAlert, CheckCircle, FileCode, Layers, Filter } from 'lucide-react';
import Card, { CardHeader, CardBody } from '../ui/Card';
import Badge from '../ui/Badge';
import MermaidRenderer from './MermaidRenderer';

export default function FileRelationshipExplorer({ files = [], selectedFile: externalSelectedFile, onSelectFile }) {
  const [internalSelectedFile, setInternalSelectedFile] = useState('');
  const [search, setSearch] = useState('');
  const [hopDepth, setHopDepth] = useState(1); // 1-hop or 2-hop

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

  // ── Calculate Direct & Cascading Relationships ──
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

    // Blast Radius Assessment
    const totalImpactCount = directConsumers.length + secondaryConsumers.size;
    let blastRadius = {
      level: 'Low',
      color: 'green',
      role: 'Leaf Component / Utility',
      desc: 'Minimal architectural impact. Safe to modify or refactor.'
    };

    if (totalImpactCount >= 6) {
      blastRadius = {
        level: 'Critical',
        color: 'red',
        role: 'Core Anchor File',
        desc: `High blast radius (${totalImpactCount} downstream dependents). Modifying may cause widespread breaking changes.`
      };
    } else if (totalImpactCount >= 2) {
      blastRadius = {
        level: 'Moderate',
        color: 'yellow',
        role: 'Intermediate Service Module',
        desc: `Moderate impact (${totalImpactCount} downstream dependents). Test connected consumers when editing.`
      };
    }

    // ── Generate Isolated Subgraph Mermaid ──
    const cleanId = (name) => name.replace(/[^a-zA-Z0-9]/g, '_');
    const activeShort = activeFile.split('/').pop();
    const mermaidLines = ['graph LR'];

    // Target Node
    mermaidLines.push(`  TARGET["🎯 ${activeShort}"]:::targetNode`);

    // Inbound Consumers
    if (directConsumers.length === 0) {
      mermaidLines.push('  NO_CONS["(No Inbound Consumers)"]:::mutedNode -.-> TARGET');
    } else {
      directConsumers.slice(0, 8).forEach((c, idx) => {
        const cId = cleanId(c);
        const cShort = c.split('/').pop();
        mermaidLines.push(`  C_${idx}["📥 ${cShort}"]:::consumerNode --> TARGET`);
      });
    }

    // Outbound Dependencies
    if (directDependencies.length === 0) {
      mermaidLines.push('  TARGET -.-> NO_DEPS["(No Local Dependencies)"]:::mutedNode');
    } else {
      directDependencies.slice(0, 8).forEach((d, idx) => {
        const dId = cleanId(d);
        const dShort = d.split('/').pop();
        mermaidLines.push(`  TARGET --> D_${idx}["📤 ${dShort}"]:::depNode`);
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

  const filteredFiles = fileList.filter(f =>
    f.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = (file) => {
    setInternalSelectedFile(file);
    onSelectFile?.(file);
  };

  return (
    <Card glow className="overflow-hidden">
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
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {relationships.directConsumers.map((c, i) => (
                      <div
                        key={i}
                        onClick={() => handleSelect(c)}
                        className="p-2 rounded-lg bg-white dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 text-xs font-mono text-slate-700 dark:text-slate-300 hover:border-emerald-500/50 cursor-pointer flex items-center justify-between truncate"
                      >
                        <span className="truncate">{c}</span>
                        <ArrowRight className="w-3 h-3 text-slate-400 shrink-0 ml-1" />
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
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {relationships.directDependencies.map((d, i) => (
                      <div
                        key={i}
                        onClick={() => handleSelect(d)}
                        className="p-2 rounded-lg bg-white dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 text-xs font-mono text-slate-700 dark:text-slate-300 hover:border-cyan-500/50 cursor-pointer flex items-center justify-between truncate"
                      >
                        <span className="truncate">{d}</span>
                        <ArrowRight className="w-3 h-3 text-slate-400 shrink-0 ml-1" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
