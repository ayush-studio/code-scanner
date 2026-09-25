/**
 * server.dev.js — Local Development API Server
 *
 * Runs the Vercel serverless handlers as a plain Express server on port 3001.
 * Vite proxies /api/* → http://localhost:3001/api/* during development.
 *
 * In production on Vercel, the /api directory is used directly as serverless functions.
 * This file is ONLY used for local development and is never deployed.
 */

import express from 'express';
import { spawn } from 'child_process';

import analyzeHandler from './api/analyze.js';
import fetchGithubHandler from './api/fetch-github.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json({ limit: '50mb' }));

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  next();
});

app.all('/api/analyze', async (req, res) => {
  try {
    await analyzeHandler(req, res);
  } catch (err) {
    console.error('[/api/analyze] Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

app.all('/api/fetch-github', async (req, res) => {
  try {
    await fetchGithubHandler(req, res);
  } catch (err) {
    console.error('[/api/fetch-github] Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

function runLocalJsFallback(files) {
  const routes = [];
  const security = [];
  const schemas = [];
  const antiPatterns = [];

  const routePatterns = [
    { re: /(?:app|router)\.(get|post|put|delete|patch)\s*\(\s*['"]([^'"]+)['"]/gi, framework: 'Express.js' },
    { re: /@(?:app|router)\.(get|post|put|delete|patch)\s*\(\s*['"]([^'"]+)['"]/gi, framework: 'FastAPI/Flask' },
  ];

  for (const f of files) {
    const name = f.name || '';
    const content = f.content || '';

    // Route scanner
    for (const p of routePatterns) {
      let match;
      const re = new RegExp(p.re.source, p.re.flags);
      while ((match = re.exec(content)) !== null) {
        routes.push({
          method: match[1].toUpperCase(),
          path: match[2],
          file: name,
          framework: p.framework
        });
      }
    }

    // Security scanner
    if (/(?:api[_-]?key|secret[_-]?key|password)\s*=\s*['"][A-Za-z0-9_\-]{16,}['"]/i.test(content)) {
      security.push({
        severity: 'High',
        rule: 'Potential Hardcoded Secret / Key',
        file: name,
        line: 1,
        snippet: 'Hardcoded key pattern matched'
      });
    }

    if (/eval\s*\([^)]+\)/i.test(content)) {
      security.push({
        severity: 'High',
        rule: 'Use of Unsafe eval()',
        file: name,
        line: 1,
        snippet: 'eval() statement found'
      });
    }

    // Schema detector
    const modelMatches = [...content.matchAll(/model\s+(\w+)\s*\{/g)];
    for (const m of modelMatches) {
      schemas.push({ name: m[1], type: 'Prisma ORM', file: name, fields: ['id', 'createdAt'] });
    }

    // Anti-patterns
    if (/from\s+\w+\s+import\s+\*/.test(content)) {
      antiPatterns.push({
        file: name,
        line: 1,
        type: 'Wildcard Import',
        severity: 'Medium',
        message: 'Wildcard import pollutes global namespace.',
        snippet: 'from module import *'
      });
    }
  }

  // Hotspots calculation
  const hotspots = files
    .filter(f => !f.name?.endsWith('.json') && !f.name?.endsWith('.lock'))
    .map(f => {
      const lines = (f.content || '').split('\n').filter(l => l.trim());
      const loc = lines.length;
      const complexity = Math.max(1, Math.round(loc / 25));
      const riskScore = Math.round(((complexity * 3.5) + (loc / 12)) * 10) / 10;
      return {
        file: f.name || '',
        shortName: (f.name || '').split('/').pop(),
        loc,
        complexity,
        riskScore,
        priority: riskScore > 60 ? 'Critical' : riskScore > 30 ? 'Moderate' : 'Low',
        recommendation: loc > 200 ? 'Module exceeds 200 lines. Break into helper services.' : 'Structure looks clean.'
      };
    })
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, 6);

  // ── New fields: complexity, large files, comment ratio, coupling ──
  const jsExts = new Set(['js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs']);

  const complexityByFile = files
    .filter(f => jsExts.has(f.name?.split('.').pop()?.toLowerCase()))
    .map(f => {
      const c = (f.content || '');
      const count = (re) => (c.match(re) || []).length;
      const complexity = 1 + count(/\bif\s*\(/g) + count(/\bfor\s*\(/g) + count(/\bwhile\s*\(/g) +
                         count(/\bswitch\s*\(/g) + count(/\bcatch\s*[({]/g) + count(/&&/g) + count(/\|\|/g);
      return {
        file: f.name,
        shortName: (f.name || '').split('/').pop(),
        complexity,
        severity: complexity >= 60 ? 'Critical' : complexity >= 30 ? 'High' : complexity >= 12 ? 'Medium' : 'Low',
      };
    })
    .sort((a, b) => b.complexity - a.complexity);

  const largeFiles = files
    .filter(f => {
      const ext = f.name?.split('.').pop()?.toLowerCase();
      const ignoreExts = new Set(['json', 'lock', 'md', 'yaml', 'yml', 'toml', 'svg', 'css']);
      return !ignoreExts.has(ext);
    })
    .map(f => ({ file: f.name, shortName: (f.name || '').split('/').pop(), loc: (f.content || '').split('\n').filter(l => l.trim()).length }))
    .filter(f => f.loc >= 350)
    .sort((a, b) => b.loc - a.loc)
    .slice(0, 10)
    .map(f => ({
      ...f,
      severity: f.loc >= 700 ? 'Critical' : f.loc >= 500 ? 'High' : 'Moderate',
      warning: f.loc >= 700 ? 'Extreme God File — split urgently' : 'Exceeds 350-line limit',
    }));

  const commentRatiosPerFile = files.map(f => {
    const lines = (f.content || '').split('\n');
    const commentLines = lines.filter(l => l.trim().startsWith('//') || l.trim().startsWith('#') || l.trim().startsWith('*')).length;
    const codeLines = lines.filter(l => l.trim() && !l.trim().startsWith('//') && !l.trim().startsWith('#') && !l.trim().startsWith('*')).length;
    const total = commentLines + codeLines;
    return { file: f.name, shortName: (f.name || '').split('/').pop(), commentLines, codeLines, commentRatio: total > 0 ? parseFloat(((commentLines / total) * 100).toFixed(1)) : 0, documented: false };
  });

  // Topology diagram
  const lines = ['graph LR', '  Client["🌐 Client App"]'];
  routes.slice(0, 10).forEach((r, idx) => {
    lines.push(`  R_${idx}["${r.method} ${r.path}"]`);
    lines.push(`  Client --> R_${idx}`);
  });
  schemas.slice(0, 5).forEach((s, idx) => {
    lines.push(`  DB_${idx}[("🗄️ ${s.name}")]`);
    if (routes.length > 0) lines.push(`  R_0 -.-> DB_${idx}`);
  });

  return {
    pythonAST: { classes: [], functions: [], commentRatios: [] },
    apiRoutes: routes,
    databaseSchemas: schemas,
    securityIssues: security,
    antiPatterns,
    circularDependencies: [],
    hotspots,
    apiTopologyDiagram: lines.join('\n'),
    totalPythonFiles: files.filter(f => f.name?.endsWith('.py')).length,
    // New fields
    complexityReport: { byFile: complexityByFile.slice(0, 20), highComplexityCount: complexityByFile.filter(f => f.severity === 'Critical' || f.severity === 'High').length },
    jsCircularDeps: [],
    commentRatios: { perFile: commentRatiosPerFile.slice(0, 30), poorlyDocumented: commentRatiosPerFile.filter(f => f.commentRatio < 5).slice(0, 10), avgRatio: 0, documentedFileCount: 0, totalAnalyzed: commentRatiosPerFile.length },
    largeFiles,
    couplingData: { couplingMap: [], highlyCoupledCount: 0 },
    jsSecurityIssues: security,
  };
}

app.all('/api/analyze-python', async (req, res) => {
  const files = req.body?.files || [];

  // 1. Try forwarding to Python Dev Server if running on port 3002
  try {
    const resp = await fetch('http://localhost:3002/api/analyze-python', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    });
    if (resp.ok) {
      const data = await resp.json();
      return res.status(resp.status).json(data);
    }
  } catch (err) {
    // Port 3002 not running, continue to local execution
  }

  // 2. Try running Python subprocess safely with error handlers
  const pyScript = `
import sys, json
from api.analyze_python import (
    PythonASTAnalyzer, RouteScanner, SchemaDetector, SecurityScanner,
    PythonDiagramBuilder, AntiPatternScanner, CircularDependencyScanner, HotspotCalculator
)

try:
    data = json.load(sys.stdin)
    files = data.get('files', [])
    py_files = [f for f in files if f.get('name', '').endswith('.py')]
    
    ast_res = PythonASTAnalyzer(py_files).analyze() if py_files else {"classes": [], "functions": []}
    routes = RouteScanner(files).scan()
    schemas = SchemaDetector(files).detect()
    security = SecurityScanner(files).scan()
    anti_patterns = AntiPatternScanner(files).scan()
    cycles = CircularDependencyScanner(files).scan()
    hotspots = HotspotCalculator(files, ast_res).calculate()
    diagram = PythonDiagramBuilder().build_api_topology(routes, schemas)

    print(json.dumps({
        "pythonAST": ast_res,
        "apiRoutes": routes,
        "databaseSchemas": schemas,
        "securityIssues": security,
        "antiPatterns": anti_patterns,
        "circularDependencies": cycles,
        "hotspots": hotspots,
        "apiTopologyDiagram": diagram,
        "totalPythonFiles": len(py_files)
    }))
except Exception as e:
    print(json.dumps({"error": str(e)}))
`;

  let answered = false;

  try {
    const pyProc = spawn('python', ['-c', pyScript]);
    let stdout = '';

    pyProc.on('error', () => {
      if (!answered) {
        answered = true;
        // Python binary not found on system — return pure JS analysis fallback
        return res.json(runLocalJsFallback(files));
      }
    });

    if (pyProc.stdin) {
      pyProc.stdin.on('error', () => {
        if (!answered) {
          answered = true;
          return res.json(runLocalJsFallback(files));
        }
      });
      pyProc.stdin.write(JSON.stringify(req.body));
      pyProc.stdin.end();
    }

    if (pyProc.stdout) {
      pyProc.stdout.on('data', (d) => stdout += d);
    }

    pyProc.on('close', (code) => {
      if (!answered) {
        answered = true;
        if (code === 0 && stdout.trim()) {
          try {
            const json = JSON.parse(stdout);
            return res.json(json);
          } catch (e) {
            return res.json(runLocalJsFallback(files));
          }
        }
        return res.json(runLocalJsFallback(files));
      }
    });
  } catch (err) {
    if (!answered) {
      answered = true;
      return res.json(runLocalJsFallback(files));
    }
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const server = app.listen(PORT, () => {
  console.log(`\n  🚀 API Dev Server running at http://localhost:${PORT}`);
  console.log(`  📡 Routes:`);
  console.log(`     POST /api/analyze`);
  console.log(`     POST /api/analyze-python`);
  console.log(`     POST /api/fetch-github`);
  console.log(`     GET  /api/health\n`);
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`\n  ⚠ Port ${PORT} is already in use. API Dev Server is running on port ${PORT}.\n`);
  } else {
    console.error('API Dev Server error:', err);
  }
});
