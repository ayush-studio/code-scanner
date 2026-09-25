// src/components/dashboard/ComplexityReportCard.jsx
import React, { useState } from 'react';
import { Zap, CheckCircle, ChevronDown, ChevronUp, ArrowUpDown } from 'lucide-react';
import Card, { CardHeader, CardBody } from '../ui/Card';
import Badge from '../ui/Badge';

const SEVERITY_CONFIG = {
  Critical: { color: 'red',    bar: 'bg-red-500',    text: 'text-red-400',    label: 'Critical' },
  High:     { color: 'amber',  bar: 'bg-amber-500',  text: 'text-amber-400',  label: 'High' },
  Medium:   { color: 'yellow', bar: 'bg-yellow-500',  text: 'text-yellow-400', label: 'Medium' },
  Low:      { color: 'green',  bar: 'bg-emerald-500', text: 'text-emerald-400',label: 'Low' },
};

export default function ComplexityReportCard({ complexityReport = {}, couplingData = {} }) {
  const [showAll, setShowAll] = useState(false);

  const byFile = complexityReport?.byFile || [];
  const highCount = complexityReport?.highComplexityCount || 0;
  const couplingMap = couplingData?.couplingMap || [];

  if (byFile.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-500" />
            <h2 className="font-semibold text-slate-900 dark:text-white text-base">JS/TS Complexity Report</h2>
          </div>
        </CardHeader>
        <CardBody className="!py-8 text-center text-slate-500 text-xs">
          <CheckCircle className="w-6 h-6 text-emerald-500 mx-auto mb-2" />
          No JavaScript/TypeScript files found to analyze.
        </CardBody>
      </Card>
    );
  }

  const maxComplexity = byFile[0]?.complexity || 1;
  const visible = showAll ? byFile : byFile.slice(0, 8);

  // Merge coupling data
  const couplingByFile = new Map(couplingMap.map(c => [c.file, c]));

  return (
    <Card glow className="overflow-hidden">
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
              <Zap className="w-4 h-4 text-yellow-500" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-900 dark:text-white text-base">JS/TS Complexity Report</h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                File-level complexity scored by branching keyword density
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono">
            {highCount > 0 ? (
              <Badge color="amber">{highCount} High-Risk</Badge>
            ) : (
              <Badge color="green">All Clean</Badge>
            )}
            <span className="text-slate-400">{byFile.length} files</span>
          </div>
        </div>
      </CardHeader>

      <CardBody className="!px-5 !py-4 space-y-2.5">
        {/* Legend */}
        <div className="flex items-center gap-4 text-[10px] font-mono text-slate-400 border-b border-slate-200 dark:border-slate-800 pb-2.5 flex-wrap gap-y-1">
          {Object.entries(SEVERITY_CONFIG).map(([key, cfg]) => (
            <span key={key} className="flex items-center gap-1">
              <span className={`w-2 h-2 rounded-full ${cfg.bar}`} />
              {cfg.label}
            </span>
          ))}
          <span className="ml-auto flex items-center gap-1"><ArrowUpDown className="w-3 h-3" /> Sorted by complexity</span>
        </div>

        {/* File rows */}
        <div className="space-y-2">
          {visible.map((item, idx) => {
            const cfg = SEVERITY_CONFIG[item.severity] || SEVERITY_CONFIG.Low;
            const pct = Math.round((item.complexity / maxComplexity) * 100);
            const coupling = couplingByFile.get(item.file);

            return (
              <div key={idx} className="group p-3 rounded-xl bg-slate-50/70 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-all">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <span className="text-xs font-mono font-semibold text-slate-900 dark:text-white truncate max-w-[260px]" title={item.file}>
                    {item.shortName}
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    {coupling?.coupled && (
                      <span className="text-[10px] text-orange-400 font-mono border border-orange-500/30 bg-orange-500/10 px-1.5 py-0.5 rounded">
                        High Coupling
                      </span>
                    )}
                    <span className={`text-[11px] font-bold font-mono ${cfg.text}`}>
                      {item.complexity}
                    </span>
                  </div>
                </div>

                {/* Complexity bar */}
                <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${cfg.bar}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>

                {/* Breakdown pills */}
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {item.breakdown && Object.entries(item.breakdown)
                    .filter(([, v]) => v > 0)
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 5)
                    .map(([k, v]) => (
                      <span key={k} className="text-[10px] font-mono text-slate-500 dark:text-slate-400 bg-slate-200/70 dark:bg-slate-800/80 px-1.5 py-0.5 rounded">
                        {k}: {v}
                      </span>
                    ))}
                  {coupling && (
                    <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 bg-cyan-500/10 border border-cyan-500/20 px-1.5 py-0.5 rounded">
                      out: {coupling.outDegree} in: {coupling.inDegree}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {byFile.length > 8 && (
          <button
            onClick={() => setShowAll(s => !s)}
            className="w-full flex items-center justify-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white py-2 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600 transition-all mt-1"
          >
            {showAll ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            {showAll ? 'Show less' : `Show ${byFile.length - 8} more files`}
          </button>
        )}
      </CardBody>
    </Card>
  );
}
