// src/pages/DashboardPage.jsx
import React, { useState } from 'react';
import { ArrowLeft, ScanSearch, Network, Layers, GitBranch } from 'lucide-react';
import useAnalysisStore from '../store/useAnalysisStore';
import MetricsTable from '../components/dashboard/MetricsTable';
import RequirementsList from '../components/dashboard/RequirementsList';
import MermaidRenderer from '../components/dashboard/MermaidRenderer';
import StructureTree from '../components/dashboard/StructureTree';
import DownloadButton from '../components/dashboard/DownloadButton';
import ThemeToggle from '../components/ui/ThemeToggle';
import SkeletonCard, { SkeletonDiagram } from '../components/ui/SkeletonCard';

const DIAGRAM_TABS = [
  { id: 'hld',     label: 'High-Level Design (HLD)', icon: Layers,   key: 'hld' },
  { id: 'lineage', label: 'File Lineage Graph',       icon: Network,  key: 'lineage' },
  { id: 'lld',     label: 'Low-Level Design (LLD)',  icon: GitBranch, key: 'lld' },
];

export default function DashboardPage({ onBack }) {
  const { result, status } = useAnalysisStore();
  const [activeTab, setActiveTab] = useState('hld');

  const isAnalyzing = status === 'analyzing' || status === 'uploading' || status === 'fetching_git';

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0A0A0F] text-slate-900 dark:text-white transition-colors duration-300">
      {/* Subtle ambient glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/4 w-[600px] h-[300px] rounded-full bg-violet-500/5 dark:bg-violet-600/5 blur-[100px]" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[300px] rounded-full bg-cyan-500/5 dark:bg-cyan-600/5 blur-[80px]" />
      </div>

      {/* ── Top Bar / Navbar ── */}
      <header className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800/80 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md sticky top-0 shadow-sm dark:shadow-none">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-medium transition-colors text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            New Scan
          </button>
          <div className="w-px h-5 bg-slate-200 dark:bg-slate-800" />
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-violet-500/10 dark:bg-violet-600/20 border border-violet-500/20 dark:border-violet-500/30">
              <ScanSearch className="w-4 h-4 text-violet-600 dark:text-violet-400" />
            </div>
            <span className="font-bold text-sm tracking-tight text-slate-900 dark:text-white">Analysis Dashboard</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {result && <DownloadButton result={result} />}
          <ThemeToggle />
          {result && (
            <div className="hidden sm:flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1.5 rounded-full">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Complete
            </div>
          )}
        </div>
      </header>

      {/* ── Main Content ── */}
      <main className="relative z-10 max-w-7xl mx-auto px-6 py-8 space-y-8">

        {/* Row 1: Metrics + Requirements */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {isAnalyzing || !result?.metrics
            ? <SkeletonCard rows={5} />
            : <MetricsTable metrics={result.metrics} />
          }
          {isAnalyzing || !result?.requirements
            ? <SkeletonCard rows={5} />
            : <RequirementsList requirements={result.requirements} />
          }
        </div>

        {/* Row 2: Diagrams with tabs */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/60 backdrop-blur-md overflow-hidden shadow-sm dark:shadow-none">
          {/* Tab Bar */}
          <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-950/60 overflow-x-auto">
            {DIAGRAM_TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`
                  flex items-center gap-2 px-5 py-3.5 text-sm font-semibold transition-all duration-200 whitespace-nowrap
                  border-b-2 -mb-px
                  ${activeTab === id
                    ? 'border-violet-600 dark:border-violet-500 text-violet-700 dark:text-violet-300 bg-violet-500/10 dark:bg-violet-500/10'
                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800/40'
                  }
                `}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>

          {/* Active Diagram Panel */}
          <div className="p-5">
            {isAnalyzing || !result ? (
              <SkeletonDiagram />
            ) : (
              <DiagramPanel result={result} activeTab={activeTab} />
            )}
          </div>
        </div>

        {/* Row 3: Structure Tree */}
        {result?.structureTree && (
          <StructureTree structureTree={result.structureTree} />
        )}
      </main>
    </div>
  );
}

function DiagramPanel({ result, activeTab }) {
  const diagrams = {
    hld:     { data: result.hld,     title: 'High-Level Architecture (Folder Topology)' },
    lineage: { data: result.lineage, title: 'File Lineage & Local Dependency Graph' },
    lld:     { data: result.lld,     title: 'Low-Level Design (Classes & Signatures)' },
  };

  const { data, title } = diagrams[activeTab] || diagrams.hld;

  if (!data) {
    return (
      <div className="text-center py-16 text-slate-400 text-sm font-medium">
        No diagram data generated for this view.
      </div>
    );
  }

  return <MermaidRenderer diagram={data} title={title} />;
}
