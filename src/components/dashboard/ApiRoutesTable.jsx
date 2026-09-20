// src/components/dashboard/ApiRoutesTable.jsx
import React, { useState } from 'react';
import { Search, Server, Database, Code2, Terminal, Copy, Check, ChevronDown, ChevronUp, Play } from 'lucide-react';
import Card, { CardHeader, CardBody } from '../ui/Card';
import Badge from '../ui/Badge';

function MethodBadge({ method }) {
  const colors = {
    GET: 'green',
    POST: 'violet',
    PUT: 'yellow',
    DELETE: 'red',
    PATCH: 'cyan',
  };
  return <Badge color={colors[method] || 'gray'} className="font-mono font-bold">{method}</Badge>;
}

export default function ApiRoutesTable({ routes = [], schemas = [] }) {
  const [search, setSearch] = useState('');
  const [expandedIndex, setExpandedIndex] = useState(null);
  const [copiedKey, setCopiedKey] = useState(null);

  const filteredRoutes = routes.filter(r =>
    r.path.toLowerCase().includes(search.toLowerCase()) ||
    r.file.toLowerCase().includes(search.toLowerCase()) ||
    r.method.toLowerCase().includes(search.toLowerCase())
  );

  const toggleExpand = (idx) => {
    setExpandedIndex(expandedIndex === idx ? null : idx);
  };

  const copyToClipboard = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const generateCurl = (r) => {
    const hasBody = ['POST', 'PUT', 'PATCH'].includes(r.method);
    const bodyStr = hasBody ? ` -H "Content-Type: application/json" -d '{"sample": "payload"}'` : '';
    return `curl -X ${r.method} "http://localhost:3000${r.path}"${bodyStr}`;
  };

  const generateFetch = (r) => {
    const hasBody = ['POST', 'PUT', 'PATCH'].includes(r.method);
    return `// JavaScript Fetch Snippet
await fetch("${r.path}", {
  method: "${r.method}",
  headers: { "Content-Type": "application/json" },${hasBody ? '\n  body: JSON.stringify({ key: "value" })' : ''}
}).then(res => res.json());`;
  };

  return (
    <div className="space-y-6">
      {/* API Routes Card */}
      <Card glow>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Server className="w-5 h-5 text-cyan-500 dark:text-cyan-400" />
              <div>
                <h2 className="font-semibold text-slate-900 dark:text-white text-base">
                  Discovered API Routes & Playground
                </h2>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Click any route to generate mock curl commands, fetch snippets, and request templates
                </p>
              </div>
              <Badge color="cyan" className="ml-2">{routes.length} endpoints</Badge>
            </div>
            <div className="relative max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search route, method, file..."
                className="w-full bg-slate-100 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-lg pl-8 pr-3 py-1 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              />
            </div>
          </div>
        </CardHeader>
        <CardBody className="!px-4 !py-4">
          {routes.length === 0 ? (
            <p className="text-slate-500 dark:text-slate-400 text-sm text-center py-6 font-medium">
              No HTTP API routes explicitly matched in source code (Express, FastAPI, Next.js routes, Spring Boot).
            </p>
          ) : (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-200 dark:divide-slate-800 bg-slate-50/50 dark:bg-slate-900/40 overflow-hidden">
              {filteredRoutes.map((r, i) => {
                const isExpanded = expandedIndex === i;
                const curlCmd = generateCurl(r);
                const fetchSnippet = generateFetch(r);

                return (
                  <div key={i} className="transition-colors">
                    <div
                      onClick={() => toggleExpand(i)}
                      className="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-3 hover:bg-slate-100 dark:hover:bg-slate-800/60 cursor-pointer text-xs gap-2"
                    >
                      <div className="flex items-center gap-3 font-mono">
                        <MethodBadge method={r.method} />
                        <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">{r.path}</span>
                      </div>
                      <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                        <Badge color="gray">{r.framework || 'HTTP Route'}</Badge>
                        <span className="truncate max-w-[200px]" title={r.file}>{r.file}</span>
                        {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                      </div>
                    </div>

                    {/* Expandable Playground Drawer */}
                    {isExpanded && (
                      <div className="p-4 bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 space-y-3 animate-in slide-in-from-top-1 duration-200">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                            <Terminal className="w-3.5 h-3.5 text-cyan-500" />
                            Ready-To-Run cURL Request
                          </span>
                          <button
                            onClick={(e) => { e.stopPropagation(); copyToClipboard(curlCmd, `curl_${i}`); }}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-violet-500 hover:text-white text-[11px] font-medium transition-colors"
                          >
                            {copiedKey === `curl_${i}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                            <span>{copiedKey === `curl_${i}` ? 'Copied!' : 'Copy cURL'}</span>
                          </button>
                        </div>
                        <pre className="p-2.5 rounded-lg bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-mono text-xs overflow-x-auto border border-slate-200 dark:border-slate-800">
                          {curlCmd}
                        </pre>

                        <div className="flex items-center justify-between pt-1">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                            <Code2 className="w-3.5 h-3.5 text-violet-500" />
                            Client Code Snippet
                          </span>
                          <button
                            onClick={(e) => { e.stopPropagation(); copyToClipboard(fetchSnippet, `fetch_${i}`); }}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-violet-500 hover:text-white text-[11px] font-medium transition-colors"
                          >
                            {copiedKey === `fetch_${i}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                            <span>{copiedKey === `fetch_${i}` ? 'Copied!' : 'Copy Code'}</span>
                          </button>
                        </div>
                        <pre className="p-2.5 rounded-lg bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-mono text-xs overflow-x-auto border border-slate-200 dark:border-slate-800">
                          {fetchSnippet}
                        </pre>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Database Schemas & ORM Models */}
      {schemas.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Database className="w-5 h-5 text-violet-500 dark:text-violet-400" />
              <h2 className="font-semibold text-slate-900 dark:text-white text-base">
                Database Tables & ORM Schemas
              </h2>
              <Badge color="violet" className="ml-2">{schemas.length} entities</Badge>
            </div>
          </CardHeader>
          <CardBody className="!px-4 !py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {schemas.map((s, idx) => (
                <div key={idx} className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-900/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 dark:text-white text-xs font-mono">{s.name}</span>
                    <Badge color="violet" className="text-[10px]">{s.type}</Badge>
                  </div>
                  {s.fields && s.fields.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {s.fields.map((f, i) => (
                        <span key={i} className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-[10px] font-mono text-slate-600 dark:text-slate-300">
                          {f}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
