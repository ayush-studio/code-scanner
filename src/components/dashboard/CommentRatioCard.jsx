// src/components/dashboard/CommentRatioCard.jsx
import React from 'react';
import { BookOpen, FileText, CheckCircle, AlertTriangle } from 'lucide-react';
import Card, { CardHeader, CardBody } from '../ui/Card';
import Badge from '../ui/Badge';

// Pure SVG donut ring — no library needed
function DonutRing({ pct, size = 80, stroke = 10, color = '#10b981' }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;

  return (
    <svg width={size} height={size} className="rotate-[-90deg]">
      {/* Track */}
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-slate-200 dark:text-slate-800" />
      {/* Fill */}
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.6s ease' }}
      />
    </svg>
  );
}

function getRingColor(ratio) {
  if (ratio >= 20) return '#10b981'; // emerald
  if (ratio >= 10) return '#06b6d4'; // cyan
  if (ratio >= 5)  return '#f59e0b'; // amber
  return '#ef4444';                  // red
}

function getRatioBadge(ratio) {
  if (ratio >= 20) return <Badge color="green">Well Documented</Badge>;
  if (ratio >= 10) return <Badge color="cyan">Documented</Badge>;
  if (ratio >= 5)  return <Badge color="yellow">Sparse Docs</Badge>;
  return <Badge color="red">Undocumented</Badge>;
}

export default function CommentRatioCard({ commentRatios = {} }) {
  const perFile = commentRatios?.perFile || [];
  const poorlyDocumented = commentRatios?.poorlyDocumented || [];
  const avgRatio = commentRatios?.avgRatio || 0;
  const documentedCount = commentRatios?.documentedFileCount || 0;
  const totalAnalyzed = commentRatios?.totalAnalyzed || 0;

  if (totalAnalyzed === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-slate-500" />
            <h2 className="font-semibold text-slate-900 dark:text-white text-base">Documentation Ratio</h2>
          </div>
        </CardHeader>
        <CardBody className="!py-8 text-center text-slate-500 text-xs">
          <CheckCircle className="w-6 h-6 text-emerald-500 mx-auto mb-2" />
          No source files found to analyze.
        </CardBody>
      </Card>
    );
  }

  const ringColor = getRingColor(avgRatio);
  const docPct = totalAnalyzed > 0 ? Math.round((documentedCount / totalAnalyzed) * 100) : 0;

  return (
    <Card glow className="overflow-hidden">
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
              <BookOpen className="w-4 h-4 text-cyan-500" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-900 dark:text-white text-base">Documentation Ratio</h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Comment-to-code density across {totalAnalyzed} source files
              </p>
            </div>
          </div>
          {getRatioBadge(avgRatio)}
        </div>
      </CardHeader>

      <CardBody className="!px-5 !py-4">
        {/* Stats row */}
        <div className="flex items-center gap-6 mb-5">
          {/* Donut */}
          <div className="relative shrink-0">
            <DonutRing pct={Math.min(avgRatio * 3, 100)} size={84} stroke={9} color={ringColor} />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-base font-bold text-slate-900 dark:text-white font-mono leading-none">{avgRatio}%</span>
              <span className="text-[9px] text-slate-400 leading-none mt-0.5">avg</span>
            </div>
          </div>

          {/* Metrics */}
          <div className="flex-1 grid grid-cols-2 gap-3">
            <div className="p-2.5 rounded-xl bg-slate-100/80 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-center">
              <div className="text-base font-bold text-emerald-500 font-mono">{documentedCount}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">Documented Files</div>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-100/80 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-center">
              <div className="text-base font-bold text-red-400 font-mono">{poorlyDocumented.length}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">Undocumented</div>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-100/80 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-center col-span-2">
              <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full transition-all duration-700" style={{ width: `${docPct}%` }} />
              </div>
              <div className="text-[10px] text-slate-400 mt-1">{docPct}% of files documented (&gt;10% ratio)</div>
            </div>
          </div>
        </div>

        {/* Poorly documented files */}
        {poorlyDocumented.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 text-amber-500" />
              Undocumented Files (&lt;5% comment ratio)
            </p>
            <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
              {poorlyDocumented.map((f, i) => (
                <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-amber-500/5 border border-amber-500/10 text-xs font-mono">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="w-3 h-3 text-amber-400 shrink-0" />
                    <span className="truncate text-slate-700 dark:text-slate-300" title={f.file}>{f.shortName}</span>
                  </div>
                  <span className="text-amber-500 font-bold shrink-0 ml-2">{f.commentRatio}%</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
