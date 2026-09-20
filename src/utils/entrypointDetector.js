/**
 * entrypointDetector.js — Architectural Bootstrap Entrypoint Scanner
 *
 * Pinpoints the execution starting points of a codebase:
 * - Server: server.ts, server.js, app.py, main.py, main.go
 * - Client: main.tsx, index.js, App.jsx, index.html
 * - Config: docker-compose.yml, vite.config.ts, package.json
 */

export function detectEntrypoints(files = []) {
  const entrypoints = [];

  const patterns = [
    { regex: /(?:^|\/)(server\.(?:js|ts|mjs|cjs))$/i, type: 'Backend Server Entrypoint', role: 'Server Listener & App Root', color: 'emerald' },
    { regex: /(?:^|\/)(main\.(?:py|go|rs|cpp|c))$/i, type: 'Application Main Entrypoint', role: 'Runtime Execution Root', color: 'emerald' },
    { regex: /(?:^|\/)(app\.(?:py|js|ts))$/i, type: 'App Router / Gateway', role: 'Middleware & Route Registry', color: 'cyan' },
    { regex: /(?:^|\/)(main\.(?:tsx|jsx|js|ts))$/i, type: 'Frontend Client Bootstrap', role: 'React / Client Mount Root', color: 'violet' },
    { regex: /(?:^|\/)(index\.(?:html))$/i, type: 'HTML Document Root', role: 'Browser Document Shell', color: 'amber' },
    { regex: /(?:^|\/)(App\.(?:tsx|jsx|vue|svelte))$/i, type: 'Root UI Component', role: 'Component Tree Shell', color: 'violet' },
    { regex: /(?:^|\/)(docker-compose\.(?:yml|yaml))$/i, type: 'Container Orchestration', role: 'Service Infrastructure Spec', color: 'pink' },
  ];

  for (const f of files) {
    const fname = f.name || '';
    for (const p of patterns) {
      if (p.regex.test(fname)) {
        entrypoints.push({
          file: fname,
          shortName: fname.split('/').pop(),
          type: p.type,
          role: p.role,
          color: p.color
        });
        break;
      }
    }
  }

  return entrypoints.slice(0, 6);
}
