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
// STAGE 4 — Lineage Generator (Dependency Graph)
// Traces relative import/require statements between source files.
// ─────────────────────────────────────────────
class LineageGenerator {
  constructor(files) {
    this.files = files;
  }

  generate() {
    const edges = new Set();
    const nodeLabels = new Map();

    const sourceExts = new Set(['js', 'jsx', 'ts', 'tsx', 'py', 'java', 'go', 'rs', 'php', 'rb', 'kt']);
    const sourceFiles = this.files.filter(f => {
      const ext = f.name.split('.').pop()?.toLowerCase();
      return sourceExts.has(ext);
    });

    const importPatterns = [
      /import\s+(?:[\w*{},\s]+\s+from\s+)?['"]([^'"]+)['"]/g,
      /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
      /from\s+(\.[\w./]+)\s+import/g,
    ];

    for (const file of sourceFiles) {
      const fromBase = file.name.split('/').pop().replace(/\.[^.]+$/, '');
      const fromId = this._nodeId(file.name);
      nodeLabels.set(fromId, fromBase);
      const fromDir = file.name.split('/').slice(0, -1).join('/');

      for (const pattern of importPatterns) {
        let match;
        const re = new RegExp(pattern.source, pattern.flags);
        while ((match = re.exec(file.content)) !== null) {
          const importPath = match[1];
          if (!importPath || (!importPath.startsWith('.') && !importPath.startsWith('/'))) continue;

          const resolved = this._resolve(fromDir, importPath);
          const toBase = resolved.split('/').pop().replace(/\.[^.]+$/, '');
          const toId = this._nodeId(resolved);
          nodeLabels.set(toId, toBase);

          if (fromId !== toId) {
            edges.add(`${fromId} --> ${toId}`);
          }
        }
      }
    }

    if (edges.size === 0) {
      return 'graph TD\n  A["No local file import relationships detected"]';
    }

    const edgeList = [...edges].slice(0, 35);
    const activeNodes = [...nodeLabels.entries()]
      .filter(([id]) => edgeList.some(e => e.includes(id)))
      .map(([id, label]) => `  ${id}["${label}"]`);

    const lines = ['graph TD', ...activeNodes, ...edgeList.map(e => '  ' + e)];
    return lines.join('\n');
  }

  _nodeId(filePath) {
    return 'L_' + filePath.replace(/[^a-zA-Z0-9]/g, '_').slice(-30);
  }

  _resolve(fromDir, importPath) {
    if (importPath.startsWith('/')) return importPath.slice(1);
    const parts = (fromDir ? fromDir + '/' + importPath : importPath).split('/');
    const resolved = [];
    for (const part of parts) {
      if (part === '..') resolved.pop();
      else if (part !== '.') resolved.push(part);
    }
    return resolved.join('/');
  }
}

// ─────────────────────────────────────────────
// STAGE 5 — LLD Generator
// Extracts class/function signatures into a Mermaid class diagram.
// ─────────────────────────────────────────────
class LLDGenerator {
  constructor(files) {
    this.files = files;
  }

  generate() {
    const classes = [];

    for (const file of this.files) {
      const ext = file.name.split('.').pop().toLowerCase();
      if (!['js', 'jsx', 'ts', 'tsx', 'py', 'java', 'cs', 'go'].includes(ext)) continue;

      const extracted = this._extractFromFile(file.content, ext);
      classes.push(...extracted);

      if (classes.length >= 15) break;
    }

    if (classes.length === 0) {
      return 'classDiagram\n  note "No explicit class or export function signatures detected"';
    }

    const lines = ['classDiagram'];
    for (const cls of classes.slice(0, 15)) {
      const safeName = cls.name.replace(/[^a-zA-Z0-9_]/g, '_');
      lines.push(`  class ${safeName} {`);
      for (const prop of cls.properties.slice(0, 5)) {
        lines.push(`    ${this._sanitizeMember(prop)}`);
      }
      for (const method of cls.methods.slice(0, 6)) {
        lines.push(`    ${this._sanitizeMember(method)}()`);
      }
      lines.push('  }');
    }

    return lines.join('\n');
  }

  _extractFromFile(content, ext) {
    const result = [];

    if (['js', 'jsx', 'ts', 'tsx'].includes(ext)) {
      const classRe = /class\s+(\w+)/g;
      let m;
      while ((m = classRe.exec(content)) !== null) {
        result.push({ name: m[1], methods: ['constructor', 'render'], properties: ['state', 'props'] });
      }

      const fnRe = /export\s+(?:default\s+)?(?:async\s+)?function\s+(\w+)/g;
      while ((m = fnRe.exec(content)) !== null) {
        result.push({ name: m[1], methods: ['execute'], properties: [] });
      }
    }

    if (ext === 'py') {
      const classRe = /^class\s+(\w+)/gm;
      let m;
      while ((m = classRe.exec(content)) !== null) {
        result.push({ name: m[1], methods: ['__init__'], properties: [] });
      }
    }

    if (ext === 'java' || ext === 'cs') {
      const classRe = /(?:public|private)?\s*class\s+(\w+)/g;
      let m;
      while ((m = classRe.exec(content)) !== null) {
        result.push({ name: m[1], methods: ['main'], properties: [] });
      }
    }

    if (ext === 'go') {
      const structRe = /type\s+(\w+)\s+struct/g;
      let m;
      while ((m = structRe.exec(content)) !== null) {
        result.push({ name: m[1], methods: [], properties: [] });
      }
    }

    return result;
  }

  _sanitizeMember(name) {
    return name.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 25);
  }
}

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
    const metrics       = new MetricsScanner(cappedFiles).scan();
    const requirements  = new RequirementsExtractor(cappedFiles).extract();
    const hldRaw        = new HLDGenerator(cappedFiles).generate();
    const lineageRaw    = new LineageGenerator(cappedFiles).generate();
    const lldRaw        = new LLDGenerator(cappedFiles).generate();
    const structureTree = buildStructureTree(cappedFiles);

    const hld     = validator.safeValidate(hldRaw, 'hld', 'graph TD\n  A["Could not generate HLD"]');
    const lineage = validator.safeValidate(lineageRaw, 'lineage', 'graph TD\n  A["No import relationships found"]');
    const lld     = validator.safeValidate(lldRaw, 'lld', 'classDiagram\n  note "No class signatures found"');

    return res.status(200).json({ metrics, requirements, hld, lld, lineage, structureTree });
  } catch (err) {
    console.error('[analyze] Error:', err);
    return res.status(500).json({ error: 'Internal analysis error', details: err.message });
  }
}
