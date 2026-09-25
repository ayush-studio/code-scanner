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
    // Node.js
    { re: /(?:app|router)\.(get|post|put|delete|patch)\s*\(\s*['"]([^'"]+)['"]/gi, framework: 'Express.js' },
    { re: /@(?:Get|Post|Put|Delete|Patch)\s*\(\s*['"]([^'"]+)['"]/gi, framework: 'NestJS' },
    { re: /fastify\.(get|post|put|delete|patch)\s*\(\s*['"]([^'"]+)['"]/gi, framework: 'Fastify' },
    // Python
    { re: /@(?:app|router|api)\.(get|post|put|delete|patch)\s*\(\s*['"]([^'"]+)['"]/gi, framework: 'FastAPI/Flask' },
    { re: /path\s*\(\s*['"]([^'"]+)['"]\s*,/gi, framework: 'Django' },
    // Go
    { re: /(?:r|router|app|api|group)\.(GET|POST|PUT|DELETE|PATCH)\s*\(\s*['"]([^'"]+)['"]/g, framework: 'Go (Gin/Echo/Fiber)' },
    { re: /(?:r|router)\.(get|post|put|delete)\s*\(\s*['"]([^'"]+)['"]/gi, framework: 'Go Chi' },
    // Java / Kotlin
    { re: /@(?:GetMapping|PostMapping|PutMapping|DeleteMapping|PatchMapping|RequestMapping)\s*\(\s*(?:(?:value|path)\s*=\s*)?['"]([^'"]+)['"]/gi, framework: 'Spring Boot' },
    { re: /@Path\s*\(\s*['"]([^'"]+)['"]/gi, framework: 'JAX-RS' },
    // C# / .NET
    { re: /\[(?:HttpGet|HttpPost|HttpPut|HttpDelete|HttpPatch|Route)\s*\(\s*['"]([^'"]+)['"]\)\]/gi, framework: 'ASP.NET Core' },
    { re: /app\.Map(?:Get|Post|Put|Delete|Patch)\s*\(\s*['"]([^'"]+)['"]/gi, framework: 'ASP.NET Minimal API' },
    // Rust
    { re: /#\[(?:get|post|put|delete|patch)\s*\(\s*['"]([^'"]+)['"]\)\]/gi, framework: 'Rust Actix/Rocket' },
    // PHP
    { re: /Route::(get|post|put|delete|patch)\s*\(\s*['"]([^'"]+)['"]/gi, framework: 'Laravel' },
    // Ruby
    { re: /^\s*(get|post|put|delete|patch)\s+['"]([^'"]+)['"]/gim, framework: 'Ruby on Rails' },
  ];

  for (const f of files) {
    const name = f.name || '';
    const content = f.content || '';
    const ext = name.split('.').pop()?.toLowerCase();

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

    // Security scanner (Universal + Polyglot)
    if (/(?:api[_-]?key|secret[_-]?key|password|jwt[_-]?secret)\s*[:=]\s*['"][A-Za-z0-9+/=_\-]{14,}['"]/i.test(content)) {
      security.push({
        severity: 'High',
        rule: 'Potential Hardcoded Secret / Key',
        file: name,
        line: 1,
        snippet: 'Hardcoded credential pattern matched'
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

    // Language specific security checks
    if (ext === 'py' && /pickle\.loads?|shell\s*=\s*True/i.test(content)) {
      security.push({ severity: 'High', rule: 'Unsafe Python Subprocess / Deserialization', file: name, line: 1, snippet: 'pickle.load or shell=True detected' });
    } else if (ext === 'go' && /(?:Query|Exec)\s*\(\s*fmt\.Sprintf/i.test(content)) {
      security.push({ severity: 'High', rule: 'Go SQL Injection via fmt.Sprintf', file: name, line: 1, snippet: 'fmt.Sprintf in SQL query' });
    } else if (['java', 'cs'].includes(ext) && /(?:executeQuery|SqlCommand)\s*\([^)]*\+/i.test(content)) {
      security.push({ severity: 'High', rule: 'SQL Injection via String Concatenation', file: name, line: 1, snippet: 'Dynamic string concatenated query' });
    } else if (['c', 'cpp'].includes(ext) && /\b(?:strcpy|gets|sprintf)\s*\(/i.test(content)) {
      security.push({ severity: 'High', rule: 'Deprecated Insecure Buffer Function', file: name, line: 1, snippet: 'strcpy/gets buffer overflow risk' });
    } else if (ext === 'php' && /(?:mysqli_query|PDO::query)\s*\([^)]*\$/i.test(content)) {
      security.push({ severity: 'High', rule: 'PHP SQL Injection via Variable in Query', file: name, line: 1, snippet: 'Raw PHP variable in query' });
    }

    // Schema detector (Prisma, JPA, GORM, EF Core, Mongoose, SQLAlchemy)
    const prismaMatches = [...content.matchAll(/model\s+(\w+)\s*\{/g)];
    for (const m of prismaMatches) {
      schemas.push({ name: m[1], type: 'Prisma ORM', file: name, fields: ['id', 'createdAt'] });
    }

    const jpaMatches = [...content.matchAll(/@Entity[\s\S]*?class\s+(\w+)/g)];
    for (const m of jpaMatches) {
      schemas.push({ name: m[1], type: 'JPA/Hibernate Entity', file: name, fields: ['id'] });
    }

    const gormMatches = [...content.matchAll(/type\s+(\w+)\s+struct\s*\{[^}]*gorm\.Model/g)];
    for (const m of gormMatches) {
      schemas.push({ name: m[1], type: 'Go GORM Model', file: name, fields: ['ID', 'CreatedAt'] });
    }

    const efMatches = [...content.matchAll(/DbSet<(\w+)>/g)];
    for (const m of efMatches) {
      schemas.push({ name: m[1], type: 'Entity Framework Core', file: name, fields: ['Id'] });
    }

    const sqlAlchemyMatches = [...content.matchAll(/class\s+(\w+)\s*\([^)]*Base[^)]*\):[\s\S]*?__tablename__/g)];
    for (const m of sqlAlchemyMatches) {
      schemas.push({ name: m[1], type: 'SQLAlchemy Model', file: name, fields: ['id'] });
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

  // Polyglot complexity scanner
  const polyglotExts = new Set([
    'js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs',
    'py', 'java', 'go', 'rs', 'php', 'rb', 'kt', 'cs',
    'cpp', 'c', 'cc', 'cxx', 'h', 'hpp', 'swift'
  ]);

  const complexityByFile = files
    .filter(f => polyglotExts.has(f.name?.split('.').pop()?.toLowerCase()))
    .map(f => {
      const c = (f.content || '');
      const count = (re) => (c.match(re) || []).length;
      const complexity = 1 + count(/\bif\b/g) + count(/\b(?:for|foreach)\b/g) + count(/\bwhile\b/g) +
                         count(/\b(?:switch|match)\b/g) + count(/\b(?:catch|except|rescue)\b/g) + count(/(?:&&|\band\b)/g) + count(/(?:\|\||\bor\b)/g);
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
  const lines = ['graph LR'];
  lines.push('  subgraph ClientTier ["🌐 Client Tier"]');
  lines.push('    Client["Frontend Application"]');
  lines.push('  end');

  if (routes.length > 0) {
    lines.push('  subgraph Endpoints ["⚡ API Gateway & Endpoints"]');
    routes.slice(0, 10).forEach((r, idx) => {
      lines.push(`    R_${idx}["${r.method} ${r.path}"]`);
    });
    lines.push('  end');
  }

  if (schemas.length > 0) {
    lines.push('  subgraph DatabaseTier ["🗄️ Data Storage Tier"]');
    schemas.slice(0, 6).forEach((s, idx) => {
      lines.push(`    DB_${idx}[("${s.name}")]`);
    });
    lines.push('  end');
  }

  // Connections
  routes.slice(0, 10).forEach((r, idx) => {
    lines.push(`  Client --> R_${idx}`);
  });

  schemas.slice(0, 6).forEach((s, idx) => {
    if (routes.length > 0) {
      const matchIdx = routes.findIndex(r => r.path?.toLowerCase().includes(s.name?.toLowerCase()));
      const targetRouteIdx = matchIdx !== -1 ? matchIdx : (idx % Math.min(routes.length, 5));
      lines.push(`  R_${targetRouteIdx} -.-> DB_${idx}`);
    }
  });

  if (routes.length === 0 && schemas.length === 0) {
    lines.push('  Client --> API["⚡ API Gateway"]');
  }

  // Technical debt annotations
  const debtItems = [];
  const debtByTag = { TODO: 0, FIXME: 0, HACK: 0, BUG: 0, XXX: 0, OPTIMIZE: 0 };
  const debtPattern = /(?:\/\/|#|\/\*|\*)\s*(TODO|FIXME|HACK|BUG|XXX|OPTIMIZE)(?:\s*(?:\(([^)]+)\)|:))?\s*(.+?)(?:\*\/|$)/gi;

  for (const f of files) {
    const lines = (f.content || '').split('\n');
    lines.forEach((lineText, idx) => {
      const re = new RegExp(debtPattern.source, 'gi');
      let m;
      while ((m = re.exec(lineText)) !== null) {
        const rawTag = (m[1] || '').toUpperCase();
        const tag = debtByTag.hasOwnProperty(rawTag) ? rawTag : 'TODO';
        const msg = (m[3] || '').trim().replace(/^[:\-\s]+/, '');
        if (msg.length < 2) continue;
        debtByTag[tag] = (debtByTag[tag] || 0) + 1;
        debtItems.push({
          tag,
          author: (m[2] || '').trim() || null,
          message: msg.slice(0, 160),
          file: f.name,
          shortName: (f.name || '').split('/').pop(),
          line: idx + 1,
          severity: ['FIXME', 'HACK', 'BUG', 'XXX'].includes(tag) ? 'High' : (tag === 'OPTIMIZE' ? 'Medium' : 'Low'),
        });
      }
    });
  }

  // API Drift check
  const clientCalls = [];
  const clientRe = /(?:fetch|axios\.(?:get|post|put|delete|patch))\s*\(\s*['"`]([^'"`\s\?#]+)['"`]/gi;
  for (const f of files) {
    if (!f.name?.includes('server') && !f.name?.includes('api/')) {
      let cm;
      while ((cm = clientRe.exec(f.content || '')) !== null) {
        let p = cm[1];
        if (p.startsWith('/') || p.startsWith('api')) {
          clientCalls.push({ endpoint: p.startsWith('/') ? p : '/' + p, file: f.name });
        }
      }
    }
  }

  const dangling = clientCalls.filter(c => !routes.some(r => r.path === c.endpoint)).slice(0, 15);
  const matched = clientCalls.filter(c => routes.some(r => r.path === c.endpoint)).slice(0, 15);
  const orphan = routes.filter(r => !clientCalls.some(c => c.endpoint === r.path)).slice(0, 15);
  const driftScore = clientCalls.length > 0 ? Math.round((matched.length / clientCalls.length) * 100) : 100;

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
    technicalDebt: {
      totalCount: debtItems.length,
      highSeverityCount: (debtByTag.FIXME || 0) + (debtByTag.HACK || 0) + (debtByTag.BUG || 0) + (debtByTag.XXX || 0),
      byTag: debtByTag,
      byFile: [],
      items: debtItems.slice(0, 50),
    },
    apiDrift: {
      driftScore,
      totalBackendRoutes: routes.length,
      totalClientCalls: clientCalls.length,
      matchedContracts: matched.map(m => ({ endpoint: m.endpoint, method: 'ALL', clientFile: m.file, backendFile: 'server.js' })),
      danglingCalls: dangling.map(d => ({ endpoint: d.endpoint, method: 'ALL', file: d.file, reason: 'No matching backend route handler found' })),
      orphanRoutes: orphan.map(o => ({ path: o.path, method: o.method, file: o.file })),
    },
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
