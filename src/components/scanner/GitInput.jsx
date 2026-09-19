// src/components/scanner/GitInput.jsx
import React, { useState } from 'react';
import { GitBranch, Lock, Eye, EyeOff, AlertTriangle, Info } from 'lucide-react';
import Button from '../ui/Button';

export default function GitInput({ onSubmit, isLoading }) {
  const [url, setUrl] = useState('');
  const [token, setToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [showTokenField, setShowTokenField] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!url.trim()) return;
    onSubmit?.({ url: url.trim(), token: token.trim() || undefined });
  };

  const isValid = url.startsWith('https://github.com/') && url.split('/').filter(Boolean).length >= 4;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Disclaimer Banner */}
      <div className="flex gap-3 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-xs">
        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
        <p>
          Due to serverless limits, Git imports are optimized for <strong>small/medium repos (~250 files max)</strong>.
          For large codebases, clone locally and use the Folder Upload instead.
        </p>
      </div>

      {/* URL input */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
          GitHub Repository URL
        </label>
        <div className="relative">
          <GitBranch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />

          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://github.com/owner/repo"
            className="w-full bg-slate-100 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-xl pl-10 pr-4 py-3 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
          />
        </div>
        {url && !isValid && (
          <p className="text-red-500 dark:text-red-400 text-xs flex items-center gap-1 mt-1">
            <Info className="w-3 h-3" />
            Enter a full GitHub URL: https://github.com/owner/repo
          </p>
        )}
      </div>

      {/* Private repo PAT */}
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => setShowTokenField(!showTokenField)}
          className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors font-medium"
        >
          <Lock className="w-3 h-3" />
          {showTokenField ? 'Hide token field' : 'Private repo? Add Personal Access Token'}
        </button>

        {showTokenField && (
          <div className="relative">
            <input
              type={showToken ? 'text' : 'password'}
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
              className="w-full bg-slate-100 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-xl pl-4 pr-10 py-3 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
            />
            <button
              type="button"
              onClick={() => setShowToken(!showToken)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        )}

        {showTokenField && (
          <p className="text-slate-500 dark:text-slate-400 text-xs">
            Token is sent securely to the server and never saved. Needs <code className="text-violet-600 dark:text-violet-300 font-mono">repo</code> scope for private repos.
          </p>
        )}
      </div>

      <Button
        type="submit"
        variant="secondary"
        size="lg"
        className="w-full"
        disabled={!isValid || isLoading}
        loading={isLoading}
      >
        <GitBranch className="w-4 h-4" />
        {isLoading ? 'Fetching repository…' : 'Fetch & Analyze'}
      </Button>
    </form>
  );
}
