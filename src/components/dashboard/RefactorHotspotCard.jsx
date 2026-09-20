// src/components/dashboard/RefactorHotspotCard.jsx
import React from 'react';
import { Flame, AlertCircle, ArrowRight, CheckCircle, FileCode } from 'lucide-react';
import Card, { CardHeader, CardBody } from '../ui/Card';
import Badge from '../ui/Badge';

export default function RefactorHotspotCard({ hotspots = [] }) {
  if (!hotspots || hotspots.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-amber-500" />
            <h2 className="font-semibold text-slate-900 dark:text-white text-base">
              Refactoring Priority Hotspots
            </h2>
          </div>
        </CardHeader>
        <CardBody className="!py-6 text-center text-slate-500 text-xs">
          <CheckCircle className="w-6 h-6 text-emerald-500 mx-auto mb-2" />
          No high-complexity or oversized modules requiring immediate refactoring.
        </CardBody>
      </Card>
    );
  }

  const getPriorityBadge = (priority) => {
    switch (priority) {
      case 'Critical':
        return <Badge color="red" className="font-bold">Critical Refactor</Badge>;
      case 'Moderate':
        return <Badge color="yellow">Moderate Priority</Badge>;
      default:
        return <Badge color="gray">Low Risk</Badge>;
    }
  };

  return (
    <Card glow className="overflow-hidden">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-amber-500 animate-pulse" />
            <div>
              <h2 className="font-semibold text-slate-900 dark:text-white text-base">
                Refactoring Priority Hotspots
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Ranked by combined Cyclomatic Complexity × Size Risk formula
              </p>
            </div>
          </div>
          <Badge color="amber">{hotspots.length} Modules Flagged</Badge>
        </div>
      </CardHeader>
      <CardBody className="!px-4 !py-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {hotspots.map((item, idx) => (
            <div
              key={idx}
              className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 space-y-2 hover:border-amber-500/30 transition-all shadow-sm dark:shadow-none"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 font-mono text-xs font-bold text-slate-900 dark:text-white truncate">
                  <FileCode className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span className="truncate max-w-[200px]" title={item.file}>{item.shortName}</span>
                </div>
                {getPriorityBadge(item.priority)}
              </div>

              <div className="flex items-center gap-3 text-[11px] font-mono text-slate-600 dark:text-slate-400">
                <span>LOC: <strong>{item.loc}</strong></span>
                <span>•</span>
                <span>Complexity: <strong>{item.complexity}</strong></span>
                <span>•</span>
                <span className="text-amber-600 dark:text-amber-400 font-bold">Risk: {item.riskScore}</span>
              </div>

              <div className="p-2 rounded bg-white dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800/80 text-[11px] text-slate-700 dark:text-slate-300 flex items-start gap-1.5">
                <ArrowRight className="w-3 h-3 text-amber-500 shrink-0 mt-0.5" />
                <span className="leading-snug">{item.recommendation}</span>
              </div>
            </div>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}
