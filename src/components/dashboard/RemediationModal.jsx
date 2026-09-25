// src/components/dashboard/RemediationModal.jsx
import React, { useState, useMemo } from 'react';
import {
  Sparkles, Download, Copy, Check, X, FileText, Bot, ShieldAlert,
  ArrowRight, Code2, Layers, CheckCircle2
} from 'lucide-react';
import { generateRemediationSpec } from '../../utils/remediationSpecGenerator';

export default function RemediationModal({ isOpen, onClose, result, projectName = 'codebase' }) {
  const [activeTab, setActiveTab] = useState('full'); // 'full' | 'prompt'
  const [copied, setCopied] = useState(false);

  const fullMarkdown = useMemo(() => {
    if (!result) return '';
    return generateRemediationSpec(result, { projectName });
  }, [result, projectName]);

  const quickPrompt = useMemo(() => {
    if (!result) return '';
    const scorecard = result.scorecard || {};
    const pySec = result.pythonAnalysis?.securityIssues || [];
    const jsSec = result.jsSecurityIssues || [];
    const allSec = [...pySec, ...jsSec];
    const circ = [...(result.pythonAnalysis?.circularDependencies || []), ...(result.jsCircularDeps || [])];
    const large = result.largeFiles || [];

    const promptLines = [
      `I need you to act as a Principal Software Engineer and refactor my repository according to this static analysis audit:`,
      `- Project: ${projectName}`,
      `- Health Score: ${scorecard.score || 100}/100 (Grade ${scorecard.grade || 'A+'})`,
      `- Critical Security Issues: ${allSec.length}`,
      `- Circular Dependency Loops: ${circ.length}`,
      `- God Files (>350 LOC): ${large.length}`,
      '',
      'Prioritized Action Items:',
    ];

    if (allSec.length > 0) {
      promptLines.push('1. [P0 Security]: Fix hardcoded credentials and unsafe evaluations:');
      allSec.slice(0, 5).forEach(s => promptLines.push(`   - ${s.file}:${s.line || 1} -> ${s.rule}`));
    }
    if (circ.length > 0) {
      promptLines.push('2. [P1 Circular Deps]: Decouple mutual import loops:');
      circ.slice(0, 3).forEach(c => promptLines.push(`   - Loop: ${c.summary || c.chain?.join(' -> ')}`));
    }
    if (large.length > 0) {
      promptLines.push('3. [P2 God Files]: Break down oversized modules into custom hooks and sub-components:');
      large.slice(0, 4).forEach(l => promptLines.push(`   - ${l.file} (${l.loc} LOC)`));
    }

    promptLines.push('');
    promptLines.push('Please produce safe, minimal, non-breaking refactorings for these issues starting with P0.');
    return promptLines.join('\n');
  }, [result, projectName]);

  if (!isOpen || !result) return null;

  const currentContent = activeTab === 'full' ? fullMarkdown : quickPrompt;

  const handleCopy = () => {
    navigator.clipboard.writeText(currentContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDownload = () => {
    const filename = activeTab === 'full' ? `${projectName}-REFACTOR_SPEC.md` : `${projectName}-AI_PROMPT.txt`;
    const type = activeTab === 'full' ? 'text/markdown' : 'text/plain';
    const blob = new Blob([currentContent], { type: `${type};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-4xl h-[88vh] rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl flex flex-col overflow-hidden">
        
        {/* ── Modal Header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/80">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-violet-600 to-cyan-500 text-white shadow-md shadow-violet-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-slate-900 dark:text-white text-base">
                  Actionable Remediation Spec & AI Prompt
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20 font-bold">
                  Developer & LLM Ready
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Comprehensive, prioritized audit document structured for instant AI or manual refactoring
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Tab Bar & Actions ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-100/60 dark:bg-slate-950/40">
          <div className="flex items-center gap-1.5 bg-slate-200/80 dark:bg-slate-800/80 p-1 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setActiveTab('full')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'full'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <FileText className="w-3.5 h-3.5 text-violet-500" />
              Full Technical Spec (.md)
            </button>
            <button
              onClick={() => setActiveTab('prompt')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'prompt'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Bot className="w-3.5 h-3.5 text-cyan-500" />
              Quick AI Chat Prompt
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                copied
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/20'
                  : 'bg-violet-600 hover:bg-violet-500 text-white shadow-md shadow-violet-500/20'
              }`}
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied to Clipboard!' : 'Copy for AI / Dev'}</span>
            </button>

            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
            >
              <Download className="w-3.5 h-3.5" />
              Download {activeTab === 'full' ? '.md' : '.txt'}
            </button>
          </div>
        </div>

        {/* ── Document Viewer ── */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50 dark:bg-[#07070b]">
          <pre className="text-xs font-mono text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap selection:bg-violet-500/30">
            {currentContent}
          </pre>
        </div>

        {/* ── Modal Footer ── */}
        <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-500 dark:text-slate-400 gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span>Ready to paste directly into Cursor, Claude, ChatGPT, or GitHub PR description</span>
          </div>
          <span className="font-mono text-[11px]">
            {currentContent.split('\n').length} lines · {Math.round(currentContent.length / 1024 * 10) / 10} KB
          </span>
        </div>
      </div>
    </div>
  );
}
