/**
 * pythonAnalyzeService.js — Client-side service wrapper for /api/analyze-python
 *
 * Integrates Python AST & Route/Schema/Security analysis with fallback regex extraction.
 */

import axios from 'axios';

/**
 * Fallback static analysis if Python serverless endpoint is offline
 */
function clientSideFallbackScan(files) {
  const routes = [];
  const security = [];
  const schemas = [];

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
    // Anti-patterns fallback
    if (/from\s+\w+\s+import\s+\*/.test(content)) {
      security.push({
        severity: 'Medium',
        rule: 'Wildcard Star Import',
        file: name,
        line: 1,
        snippet: 'from module import *'
      });
    }
  }

  // Calculate hotspots from file lengths
  const hotspots = files
    .filter(f => !f.name?.endsWith('.json') && !f.name?.endsWith('.lock'))
    .map(f => {
      const loc = (f.content || '').split('\n').filter(l => l.trim()).length;
      const complexity = Math.max(1, Math.round(loc / 25));
      const riskScore = roundScore((complexity * 3.5) + (loc / 12));
      return {
        file: f.name || '',
        shortName: (f.name || '').split('/').pop(),
        loc,
        complexity,
        riskScore,
        priority: riskScore > 60 ? 'Critical' : riskScore > 30 ? 'Moderate' : 'Low',
        recommendation: loc > 200 ? 'Module exceeds 200 lines. Break into separate helper services.' : 'Structure looks clean.'
      };
    })
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, 6);

  function roundScore(n) { return Math.round(n * 10) / 10; }

  // Topology diagram fallback
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
    pythonAST: { classes: [], functions: [] },
    apiRoutes: routes,
    databaseSchemas: schemas,
    securityIssues: security,
    antiPatterns: [],
    circularDependencies: [],
    hotspots,
    apiTopologyDiagram: lines.join('\n'),
    totalPythonFiles: files.filter(f => f.name?.endsWith('.py')).length
  };
}

export async function analyzeWithPython(files) {
  try {
    const response = await axios.post('/api/analyze-python', { files }, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 15000,
    });
    return response.data;
  } catch (err) {
    console.warn('[pythonAnalyzeService] Python endpoint unavailable, running fallback scanner:', err);
    return clientSideFallbackScan(files);
  }
}
