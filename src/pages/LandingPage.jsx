// src/pages/LandingPage.jsx
import React, { useState, useRef } from 'react';
import { ScanSearch, Zap, GitBranch, FolderOpen, BarChart3, Network, Layers, Shield, ChevronDown } from 'lucide-react';
import DropZone from '../components/scanner/DropZone';
import GitInput from '../components/scanner/GitInput';
import AnalysisControls from '../components/scanner/AnalysisControls';
import ThemeToggle from '../components/ui/ThemeToggle';
import useAnalysisStore from '../store/useAnalysisStore';
import { analyzeFiles } from '../services/analyzeService';
import { fetchGitHubRepo } from '../services/githubService';
import axios from 'axios';

const FEATURES = [
  {
    icon: Zap,
    color: 'text-amber-500 dark:text-yellow-400',
    bg: 'bg-amber-500/10',
    title: 'Zero AI APIs',
    desc: 'Fully deterministic static analysis. No OpenAI, no Anthropic — pure regex, AST heuristics, and lightning speed.',
  },
  {
    icon: BarChart3,
    color: 'text-violet-600 dark:text-violet-400',
    bg: 'bg-violet-500/10',
    title: 'Deep Code Metrics',
    desc: 'Lines of code, file counts, and accurate per-language breakdowns automatically extracted from valid source files.',
  },
  {
    icon: Network,
    color: 'text-cyan-600 dark:text-cyan-400',
    bg: 'bg-cyan-500/10',
    title: 'File Lineage Graph',
    desc: 'Traces import/require relationships to generate a visual, interactive dependency graph of your code modules.',
  },
  {
    icon: Layers,
    color: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-500/10',
    title: 'HLD + LLD Diagrams',
    desc: 'Auto-generates clean Mermaid flowcharts for high-level architecture and class/function structures.',
  },
  {
    icon: GitBranch,
    color: 'text-slate-700 dark:text-gray-300',
    bg: 'bg-slate-500/10 dark:bg-white/5',
    title: 'GitHub REST Integration',
    desc: 'Paste a GitHub repo URL to analyze public or private projects instantly using GitHub tree APIs.',
  },
  {
    icon: Shield,
    color: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-500/10',
    title: 'Privacy & Free Tier Ready',
    desc: 'Your code stays safe. Optimized for Vercel Free Tier with fast execution under 10 seconds.',
  },
];

export default function LandingPage({ onDone }) {
  const [tab, setTab] = useState('folder'); // 'folder' | 'git'
  const [localFiles, setLocalFiles] = useState([]);

  const { status, setStatus, setResult, setError, errorMsg } = useAnalysisStore();
  const isLoading = ['uploading', 'fetching_git', 'analyzing'].includes(status);

  const handleLocalAnalyze = async () => {
    if (!localFiles.length) return;
    setStatus('uploading');
    try {
      const result = await analyzeFiles(localFiles);
      setResult(result);
      onDone?.();
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Analysis failed');
    }
  };

  const handleGitAnalyze = async ({ url, token }) => {
    setStatus('fetching_git');
    try {
      const { files } = await fetchGitHubRepo(url, token);
      setStatus('analyzing');
      const response = await axios.post('/api/analyze', { files }, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 35000,
      });
      setResult(response.data);
      onDone?.();
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'GitHub fetch failed';
      setError(msg);
    }
  };

  const statusMessages = {
    uploading:    '📂 Serializing & reading files…',
    fetching_git: '🔗 Fetching repository tree from GitHub…',
    analyzing:    '⚡ Running static analysis pipeline…',
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0A0A0F] text-slate-900 dark:text-white transition-colors duration-300 overflow-x-hidden">
      {/* ── Background Ambient Glow ── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-violet-500/10 dark:bg-violet-600/10 blur-[120px] animate-pulse" />
        <div className="absolute top-1/2 -right-40 w-[500px] h-[500px] rounded-full bg-cyan-500/8 dark:bg-cyan-600/8 blur-[100px] animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      {/* ── Navbar ── */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-5 max-w-7xl mx-auto">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-violet-500/10 dark:bg-violet-600/20 border border-violet-500/20 dark:border-violet-500/30">
            <ScanSearch className="w-5 h-5 text-violet-600 dark:text-violet-400" />
          </div>
          <span className="font-bold text-xl tracking-tight text-slate-900 dark:text-white">CodeScanner</span>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="hidden md:block text-slate-500 dark:text-slate-400 font-medium">Zero-LLM · Zero-Cost · Vercel Ready</span>
          <ThemeToggle />
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative z-10 text-center px-6 pt-12 pb-16 max-w-4xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-violet-500/10 dark:bg-violet-500/10 border border-violet-500/20 text-violet-700 dark:text-violet-300 text-xs font-semibold mb-6">
          <Zap className="w-3.5 h-3.5" />
          No AI APIs. No subscriptions. 100% Deterministic Static Analysis.
        </div>

        <h1 className="text-4xl sm:text-6xl md:text-7xl font-black tracking-tight leading-tight mb-6">
          <span className="text-slate-900 dark:text-white">
            Visualize any
          </span>
          <br />
          <span className="bg-gradient-to-r from-violet-600 via-purple-600 to-cyan-500 dark:from-violet-400 dark:via-purple-400 dark:to-cyan-400 bg-clip-text text-transparent">
            codebase architecture
          </span>
        </h1>

        <p className="text-slate-600 dark:text-slate-400 text-base sm:text-xl max-w-2xl mx-auto leading-relaxed font-normal">
          Upload a project folder or paste a GitHub URL. Instant codebase metrics, file lineage graph,
          HLD/LLD Mermaid diagrams, and setup requirements.
        </p>

        <div className="mt-8 flex justify-center animate-bounce">
          <ChevronDown className="w-5 h-5 text-slate-400" />
        </div>
      </section>

      {/* ── Input Panel ── */}
      <section className="relative z-10 max-w-2xl mx-auto px-6 pb-20">
        <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/70 backdrop-blur-xl p-2 shadow-xl dark:shadow-none">
          {/* Tab switcher */}
          <div className="flex p-1 rounded-2xl bg-slate-100 dark:bg-slate-950/60 mb-2">
            <TabBtn active={tab === 'folder'} onClick={() => setTab('folder')}>
              <FolderOpen className="w-4 h-4" /> Local Folder Upload
            </TabBtn>
            <TabBtn active={tab === 'git'} onClick={() => setTab('git')}>
              <GitBranch className="w-4 h-4" /> GitHub Repository
            </TabBtn>
          </div>

          <div className="p-4 sm:p-6 space-y-4">
            {tab === 'folder' ? (
              <>
                <DropZone onFiles={setLocalFiles} />
                <AnalysisControls
                  onAnalyze={handleLocalAnalyze}
                  onReset={() => { setLocalFiles([]); useAnalysisStore.getState().reset(); }}
                  canAnalyze={localFiles.length > 0}
                  isLoading={isLoading}
                />
              </>
            ) : (
              <GitInput onSubmit={handleGitAnalyze} isLoading={isLoading} />
            )}

            {/* Status message */}
            {isLoading && (
              <div className="flex items-center gap-3 px-4 py-3 rounded.xl bg-violet-500/10 border border-violet-500/20">
                <div className="w-4 h-4 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin shrink-0" />
                <p className="text-violet-700 dark:text-violet-300 text-sm font-medium">{statusMessages[status]}</p>
              </div>
            )}

            {/* Error state */}
            {status === 'error' && (
              <ErrorBanner message={errorMsg} />
            )}
          </div>
        </div>
      </section>

      {/* ── Feature Grid ── */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 pb-24">
        <h2 className="text-center text-2xl font-bold text-slate-900 dark:text-white mb-10">
          Built for Instant Codebase Exploration
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map(({ icon: Icon, color, bg, title, desc }) => (
            <div key={title} className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/50 hover:border-violet-300 dark:hover:border-slate-700 transition-all duration-300 shadow-sm dark:shadow-none">
              <div className={`inline-flex p-3 rounded-xl ${bg} mb-4`}>
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
              <h3 className="font-semibold text-slate-900 dark:text-white text-base mb-2">{title}</h3>
              <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-slate-200 dark:border-slate-800 px-6 py-8 text-center text-slate-500 dark:text-slate-400 text-sm font-medium">
        Built with React + Vite + Tailwind CSS + Vercel Serverless. Zero external AI dependencies.
      </footer>
    </div>
  );
}

function TabBtn({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`
        flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold transition-all duration-200
        ${active
          ? 'bg-violet-600 text-white shadow-md shadow-violet-500/20'
          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
        }
      `}
    >
      {children}
    </button>
  );
}

function ErrorBanner({ message }) {
  return (
    <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-300 text-sm">
      <span className="text-red-500 font-bold text-base">⚠</span>
      <p className="flex-1 font-medium">{message || 'Something went wrong. Please try again.'}</p>
    </div>
  );
}
