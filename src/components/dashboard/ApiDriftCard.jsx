// src/components/dashboard/ApiDriftCard.jsx
import React, { useState } from 'react';
import {
  PlugZap, AlertTriangle, CheckCircle2, ArrowRight,
  Server, Laptop, Sparkles, Check, HelpCircle
} from 'lucide-react';
import Card, { CardHeader, CardBody } from '../ui/Card';
import Badge from '../ui/Badge';
import { generateSingleIssuePrompt } from '../../utils/remediationSpecGenerator';

export default function ApiDriftCard({ apiDrift = {} }) {
  const [activeTab, setActiveTab] = useState('dangling'); // 'dangling' | 'matched' | 'orphan'
  const [copiedIdx, setCopiedIdx] = useState(null);

  const driftScore = apiDrift.driftScore ?? 100;
  const danglingCalls = apiDrift.danglingCalls || [];
  const matchedContracts = apiDrift.matchedContracts || [];
  const orphanRoutes = apiDrift.orphanRoutes || [];
  const totalCalls = apiDrift.totalClientCalls || 0;
  const totalBackend = apiDrift.totalBackendRoutes || 0;

  const handleCopyPrompt = (item, idx) => {
    const prompt = generateSingleIssuePrompt('api_drift', item);
    navigator.clipboard.writeText(prompt);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const getScoreBadge = (score) => {
    if (score >= 90) return <Badge color="green">{score}% Synced</Badge>;
    if (score >= 70) return <Badge color="yellow">{score}% Synced</Badge>;
    return <Badge color="red">{score}% Drifted</Badge>;
  };

  return (
    <Card glow className="overflow-hidden">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
              <PlugZap className="w-4 h-4 text-cyan-500" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-900 dark:text-white text-base">
                API Contract Drift Detector
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Cross-references client HTTP requests (<code className="font-mono">fetch</code>, <code className="font-mono">axios</code>) against backend route declarations
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono">
            {getScoreBadge(driftScore)}
            <span className="text-slate-400">{totalCalls} Client Calls</span>
          </div>
        </div>
      </CardHeader>

      <CardBody className="!px-5 !py-4 space-y-4">
        {/* ── Sub-tabs ── */}
        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
          <button
            onClick={() => setActiveTab('dangling')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'dangling'
                ? 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/30'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
            <span>Dangling Client Calls</span>
            <span className="font-mono text-[10px] px-1.5 py-0.2 rounded-full bg-red-500/20">
              {danglingCalls.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('matched')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'matched'
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            <span>Verified Contracts</span>
            <span className="font-mono text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-500/20">
              {matchedContracts.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('orphan')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'orphan'
                ? 'bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Server className="w-3.5 h-3.5 text-slate-400" />
            <span>Orphan Backend Endpoints</span>
            <span className="font-mono text-[10px] px-1.5 py-0.2 rounded-full bg-slate-300 dark:bg-slate-700">
              {orphanRoutes.length}
            </span>
          </button>
        </div>

        {/* ── Tab Content ── */}

        {/* 1. DANGLING CALLS */}
        {activeTab === 'dangling' && (
          <div className="space-y-2.5">
            {danglingCalls.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">
                <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-2" />
                No dangling client API calls. Every frontend endpoint call has a matching backend handler!
              </div>
            ) : (
              danglingCalls.map((item, idx) => {
                const isCopied = copiedIdx === idx;
                return (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl border border-red-200 dark:border-red-900/40 bg-red-50/50 dark:bg-red-950/20 text-xs font-mono space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="px-1.5 py-0.5 rounded bg-red-500 text-white font-bold text-[10px]">
                          {item.method || 'GET'}
                        </span>
                        <span className="font-bold text-red-700 dark:text-red-300 text-sm">
                          {item.endpoint}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleCopyPrompt(item, idx)}
                          title="Generate missing backend route with AI"
                          className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-white dark:bg-slate-900 text-red-600 dark:text-red-300 border border-red-300 dark:border-red-900/60 hover:border-red-500 transition-colors font-sans"
                        >
                          {isCopied ? <Check className="w-3 h-3 text-emerald-500" /> : <Sparkles className="w-3 h-3 text-red-500" />}
                          <span>{isCopied ? 'Copied' : 'AI Generate Route'}</span>
                        </button>
                        <Badge color="red">Missing Backend Handler</Badge>
                      </div>
                    </div>

                    <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 font-sans">
                      <Laptop className="w-3 h-3 text-slate-400" />
                      <span>Called in client file:</span>
                      <code className="font-mono text-slate-700 dark:text-slate-300 font-bold">{item.file}:{item.line || 1}</code>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* 2. MATCHED CONTRACTS */}
        {activeTab === 'matched' && (
          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {matchedContracts.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">
                No matching client-server endpoint pairs identified.
              </div>
            ) : (
              matchedContracts.map((m, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 text-xs font-mono flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="px-1.5 py-0.5 rounded bg-emerald-500 text-white font-bold text-[10px]">
                      {m.method}
                    </span>
                    <span className="font-bold text-slate-900 dark:text-white truncate">
                      {m.endpoint}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 font-sans shrink-0">
                    <span className="truncate max-w-[140px]" title={m.clientFile}>{m.clientFile.split('/').pop()}</span>
                    <ArrowRight className="w-3 h-3 text-emerald-500 shrink-0" />
                    <span className="truncate max-w-[140px] text-slate-800 dark:text-slate-200 font-semibold" title={m.backendFile}>{m.backendFile.split('/').pop()}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* 3. ORPHAN ROUTES */}
        {activeTab === 'orphan' && (
          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {orphanRoutes.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">
                Every backend route is consumed by the client app!
              </div>
            ) : (
              orphanRoutes.map((o, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 text-xs font-mono flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-[10px]">
                      {o.method}
                    </span>
                    <span className="text-slate-800 dark:text-slate-200 font-semibold truncate">
                      {o.path}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-slate-400 shrink-0 font-sans">
                    <span>{o.framework || 'Backend'}</span>
                    <span className="font-mono text-slate-500 truncate max-w-[120px]" title={o.file}>({o.file.split('/').pop()})</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
