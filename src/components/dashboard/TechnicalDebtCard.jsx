// src/components/dashboard/TechnicalDebtCard.jsx
import React, { useState, useMemo } from 'react';
import {
  Clock, AlertOctagon, CheckCircle2, Search, Filter,
  Sparkles, Check, FileCode, Tag, ChevronDown, ChevronUp
} from 'lucide-react';
import Card, { CardHeader, CardBody } from '../ui/Card';
import Badge from '../ui/Badge';
import { generateSingleIssuePrompt } from '../../utils/remediationSpecGenerator';

const TAG_CONFIG = {
  FIXME:    { color: 'red',    bg: 'bg-red-500/10 border-red-500/20 text-red-500',       badge: 'red',    label: 'FIXME' },
  HACK:     { color: 'orange', bg: 'bg-orange-500/10 border-orange-500/20 text-orange-500', badge: 'orange', label: 'HACK' },
  BUG:      { color: 'red',    bg: 'bg-red-500/10 border-red-500/20 text-red-500',       badge: 'red',    label: 'BUG' },
  XXX:      { color: 'red',    bg: 'bg-red-500/10 border-red-500/20 text-red-500',       badge: 'red',    label: 'XXX' },
  OPTIMIZE: { color: 'yellow', bg: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-500', badge: 'yellow', label: 'OPTIMIZE' },
  TODO:     { color: 'cyan',   bg: 'bg-cyan-500/10 border-cyan-500/20 text-cyan-500',    badge: 'cyan',   label: 'TODO' },
};

export default function TechnicalDebtCard({ technicalDebt = {} }) {
  const [activeTag, setActiveTag] = useState('ALL');
  const [search, setSearch] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState(null);

  const items = technicalDebt.items || [];
  const byTag = technicalDebt.byTag || {};
  const totalCount = technicalDebt.totalCount || items.length;
  const highSeverityCount = technicalDebt.highSeverityCount || 0;

  const filteredItems = useMemo(() => {
    let result = items;
    if (activeTag !== 'ALL') {
      result = result.filter(item => item.tag === activeTag);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(item =>
        item.message.toLowerCase().includes(q) ||
        item.file.toLowerCase().includes(q) ||
        (item.author && item.author.toLowerCase().includes(q))
      );
    }
    return result;
  }, [items, activeTag, search]);

  const visibleItems = showAll ? filteredItems : filteredItems.slice(0, 8);

  const handleCopyPrompt = (item, idx) => {
    const prompt = generateSingleIssuePrompt('debt', item);
    navigator.clipboard.writeText(prompt);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  if (totalCount === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-slate-500" />
            <h2 className="font-semibold text-slate-900 dark:text-white text-base">Technical Debt & Annotations</h2>
          </div>
        </CardHeader>
        <CardBody className="!py-8 text-center text-slate-500 text-xs">
          <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-2" />
          No TODO, FIXME, or HACK comments found. Clean codebase annotations!
        </CardBody>
      </Card>
    );
  }

  return (
    <Card glow className="overflow-hidden">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <Clock className="w-4 h-4 text-amber-500" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-900 dark:text-white text-base">
                Technical Debt & Annotation Tracker
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Indexed TODO, FIXME, HACK, and OPTIMIZE flags with direct file locations
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono">
            {highSeverityCount > 0 ? (
              <Badge color="red">{highSeverityCount} Urgent Fixes</Badge>
            ) : (
              <Badge color="green">No Urgent Fixes</Badge>
            )}
            <Badge color="gray">{totalCount} Total Items</Badge>
          </div>
        </div>
      </CardHeader>

      <CardBody className="!px-5 !py-4 space-y-4">
        {/* ── Filter Tags & Search Bar ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setActiveTag('ALL')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold font-mono transition-all ${
                activeTag === 'ALL'
                  ? 'bg-violet-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              ALL ({totalCount})
            </button>
            {Object.entries(byTag).map(([tag, count]) => {
              if (count === 0) return null;
              const cfg = TAG_CONFIG[tag] || TAG_CONFIG.TODO;
              const isSelected = activeTag === tag;
              return (
                <button
                  key={tag}
                  onClick={() => setActiveTag(tag)}
                  className={`px-2 py-1 rounded-lg text-[11px] font-semibold font-mono transition-all flex items-center gap-1 ${
                    isSelected
                      ? 'bg-violet-600 text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  <span>{tag}</span>
                  <span className="opacity-70 text-[10px]">({count})</span>
                </button>
              );
            })}
          </div>

          {/* Quick Search */}
          <div className="relative w-full sm:w-56">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search debt notes..."
              className="w-full bg-slate-100 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-xl pl-8 pr-3 py-1 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-violet-500 font-mono"
            />
          </div>
        </div>

        {/* ── Debt List Rows ── */}
        <div className="space-y-2">
          {filteredItems.length === 0 ? (
            <p className="text-center py-6 text-xs text-slate-400">No debt annotations matching your filters.</p>
          ) : (
            visibleItems.map((item, idx) => {
              const cfg = TAG_CONFIG[item.tag] || TAG_CONFIG.TODO;
              const isCopied = copiedIdx === idx;

              return (
                <div
                  key={idx}
                  className="group p-3 rounded-xl bg-slate-50/70 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-all space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded border ${cfg.bg}`}>
                        {item.tag}
                      </span>
                      {item.author && (
                        <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                          @{item.author}
                        </span>
                      )}
                      <span className="text-xs font-mono text-slate-500 dark:text-slate-400 truncate">
                        {item.shortName}:{item.line}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleCopyPrompt(item, idx)}
                        title="Copy AI Prompt to resolve this debt comment"
                        className="opacity-80 group-hover:opacity-100 flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:border-violet-500 transition-all"
                      >
                        {isCopied ? <Check className="w-3 h-3 text-emerald-500" /> : <Sparkles className="w-3 h-3 text-violet-500" />}
                        <span>{isCopied ? 'Copied' : 'AI Prompt'}</span>
                      </button>
                      <Badge color={cfg.badge}>{item.severity}</Badge>
                    </div>
                  </div>

                  <p className="text-xs text-slate-800 dark:text-slate-200 font-medium leading-relaxed pl-1 border-l-2 border-slate-300 dark:border-slate-700">
                    {item.message}
                  </p>
                </div>
              );
            })
          )}
        </div>

        {filteredItems.length > 8 && (
          <button
            onClick={() => setShowAll(s => !s)}
            className="w-full flex items-center justify-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white py-2 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600 transition-all mt-1"
          >
            {showAll ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            {showAll ? 'Show less' : `Show ${filteredItems.length - 8} more annotations`}
          </button>
        )}
      </CardBody>
    </Card>
  );
}
