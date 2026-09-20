/**
 * deadCodeDetector.js — Zero-LLM Dead Code & Unused Export Scanner
 *
 * Scans JavaScript, TypeScript, and Python codebases for exported symbols
 * and cross-references them against imports to identify unused exports & orphan files.
 */

export function detectDeadCode(files = []) {
  const exportsMap = new Map(); // exportName -> { file, line, symbol }
  const importedSymbols = new Set();
  const importedFiles = new Set();
  const allSourceFiles = [];

  for (const f of files) {
    const name = f.name || '';
    const content = f.content || '';
    if (!content.trim()) continue;

    const isJsTs = /\.(js|jsx|ts|tsx|mjs|cjs)$/i.test(name);
    const isPy = /\.py$/i.test(name);

    if (isJsTs || isPy) {
      allSourceFiles.push(name);
    }

    // ── 1. Extract Exports ──
    if (isJsTs) {
      // Named exports: export const foo = ..., export function bar(), export class Baz
      const namedMatches = [...content.matchAll(/export\s+(?:const|let|var|function|class|type|interface|async\s+function)\s+(\w+)/g)];
      for (const m of namedMatches) {
        const symbol = m[1];
        if (symbol && symbol !== 'default') {
          exportsMap.set(`${name}:${symbol}`, { file: name, symbol, type: 'Named Export' });
        }
      }

      // Default export: export default function Foo() or export default Foo
      const defaultMatch = content.match(/export\s+default\s+(?:function|class)?\s*(\w+)?/);
      if (defaultMatch && defaultMatch[1]) {
        exportsMap.set(`${name}:${defaultMatch[1]}`, { file: name, symbol: defaultMatch[1], type: 'Default Export' });
      }
    } else if (isPy) {
      // Python top-level def & class
      const pyMatches = [...content.matchAll(/^(?:def|class)\s+(\w+)/gm)];
      for (const m of pyMatches) {
        const symbol = m[1];
        if (symbol && !symbol.startsWith('_')) {
          exportsMap.set(`${name}:${symbol}`, { file: name, symbol, type: 'Python Definition' });
        }
      }
    }

    // ── 2. Track Imports & References ──
    if (isJsTs) {
      // import { foo, bar } from './file'
      const importBlockMatches = [...content.matchAll(/import\s+[\s\S]*?from\s+['"]([^'"]+)['"]/g)];
      for (const m of importBlockMatches) {
        const targetPath = m[1];
        importedFiles.add(targetPath);
        // Extract imported identifiers inside { ... }
        const insideBrackets = m[0].match(/\{([^}]+)\}/);
        if (insideBrackets) {
          insideBrackets[1].split(',').forEach(s => {
            const trimmed = s.trim().split(/\s+as\s+/)[0].trim();
            if (trimmed) importedSymbols.add(trimmed);
          });
        }
      }

      // const foo = require('./file')
      const requireMatches = [...content.matchAll(/require\s*\(\s*['"]([^'"]+)['"]\s*\)/g)];
      for (const m of requireMatches) {
        importedFiles.add(m[1]);
      }
    } else if (isPy) {
      // from module import foo, bar
      const pyImportMatches = [...content.matchAll(/from\s+[\w.]+\s+import\s+([\w,\s]+)/g)];
      for (const m of pyImportMatches) {
        m[1].split(',').forEach(s => {
          const trimmed = s.trim();
          if (trimmed) importedSymbols.add(trimmed);
        });
      }
    }

    // Direct symbol invocation / usage in other files
    for (const [key, exp] of exportsMap.entries()) {
      if (exp.file !== name && content.includes(exp.symbol)) {
        importedSymbols.add(exp.symbol);
      }
    }
  }

  // ── 3. Identify Unused Exports ──
  const unusedExports = [];
  for (const [key, exp] of exportsMap.entries()) {
    if (!importedSymbols.has(exp.symbol)) {
      unusedExports.push(exp);
    }
  }

  // ── 4. Identify Orphan Files (Files not imported anywhere except root entrypoints) ──
  const entryPointNames = ['index', 'main', 'app', 'server', 'vite.config', 'next.config', 'setupTests'];
  const orphanFiles = [];

  for (const file of allSourceFiles) {
    const baseName = file.split('/').pop().split('.')[0].toLowerCase();
    if (entryPointNames.includes(baseName) || file.includes('pages/') || file.includes('routes/')) {
      continue;
    }

    let isReferenced = false;
    for (const impPath of importedFiles) {
      if (impPath.includes(baseName)) {
        isReferenced = true;
        break;
      }
    }

    if (!isReferenced) {
      orphanFiles.push(file);
    }
  }

  return {
    unusedExports: unusedExports.slice(0, 20),
    totalUnusedExports: unusedExports.length,
    orphanFiles: orphanFiles.slice(0, 15),
    totalOrphanFiles: orphanFiles.length,
    totalExportedSymbols: exportsMap.size
  };
}
