// src/components/dashboard/GodFilesCard.jsx
import React, { useState } from 'react';
import { Layers, CheckCircle, AlertTriangle, XCircle, Sparkles, Check, Copy } from 'lucide-react';
import Card, { CardHeader, CardBody } from '../ui/Card';
import Badge from '../ui/Badge';
import { generateSingleIssuePrompt } from '../../utils/remediationSpecGenerator';

const SEV_CONFIG = {
  Critical: { icon: XCircle,     color: 'text-red-400',    bg: 'bg-red-500/10 border-red-500/20',    bar: 'bg-red-500',    badge: 'red' },
  High:     { icon: AlertTriangle, color: 'text-amber-400',  bg: 'bg-amber-500/10 border-amber-500/20',  bar: 'bg-amber-500',  badge: 'amber' },
  Moderate: { icon: AlertTriangle, color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20', bar: 'bg-yellow-500', badge: 'yellow' },
};

export default function GodFilesCard({ largeFiles = [], onSelectFile }) {
  const [copiedIdx, setCopiedIdx] = useState(null);

  if (!largeFiles || largeFiles.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-slate-500" />
            <h2 className="font-semibold text-slate-900 dark:text-white text-base">God File / Large File Detector</h2>
          </div>
        </CardHeader>
        <CardBody className="!py-8 text-center text-slate-500 text-xs">
          <CheckCircle className="w-6 h-6 text-emerald-500 mx-auto mb-2" />
          No files exceed the 350-line threshold. Codebase is well-modularised.
        </CardBody>
      </Card>
    );
  }

  const maxLoc = largeFiles[0]?.loc || 1;

  const handleCopyPrompt = (e, item, idx) => {
    e.stopPropagation();
    const prompt = generateSingleIssuePrompt('god_file', item);
    navigator.clipboard.writeText(prompt);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  return (
    <Card glow className="overflow-hidden">
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-orange-500/10 border border-orange-500/20">
              <Layers className="w-4 h-4 text-orange-500" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-900 dark:text-white text-base">God File / Large File Detector</h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Source files exceeding the recommended 350-line threshold
              </p>
            </div>
          </div>
          <Badge color="orange">{largeFiles.length} oversized</Badge>
        </div>
      </CardHeader>

      <CardBody className="!px-5 !py-4">
        <div className="space-y-3">
          {largeFiles.map((item, idx) => {
            const cfg = SEV_CONFIG[item.severity] || SEV_CONFIG.Moderate;
            const Icon = cfg.icon;
            const pct = Math.round((item.loc / maxLoc) * 100);
            const isCopied = copiedIdx === idx;

            return (
              <div
                key={idx}
                onClick={() => onSelectFile?.(item.file)}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all hover:scale-[1.005] group ${cfg.bg}`}
              >
                <div className="flex items-start justify-between gap-3 mb-2.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <Icon className={`w-4 h-4 shrink-0 ${cfg.color}`} />
                    <span className="text-xs font-mono font-bold text-slate-900 dark:text-white truncate max-w-[200px]" title={item.file}>
                      {item.shortName}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={(e) => handleCopyPrompt(e, item, idx)}
                      title="Copy AI Refactoring Prompt for this file"
                      className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-white/80 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:border-violet-500 transition-colors"
                    >
                      {isCopied ? <Check className="w-3 h-3 text-emerald-500" /> : <Sparkles className="w-3 h-3 text-violet-500" />}
                      <span>{isCopied ? 'Copied' : 'AI Prompt'}</span>
                    </button>
                    <Badge color={cfg.badge}>{item.severity}</Badge>
                    <span className="text-xs font-mono font-bold text-slate-600 dark:text-slate-300">
                      {item.loc.toLocaleString()} LOC
                    </span>
                  </div>
                </div>

                {/* LOC bar */}
                <div className="w-full h-2 bg-slate-200/70 dark:bg-slate-800/70 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${cfg.bar}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>

                <p className="mt-2 text-[11px] text-slate-600 dark:text-slate-400 leading-snug">
                  {item.warning}
                </p>

                {/* Full path */}
                <p className="mt-1 text-[10px] font-mono text-slate-400 dark:text-slate-500 truncate" title={item.file}>
                  {item.file}
                </p>
              </div>
            );
          })}
        </div>
      </CardBody>
    </Card>
  );
}
