/**
 * /api/analyze.js — Zero-LLM Codebase Analysis Endpoint
 *
 * Architecture note: This pipeline is intentionally modular.
 * To add LLM enrichment in the future, inject an LLMEnricher class
 * between any pipeline stages below.
 *
 * Accepts POST: { files: [{ name: string, content: string }] }
 * Returns:      { metrics, requirements, hld, lld, lineage, structureTree }
 */

// ─────────────────────────────────────────────
// FILTER CONSTANTS
// ─────────────────────────────────────────────
const IGNORED_DIRS = new Set([
  '.git', 'node_modules', 'dist', 'build', '.next', 'out', 'coverage',
  '.venv', 'venv', '__pycache__', '.idea', '.vscode', '.turbo', '.cache',
  'vendor', 'target', 'bin', 'obj', '.output', '.nuxt', 'bower_components',
  '.expo', '.gradle'
]);

const IGNORED_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'svg', 'ico', 'webp', 'bmp', 'tiff', 'psd',
  'mp3', 'mp4', 'avi', 'mov', 'mkv', 'webm', 'wav', 'ogg', 'flac',
  'glb', 'gltf', 'obj', 'fbx', 'stl',
  'pdf', 'zip', 'tar', 'gz', '7z', 'rar', 'bz2', 'xz', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
  'exe', 'dll', 'so', 'dylib', 'bin', 'dat', 'iso', 'dmg', 'apk', 'deb', 'rpm', 'jar', 'pyc', 'pyo', 'class', 'o', 'a',
  'woff', 'woff2', 'ttf', 'eot', 'otf',
  'db', 'sqlite', 'sqlite3', 'lock', 'ds_store', 'log'
]);

const LANG_LABELS = {
  '.js': 'JavaScript',
  '.jsx': 'React JSX',
  '.ts': 'TypeScript',
  '.tsx': 'React TSX',
  '.py': 'Python',
  '.java': 'Java',
  '.go': 'Go',
  '.rs': 'Rust',
  '.cpp': 'C++',
  '.c': 'C',
  '.cs': 'C#',
  '.rb': 'Ruby',
  '.php': 'PHP',
  '.css': 'CSS',
  '.scss': 'SCSS',
  '.html': 'HTML',
  '.json': 'JSON',
  '.md': 'Markdown',
  '.yaml': 'YAML',
  '.yml': 'YAML',
  '.toml': 'TOML',
  '.sh': 'Shell',
  '.kt': 'Kotlin',
  '.swift': 'Swift',
  '.sql': 'SQL',
};

function shouldIgnoreFile(filePath) {
  if (!filePath || typeof filePath !== 'string') return true;
  const normalized = filePath.replace(/\\/g, '/');
  const parts = normalized.toLowerCase().split('/').filter(Boolean);

  for (const part of parts) {
    if (IGNORED_DIRS.has(part) || part.startsWith('.git')) return true;
  }

  const filename = parts[parts.length - 1] || '';
  if (filename === '.ds_store' || filename === 'thumbs.db' || filename === 'desktop.ini') return true;

  const extMatch = filename.match(/\.([^.]+)$/);
  if (extMatch && IGNORED_EXTENSIONS.has(extMatch[1].toLowerCase())) return true;

  return false;
}

// ─────────────────────────────────────────────
// STAGE 1 — Requirements Extractor
// Detects root/config files & extracts commands/dependencies.
// ─────────────────────────────────────────────
class RequirementsExtractor {
  constructor(files) {
    this.files = files;
  }

  extract() {
    const commands = [];
    const dependencies = [];

    for (const file of this.files) {
      const parts = file.name.split('/').filter(Boolean);
      // Only examine root or 1-level deep config files (ignore nested node_modules / test configs)
      if (parts.length > 3) continue;

      const base = parts[parts.length - 1];

      // Node.js
      if (base === 'package.json') {
        try {
          const pkg = JSON.parse(file.content);
          commands.push('npm install');
          if (pkg.scripts?.start) commands.push(`npm run start  # ${pkg.scripts.start}`);
          if (pkg.scripts?.build) commands.push(`npm run build  # ${pkg.scripts.build}`);
          if (pkg.scripts?.dev)   commands.push(`npm run dev    # ${pkg.scripts.dev}`);
          const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
          for (const [name, version] of Object.entries(deps)) {
            dependencies.push({ name, version, source: 'package.json' });
          }
        } catch (_) {}
      }

      // Python
      if (base === 'requirements.txt') {
        commands.push('pip install -r requirements.txt');
        file.content.split('\n').forEach(line => {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith('#')) {
            const [name, version] = trimmed.split(/[=<>~!]+/);
            dependencies.push({ name: name.trim(), version: version?.trim() || '*', source: 'requirements.txt' });
          }
        });
      }

      if (base === 'Pipfile') commands.push('pipenv install');
      if (base === 'pyproject.toml') commands.push('poetry install');

      // Java/Maven/Gradle
      if (base === 'pom.xml') commands.push('mvn install');
      if (base === 'build.gradle' || base === 'build.gradle.kts') commands.push('./gradlew build');

      // Docker
      if (base === 'Dockerfile') commands.push('docker build -t app .\ndocker run -p 8080:8080 app');
      if (base === 'docker-compose.yml' || base === 'docker-compose.yaml') commands.push('docker compose up --build');

      // Go / Rust / Ruby / PHP
      if (base === 'go.mod') commands.push('go mod download\ngo build ./...');
      if (base === 'Cargo.toml') commands.push('cargo build\ncargo run');
      if (base === 'Gemfile') commands.push('bundle install');
      if (base === 'composer.json') commands.push('composer install');

      if (base === '.env.example' || base === '.env.sample') {
        commands.push('cp .env.example .env  # Fill in environment variables');
      }
    }

    const uniqueCommands = [...new Set(commands)];
    return { commands: uniqueCommands, dependencies };
  }
}

// ─────────────────────────────────────────────
// STAGE 2 — Metrics Scanner
// Counts files, lines of code, and groups by language.
// ─────────────────────────────────────────────
class MetricsScanner {
  constructor(files) {
    this.files = files;
  }

  scan() {
    let totalLines = 0;
    const byLanguage = {};

    for (const file of this.files) {
      const ext = '.' + (file.name.split('.').pop() || 'txt').toLowerCase();
      const lines = Math.max(1, (file.content.match(/\n/g) || []).length + 1);
      totalLines += lines;
      byLanguage[ext] = (byLanguage[ext] || 0) + lines;
    }

    // Sort by line count descending
    const sortedEntries = Object.entries(byLanguage).sort(([, a], [, b]) => b - a);

    // Limit top languages to keep UI clean, aggregate smaller into '.other'
    const sortedByLanguage = {};
    let otherLines = 0;

    sortedEntries.forEach(([ext, count], idx) => {
      if (idx < 10) {
        sortedByLanguage[ext] = count;
      } else {
        otherLines += count;
      }
    });

    if (otherLines > 0) {
      sortedByLanguage['.other'] = otherLines;
    }

    return {
      totalFiles: this.files.length,
      totalLines,
      byLanguage: sortedByLanguage,
    };
  }
}

// ─────────────────────────────────────────────
// STAGE 3 — HLD Generator
// Analyzes folder structure & builds a high-level flowchart.
// ─────────────────────────────────────────────
class HLDGenerator {
  constructor(files) {
    this.files = files;
  }

  generate() {
    const nodes = new Set();
    const edges = new Set();
    const folderFiles = new Map(); // folder -> count of files

    nodes.add('ROOT["📁 Project Root"]');

    for (const file of this.files) {
      const parts = file.name.split('/').filter(Boolean);
      if (parts.length === 0) continue;

      if (parts.length === 1) {
        // Top-level file
        const fId = this._sanitize('ROOT_' + parts[0]);
        nodes.add(`${fId}["📄 ${parts[0]}"]`);
        edges.add(`ROOT --> ${fId}`);
      } else {
        // Folder structure
        const l1 = parts[0];
        const l1Id = this._sanitize(l1);
        nodes.add(`${l1Id}["${this._icon(l1)} ${l1}/"]`);
        edges.add(`ROOT --> ${l1Id}`);

        if (parts.length >= 2) {
          const l2 = parts[1];
          const l2Id = this._sanitize(l1 + '_' + l2);
          const isFile = l2.includes('.') && parts.length === 2;
          const label = isFile ? `📄 ${l2}` : `📁 ${l2}/`;
          nodes.add(`${l2Id}["${label}"]`);
          edges.add(`${l1Id} --> ${l2Id}`);
        }
      }
    }

    // Cap output to 35 edges max for diagram clarity
    const edgeList = [...edges].slice(0, 35);
    const usedNodeIds = new Set();
    edgeList.forEach(e => {
      const [from, to] = e.split(' --> ');
      usedNodeIds.add(from);
      usedNodeIds.add(to);
    });

    const activeNodes = [...nodes].filter(n => {
      const id = n.split('[')[0];
      return usedNodeIds.has(id);
    });

    const lines = ['graph TD', ...activeNodes.map(n => '  ' + n), ...edgeList.map(e => '  ' + e)];
    return lines.join('\n');
  }

  _sanitize(str) {
    return 'N_' + str.replace(/[^a-zA-Z0-9_]/g, '_');
  }

  _icon(name) {
    const icons = {
      src: '🔧', api: '⚡', components: '🧩', pages: '📄', store: '📦',
      services: '🔌', styles: '🎨', assets: '🖼', tests: '🧪', docs: '📚',
      public: '🌐', lib: '📚', utils: '🛠', server: '🖥', client: '📱', config: '⚙'
    };
    return icons[name.toLowerCase()] || '📁';
  }
}

// ─────────────────────────────────────────────
// STAGE 4 — Polyglot Lineage Generator (Dependency Graph)
// Traces imports, requires, packages, and modules across JS/TS, Python, Go, Rust, Java, Kotlin, C#, C/C++, PHP, Ruby, and Swift.
// ─────────────────────────────────────────────
class LineageGenerator {
  constructor(files) {
    this.files = files;
  }

  generate() {
    const edges = new Set();
    const nodeLabels = new Map();

    const sourceExts = new Set([
      'js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs',
      'py', 'java', 'go', 'rs', 'php', 'rb', 'kt', 'cs',
      'cpp', 'c', 'cc', 'cxx', 'h', 'hpp', 'swift', 'scala'
    ]);

    const sourceFiles = this.files.filter(f => {
      const ext = f.name.split('.').pop()?.toLowerCase();
      return sourceExts.has(ext);
    });

    if (sourceFiles.length === 0) {
      return 'graph TD\n  A["No recognized source files detected"]';
    }

    // Build project-wide lookup tables for fast multi-language resolution
    const pathSet = new Set(sourceFiles.map(f => this._normalize(f.name)));
    const baseToPaths = new Map(); // 'userservice' -> ['src/services/UserService.java']
    const nameWithExtToPaths = new Map(); // 'userservice.java' -> ['src/services/UserService.java']

    for (const f of sourceFiles) {
      const norm = this._normalize(f.name);
      const filename = norm.split('/').pop();
      const base = filename.replace(/\.[^.]+$/, '').toLowerCase();

      if (!baseToPaths.has(base)) baseToPaths.set(base, []);
      baseToPaths.get(base).push(norm);

      const fnLower = filename.toLowerCase();
      if (!nameWithExtToPaths.has(fnLower)) nameWithExtToPaths.set(fnLower, []);
      nameWithExtToPaths.get(fnLower).push(norm);
    }

    for (const file of sourceFiles) {
      const normFile = this._normalize(file.name);
      const fromBase = normFile.split('/').pop().replace(/\.[^.]+$/, '');
      const fromId = this._nodeId(normFile);
      nodeLabels.set(fromId, fromBase);
      const fromDir = normFile.split('/').slice(0, -1).join('/');
      const ext = normFile.split('.').pop()?.toLowerCase();
      const content = file.content || '';

      const targets = this._extractImports(content, ext);

      for (const target of targets) {
        const resolved = this._resolveTarget(normFile, fromDir, target, ext, pathSet, baseToPaths, nameWithExtToPaths);
        if (resolved && resolved !== normFile) {
          const toBase = resolved.split('/').pop().replace(/\.[^.]+$/, '');
          const toId = this._nodeId(resolved);
          nodeLabels.set(toId, toBase);
          edges.add(`${fromId} --> ${toId}`);
        }
      }
    }

    if (edges.size === 0) {
      return 'graph TD\n  A["No local file import relationships detected"]';
    }

    // Cap output to 40 edges max for diagram clarity and rendering speed
    const edgeList = [...edges].slice(0, 40);
    const activeNodes = [...nodeLabels.entries()]
      .filter(([id]) => edgeList.some(e => e.includes(id)))
      .map(([id, label]) => `  ${id}["${label}"]`);

    const lines = ['graph TD', ...activeNodes, ...edgeList.map(e => '  ' + e)];
    return lines.join('\n');
  }

  _normalize(p) {
    return (p || '').replace(/\\/g, '/').replace(/^\/+/, '');
  }

  _nodeId(filePath) {
    return 'L_' + filePath.replace(/[^a-zA-Z0-9]/g, '_').slice(-30);
  }

  _extractImports(content, ext) {
    const targets = [];

    // JS / TS
    if (['js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs'].includes(ext)) {
      const re = /(?:import\s+(?:[\w*{},\s]+\s+from\s+)?|export\s+(?:[\w*{},\s]+\s+from\s+)?|require\s*\(\s*|import\s*\(\s*)['"]([^'"]+)['"]/g;
      let m;
      while ((m = re.exec(content)) !== null) targets.push(m[1]);
    }
    // Python
    else if (ext === 'py') {
      const fromRe = /^from\s+(\.?[\w.]+)\s+import/gm;
      let m;
      while ((m = fromRe.exec(content)) !== null) targets.push(m[1]);
      const impRe = /^import\s+([\w.]+)/gm;
      while ((m = impRe.exec(content)) !== null) targets.push(m[1]);
    }
    // Go
    else if (ext === 'go') {
      const singleRe = /import\s+['"]([^'"]+)['"]/g;
      let m;
      while ((m = singleRe.exec(content)) !== null) targets.push(m[1]);
      const blockRe = /import\s*\(([\s\S]*?)\)/g;
      while ((m = blockRe.exec(content)) !== null) {
        const lineRe = /['"]([^'"]+)['"]/g;
        let lm;
        while ((lm = lineRe.exec(m[1])) !== null) targets.push(lm[1]);
      }
    }
    // Rust
    else if (ext === 'rs') {
      const useRe = /use\s+(?:crate|super)?::?([\w:]+)/g;
      let m;
      while ((m = useRe.exec(content)) !== null) targets.push(m[1]);
      const modRe = /mod\s+([a-zA-Z0-9_]+)\s*;/g;
      while ((m = modRe.exec(content)) !== null) targets.push(m[1]);
    }
    // Java / Kotlin / Scala
    else if (['java', 'kt', 'scala'].includes(ext)) {
      const impRe = /import\s+(?:static\s+)?([a-zA-Z0-9_.]+);?/g;
      let m;
      while ((m = impRe.exec(content)) !== null) targets.push(m[1]);
    }
    // C#
    else if (ext === 'cs') {
      const usingRe = /using\s+(?:static\s+)?([a-zA-Z0-9_.]+);/g;
      let m;
      while ((m = usingRe.exec(content)) !== null) targets.push(m[1]);
    }
    // C / C++
    else if (['c', 'cpp', 'cc', 'cxx', 'h', 'hpp'].includes(ext)) {
      const incRe = /#include\s*["<]([^">]+)[">]/g;
      let m;
      while ((m = incRe.exec(content)) !== null) targets.push(m[1]);
    }
    // PHP
    else if (ext === 'php') {
      const reqRe = /(?:require|require_once|include|include_once)\s*\(?['"]([^'"]+)['"]\)?/g;
      let m;
      while ((m = reqRe.exec(content)) !== null) targets.push(m[1]);
      const useRe = /use\s+([a-zA-Z0-9_\\]+);/g;
      while ((m = useRe.exec(content)) !== null) targets.push(m[1]);
    }
    // Ruby
    else if (ext === 'rb') {
      const reqRe = /(?:require_relative|require)\s*['"]([^'"]+)['"]/g;
      let m;
      while ((m = reqRe.exec(content)) !== null) targets.push(m[1]);
    }
    // Swift
    else if (ext === 'swift') {
      const impRe = /import\s+([a-zA-Z0-9_]+)/g;
      let m;
      while ((m = impRe.exec(content)) !== null) targets.push(m[1]);
    }

    return targets;
  }

  _resolveTarget(fromFile, fromDir, target, sourceExt, pathSet, baseToPaths, nameWithExtToPaths) {
    if (!target) return null;

    // 1. Relative import (starts with . or /)
    if (target.startsWith('.') || target.startsWith('/')) {
      const cleanTarget = target.startsWith('/') ? target.slice(1) : target;
      const combined = fromDir ? `${fromDir}/${cleanTarget}` : cleanTarget;
      const parts = combined.split('/');
      const stack = [];
      for (const p of parts) {
        if (p === '..') stack.pop();
        else if (p !== '.' && p !== '') stack.push(p);
      }
      const candidate = stack.join('/');

      // Exact match
      if (pathSet.has(candidate)) return candidate;

      // With source extension or common extensions
      const extsToTry = [sourceExt, 'ts', 'tsx', 'js', 'jsx', 'py', 'go', 'rs', 'php', 'rb', 'h', 'hpp', 'cpp'];
      for (const e of extsToTry) {
        if (pathSet.has(`${candidate}.${e}`)) return `${candidate}.${e}`;
        if (pathSet.has(`${candidate}/index.${e}`)) return `${candidate}/index.${e}`;
        if (pathSet.has(`${candidate}/mod.${e}`)) return `${candidate}/mod.${e}`;
      }
      return null;
    }

    // 2. Direct filename match (e.g. C/C++ #include "logger.h" or Ruby require 'helper')
    const targetFilename = target.split('/').pop()?.toLowerCase();
    if (targetFilename && nameWithExtToPaths.has(targetFilename)) {
      const matches = nameWithExtToPaths.get(targetFilename);
      const sameDirMatch = matches.find(m => m.startsWith(fromDir));
      return sameDirMatch || matches[0];
    }

    // 3. Dotted or scoped module (Python, Java, Kotlin, C#, Rust, PHP)
    const normalizedTarget = target.replace(/::/g, '/').replace(/\\/g, '/').replace(/\./g, '/');
    const segments = normalizedTarget.split('/').filter(Boolean);
    if (segments.length === 0) return null;

    const lastSegment = segments[segments.length - 1].toLowerCase();

    if (baseToPaths.has(lastSegment)) {
      const candidates = baseToPaths.get(lastSegment);
      if (segments.length > 1) {
        const secondLast = segments[segments.length - 2].toLowerCase();
        const contextual = candidates.find(c => c.toLowerCase().includes(secondLast));
        if (contextual) return contextual;
      }
      return candidates[0];
    }

    // 4. Go package or directory match (e.g. 'internal/auth' or 'pkg/db')
    for (let i = 0; i < segments.length; i++) {
      const subpath = segments.slice(i).join('/').toLowerCase();
      for (const p of pathSet) {
        if (p.toLowerCase().includes(subpath)) return p;
      }
    }

    return null;
  }
}

// ─────────────────────────────────────────────
// STAGE 5 — Polyglot LLD Generator (Class & Interface UML)
// Extracts classes, structs, traits, interfaces, records, and relationships across 11+ languages.
// ─────────────────────────────────────────────
class LLDGenerator {
  constructor(files) {
    this.files = files;
  }

  generate() {
    const classes = [];
    const relationships = [];

    const supportedExts = new Set([
      'js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs',
      'py', 'java', 'go', 'rs', 'php', 'rb', 'kt', 'cs',
      'cpp', 'c', 'cc', 'cxx', 'h', 'hpp', 'swift', 'scala'
    ]);

    for (const file of this.files) {
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (!supportedExts.has(ext)) continue;

      const extracted = this._extractFromFile(file.content || '', ext, file.name);
      classes.push(...extracted.classes);
      relationships.push(...extracted.relationships);

      if (classes.length >= 25) break;
    }

    if (classes.length === 0) {
      return 'classDiagram\n  note "No explicit class, struct, or interface declarations detected"';
    }

    // Deduplicate classes by name
    const seenNames = new Set();
    const uniqueClasses = [];
    for (const cls of classes) {
      const safeName = this._sanitizeName(cls.name);
      if (!seenNames.has(safeName) && safeName.length > 0) {
        seenNames.add(safeName);
        uniqueClasses.push({ ...cls, safeName });
      }
    }

    const lines = ['classDiagram'];

    // Render classes
    for (const cls of uniqueClasses.slice(0, 18)) {
      lines.push(`  class ${cls.safeName} {`);
      if (cls.stereotype) {
        lines.push(`    <<${cls.stereotype}>>`);
      }
      for (const prop of (cls.properties || []).slice(0, 6)) {
        lines.push(`    +${this._sanitizeMember(prop)}`);
      }
      for (const method of (cls.methods || []).slice(0, 7)) {
        lines.push(`    +${this._sanitizeMember(method)}()`);
      }
      lines.push('  }');
    }

    // Render valid relationships (inheritance <|-- and interface implementation <|..)
    const validRels = relationships.filter(rel => {
      const safeParent = this._sanitizeName(rel.parent);
      const safeChild = this._sanitizeName(rel.child);
      return seenNames.has(safeParent) && seenNames.has(safeChild) && safeParent !== safeChild;
    });

    const seenRels = new Set();
    for (const rel of validRels.slice(0, 15)) {
      const safeParent = this._sanitizeName(rel.parent);
      const safeChild = this._sanitizeName(rel.child);
      const arrow = rel.type === 'implements' ? '<|..' : '<|--';
      const relKey = `${safeParent}_${arrow}_${safeChild}`;
      if (!seenRels.has(relKey)) {
        seenRels.add(relKey);
        lines.push(`  ${safeParent} ${arrow} ${safeChild}`);
      }
    }

    return lines.join('\n');
  }

  _sanitizeName(str) {
    return (str || '').replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 32);
  }

  _sanitizeMember(name) {
    return (name || '').replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 24);
  }

  _extractFromFile(content, ext, filename) {
    const classes = [];
    const relationships = [];

    // 1. JavaScript / TypeScript
    if (['js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs'].includes(ext)) {
      const classRe = /class\s+([a-zA-Z0-9_]+)(?:\s+extends\s+([a-zA-Z0-9_]+))?(?:\s+implements\s+([a-zA-Z0-9_,\s]+))?\s*\{/g;
      let m;
      while ((m = classRe.exec(content)) !== null) {
        const className = m[1];
        const parent = m[2];
        const ifaces = m[3] ? m[3].split(',').map(s => s.trim()) : [];
        if (parent) relationships.push({ parent, child: className, type: 'extends' });
        ifaces.forEach(iface => {
          if (iface) relationships.push({ parent: iface, child: className, type: 'implements' });
        });

        const methods = ['constructor'];
        const methodRe = /(?:async\s+)?(?:static\s+)?([a-zA-Z0-9_]+)\s*\([^)]*\)\s*\{/g;
        let mm;
        while ((mm = methodRe.exec(content)) !== null) {
          if (!['if', 'for', 'while', 'switch', 'catch', 'function'].includes(mm[1])) {
            methods.push(mm[1]);
          }
        }

        const properties = [];
        const propRe = /(?:readonly\s+)?([a-zA-Z0-9_]+)\s*(?::\s*[^=;]+)?\s*=/g;
        while ((mm = propRe.exec(content)) !== null) {
          if (!['const', 'let', 'var'].includes(mm[1])) properties.push(mm[1]);
        }

        classes.push({ name: className, stereotype: null, methods: [...new Set(methods)], properties: [...new Set(properties)] });
      }

      // TypeScript Interfaces
      const ifaceRe = /interface\s+([a-zA-Z0-9_]+)(?:\s+extends\s+([a-zA-Z0-9_]+))?\s*\{([^}]*)\}/g;
      while ((m = ifaceRe.exec(content)) !== null) {
        const name = m[1];
        if (m[2]) relationships.push({ parent: m[2], child: name, type: 'extends' });
        const body = m[3] || '';
        const methods = [];
        const properties = [];
        body.split(';').forEach(line => {
          const trimmed = line.trim();
          if (trimmed.includes('(')) {
            const fnMatch = trimmed.match(/^([a-zA-Z0-9_]+)\s*\(/);
            if (fnMatch) methods.push(fnMatch[1]);
          } else {
            const propMatch = trimmed.match(/^([a-zA-Z0-9_]+)\s*:/);
            if (propMatch) properties.push(propMatch[1]);
          }
        });
        classes.push({ name, stereotype: 'interface', methods, properties });
      }

      if (classes.length === 0) {
        const fnRe = /export\s+(?:default\s+)?(?:async\s+)?function\s+([a-zA-Z0-9_]+)/g;
        const exportedFns = [];
        while ((m = fnRe.exec(content)) !== null) exportedFns.push(m[1]);
        if (exportedFns.length > 0) {
          const modName = filename.split('/').pop().replace(/\.[^.]+$/, '');
          classes.push({ name: modName, stereotype: 'module', methods: exportedFns, properties: [] });
        }
      }
    }

    // 2. Python
    else if (ext === 'py') {
      const classRe = /^class\s+([a-zA-Z0-9_]+)(?:\(([^)]+)\))?:/gm;
      let m;
      while ((m = classRe.exec(content)) !== null) {
        const name = m[1];
        const base = m[2]?.trim();
        if (base && base !== 'object') {
          relationships.push({ parent: base.split('.').pop(), child: name, type: 'extends' });
        }

        const methods = [];
        const properties = [];
        const methodRe = /^\s+def\s+([a-zA-Z0-9_]+)\s*\(/gm;
        let mm;
        while ((mm = methodRe.exec(content)) !== null) {
          methods.push(mm[1]);
        }
        const propRe = /self\.([a-zA-Z0-9_]+)\s*=/g;
        while ((mm = propRe.exec(content)) !== null) {
          properties.push(mm[1]);
        }

        classes.push({ name, stereotype: null, methods: [...new Set(methods)], properties: [...new Set(properties)] });
      }
    }

    // 3. Go
    else if (ext === 'go') {
      const structRe = /type\s+([a-zA-Z0-9_]+)\s+struct\s*\{([^}]*)\}/g;
      let m;
      while ((m = structRe.exec(content)) !== null) {
        const name = m[1];
        const body = m[2] || '';
        const properties = [];
        body.split('\n').forEach(line => {
          const trimmed = line.trim();
          const fieldMatch = trimmed.match(/^([a-zA-Z0-9_]+)\s+[A-Za-z0-9_*\[\]]+/);
          if (fieldMatch && !trimmed.startsWith('//')) properties.push(fieldMatch[1]);
        });
        classes.push({ name, stereotype: 'struct', methods: [], properties });
      }

      const ifaceRe = /type\s+([a-zA-Z0-9_]+)\s+interface\s*\{([^}]*)\}/g;
      while ((m = ifaceRe.exec(content)) !== null) {
        const name = m[1];
        const body = m[2] || '';
        const methods = [];
        body.split('\n').forEach(line => {
          const match = line.trim().match(/^([a-zA-Z0-9_]+)\s*\(/);
          if (match) methods.push(match[1]);
        });
        classes.push({ name, stereotype: 'interface', methods, properties: [] });
      }

      const receiverRe = /func\s*\(\s*(?:\w+\s+)?\*?([a-zA-Z0-9_]+)\s*\)\s*([a-zA-Z0-9_]+)\s*\(/g;
      while ((m = receiverRe.exec(content)) !== null) {
        const structName = m[1];
        const methodName = m[2];
        const target = classes.find(c => c.name === structName);
        if (target) target.methods.push(methodName);
      }
    }

    // 4. Rust
    else if (ext === 'rs') {
      const structRe = /(?:pub\s+)?struct\s+([a-zA-Z0-9_]+)\s*(?:\{([^}]*)\})?/g;
      let m;
      while ((m = structRe.exec(content)) !== null) {
        const name = m[1];
        const body = m[2] || '';
        const properties = [];
        body.split(',').forEach(field => {
          const fm = field.trim().match(/(?:pub\s+)?([a-zA-Z0-9_]+)\s*:/);
          if (fm) properties.push(fm[1]);
        });
        classes.push({ name, stereotype: 'struct', methods: [], properties });
      }

      const enumRe = /(?:pub\s+)?enum\s+([a-zA-Z0-9_]+)\s*\{([^}]*)\}/g;
      while ((m = enumRe.exec(content)) !== null) {
        const name = m[1];
        const body = m[2] || '';
        const variants = body.split(',').map(v => v.trim().split(/[\s(]/)[0]).filter(v => v && !v.startsWith('//'));
        classes.push({ name, stereotype: 'enum', methods: [], properties: variants });
      }

      const traitRe = /(?:pub\s+)?trait\s+([a-zA-Z0-9_]+)\s*\{([^}]*)\}/g;
      while ((m = traitRe.exec(content)) !== null) {
        const name = m[1];
        const body = m[2] || '';
        const methods = [];
        const fnRe = /fn\s+([a-zA-Z0-9_]+)\s*\(/g;
        let fnMatch;
        while ((fnMatch = fnRe.exec(body)) !== null) methods.push(fnMatch[1]);
        classes.push({ name, stereotype: 'trait', methods, properties: [] });
      }

      const implRe = /impl(?:\s+([a-zA-Z0-9_]+)\s+for)?\s+([a-zA-Z0-9_]+)\s*\{([\s\S]*?)\}/g;
      while ((m = implRe.exec(content)) !== null) {
        const traitName = m[1];
        const structName = m[2];
        const body = m[3] || '';
        if (traitName) relationships.push({ parent: traitName, child: structName, type: 'implements' });

        const methods = [];
        const fnRe = /(?:pub\s+)?fn\s+([a-zA-Z0-9_]+)\s*\(/g;
        let fnMatch;
        while ((fnMatch = fnRe.exec(body)) !== null) methods.push(fnMatch[1]);

        let target = classes.find(c => c.name === structName);
        if (!target) {
          target = { name: structName, stereotype: 'struct', methods: [], properties: [] };
          classes.push(target);
        }
        target.methods.push(...methods);
      }
    }

    // 5. Java / Kotlin
    else if (['java', 'kt'].includes(ext)) {
      const typeRe = /(?:public|protected|private|abstract|static|data|\s)*\b(class|interface|record|enum)\s+([a-zA-Z0-9_]+)(?:\s+extends\s+([a-zA-Z0-9_]+))?(?:\s+implements\s+([a-zA-Z0-9_,\s]+))?(?:\s*:\s*([a-zA-Z0-9_,\s()]+))?/g;
      let m;
      while ((m = typeRe.exec(content)) !== null) {
        const kind = m[1];
        const name = m[2];
        const parent = m[3] || (m[5] ? m[5].split(',')[0].replace(/\([^)]*\)/, '').trim() : null);
        const ifaces = m[4] ? m[4].split(',').map(s => s.trim()) : [];

        if (parent && parent !== 'Object') relationships.push({ parent, child: name, type: 'extends' });
        ifaces.forEach(iface => {
          if (iface) relationships.push({ parent: iface, child: name, type: 'implements' });
        });

        const methods = [];
        const methodRe = /(?:public|protected|private|fun|\s)*(?:static\s+)?(?:final\s+)?(?:[\w<>\[\],]+\s+)?([a-zA-Z0-9_]+)\s*\([^)]*\)\s*(?:\{|throws)/g;
        let mm;
        while ((mm = methodRe.exec(content)) !== null) {
          const fn = mm[1];
          if (!['if', 'for', 'while', 'switch', 'catch', 'class', 'interface', 'return', 'super', 'this'].includes(fn)) {
            methods.push(fn);
          }
        }

        const properties = [];
        const fieldRe = /(?:private|protected|public|val|var)\s+(?:final\s+)?(?:[\w<>\[\],]+\s+)?([a-zA-Z0-9_]+)\s*[;=:]/g;
        while ((mm = fieldRe.exec(content)) !== null) {
          properties.push(mm[1]);
        }

        classes.push({ name, stereotype: kind === 'class' ? null : kind, methods: [...new Set(methods)], properties: [...new Set(properties)] });
      }
    }

    // 6. C# (.cs)
    else if (ext === 'cs') {
      const classRe = /(?:public|internal|private|protected|\s)*\b(class|interface|struct|record)\s+([a-zA-Z0-9_]+)(?:\s*:\s*([a-zA-Z0-9_,\s]+))?/g;
      let m;
      while ((m = classRe.exec(content)) !== null) {
        const kind = m[1];
        const name = m[2];
        const bases = m[3] ? m[3].split(',').map(s => s.trim()) : [];
        if (bases.length > 0) {
          relationships.push({ parent: bases[0], child: name, type: bases[0].startsWith('I') ? 'implements' : 'extends' });
        }

        const methods = [];
        const methodRe = /(?:public|protected|private|\s)*(?:async\s+)?(?:virtual\s+|override\s+|static\s+)?(?:[\w<>\[\],?]+\s+)+([a-zA-Z0-9_]+)\s*\([^)]*\)/g;
        let mm;
        while ((mm = methodRe.exec(content)) !== null) {
          if (!['if', 'for', 'while', 'switch', 'catch', 'using', 'return', 'get', 'set'].includes(mm[1])) {
            methods.push(mm[1]);
          }
        }

        const properties = [];
        const propRe = /(?:public|protected|private)\s+[\w<>\[\],?]+\s+([a-zA-Z0-9_]+)\s*\{\s*get/g;
        while ((mm = propRe.exec(content)) !== null) properties.push(mm[1]);

        classes.push({ name, stereotype: kind === 'class' ? null : kind, methods: [...new Set(methods)], properties: [...new Set(properties)] });
      }
    }

    // 7. C / C++
    else if (['c', 'cpp', 'cc', 'cxx', 'h', 'hpp'].includes(ext)) {
      const classRe = /\b(class|struct)\s+([a-zA-Z0-9_]+)(?:\s*:\s*(?:public|protected|private)\s+([a-zA-Z0-9_]+))?\s*\{/g;
      let m;
      while ((m = classRe.exec(content)) !== null) {
        const kind = m[1];
        const name = m[2];
        const parent = m[3];
        if (parent) relationships.push({ parent, child: name, type: 'extends' });

        const methods = [];
        const methodRe = /(?:virtual\s+)?(?:[\w:*&<>]+\s+)+([a-zA-Z0-9_]+)\s*\([^)]*\)\s*(?:const\s*)?(?:=\s*0\s*)?[;{]/g;
        let mm;
        while ((mm = methodRe.exec(content)) !== null) {
          if (!['if', 'for', 'while', 'switch', 'catch', 'return'].includes(mm[1])) {
            methods.push(mm[1]);
          }
        }

        classes.push({ name, stereotype: kind === 'class' ? null : kind, methods: [...new Set(methods)], properties: [] });
      }
    }

    // 8. PHP
    else if (ext === 'php') {
      const classRe = /\b(class|interface|trait)\s+([a-zA-Z0-9_]+)(?:\s+extends\s+([a-zA-Z0-9_]+))?(?:\s+implements\s+([a-zA-Z0-9_,\s]+))?/g;
      let m;
      while ((m = classRe.exec(content)) !== null) {
        const kind = m[1];
        const name = m[2];
        const parent = m[3];
        const ifaces = m[4] ? m[4].split(',').map(s => s.trim()) : [];
        if (parent) relationships.push({ parent, child: name, type: 'extends' });
        ifaces.forEach(iface => {
          if (iface) relationships.push({ parent: iface, child: name, type: 'implements' });
        });

        const methods = [];
        const methodRe = /(?:public|protected|private|\s)*(?:static\s+)?function\s+([a-zA-Z0-9_]+)\s*\(/g;
        let mm;
        while ((mm = methodRe.exec(content)) !== null) methods.push(mm[1]);

        const properties = [];
        const propRe = /(?:public|protected|private)\s+(?:[\w?]+\s+)?\$([a-zA-Z0-9_]+)/g;
        while ((mm = propRe.exec(content)) !== null) properties.push(mm[1]);

        classes.push({ name, stereotype: kind === 'class' ? null : kind, methods: [...new Set(methods)], properties: [...new Set(properties)] });
      }
    }

    // 9. Ruby
    else if (ext === 'rb') {
      const classRe = /\b(class|module)\s+([a-zA-Z0-9_]+)(?:\s*<\s*([a-zA-Z0-9_]+))?/g;
      let m;
      while ((m = classRe.exec(content)) !== null) {
        const kind = m[1];
        const name = m[2];
        const parent = m[3];
        if (parent) relationships.push({ parent, child: name, type: 'extends' });

        const methods = [];
        const methodRe = /def\s+(?:self\.)?([a-zA-Z0-9_?!]+)/g;
        let mm;
        while ((mm = methodRe.exec(content)) !== null) methods.push(mm[1]);

        const properties = [];
        const propRe = /attr_(?:accessor|reader|writer)\s+([:\w,\s]+)/g;
        while ((mm = propRe.exec(content)) !== null) {
          mm[1].split(',').forEach(p => {
            const clean = p.trim().replace(/^:/, '');
            if (clean) properties.push(clean);
          });
        }

        classes.push({ name, stereotype: kind === 'class' ? null : kind, methods: [...new Set(methods)], properties: [...new Set(properties)] });
      }
    }

    // 10. Swift
    else if (ext === 'swift') {
      const typeRe = /(?:public\s+|open\s+|internal\s+)?\b(class|struct|protocol)\s+([a-zA-Z0-9_]+)(?:\s*:\s*([a-zA-Z0-9_,\s]+))?/g;
      let m;
      while ((m = typeRe.exec(content)) !== null) {
        const kind = m[1];
        const name = m[2];
        const bases = m[3] ? m[3].split(',').map(s => s.trim()) : [];
        if (bases.length > 0) {
          relationships.push({ parent: bases[0], child: name, type: 'extends' });
        }

        const methods = [];
        const methodRe = /func\s+([a-zA-Z0-9_]+)\s*\(/g;
        let mm;
        while ((mm = methodRe.exec(content)) !== null) methods.push(mm[1]);

        const properties = [];
        const propRe = /(?:var|let)\s+([a-zA-Z0-9_]+)\s*:/g;
        while ((mm = propRe.exec(content)) !== null) properties.push(mm[1]);

        classes.push({ name, stereotype: kind === 'class' ? null : kind, methods: [...new Set(methods)], properties: [...new Set(properties)] });
      }
    }

    return { classes, relationships };
  }
}

// ─────────────────────────────────────────────
// STAGE 7 — Polyglot Per-File Cyclomatic Complexity Scorer
// Measures branching complexity across JS/TS, Python, Go, Rust, Java, Kotlin, C#, C/C++, PHP, Ruby, and Swift.
// ─────────────────────────────────────────────
class ComplexityScanner {
  constructor(files) { this.files = files; }

  scan() {
    const srcExts = new Set([
      'js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs',
      'py', 'java', 'go', 'rs', 'php', 'rb', 'kt', 'cs',
      'cpp', 'c', 'cc', 'cxx', 'h', 'hpp', 'swift', 'scala'
    ]);
    const byFile = [];

    for (const file of this.files) {
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (!srcExts.has(ext)) continue;

      let content = file.content || '';

      // Strip comment blocks according to language
      if (ext === 'py' || ext === 'rb') {
        content = content
          .replace(/#.*$/gm, '')
          .replace(/"""[\s\S]*?"""/g, '')
          .replace(/'''[\s\S]*?'''/g, '');
      } else {
        content = content
          .replace(/\/\/[^\n]*/g, '')
          .replace(/\/\*[\s\S]*?\*\//g, '');
      }

      // Strip string literals
      content = content
        .replace(/'[^'\\]*(?:\\.[^'\\]*)*'/g, "''")
        .replace(/"[^"\\]*(?:\\.[^"\\]*)*"/g, '""')
        .replace(/`[^`\\]*(?:\\.[^`\\]*)*`/g, '``');

      const count = (re) => (content.match(re) || []).length;

      const ifCount     = count(/\bif\b/g);
      const elseIfCount = count(/\b(?:else\s+if|elif|elsif)\b/g);
      const forCount    = count(/\b(?:for|foreach)\b/g);
      const whileCount  = count(/\bwhile\b/g);
      const switchCount = count(/\b(?:switch|match)\b/g);
      const catchCount  = count(/\b(?:catch|except|rescue)\b/g);
      const ternary     = count(/\?(?![?.=])/g);
      const andOp       = count(/(?:&&|\band\b)/g);
      const orOp        = count(/(?:\|\||\bor\b)/g);

      const complexity = 1 + ifCount + elseIfCount + forCount + whileCount +
                         switchCount + catchCount + ternary + andOp + orOp;

      byFile.push({
        file: file.name,
        shortName: file.name.split('/').pop(),
        complexity,
        breakdown: { ifCount, elseIfCount, forCount, whileCount, switchCount, catchCount, ternary, andOp, orOp },
        severity: complexity >= 60 ? 'Critical' : complexity >= 30 ? 'High' : complexity >= 12 ? 'Medium' : 'Low',
      });
    }

    byFile.sort((a, b) => b.complexity - a.complexity);

    return {
      byFile: byFile.slice(0, 25),
      highComplexityCount: byFile.filter(f => f.severity === 'Critical' || f.severity === 'High').length,
    };
  }
}

// ─────────────────────────────────────────────
// STAGE 8 — Polyglot Circular Dependency Detector
// Universal DFS cycle detection on multi-language project dependency graph.
// ─────────────────────────────────────────────
class PolyglotCircularDepDetector {
  constructor(files) { this.files = files; }

  detect() {
    const lineage = new LineageGenerator(this.files);
    const sourceFiles = lineage.files.filter(f => {
      const ext = f.name.split('.').pop()?.toLowerCase();
      return ['js', 'jsx', 'ts', 'tsx', 'py', 'go', 'rs', 'java', 'cs', 'cpp', 'c', 'php', 'rb', 'kt'].includes(ext);
    });

    const pathSet = new Set(sourceFiles.map(f => lineage._normalize(f.name)));
    const baseToPaths = new Map();
    const nameWithExtToPaths = new Map();

    for (const f of sourceFiles) {
      const norm = lineage._normalize(f.name);
      const filename = norm.split('/').pop();
      const base = filename.replace(/\.[^.]+$/, '').toLowerCase();
      if (!baseToPaths.has(base)) baseToPaths.set(base, []);
      baseToPaths.get(base).push(norm);

      const fnLower = filename.toLowerCase();
      if (!nameWithExtToPaths.has(fnLower)) nameWithExtToPaths.set(fnLower, []);
      nameWithExtToPaths.get(fnLower).push(norm);
    }

    const graph = new Map();
    for (const f of sourceFiles) graph.set(lineage._normalize(f.name), new Set());

    for (const file of sourceFiles) {
      const normFile = lineage._normalize(file.name);
      const fromDir = normFile.split('/').slice(0, -1).join('/');
      const ext = normFile.split('.').pop()?.toLowerCase();
      const targets = lineage._extractImports(file.content || '', ext);

      for (const t of targets) {
        const resolved = lineage._resolveTarget(normFile, fromDir, t, ext, pathSet, baseToPaths, nameWithExtToPaths);
        if (resolved && resolved !== normFile) {
          graph.get(normFile)?.add(resolved);
        }
      }
    }

    const cycles = [];
    const seenKeys = new Set();
    const visited = new Set();
    const recStack = [];
    const recSet = new Set();

    const dfs = (node) => {
      visited.add(node);
      recStack.push(node);
      recSet.add(node);

      for (const neighbor of graph.get(node) || []) {
        if (!visited.has(neighbor)) {
          dfs(neighbor);
        } else if (recSet.has(neighbor)) {
          const idx = recStack.indexOf(neighbor);
          const chain = [...recStack.slice(idx), neighbor];
          const key = chain.map(f => f.split('/').pop()).sort().join('|');
          if (!seenKeys.has(key)) {
            seenKeys.add(key);
            cycles.push({
              chain: chain.map(f => f.split('/').pop()),
              fullPaths: chain,
              length: chain.length - 1,
              severity: chain.length <= 3 ? 'High' : 'Medium',
              summary: chain.map(f => f.split('/').pop()).join(' -> '),
            });
          }
        }
      }

      recStack.pop();
      recSet.delete(node);
    };

    for (const node of graph.keys()) {
      if (!visited.has(node)) dfs(node);
    }

    return cycles.slice(0, 10);
  }
}
const JsCircularDepDetector = PolyglotCircularDepDetector;

// ─────────────────────────────────────────────
// STAGE 9 — Comment-to-Code Ratio Analyzer
// Measures documentation density across all source files.
// ─────────────────────────────────────────────
class CommentRatioAnalyzer {
  constructor(files) { this.files = files; }

  analyze() {
    const srcExts = new Set(['js', 'jsx', 'ts', 'tsx', 'py', 'java', 'go', 'rs', 'cs', 'cpp', 'c', 'rb', 'php', 'kt', 'swift']);
    const perFile = [];

    for (const file of this.files) {
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (!srcExts.has(ext)) continue;

      const lines = (file.content || '').split('\n');
      let commentLines = 0;
      let codeLines = 0;
      let inBlockComment = false;

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) continue;

        if (inBlockComment) {
          commentLines++;
          if (line.includes('*/') || line.includes('"""') || line.includes("'''")) inBlockComment = false;
          continue;
        }

        if (line.startsWith('/*') || line.startsWith('"""') || line.startsWith("'''")) {
          commentLines++;
          const rest = line.slice(2);
          if (!rest.includes('*/') && !rest.includes('"""') && !rest.includes("'''")) inBlockComment = true;
        } else if (line.startsWith('//') || line.startsWith('#') || line.startsWith('*')) {
          commentLines++;
        } else {
          codeLines++;
        }
      }

      const total = commentLines + codeLines;
      const ratio = total > 0 ? parseFloat(((commentLines / total) * 100).toFixed(1)) : 0;

      perFile.push({
        file: file.name,
        shortName: file.name.split('/').pop(),
        commentLines,
        codeLines,
        commentRatio: ratio,
        documented: ratio >= 10,
      });
    }

    const poorlyDocumented = perFile
      .filter(f => f.commentRatio < 5 && f.codeLines > 30)
      .sort((a, b) => a.commentRatio - b.commentRatio)
      .slice(0, 10);

    const avgRatio = perFile.length > 0
      ? parseFloat((perFile.reduce((s, f) => s + f.commentRatio, 0) / perFile.length).toFixed(1))
      : 0;

    return {
      perFile: perFile.slice(0, 30),
      poorlyDocumented,
      avgRatio,
      documentedFileCount: perFile.filter(f => f.documented).length,
      totalAnalyzed: perFile.length,
    };
  }
}

// ─────────────────────────────────────────────
// STAGE 10 — Large File / God File Detector
// Flags source files exceeding the recommended 350-line threshold.
// ─────────────────────────────────────────────
class LargeFileDetector {
  constructor(files) { this.files = files; }

  detect(threshold = 350) {
    const ignoreExts = new Set(['json', 'lock', 'md', 'yaml', 'yml', 'toml', 'txt', 'csv', 'svg', 'html', 'css', 'scss']);
    const largeFiles = [];

    for (const file of this.files) {
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (ignoreExts.has(ext)) continue;

      const loc = (file.content || '').split('\n').filter(l => l.trim().length > 0).length;
      if (loc < threshold) continue;

      largeFiles.push({
        file: file.name,
        shortName: file.name.split('/').pop(),
        loc,
        severity: loc >= 700 ? 'Critical' : loc >= 500 ? 'High' : 'Moderate',
        warning: loc >= 700
          ? 'Extreme God File — split urgently into focused sub-modules'
          : loc >= 500
          ? 'Very large — decompose into focused service classes'
          : 'Exceeds recommended 350-line limit — consider extracting helpers',
      });
    }

    largeFiles.sort((a, b) => b.loc - a.loc);
    return largeFiles.slice(0, 15);
  }
}

// ─────────────────────────────────────────────
// STAGE 11 — Polyglot Coupling & Fan-Out Analyzer
// Measures outDegree (dependencies) and inDegree (dependents) across all supported languages.
// ─────────────────────────────────────────────
class CouplingAnalyzer {
  constructor(files) { this.files = files; }

  analyze() {
    const lineage = new LineageGenerator(this.files);
    const sourceFiles = lineage.files.filter(f => {
      const ext = f.name.split('.').pop()?.toLowerCase();
      return ['js', 'jsx', 'ts', 'tsx', 'py', 'go', 'rs', 'java', 'cs', 'cpp', 'c', 'php', 'rb', 'kt'].includes(ext);
    });

    const pathSet = new Set(sourceFiles.map(f => lineage._normalize(f.name)));
    const baseToPaths = new Map();
    const nameWithExtToPaths = new Map();

    for (const f of sourceFiles) {
      const norm = lineage._normalize(f.name);
      const filename = norm.split('/').pop();
      const base = filename.replace(/\.[^.]+$/, '').toLowerCase();
      if (!baseToPaths.has(base)) baseToPaths.set(base, []);
      baseToPaths.get(base).push(norm);

      const fnLower = filename.toLowerCase();
      if (!nameWithExtToPaths.has(fnLower)) nameWithExtToPaths.set(fnLower, []);
      nameWithExtToPaths.get(fnLower).push(norm);
    }

    const outMap = new Map();
    const inMap = new Map();
    for (const f of sourceFiles) {
      const norm = lineage._normalize(f.name);
      outMap.set(norm, new Set());
      inMap.set(norm, new Set());
    }

    for (const file of sourceFiles) {
      const normFile = lineage._normalize(file.name);
      const fromDir = normFile.split('/').slice(0, -1).join('/');
      const ext = normFile.split('.').pop()?.toLowerCase();
      const targets = lineage._extractImports(file.content || '', ext);

      for (const t of targets) {
        const resolved = lineage._resolveTarget(normFile, fromDir, t, ext, pathSet, baseToPaths, nameWithExtToPaths);
        if (resolved && resolved !== normFile) {
          outMap.get(normFile)?.add(resolved);
          inMap.get(resolved)?.add(normFile);
        }
      }
    }

    const couplingMap = sourceFiles.map(f => {
      const norm = lineage._normalize(f.name);
      const outDegree = outMap.get(norm)?.size || 0;
      const inDegree  = inMap.get(norm)?.size || 0;
      return {
        file: f.name,
        shortName: f.name.split('/').pop(),
        outDegree,
        inDegree,
        coupled: outDegree >= 8,
        instability: outDegree + inDegree > 0
          ? parseFloat((outDegree / (outDegree + inDegree)).toFixed(2))
          : 0,
      };
    });

    couplingMap.sort((a, b) => b.outDegree - a.outDegree);

    return {
      couplingMap: couplingMap.slice(0, 25),
      highlyCoupledCount: couplingMap.filter(f => f.coupled).length,
    };
  }
}

// ─────────────────────────────────────────────
// STAGE 12 — Polyglot Security Scanner
// Detects hardcoded secrets, unsafe patterns, and injection vectors across all major languages.
// ─────────────────────────────────────────────
class PolyglotSecurityScanner {
  constructor(files) { this.files = files; }

  scan() {
    const issues = [];

    const universalRules = [
      {
        re: /(?:api[_-]?key|secret[_-]?key|access[_-]?token|jwt[_-]?secret|client[_-]?secret|auth[_-]?token)\s*[:=]\s*['"`][A-Za-z0-9+/=_\-]{12,}['"`]/gi,
        severity: 'High',
        rule: 'Hardcoded API Key / Secret Token',
      },
      {
        re: /(?:password|passwd|pwd)\s*[:=]\s*['"`][^'"`\s]{6,}['"`]/gi,
        severity: 'High',
        rule: 'Hardcoded Password Value',
      },
      {
        re: /(?:DATABASE_URL|DB_PASSWORD|REDIS_URL)\s*[:=]\s*['"`][^'"`\s]{8,}['"`]/gi,
        severity: 'High',
        rule: 'Hardcoded Database / Infrastructure Credential',
      },
      {
        re: /rejectUnauthorized\s*:\s*false|InsecureSkipVerify\s*:\s*true|ServerCertificateCustomValidationCallback/gi,
        severity: 'Medium',
        rule: 'TLS/SSL Certificate Validation Disabled',
      },
    ];

    const langRules = {
      js: [
        { re: /eval\s*\([^)]{1,200}\)/g, severity: 'High', rule: 'Unsafe eval() Execution' },
        { re: /\.innerHTML\s*=[^=]/g, severity: 'Medium', rule: 'Direct innerHTML Assignment (XSS Risk)' },
        { re: /dangerouslySetInnerHTML\s*=/g, severity: 'Medium', rule: 'dangerouslySetInnerHTML Usage (XSS Risk)' },
        { re: /cors\s*\(\s*\{\s*origin\s*:\s*['"`]\*['"`]/g, severity: 'Low', rule: 'Permissive CORS: origin "*"' },
        { re: /localStorage\.setItem\s*\([^,]+,\s*(?:JSON\.stringify\s*\()?\s*(?:token|password|secret|key)/gi, severity: 'Medium', rule: 'Sensitive Data Stored in localStorage' },
      ],
      py: [
        { re: /pickle\.loads?\s*\(/g, severity: 'High', rule: 'Unsafe Deserialization via pickle (RCE Risk)' },
        { re: /yaml\.load\s*\([^,)]+,\s*Loader\s*=\s*(?:yaml\.)?(?:UnsafeLoader|Loader)/g, severity: 'High', rule: 'Unsafe YAML Loading (RCE Risk)' },
        { re: /subprocess\.(?:Popen|call|run|check_output)\s*\([^)]*shell\s*=\s*True/g, severity: 'High', rule: 'Subprocess Invocation with shell=True (Command Injection)' },
        { re: /(?:cursor|db)\.execute\s*\(\s*f?['"][^'"]*%[a-zA-Z]/g, severity: 'High', rule: 'SQL Injection via String Formatting' },
        { re: /eval\s*\([^)]{1,200}\)|exec\s*\([^)]{1,200}\)/g, severity: 'High', rule: 'Dynamic eval() or exec() Execution' },
      ],
      go: [
        { re: /(?:Query|Exec|QueryRow)\s*\(\s*fmt\.Sprintf/g, severity: 'High', rule: 'SQL Injection via fmt.Sprintf Concatenation' },
        { re: /unsafe\.Pointer/g, severity: 'Medium', rule: 'Unsafe Pointer Manipulation (Memory Safety Bypass)' },
        { re: /exec\.Command\s*\(\s*["'](?:sh|bash|cmd)["']\s*,\s*["']-[a-zA-Z]["']/g, severity: 'High', rule: 'Shell Command Invocation with User Input Risk' },
      ],
      java: [
        { re: /(?:executeQuery|executeUpdate|execute)\s*\([^)]*\+/g, severity: 'High', rule: 'SQL Injection via String Concatenation in Statement' },
        { re: /new\s+ObjectInputStream/g, severity: 'High', rule: 'Insecure ObjectInputStream Deserialization (RCE Risk)' },
        { re: /DocumentBuilderFactory\.newInstance\(\)/g, severity: 'Medium', rule: 'Potential XML External Entity (XXE) Vulnerability' },
      ],
      cs: [
        { re: /new\s+SqlCommand\s*\([^)]*\+/g, severity: 'High', rule: 'SQL Injection via String Concatenation in SqlCommand' },
        { re: /BinaryFormatter\.Deserialize/g, severity: 'High', rule: 'Insecure BinaryFormatter Deserialization' },
      ],
      cpp: [
        { re: /\b(?:strcpy|gets|sprintf|strcat)\s*\(/g, severity: 'High', rule: 'Deprecated Insecure Buffer Function (Buffer Overflow Risk)' },
      ],
      rs: [
        { re: /\bunsafe\s*\{/g, severity: 'Low', rule: 'Unsafe Block (Memory Safety Boundary Disengaged)' },
      ],
      php: [
        { re: /(?:mysqli_query|PDO::query)\s*\([^)]*\$/g, severity: 'High', rule: 'SQL Injection via Unsanitized Variable in Query' },
        { re: /\b(?:eval|passthru|shell_exec|system)\s*\(/g, severity: 'High', rule: 'Unsafe System Command / eval() Execution' },
        { re: /\bunserialize\s*\(/g, severity: 'High', rule: 'Insecure unserialize() Deserialization' },
        { re: /(?:include|require)(?:_once)?\s*\(?\s*\$_(?:GET|POST|REQUEST)/g, severity: 'High', rule: 'Remote/Local File Inclusion via Superglobal' },
      ],
      rb: [
        { re: /\.where\s*\(\s*["'][^"']*#\{/g, severity: 'High', rule: 'SQL Injection via Ruby String Interpolation in where()' },
        { re: /\b(?:eval|system)\s*\(/g, severity: 'High', rule: 'Unsafe Dynamic eval() or system() Execution' },
      ],
    };

    for (const file of this.files) {
      const ext = file.name.split('.').pop()?.toLowerCase();
      const content = file.content || '';
      const lines = content.split('\n');

      // Check universal credential rules
      for (const { re, severity, rule } of universalRules) {
        const re2 = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
        let m;
        while ((m = re2.exec(content)) !== null) {
          const lineNum = content.slice(0, m.index).split('\n').length;
          const snippet = (lines[lineNum - 1] || '').trim();
          if (snippet.startsWith('//') || snippet.startsWith('*') || snippet.startsWith('#')) continue;
          issues.push({ severity, rule, file: file.name, line: lineNum, snippet: snippet.slice(0, 80) });
          if (issues.length >= 40) return issues;
        }
      }

      // Check language-specific rules
      let specific = [];
      if (['js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs'].includes(ext)) specific = langRules.js;
      else if (ext === 'py') specific = langRules.py;
      else if (ext === 'go') specific = langRules.go;
      else if (ext === 'java' || ext === 'kt') specific = langRules.java;
      else if (ext === 'cs') specific = langRules.cs;
      else if (['c', 'cpp', 'cc', 'cxx', 'h', 'hpp'].includes(ext)) specific = langRules.cpp;
      else if (ext === 'rs') specific = langRules.rs;
      else if (ext === 'php') specific = langRules.php;
      else if (ext === 'rb') specific = langRules.rb;

      for (const { re, severity, rule } of specific) {
        const re2 = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
        let m;
        while ((m = re2.exec(content)) !== null) {
          const lineNum = content.slice(0, m.index).split('\n').length;
          const snippet = (lines[lineNum - 1] || '').trim();
          if (snippet.startsWith('//') || snippet.startsWith('*') || snippet.startsWith('#')) continue;
          issues.push({ severity, rule, file: file.name, line: lineNum, snippet: snippet.slice(0, 80) });
          if (issues.length >= 40) return issues;
        }
      }
    }

    return issues;
  }
}
const JsSecurityScanner = PolyglotSecurityScanner;

// ─────────────────────────────────────────────
// STAGE 6 — Mermaid Validator
// ─────────────────────────────────────────────
class MermaidValidator {
  validate(diagram, type) {
    if (!diagram || typeof diagram !== 'string') return false;
    if (type === 'hld' || type === 'lineage') return diagram.startsWith('graph TD') || diagram.startsWith('graph LR');
    if (type === 'lld') return diagram.startsWith('classDiagram');
    return false;
  }

  safeValidate(diagram, type, fallback) {
    return this.validate(diagram, type) ? diagram : fallback;
  }
}

// ─────────────────────────────────────────────
// STAGE 12 — Technical Debt & Annotation Tracker
// Scans all source files for TODO, FIXME, HACK, BUG, XXX, OPTIMIZE annotations.
// ─────────────────────────────────────────────
class DebtScanner {
  constructor(files) { this.files = files; }

  scan() {
    const items = [];
    const byTag = { TODO: 0, FIXME: 0, HACK: 0, BUG: 0, XXX: 0, OPTIMIZE: 0 };
    const tagSeverities = {
      FIXME: 'High',
      HACK: 'High',
      BUG: 'High',
      XXX: 'High',
      OPTIMIZE: 'Medium',
      TODO: 'Low',
    };

    const pattern = /(?:\/\/|#|\/\*|\*)\s*(TODO|FIXME|HACK|BUG|XXX|OPTIMIZE)(?:\s*(?:\(([^)]+)\)|:))?\s*(.+?)(?:\*\/|$)/gi;

    for (const file of this.files) {
      const content = file.content || '';
      const lines = content.split('\n');

      lines.forEach((lineText, idx) => {
        const re = new RegExp(pattern.source, 'gi');
        let m;
        while ((m = re.exec(lineText)) !== null) {
          const rawTag = (m[1] || '').toUpperCase();
          const tag = byTag.hasOwnProperty(rawTag) ? rawTag : 'TODO';
          const author = (m[2] || '').trim();
          const message = (m[3] || '').trim().replace(/^[:\-\s]+/, '');

          if (message.length < 2) continue;

          byTag[tag] = (byTag[tag] || 0) + 1;

          items.push({
            tag,
            author: author || null,
            message: message.slice(0, 160),
            file: file.name,
            shortName: file.name.split('/').pop(),
            line: idx + 1,
            severity: tagSeverities[tag] || 'Low',
          });
        }
      });
    }

    const highSeverityCount = (byTag.FIXME || 0) + (byTag.HACK || 0) + (byTag.BUG || 0) + (byTag.XXX || 0);

    const fileCountMap = new Map();
    items.forEach(it => fileCountMap.set(it.file, (fileCountMap.get(it.file) || 0) + 1));
    const byFile = Array.from(fileCountMap.entries())
      .map(([file, count]) => ({ file, shortName: file.split('/').pop(), count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalCount: items.length,
      highSeverityCount,
      byTag,
      byFile,
      items: items.slice(0, 60),
    };
  }
}

// ─────────────────────────────────────────────
// STAGE 13 — API Contract Drift Scanner
// Cross-references client HTTP requests against server endpoint declarations.
// ─────────────────────────────────────────────
class ApiContractDriftScanner {
  constructor(files) { this.files = files; }

  scan() {
    const backendRoutes = [];
    const clientCalls = [];

    const backendPatterns = [
      // Node.js
      { re: /(?:app|router)\.(get|post|put|delete|patch)\s*\(\s*['"]([^'"]+)['"]/gi, framework: 'Express.js' },
      { re: /@(?:Get|Post|Put|Delete|Patch)\s*\(\s*['"]([^'"]+)['"]/gi, framework: 'NestJS' },
      { re: /fastify\.(get|post|put|delete|patch)\s*\(\s*['"]([^'"]+)['"]/gi, framework: 'Fastify' },
      // Python
      { re: /@(?:app|router|api)\.(get|post|put|delete|patch)\s*\(\s*['"]([^'"]+)['"]/gi, framework: 'FastAPI/Flask' },
      { re: /path\s*\(\s*['"]([^'"]+)['"]\s*,/gi, framework: 'Django' },
      // Go
      { re: /(?:r|router|app|api|group|v[0-9]+)\.(GET|POST|PUT|DELETE|PATCH)\s*\(\s*['"]([^'"]+)['"]/g, framework: 'Go (Gin/Echo/Fiber)' },
      { re: /(?:r|router)\.(get|post|put|delete)\s*\(\s*['"]([^'"]+)['"]/gi, framework: 'Go Chi' },
      { re: /http\.HandleFunc\s*\(\s*['"]([^'"]+)['"]/gi, framework: 'Go Standard HTTP' },
      // Java / Kotlin
      { re: /@(?:GetMapping|PostMapping|PutMapping|DeleteMapping|PatchMapping|RequestMapping)\s*\(\s*(?:(?:value|path)\s*=\s*)?['"]([^'"]+)['"]/gi, framework: 'Spring Boot' },
      { re: /@Path\s*\(\s*['"]([^'"]+)['"]/gi, framework: 'JAX-RS' },
      { re: /(?:get|post|put|delete)\s*\(\s*['"]([^'"]+)['"]\s*\)\s*\{/gi, framework: 'Ktor' },
      // C# / .NET
      { re: /\[(?:HttpGet|HttpPost|HttpPut|HttpDelete|HttpPatch|Route)\s*\(\s*['"]([^'"]+)['"]\)\]/gi, framework: 'ASP.NET Core' },
      { re: /app\.Map(?:Get|Post|Put|Delete|Patch)\s*\(\s*['"]([^'"]+)['"]/gi, framework: 'ASP.NET Minimal API' },
      // Rust
      { re: /#\[(?:get|post|put|delete|patch)\s*\(\s*['"]([^'"]+)['"]\)\]/gi, framework: 'Rust Actix/Rocket' },
      { re: /\.route\s*\(\s*['"]([^'"]+)['"]\s*,\s*(?:get|post|put|delete)/gi, framework: 'Rust Axum' },
      // PHP
      { re: /Route::(get|post|put|delete|patch)\s*\(\s*['"]([^'"]+)['"]/gi, framework: 'Laravel' },
      { re: /#\[Route\s*\(\s*['"]([^'"]+)['"]/gi, framework: 'Symfony' },
      // Ruby
      { re: /^\s*(get|post|put|delete|patch)\s+['"]([^'"]+)['"]/gim, framework: 'Ruby on Rails' },
    ];

    const clientPatterns = [
      { re: /fetch\s*\(\s*['"`]([^'"`\s\?#]+)['"`]/gi, method: 'ALL' },
      { re: /axios\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`\s\?#]+)['"`]/gi, methodIdx: 1, pathIdx: 2 },
      { re: /axios\s*\(\s*\{[^}]*url\s*:\s*['"`]([^'"`\s\?#]+)['"`]/gi, method: 'ALL' },
      { re: /apiClient\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`\s\?#]+)['"`]/gi, methodIdx: 1, pathIdx: 2 },
      { re: /(?:get|post|put|delete)\s*\(\s*['"`](\/(?:api|v[0-9]+)\/[^'"`\s\?#]+)['"`]/gi, method: 'ALL' },
    ];

    for (const file of this.files) {
      const content = file.content || '';
      for (const p of backendPatterns) {
        const re = new RegExp(p.re.source, 'gi');
        let m;
        while ((m = re.exec(content)) !== null) {
          const method = (m[1] || 'GET').toUpperCase();
          const path = m[2] || '';
          if (path.startsWith('/') || path.startsWith('api')) {
            const normalized = path.startsWith('/') ? path : '/' + path;
            backendRoutes.push({
              path: normalized,
              method,
              file: file.name,
              framework: p.framework
            });
          }
        }
      }

      if (file.name.includes('/api/') && /(?:route|index)\.(?:js|ts)$/i.test(file.name)) {
        const routePath = file.name
          .replace(/.*\/app/i, '')
          .replace(/.*\/src\/pages/i, '')
          .replace(/\/(?:route|index)\.(?:js|ts)$/i, '');
        if (routePath) {
          backendRoutes.push({
            path: routePath.startsWith('/') ? routePath : '/' + routePath,
            method: 'ALL',
            file: file.name,
            framework: 'Next.js App Router'
          });
        }
      }
    }

    for (const file of this.files) {
      if (/server|backend|controllers|routes/i.test(file.name) && !file.name.includes('/client') && !file.name.includes('/src/components') && !file.name.includes('/src/pages') && !file.name.includes('/src/services')) {
        continue;
      }

      const content = file.content || '';

      for (const cp of clientPatterns) {
        const re = new RegExp(cp.re.source, 'gi');
        let m;
        while ((m = re.exec(content)) !== null) {
          let path = '';
          let method = cp.method || 'GET';

          if (cp.pathIdx) {
            method = (m[cp.methodIdx] || 'GET').toUpperCase();
            path = m[cp.pathIdx] || '';
          } else {
            path = m[1] || '';
          }

          if (path.startsWith('http://') || path.startsWith('https://')) {
            try {
              const parsed = new URL(path);
              path = parsed.pathname;
            } catch { continue; }
          }

          if (!path.startsWith('/') && !path.startsWith('api')) continue;
          const normalizedPath = path.startsWith('/') ? path : '/' + path;
          const lineNum = content.slice(0, m.index).split('\n').length;

          if (!clientCalls.some(c => c.endpoint === normalizedPath && c.file === file.name && c.line === lineNum)) {
            clientCalls.push({
              endpoint: normalizedPath,
              method,
              file: file.name,
              shortName: file.name.split('/').pop(),
              line: lineNum,
            });
          }
        }
      }
    }

    const normalizeParamPattern = (p) => {
      return p
        .replace(/\$\{[^}]+\}/g, ':param')
        .replace(/:[a-zA-Z0-9_]+/g, ':param')
        .replace(/\{[a-zA-Z0-9_]+\}/g, ':param')
        .replace(/\/+$/, '');
    };

    const matchedContracts = [];
    const danglingCalls = [];
    const matchedBackendIndices = new Set();

    for (const call of clientCalls) {
      const callNorm = normalizeParamPattern(call.endpoint);
      let matchedRoute = null;

      backendRoutes.forEach((route, rIdx) => {
        const routeNorm = normalizeParamPattern(route.path);
        if (callNorm === routeNorm || call.endpoint === route.path) {
          const methodMatch = call.method === 'ALL' || route.method === 'ALL' || call.method === route.method;
          if (methodMatch) {
            matchedRoute = route;
            matchedBackendIndices.add(rIdx);
          }
        }
      });

      if (matchedRoute) {
        matchedContracts.push({
          endpoint: call.endpoint,
          method: call.method,
          clientFile: call.file,
          clientLine: call.line,
          backendFile: matchedRoute.file,
          framework: matchedRoute.framework,
        });
      } else {
        danglingCalls.push({
          endpoint: call.endpoint,
          method: call.method,
          file: call.file,
          line: call.line,
          reason: 'No matching backend route handler found',
        });
      }
    }

    const orphanRoutes = backendRoutes
      .filter((_, idx) => !matchedBackendIndices.has(idx))
      .map(r => ({
        path: r.path,
        method: r.method,
        file: r.file,
        framework: r.framework,
      }));

    const totalClientCalls = clientCalls.length;
    const driftScore = totalClientCalls > 0
      ? Math.round((matchedContracts.length / totalClientCalls) * 100)
      : 100;

    return {
      driftScore,
      totalBackendRoutes: backendRoutes.length,
      totalClientCalls,
      matchedContracts: matchedContracts.slice(0, 30),
      danglingCalls: danglingCalls.slice(0, 30),
      orphanRoutes: orphanRoutes.slice(0, 30),
    };
  }
}

// ─────────────────────────────────────────────
// Helper — Build Clean Structure Tree
// ─────────────────────────────────────────────
function buildStructureTree(files) {
  const tree = {};
  for (const file of files) {
    const parts = file.name.split('/').filter(Boolean);
    let node = tree;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (i === parts.length - 1) {
        node[part] = null;
      } else {
        node[part] = node[part] || {};
        node = node[part];
      }
    }
  }
  return tree;
}

// ─────────────────────────────────────────────
// MAIN HANDLER
// ─────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { files } = req.body;

    if (!Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ error: 'No files provided' });
    }

    // Step 1: Filter out ignored directory & binary files (.git, node_modules, dist, .png, etc.)
    const filteredFiles = files.filter(f => !shouldIgnoreFile(f.name));

    if (filteredFiles.length === 0) {
      return res.status(400).json({ error: 'No valid source code files found in payload.' });
    }

    // Step 2: Cap total files to 400 for serverless memory & timeout compliance
    const cappedFiles = filteredFiles.slice(0, 400);

    const validator = new MermaidValidator();

    // Run pipeline stages
    const metrics           = new MetricsScanner(cappedFiles).scan();
    const requirements      = new RequirementsExtractor(cappedFiles).extract();
    const hldRaw            = new HLDGenerator(cappedFiles).generate();
    const lineageRaw        = new LineageGenerator(cappedFiles).generate();
    const lldRaw            = new LLDGenerator(cappedFiles).generate();
    const structureTree     = buildStructureTree(cappedFiles);

    // Extended zero-LLM analysis stages
    const complexityReport  = new ComplexityScanner(cappedFiles).scan();
    const jsCircularDeps    = new JsCircularDepDetector(cappedFiles).detect();
    const commentRatios     = new CommentRatioAnalyzer(cappedFiles).analyze();
    const largeFiles        = new LargeFileDetector(cappedFiles).detect();
    const couplingData      = new CouplingAnalyzer(cappedFiles).analyze();
    const jsSecurityIssues  = new JsSecurityScanner(cappedFiles).scan();
    const technicalDebt     = new DebtScanner(cappedFiles).scan();
    const apiDrift          = new ApiContractDriftScanner(cappedFiles).scan();

    const hld     = validator.safeValidate(hldRaw, 'hld', 'graph TD\n  A["Could not generate HLD"]');
    const lineage = validator.safeValidate(lineageRaw, 'lineage', 'graph TD\n  A["No import relationships found"]');
    const lld     = validator.safeValidate(lldRaw, 'lld', 'classDiagram\n  note "No class signatures found"');

    return res.status(200).json({
      metrics, requirements, hld, lld, lineage, structureTree,
      complexityReport, jsCircularDeps, commentRatios,
      largeFiles, couplingData, jsSecurityIssues,
      technicalDebt, apiDrift,
    });
  } catch (err) {
    console.error('[analyze] Error:', err);
    return res.status(500).json({ error: 'Internal analysis error', details: err.message });
  }
}
