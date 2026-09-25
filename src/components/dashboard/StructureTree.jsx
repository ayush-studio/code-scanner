// src/components/dashboard/StructureTree.jsx
import React, { useState, useMemo } from 'react';
import {
  Folder, FolderOpen, File, ChevronRight, ChevronDown,
  Search, X, ChevronsUpDown, Check
} from 'lucide-react';
import Card, { CardHeader, CardBody } from '../ui/Card';

// Helper to highlight matching substring in file/folder name
function HighlightText({ text = '', query = '' }) {
  if (!query.trim()) return <span>{text}</span>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <span>{text}</span>;

  const before = text.slice(0, idx);
  const match = text.slice(idx, idx + query.length);
  const after = text.slice(idx + query.length);

  return (
    <span>
      {before}
      <mark className="bg-violet-500/30 text-violet-700 dark:text-violet-300 font-bold rounded px-0.5 not-italic">
        {match}
      </mark>
      {after}
    </span>
  );
}

// Recursively count total matching files and check if subtree has matches
function checkSubtreeMatch(val, name, query) {
  if (!query.trim()) return { hasMatch: true, matchCount: 1 };
  const nameMatches = name.toLowerCase().includes(query.toLowerCase());

  if (val === null || typeof val !== 'object') {
    return { hasMatch: nameMatches, matchCount: nameMatches ? 1 : 0 };
  }

  let total = nameMatches ? 1 : 0;
  let hasAny = nameMatches;

  for (const [k, v] of Object.entries(val)) {
    const sub = checkSubtreeMatch(v, k, query);
    if (sub.hasMatch) {
      hasAny = true;
      total += sub.matchCount;
    }
  }

  return { hasMatch: hasAny, matchCount: total };
}

function TreeNode({ name, value, depth = 0, filter = '', forceExpand = false }) {
  const isDir = value !== null && typeof value === 'object';
  const { hasMatch } = checkSubtreeMatch(value, name, filter);

  // If there's an active search and this node has a match, force open it
  const [userToggled, setUserToggled] = useState(null);
  const isOpen = userToggled !== null ? userToggled : (filter ? hasMatch : depth < 2 || forceExpand);

  if (filter && !hasMatch) return null;

  if (!isDir) {
    return (
      <div
        className="flex items-center gap-2 py-1 px-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors cursor-default"
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        <File className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
        <span className="text-slate-700 dark:text-slate-300 text-xs font-mono truncate">
          <HighlightText text={name} query={filter} />
        </span>
      </div>
    );
  }

  const children = Object.entries(value);

  return (
    <div>
      <button
        onClick={() => setUserToggled(!isOpen)}
        className="w-full flex items-center gap-1.5 py-1 px-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors text-left"
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {isOpen ? (
          <ChevronDown className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
        )}
        {isOpen ? (
          <FolderOpen className="w-3.5 h-3.5 text-violet-500 shrink-0" />
        ) : (
          <Folder className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400 shrink-0" />
        )}
        <span className="text-slate-900 dark:text-slate-200 text-xs font-mono font-semibold">
          <HighlightText text={name} query={filter} />
        </span>
        <span className="ml-auto text-slate-400 dark:text-slate-500 text-[10px] font-mono">
          {children.length}
        </span>
      </button>

      {isOpen && (
        <div>
          {children.map(([k, v]) => (
            <TreeNode
              key={k}
              name={k}
              value={v}
              depth={depth + 1}
              filter={filter}
              forceExpand={forceExpand}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function StructureTree({ structureTree }) {
  const [search, setSearch] = useState('');
  const [expandAll, setExpandAll] = useState(false);

  const totalMatches = useMemo(() => {
    if (!structureTree || !search.trim()) return null;
    let count = 0;
    for (const [k, v] of Object.entries(structureTree)) {
      count += checkSubtreeMatch(v, k, search).matchCount;
    }
    return count;
  }, [structureTree, search]);

  if (!structureTree || Object.keys(structureTree).length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Folder className="w-4 h-4 text-violet-600 dark:text-violet-400" />
            <h2 className="font-semibold text-slate-900 dark:text-white text-base">Project Structure Tree</h2>
          </div>

          <div className="flex items-center gap-2">
            {/* Quick Filter Search */}
            <div className="relative w-full sm:w-60">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search files & folders..."
                className="w-full bg-slate-100 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-xl pl-8 pr-7 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-violet-500 font-mono"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Expand / Collapse All Toggle */}
            <button
              onClick={() => setExpandAll(v => !v)}
              title={expandAll ? 'Collapse to default' : 'Expand all folders'}
              className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 text-xs transition-colors shrink-0"
            >
              <ChevronsUpDown className="w-4 h-4" />
            </button>
          </div>
        </div>

        {search && (
          <div className="mt-2 text-[11px] text-slate-500 font-mono">
            {totalMatches !== null && (
              <span>
                {totalMatches === 0 ? 'No matching files or folders found.' : `${totalMatches} item${totalMatches !== 1 ? 's' : ''} matched`}
              </span>
            )}
          </div>
        )}
      </CardHeader>

      <CardBody className="!px-3 !py-3">
        <div className="max-h-[500px] overflow-y-auto pr-1">
          {Object.entries(structureTree).map(([k, v]) => (
            <TreeNode
              key={k}
              name={k}
              value={v}
              depth={0}
              filter={search}
              forceExpand={expandAll}
            />
          ))}
        </div>
      </CardBody>
    </Card>
  );
}
