// src/components/dashboard/MetricsTable.jsx
import React from 'react';
import { FileCode, Hash, BarChart3, Code } from 'lucide-react';
import Badge from '../ui/Badge';
import Card, { CardHeader, CardBody } from '../ui/Card';
import { LANG_MAP } from '../../utils/fileFilter';

function formatNumber(n) {
  if (typeof n !== 'number') return '0';
  return n.toLocaleString();
}

function StatCard({ icon: Icon, label, value, color = 'violet' }) {
  const colors = {
    violet: 'text-violet-600 dark:text-violet-400 bg-violet-500/10 border-violet-200 dark:border-violet-500/20',
    cyan:   'text-cyan-600 dark:text-cyan-400 bg-cyan-500/10 border-cyan-200 dark:border-cyan-500/20',
    green:  'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20',
  };
  return (
    <div className="flex items-center gap-3.5 p-4 rounded-xl bg-slate-50/80 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800">
      <div className={`p-2.5 rounded-xl border ${colors[color] || colors.violet}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-xl font-bold text-slate-900 dark:text-white leading-none">{value}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">{label}</p>
      </div>
    </div>
  );
}

export default function MetricsTable({ metrics }) {
  if (!metrics) return null;
  const { totalFiles, totalLines, byLanguage = {} } = metrics;
  const topLangs = Object.entries(byLanguage).sort(([, a], [, b]) => b - a);

  return (
    <Card glow>
      <CardHeader>
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-violet-600 dark:text-violet-400" />
          <h2 className="font-semibold text-slate-900 dark:text-white text-base">Codebase Metrics</h2>
        </div>
      </CardHeader>
      <CardBody className="space-y-6">
        {/* Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <StatCard icon={FileCode} label="Total Source Files" value={formatNumber(totalFiles)} color="violet" />
          <StatCard icon={Hash} label="Lines of Code" value={formatNumber(totalLines)} color="cyan" />
          <StatCard icon={Code} label="Languages Detected" value={Object.keys(byLanguage).length} color="green" />
        </div>

        {/* Language Breakdown */}
        <div>
          <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
            Language Breakdown
          </h3>
          <div className="space-y-3">
            {topLangs.map(([ext, lines]) => {
              const pct = totalLines > 0 ? Math.round((lines / totalLines) * 100) : 0;
              const langInfo = LANG_MAP[ext] || { label: ext === '.other' ? 'Other Files' : ext.replace('.', '').toUpperCase(), color: 'gray' };
              return (
                <div key={ext} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <Badge color={langInfo.color} className="font-mono">{ext}</Badge>
                      <span className="text-slate-700 dark:text-slate-300 font-medium">{langInfo.label}</span>
                    </div>
                    <span className="text-slate-600 dark:text-slate-400 font-medium font-mono">
                      {formatNumber(lines)} lines · <strong className="text-slate-900 dark:text-white">{pct}%</strong>
                    </span>
                  </div>
                  {/* Progress bar */}
                  <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-500 transition-all duration-700"
                      style={{ width: `${Math.max(pct, 2)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
