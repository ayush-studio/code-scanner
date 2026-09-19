// src/components/dashboard/StructureTree.jsx
import React, { useState } from 'react';
import { Folder, File, ChevronRight, ChevronDown, Search } from 'lucide-react';
import Card, { CardHeader, CardBody } from '../ui/Card';

function TreeNode({ name, value, depth = 0, filter = '' }) {
  const [open, setOpen] = useState(depth < 2);
  const isDir = value !== null && typeof value === 'object';

  if (!isDir) {
    if (filter && !name.toLowerCase().includes(filter.toLowerCase())) return null;
    return (
      <div
        className="flex items-center gap-2 py-1 px-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors cursor-default"
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        <File className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
        <span className="text-slate-700 dark:text-slate-300 text-xs font-mono truncate">{name}</span>
      </div>
    );
  }

  const children = Object.entries(value);

  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-1.5 py-1 px-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors text-left"
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {open
          ? <ChevronDown className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
          : <ChevronRight className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
        }
        <Folder className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400 shrink-0" />
        <span className="text-slate-900 dark:text-slate-200 text-xs font-mono font-semibold">{name}</span>
        <span className="ml-auto text-slate-400 dark:text-slate-500 text-[10px] font-mono">{children.length}</span>
      </button>
      {open && (
        <div>
          {children.map(([k, v]) => (
            <TreeNode key={k} name={k} value={v} depth={depth + 1} filter={filter} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function StructureTree({ structureTree }) {
  const [search, setSearch] = useState('');
  if (!structureTree || Object.keys(structureTree).length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Folder className="w-4 h-4 text-violet-600 dark:text-violet-400" />
            <h2 className="font-semibold text-slate-900 dark:text-white text-base">Project Structure Tree</h2>
          </div>
          {/* Quick Filter Search */}
          <div className="relative max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search files..."
              className="w-full bg-slate-100 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-lg pl-8 pr-3 py-1 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-violet-500"
            />
          </div>
        </div>
      </CardHeader>
      <CardBody className="!px-3 !py-3">
        <div className="max-h-96 overflow-y-auto pr-1">
          {Object.entries(structureTree).map(([k, v]) => (
            <TreeNode key={k} name={k} value={v} depth={0} filter={search} />
          ))}
        </div>
      </CardBody>
    </Card>
  );
}
