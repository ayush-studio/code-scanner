/**
 * fileFilter.js — Standard File Ignorer & Extension Mapper
 *
 * Prevents scanning binary assets, git objects, build directories, and lockfiles.
 * Ensures metrics, HLD, LLD, and dependency graphs stay clean and meaningful.
 */

export const IGNORED_DIRS = new Set([
  '.git',
  'node_modules',
  'dist',
  'build',
  '.next',
  'out',
  'coverage',
  '.venv',
  'venv',
  '__pycache__',
  '.idea',
  '.vscode',
  '.turbo',
  '.cache',
  'vendor',
  'target',
  'bin',
  'obj',
  '.output',
  '.nuxt',
  'bower_components',
  '.expo',
  '.gradle'
]);

export const IGNORED_EXTENSIONS = new Set([
  // Images & Media
  'png', 'jpg', 'jpeg', 'gif', 'svg', 'ico', 'webp', 'bmp', 'tiff', 'psd',
  'mp3', 'mp4', 'avi', 'mov', 'mkv', 'webm', 'wav', 'ogg', 'flac',
  'glb', 'gltf', 'obj', 'fbx', 'stl',
  // Documents & Archives
  'pdf', 'zip', 'tar', 'gz', '7z', 'rar', 'bz2', 'xz', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
  // Binaries & Executables
  'exe', 'dll', 'so', 'dylib', 'bin', 'dat', 'iso', 'dmg', 'apk', 'deb', 'rpm', 'jar', 'pyc', 'pyo', 'class', 'o', 'a',
  // Fonts
  'woff', 'woff2', 'ttf', 'eot', 'otf',
  // DB & System
  'db', 'sqlite', 'sqlite3', 'lock', 'ds_store', 'log'
]);

// Friendly language names for extensions
export const LANG_MAP = {
  '.js': { label: 'JavaScript', color: 'yellow' },
  '.jsx': { label: 'React JSX', color: 'yellow' },
  '.ts': { label: 'TypeScript', color: 'cyan' },
  '.tsx': { label: 'React TSX', color: 'cyan' },
  '.py': { label: 'Python', color: 'green' },
  '.java': { label: 'Java', color: 'violet' },
  '.go': { label: 'Go', color: 'cyan' },
  '.rs': { label: 'Rust', color: 'yellow' },
  '.cpp': { label: 'C++', color: 'violet' },
  '.c': { label: 'C', color: 'violet' },
  '.cs': { label: 'C#', color: 'violet' },
  '.rb': { label: 'Ruby', color: 'red' },
  '.php': { label: 'PHP', color: 'violet' },
  '.css': { label: 'CSS', color: 'violet' },
  '.scss': { label: 'SCSS', color: 'violet' },
  '.html': { label: 'HTML', color: 'yellow' },
  '.json': { label: 'JSON', color: 'gray' },
  '.md': { label: 'Markdown', color: 'gray' },
  '.yaml': { label: 'YAML', color: 'gray' },
  '.yml': { label: 'YAML', color: 'gray' },
  '.toml': { label: 'TOML', color: 'gray' },
  '.sh': { label: 'Shell', color: 'green' },
  '.kt': { label: 'Kotlin', color: 'violet' },
  '.swift': { label: 'Swift', color: 'yellow' },
  '.sql': { label: 'SQL', color: 'cyan' },
  '.graphql': { label: 'GraphQL', color: 'pink' },
};

/**
 * Determines whether a file path should be excluded from analysis.
 * @param {string} filePath - E.g., "src/components/Button.jsx" or ".git/objects/3f/123"
 * @returns {boolean} - true if file should be ignored
 */
export function shouldIgnoreFile(filePath) {
  if (!filePath || typeof filePath !== 'string') return true;

  const normalized = filePath.replace(/\\/g, '/');
  const parts = normalized.toLowerCase().split('/').filter(Boolean);

  // 1. Check directory names
  for (const part of parts) {
    if (IGNORED_DIRS.has(part)) return true;
    if (part.startsWith('.git')) return true;
  }

  // 2. Check hidden files / system files
  const filename = parts[parts.length - 1] || '';
  if (filename === '.ds_store' || filename === 'thumbs.db' || filename === 'desktop.ini') {
    return true;
  }

  // 3. Check file extension
  const extMatch = filename.match(/\.([^.]+)$/);
  if (extMatch) {
    const ext = extMatch[1].toLowerCase();
    if (IGNORED_EXTENSIONS.has(ext)) return true;
  }

  return false;
}
