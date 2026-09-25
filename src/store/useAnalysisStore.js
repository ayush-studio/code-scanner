/**
 * useAnalysisStore.js — Global Zustand Store
 *
 * Architecture note: Single source of truth for app state, results,
 * loading statuses, and active Dark/Light theme mode.
 * Scan history (max 5) is persisted to localStorage under `cs_history`.
 */

import { create } from 'zustand';

const HISTORY_KEY = 'cs_scan_history';
const MAX_HISTORY = 5;

function getInitialTheme() {
  if (typeof window === 'undefined') return 'dark';
  const saved = localStorage.getItem('cs_theme');
  if (saved === 'light' || saved === 'dark') return saved;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'dark';
}

function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHistory(history) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch { /* storage full — skip */ }
}

function buildHistoryEntry(result, repoUrl) {
  return {
    repoUrl: repoUrl || 'Local Upload',
    timestamp: new Date().toISOString(),
    fileCount: result?.metrics?.totalFiles || 0,
    language: result?.metrics?.primaryLanguage || 'Unknown',
    complexityCount: result?.complexityReport?.highComplexityCount || 0,
    circularDepCount: result?.jsCircularDeps?.length || 0,
    largeFileCount: result?.largeFiles?.length || 0,
    securityIssueCount: result?.jsSecurityIssues?.length || 0,
    // Store full result snapshot
    result,
  };
}

const useAnalysisStore = create((set, get) => ({
  // ── State ──────────────────────────────────
  files: [],          // Raw File objects from dropzone
  status: 'idle',     // idle | uploading | fetching_git | analyzing | done | error
  result: null,       // Full analysis result from /api/analyze
  errorMsg: null,     // Human-readable error string
  theme: getInitialTheme(), // 'dark' | 'light'
  scanHistory: loadHistory(), // Array of past scan summaries
  lastScanUrl: null,  // Last GitHub URL used

  // ── Actions ────────────────────────────────
  setFiles: (files) => set({ files }),

  setStatus: (status) => set({ status }),

  setResult: (result, repoUrl = null) => {
    // Push to history
    const entry = buildHistoryEntry(result, repoUrl);
    const existing = get().scanHistory;
    const updated = [entry, ...existing].slice(0, MAX_HISTORY);
    saveHistory(updated);
    set({ result, status: 'done', errorMsg: null, scanHistory: updated, lastScanUrl: repoUrl });
  },

  setError: (errorMsg) => set({ errorMsg, status: 'error' }),

  loadFromHistory: (idx) => {
    const entry = get().scanHistory[idx];
    if (entry?.result) {
      set({ result: entry.result, status: 'done', errorMsg: null });
    }
  },

  clearHistory: () => {
    saveHistory([]);
    set({ scanHistory: [] });
  },

  toggleTheme: () => {
    const current = get().theme;
    const next = current === 'dark' ? 'light' : 'dark';
    if (typeof window !== 'undefined') {
      localStorage.setItem('cs_theme', next);
      if (next === 'dark') {
        document.documentElement.classList.add('dark');
        document.documentElement.classList.remove('light');
      } else {
        document.documentElement.classList.remove('dark');
        document.documentElement.classList.add('light');
      }
    }
    set({ theme: next });
  },

  initTheme: () => {
    const theme = get().theme;
    if (typeof window !== 'undefined') {
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
        document.documentElement.classList.remove('light');
      } else {
        document.documentElement.classList.remove('dark');
        document.documentElement.classList.add('light');
      }
    }
  },

  reset: () => set({
    files: [],
    status: 'idle',
    result: null,
    errorMsg: null,
  }),
}));

export default useAnalysisStore;
