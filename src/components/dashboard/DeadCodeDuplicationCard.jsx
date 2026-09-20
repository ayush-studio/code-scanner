// src/components/dashboard/DeadCodeDuplicationCard.jsx
import React, { useState } from 'react';
import { Copy, Trash2, Scale, FileText, CheckCircle2 } from 'lucide-react';
import Card, { CardHeader, CardBody } from '../ui/Card';
import Badge from '../ui/Badge';

export default function DeadCodeDuplicationCard({ deadCode = {}, duplication = {}, licenseAudit = {} }) {
  const [tab, setTab] = useState('dead'); // 'dead' | 'duplication' | 'licenses'

  const unusedExports = deadCode.unusedExports || [];
  const orphanFiles = deadCode.orphanFiles || [];
  const duplicateBlocks = duplication.duplicateBlocks || [];
  const dependencies = licenseAudit.dependencies || [];

  return (
    <Card>
      <CardHeader className="!p-0 border-b border-slate-200 dark:border-slate-800">
        <div className="flex border-b sm:border-b-0 overflow-x-auto bg-slate-100/60 dark:bg-slate-950/60 rounded-t-2xl">
          <button
            onClick={() => setTab('dead')}
            className={`flex items-center gap-2 px-5 py-3.5 text-xs font-semibold border-b-2 -mb-px whitespace-nowrap transition-colors ${
              tab === 'dead'
                ? 'border-violet-600 dark:border-violet-500 text-violet-700 dark:text-violet-300 bg-violet-500/10'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Trash2 className="w-4 h-4 text-amber-500" />
            Unused Exports & Orphans ({unusedExports.length + orphanFiles.length})
          </button>

          <button
            onClick={() => setTab('duplication')}
            className={`flex items-center gap-2 px-5 py-3.5 text-xs font-semibold border-b-2 -mb-px whitespace-nowrap transition-colors ${
              tab === 'duplication'
                ? 'border-violet-600 dark:border-violet-500 text-violet-700 dark:text-violet-300 bg-violet-500/10'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Copy className="w-4 h-4 text-cyan-500" />
            Code Duplication ({duplication.duplicationPercentage || 0}%)
          </button>

          <button
            onClick={() => setTab('licenses')}
            className={`flex items-center gap-2 px-5 py-3.5 text-xs font-semibold border-b-2 -mb-px whitespace-nowrap transition-colors ${
              tab === 'licenses'
                ? 'border-violet-600 dark:border-violet-500 text-violet-700 dark:text-violet-300 bg-violet-500/10'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Scale className="w-4 h-4 text-pink-500" />
            License Compliance ({dependencies.length})
          </button>
        </div>
      </CardHeader>

      <CardBody className="!px-5 !py-4">
        {/* ── TAB 1: DEAD CODE & ORPHANS ── */}
        {tab === 'dead' && (
          <div className="space-y-4">
            {unusedExports.length === 0 && orphanFiles.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">No Dead Code or Orphan Files Detected</p>
                <p className="text-xs text-slate-500">All exported symbols and modules are referenced across the codebase.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Unused Exports */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                    <span>Unreferenced Exports</span>
                    <Badge color="amber">{unusedExports.length}</Badge>
                  </h4>
                  <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                    {unusedExports.map((exp, idx) => (
                      <div key={idx} className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 text-xs font-mono flex items-center justify-between">
                        <span className="font-bold text-amber-700 dark:text-amber-400">{exp.symbol}</span>
                        <span className="text-[10px] text-slate-500 truncate max-w-[150px]">{exp.file}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Orphan Files */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                    <span>Unimported Orphan Modules</span>
                    <Badge color="red">{orphanFiles.length}</Badge>
                  </h4>
                  <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                    {orphanFiles.map((file, idx) => (
                      <div key={idx} className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 text-xs font-mono text-slate-800 dark:text-slate-200 truncate">
                        {file}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── TAB 2: DUPLICATION BLOCKS ── */}
        {tab === 'duplication' && (
          <div className="space-y-3">
            {duplicateBlocks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Zero Code Duplication Detected</p>
                <p className="text-xs text-slate-500">No identical multi-line code blocks found across files.</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                {duplicateBlocks.map((block, idx) => (
                  <div key={idx} className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-cyan-600 dark:text-cyan-400 font-mono">
                        {block.instancesCount} identical occurrences ({block.lines} lines block)
                      </span>
                      <Badge color="cyan">{block.files.length} files</Badge>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {block.files.map((f, fi) => (
                        <span key={fi} className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-[10px] font-mono text-slate-600 dark:text-slate-300">
                          {f}
                        </span>
                      ))}
                    </div>
                    <pre className="p-2 rounded bg-slate-100 dark:bg-slate-950 text-[11px] font-mono text-slate-700 dark:text-slate-300 overflow-x-auto border border-slate-200 dark:border-slate-800">
                      {block.snippet}
                    </pre>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── TAB 3: LICENSES ── */}
        {tab === 'licenses' && (
          <div className="space-y-3">
            {dependencies.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-6">No explicit manifest dependencies found.</p>
            ) : (
              <div className="max-h-72 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-200 dark:divide-slate-800 bg-slate-50/50 dark:bg-slate-900/40">
                {dependencies.map((dep, idx) => (
                  <div key={idx} className="flex items-center justify-between px-4 py-2.5 text-xs font-mono">
                    <div className="space-y-0.5">
                      <span className="font-bold text-slate-900 dark:text-white">{dep.name}</span>
                      <span className="text-[10px] text-slate-400 ml-2">@{dep.version}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge color={dep.risk === 'High' ? 'red' : dep.risk === 'Medium' ? 'yellow' : 'green'}>
                        {dep.license}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
