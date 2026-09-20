// src/components/dashboard/HealthScorecardCard.jsx
import React from 'react';
import { Award, ShieldAlert, AlertTriangle, CheckCircle2, Info, ArrowUpRight, Activity } from 'lucide-react';
import Card, { CardHeader, CardBody } from '../ui/Card';
import Badge from '../ui/Badge';

export default function HealthScorecardCard({ scorecard }) {
  if (!scorecard) return null;

  const { score = 100, grade = 'A+', color = 'emerald', breakdown = {}, recommendations = [] } = scorecard;

  const getGradeBadge = (g) => {
    switch (g) {
      case 'A+':
      case 'A':
        return <span className="text-4xl font-black text-emerald-500 dark:text-emerald-400 drop-shadow">{g}</span>;
      case 'B':
        return <span className="text-4xl font-black text-cyan-500 dark:text-cyan-400 drop-shadow">{g}</span>;
      case 'C':
        return <span className="text-4xl font-black text-yellow-500 dark:text-yellow-400 drop-shadow">{g}</span>;
      case 'D':
        return <span className="text-4xl font-black text-amber-500 dark:text-amber-400 drop-shadow">{g}</span>;
      default:
        return <span className="text-4xl font-black text-red-500 dark:text-red-400 drop-shadow">{g}</span>;
    }
  };

  const getRecIcon = (type) => {
    switch (type) {
      case 'critical': return <ShieldAlert className="w-4 h-4 text-red-500 shrink-0" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />;
      case 'info': return <Info className="w-4 h-4 text-cyan-500 shrink-0" />;
      default: return <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />;
    }
  };

  return (
    <Card glow className="overflow-hidden">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-violet-500 dark:text-violet-400" />
            <h2 className="font-semibold text-slate-900 dark:text-white text-base">
              Codebase Health Scorecard
            </h2>
          </div>
          <Badge color={color} className="font-bold text-xs">
            Overall Health Audit
          </Badge>
        </div>
      </CardHeader>
      <CardBody className="!px-6 !py-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
          {/* Grade & Circle Score */}
          <div className="flex flex-col items-center justify-center p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-center space-y-2">
            <div className="relative flex items-center justify-center w-28 h-28 rounded-full border-4 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-inner">
              {getGradeBadge(grade)}
            </div>
            <div className="space-y-0.5">
              <div className="text-2xl font-black text-slate-900 dark:text-white font-mono">
                {score}<span className="text-sm text-slate-400 font-normal">/100</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Architecture Grade</p>
            </div>
          </div>

          {/* Breakdown Bars */}
          <div className="space-y-3 md:col-span-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-violet-500" />
              Health Sub-System Metrics
            </h3>

            <div className="space-y-2 text-xs">
              <BarItem label="Security & Risk Assessment" value={breakdown.securityScore || 0} max={30} color="bg-emerald-500" />
              <BarItem label="Cyclomatic Complexity" value={breakdown.complexityScore || 0} max={20} color="bg-cyan-500" />
              <BarItem label="Code Duplication & Hashing" value={breakdown.duplicationScore || 0} max={20} color="bg-violet-500" />
              <BarItem label="Dead Code & Orphan Files" value={breakdown.deadCodeScore || 0} max={15} color="bg-amber-500" />
              <BarItem label="Test Coverage & License Audit" value={breakdown.testScore || 0} max={15} color="bg-pink-500" />
            </div>
          </div>
        </div>

        {/* Actionable Recommendations */}
        {recommendations.length > 0 && (
          <div className="mt-6 pt-5 border-t border-slate-200 dark:border-slate-800 space-y-2.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Actionable Quality Recommendations
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {recommendations.map((rec, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 text-xs text-slate-800 dark:text-slate-200"
                >
                  {getRecIcon(rec.type)}
                  <span className="leading-snug">{rec.text}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function BarItem({ label, value, max, color }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div className="space-y-1">
      <div className="flex justify-between font-mono text-[11px] text-slate-700 dark:text-slate-300">
        <span>{label}</span>
        <span className="font-bold">{value}/{max} pts</span>
      </div>
      <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
