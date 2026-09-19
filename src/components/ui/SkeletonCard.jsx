// src/components/ui/SkeletonCard.jsx
import React from 'react';

export function SkeletonLine({ width = 'full', height = '4' }) {
  const widths = { full: 'w-full', '3/4': 'w-3/4', half: 'w-1/2', '1/3': 'w-1/3', quarter: 'w-1/4' };
  return (
    <div className={`${widths[width] || 'w-full'} h-${height} rounded-lg bg-slate-200 dark:bg-slate-800 animate-pulse`} />
  );
}

export default function SkeletonCard({ rows = 4, title = true }) {
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/60 p-6 space-y-4">
      {title && <SkeletonLine width="half" height="5" />}
      <div className="space-y-3 pt-2">
        {Array.from({ length: rows }).map((_, i) => (
          <SkeletonLine key={i} width={i % 3 === 0 ? '3/4' : i % 3 === 1 ? 'full' : 'half'} />
        ))}
      </div>
    </div>
  );
}

export function SkeletonDiagram() {
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/60 p-6">
      <SkeletonLine width="1/3" height="5" />
      <div className="mt-6 h-64 rounded-xl bg-slate-100 dark:bg-slate-950 animate-pulse flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 opacity-40">
          <div className="w-10 h-10 rounded-full bg-violet-500 animate-pulse" />
          <div className="w-px h-8 bg-slate-400 dark:bg-slate-600" />
          <div className="w-20 h-8 rounded-lg bg-cyan-500 animate-pulse" />
          <div className="w-px h-8 bg-slate-400 dark:bg-slate-600" />
          <div className="flex gap-6">
            <div className="w-16 h-8 rounded-lg bg-violet-500/50 animate-pulse" />
            <div className="w-16 h-8 rounded-lg bg-cyan-500/50 animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function Loader({ message = 'Analyzing...' }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-12">
      <div className="relative w-12 h-12">
        <div className="absolute inset-0 rounded-full border-2 border-violet-500/30 border-t-violet-500 animate-spin" />
      </div>
      <p className="text-slate-500 dark:text-slate-400 text-sm animate-pulse font-medium">{message}</p>
    </div>
  );
}
