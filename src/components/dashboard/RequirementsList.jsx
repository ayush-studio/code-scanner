// src/components/dashboard/RequirementsList.jsx
import React, { useState } from 'react';
import { Terminal, Package, Copy, Check } from 'lucide-react';
import Card, { CardHeader, CardBody } from '../ui/Card';
import Badge from '../ui/Badge';

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (_) {}
  };

  return (
    <button
      onClick={handleCopy}
      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition-all shrink-0"
      title="Copy to clipboard"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

export default function RequirementsList({ requirements }) {
  if (!requirements) return null;
  const { commands = [], dependencies = [] } = requirements;

  return (
    <Card glow>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
          <h2 className="font-semibold text-slate-900 dark:text-white text-base">Setup Requirements</h2>
        </div>
      </CardHeader>
      <CardBody className="space-y-6">
        {/* Setup commands */}
        {commands.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
              Commands to Run
            </h3>
            <div className="space-y-2">
              {commands.map((cmd, i) => (
                <div key={i} className="flex items-start justify-between gap-2 rounded-xl bg-slate-100 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 px-4 py-3 hover:border-violet-300 dark:hover:border-violet-500/30 transition-colors">
                  <pre className="font-mono text-xs text-violet-700 dark:text-emerald-300 leading-relaxed whitespace-pre-wrap flex-1">{cmd}</pre>
                  <CopyButton text={cmd} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Dependencies */}
        {dependencies.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Dependencies
              </h3>
              <Badge color="gray">{dependencies.length} packages</Badge>
            </div>
            <div className="max-h-56 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-200 dark:divide-slate-800 bg-slate-50/50 dark:bg-slate-900/40">
              {dependencies.map((dep, i) => (
                <div key={i} className="flex items-center justify-between px-4 py-2.5 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors text-xs">
                  <div className="flex items-center gap-2 truncate pr-2">
                    <Package className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
                    <span className="text-slate-800 dark:text-slate-200 font-semibold font-mono truncate">{dep.name}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-slate-500 dark:text-slate-400 font-mono">{dep.version}</span>
                    <Badge color="gray" className="text-[10px]">{dep.source}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {commands.length === 0 && dependencies.length === 0 && (
          <p className="text-slate-500 dark:text-slate-400 text-sm text-center py-6 font-medium">
            No dependency configuration files detected (package.json, requirements.txt, Dockerfile, etc.)
          </p>
        )}
      </CardBody>
    </Card>
  );
}
