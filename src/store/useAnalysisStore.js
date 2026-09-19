/**
 * useAnalysisStore.js — Global Zustand Store
 *
 * Architecture note: Single source of truth for app state, results,
 * loading statuses, and active Dark/Light theme mode.
 */

import { create } from 'zustand';

function getInitialTheme() {
  if (typeof window === 'undefined') return 'dark';
  const saved = localStorage.getItem('cs_theme');
  if (saved === 'light' || saved === 'dark') return saved;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'dark';
}

const useAnalysisStore = create((set, get) => ({
  // ── State ──────────────────────────────────
  files: [],          // Raw File objects from dropzone
  status: 'idle',     // idle | uploading | fetching_git | analyzing | done | error
  result: null,       // Full analysis result from /api/analyze
  errorMsg: null,     // Human-readable error string
  theme: getInitialTheme(), // 'dark' | 'light'

  // ── Actions ────────────────────────────────
  setFiles: (files) => set({ files }),

  setStatus: (status) => set({ status }),

  setResult: (result) => set({ result, status: 'done', errorMsg: null }),

  setError: (errorMsg) => set({ errorMsg, status: 'error' }),

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
