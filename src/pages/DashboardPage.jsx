// src/pages/DashboardPage.jsx
import React, { useState, useEffect } from 'react';
import {
  ArrowLeft, ScanSearch, Network, Layers, GitBranch, Server,
  ShieldAlert, Award, Copy, LayoutDashboard, Search, FileCode, Flame, Bug, AlertTriangle, Wifi
} from 'lucide-react';
import useAnalysisStore from '../store/useAnalysisStore';
import MetricsTable from '../components/dashboard/MetricsTable';
import RequirementsList from '../components/dashboard/RequirementsList';
import MermaidRenderer from '../components/dashboard/MermaidRenderer';
import StructureTree from '../components/dashboard/StructureTree';
import DownloadButton from '../components/dashboard/DownloadButton';
import ApiRoutesTable from '../components/dashboard/ApiRoutesTable';
import ComplexityCard from '../components/dashboard/ComplexityCard';
import HealthScorecardCard from '../components/dashboard/HealthScorecardCard';
import DeadCodeDuplicationCard from '../components/dashboard/DeadCodeDuplicationCard';
import InteractiveGraphCanvas from '../components/dashboard/InteractiveGraphCanvas';
import RefactorHotspotCard from '../components/dashboard/RefactorHotspotCard';
import CommandPaletteModal from '../components/dashboard/CommandPaletteModal';
import FileRelationshipExplorer from '../components/dashboard/FileRelationshipExplorer';
import ComplexityReportCard from '../components/dashboard/ComplexityReportCard';
import GodFilesCard from '../components/dashboard/GodFilesCard';
import CommentRatioCard from '../components/dashboard/CommentRatioCard';
import ThemeToggle from '../components/ui/ThemeToggle';
import SkeletonCard, { SkeletonDiagram } from '../components/ui/SkeletonCard';

const SECTIONS = [
  { id: 'overview',     label: 'Overview & Health',      icon: LayoutDashboard },
  { id: 'architecture', label: 'Architecture & Lineage', icon: Layers },
  { id: 'api',          label: 'API Routes & Models',    icon: Server },
  { id: 'health',       label: 'Code Quality & Smells',  icon: ShieldAlert },
  { id: 'explorer',     label: 'File Explorer & Tree',   icon: FileCode },
];

const DIAGRAM_TABS = [
  { id: 'hld',      label: 'High-Level Design (HLD)', icon: Layers,   key: 'hld' },
  { id: 'lineage',  label: 'File Lineage Graph',       icon: Network,  key: 'lineage' },
  { id: 'lld',      label: 'Low-Level Design (LLD)',  icon: GitBranch, key: 'lld' },
  { id: 'topology', label: 'API & DB Topology Graph',  icon: Server,   key: 'topology' },
];

export default function DashboardPage({ onBack }) {
  const { result, status } = useAnalysisStore();
  const [activeSection, setActiveSection] = useState('overview');
  const [activeTab, setActiveTab] = useState('hld');
  const [selectedLineageFile, setSelectedLineageFile] = useState('');
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);

  const isAnalyzing = status === 'analyzing' || status === 'uploading' || status === 'fetching_git';
  const pythonAnalysis = result?.pythonAnalysis || {};
  const rateLimit = result?.rateLimit || null;
  const sectionIds = SECTIONS.map(s => s.id);

  // Keyboard shortcuts: 1–5 switch sections, Ctrl+K opens palette
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.ctrlKey && e.key === 'k') { e.preventDefault(); setIsPaletteOpen(true); return; }
      const idx = parseInt(e.key, 10) - 1;
      if (idx >= 0 && idx < sectionIds.length) setActiveSection(sectionIds[idx]);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [sectionIds]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0A0A0F] text-slate-900 dark:text-white transition-colors duration-300">
      {/* Ambient glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/4 w-[600px] h-[300px] rounded-full bg-violet-500/5 dark:bg-violet-600/5 blur-[100px]" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[300px] rounded-full bg-cyan-500/5 dark:bg-cyan-600/5 blur-[80px]" />
      </div>

      {/* ── Top Bar / Navbar ── */}
      <header className="relative z-20 flex items-center justify-between px-6 py-3.5 border-b border-slate-200 dark:border-slate-800/80 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md sticky top-0 shadow-sm dark:shadow-none">
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
            <span className="font-bold text-sm tracking-tight text-slate-900 dark:text-white">CodeScanner</span>
          </div>
        </div>

        {/* Global Search Button / Trigger */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsPaletteOpen(true)}
            className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100/80 dark:bg-slate-900/80 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 text-xs transition-colors"
          >
            <Search className="w-3.5 h-3.5" />
            <span>Search project...</span>
            <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] font-mono text-slate-400">Ctrl K</kbd>
          </button>

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

      {/* ── Section Navigation Switcher ── */}
      <div className="relative z-10 border-b border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-950/50 backdrop-blur-sm sticky top-[57px]">
        <div className="max-w-7xl mx-auto px-6 flex space-x-1 overflow-x-auto py-2">
          {SECTIONS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveSection(id)}
              className={`
                flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-200
                ${activeSection === id
                  ? 'bg-violet-600 text-white shadow-sm dark:shadow-violet-600/20'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-900'
                }
              `}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Main Content ── */}
      <main className="relative z-10 max-w-7xl mx-auto px-6 py-8 space-y-8">

        {/* ── GitHub Rate Limit Banner ── */}
        {rateLimit && rateLimit.remaining < 10 && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300 text-xs font-medium mb-0">
            <Wifi className="w-4 h-4 shrink-0" />
            <span>
              GitHub API rate limit low: <strong>{rateLimit.remaining}</strong> requests remaining.
              Resets at {new Date(rateLimit.resetAt).toLocaleTimeString()}. Add a Personal Access Token to increase limits.
            </span>
          </div>
        )}

        {/* ── TAB 1: OVERVIEW ── */}
        {activeSection === 'overview' && (
          <div className="space-y-8">
            {/* Overall Health Scorecard */}
            {result?.scorecard && (
              <HealthScorecardCard scorecard={result.scorecard} />
            )}

            {/* Refactor Hotspots */}
            <RefactorHotspotCard hotspots={pythonAnalysis.hotspots || []} />

            {/* God Files + Comment Ratio */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <GodFilesCard
                largeFiles={result?.largeFiles || []}
                onSelectFile={(f) => { setSelectedLineageFile(f); setActiveSection('architecture'); }}
              />
              <CommentRatioCard commentRatios={result?.commentRatios || {}} />
            </div>

            {/* Metrics + Requirements */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {isAnalyzing || !result?.metrics
                ? <SkeletonCard rows={5} />
                : <MetricsTable metrics={result.metrics} rawFiles={result.rawFiles || []} />
              }
              {isAnalyzing || !result?.requirements
                ? <SkeletonCard rows={5} />
                : <RequirementsList requirements={result.requirements} />
              }
            </div>
          </div>
        )}

        {/* ── TAB 2: ARCHITECTURE & DIAGRAMS ── */}
        {activeSection === 'architecture' && (
          <div className="space-y-8">
            {/* Focused File Lineage & Blast Radius Explorer */}
            {result?.rawFiles && (
              <FileRelationshipExplorer
                files={result.rawFiles}
                selectedFile={selectedLineageFile}
                onSelectFile={(f) => setSelectedLineageFile(f)}
                couplingData={result?.couplingData || {}}
              />
            )}

            {/* Clustered 2D Architecture Canvas */}
            {result?.rawFiles && (
              <InteractiveGraphCanvas
                files={result.rawFiles}
                structureTree={result.structureTree || {}}
                onSelectFile={(f) => setSelectedLineageFile(f)}
              />
            )}

            {/* Mermaid Tabbed Diagrams */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/60 backdrop-blur-md overflow-hidden shadow-sm dark:shadow-none">
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

              <div className="p-5">
                {isAnalyzing || !result ? (
                  <SkeletonDiagram />
                ) : (
                  <DiagramPanel result={result} activeTab={activeTab} />
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 3: API & DATABASE ── */}
        {activeSection === 'api' && (
          <div className="space-y-8">
            <ApiRoutesTable
              routes={pythonAnalysis.apiRoutes || []}
              schemas={pythonAnalysis.databaseSchemas || []}
            />
          </div>
        )}

        {/* ── TAB 4: CODE HEALTH & QUALITY ── */}
        {activeSection === 'health' && (
          <div className="space-y-8">
            {/* JS/TS Complexity Report — top of the section */}
            <ComplexityReportCard
              complexityReport={result?.complexityReport || {}}
              couplingData={result?.couplingData || {}}
            />

            {/* Anti-Patterns, Circular Dependencies, Security, & Python AST Complexity */}
            <ComplexityCard
              securityIssues={[
                ...(pythonAnalysis.securityIssues || []),
                ...(result?.jsSecurityIssues || []),
              ]}
              antiPatterns={pythonAnalysis.antiPatterns || []}
              circularDependencies={[
                ...(pythonAnalysis.circularDependencies || []),
                ...(result?.jsCircularDeps || []),
              ]}
              pythonAST={pythonAnalysis.pythonAST || { classes: [], functions: [] }}
              totalPythonFiles={pythonAnalysis.totalPythonFiles || 0}
            />

            {/* Dead Code & Duplications */}
            <DeadCodeDuplicationCard
              deadCode={result?.deadCode || {}}
              duplication={result?.duplication || {}}
              licenseAudit={result?.licenseAudit || {}}
            />
          </div>
        )}

        {/* ── TAB 5: FILE EXPLORER ── */}
        {activeSection === 'explorer' && (
          <div className="space-y-8">
            {result?.structureTree && (
              <StructureTree structureTree={result.structureTree} />
            )}
          </div>
        )}
      </main>

      {/* ── Global Search Command Palette Modal ── */}
      <CommandPaletteModal
        isOpen={isPaletteOpen}
        onClose={() => setIsPaletteOpen(false)}
        result={result}
        onSelectSection={(sec) => setActiveSection(sec)}
      />
    </div>
  );
}

function DiagramPanel({ result, activeTab }) {
  const pythonAnalysis = result?.pythonAnalysis || {};
  const diagrams = {
    hld:      { data: result.hld,                             title: 'High-Level Architecture (Folder Topology)' },
    lineage:  { data: result.lineage,                         title: 'File Lineage & Local Dependency Graph' },
    lld:      { data: result.lld,                             title: 'Low-Level Design (Classes & Signatures)' },
    topology: { data: pythonAnalysis.apiTopologyDiagram,      title: 'API Endpoint & Database Topology Graph' },
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
