/**
 * /api/fetch-github.js — GitHub REST API Integration
 *
 * Architecture note: This module uses GitHub's REST API to fetch repository
 * file trees and contents WITHOUT running git clone, making it compatible
 * with Vercel's serverless environment.
 *
 * Accepts POST: { repoUrl: string, token?: string }
 * Returns:      { files: [{ name: string, content: string }] }
 */

const MAX_FILES = 250;
const MAX_TOTAL_BYTES = 8 * 1024 * 1024; // 8MB

const IGNORED_DIRS = new Set([
  '.git', 'node_modules', 'dist', 'build', '.next', 'out', 'coverage',
  '.venv', 'venv', '__pycache__', '.idea', '.vscode', '.turbo', '.cache',
  'vendor', 'target', 'bin', 'obj', '.output', '.nuxt'
]);

const IGNORED_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'svg', 'ico', 'webp', 'pdf', 'zip', 'tar',
  'gz', '7z', 'rar', 'exe', 'dll', 'so', 'dylib', 'bin', 'dat', 'iso', 'dmg',
  'woff', 'woff2', 'ttf', 'eot', 'db', 'sqlite', 'lock', 'ds_store', 'log', 'glb', 'gltf'
]);

function shouldIgnorePath(path) {
  if (!path) return true;
  const parts = path.toLowerCase().split('/').filter(Boolean);
  for (const part of parts) {
    if (IGNORED_DIRS.has(part) || part.startsWith('.git')) return true;
  }
  const filename = parts[parts.length - 1] || '';
  const extMatch = filename.match(/\.([^.]+)$/);
  if (extMatch && IGNORED_EXTENSIONS.has(extMatch[1].toLowerCase())) return true;
  return false;
}

function parseGitHubUrl(url) {
  try {
    const u = new URL(url);
    const parts = u.pathname.replace(/^\//, '').split('/');
    const owner = parts[0];
    const repo  = parts[1]?.replace(/\.git$/, '');
    const branch = parts[3] || 'HEAD';
    if (!owner || !repo) throw new Error('Invalid GitHub URL');
    return { owner, repo, branch };
  } catch {
    throw new Error('Could not parse GitHub URL. Format: https://github.com/owner/repo');
  }
}

async function fetchFileTree(owner, repo, branch, headers) {
  const url = `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`;
  const response = await fetch(url, { headers });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    if (response.status === 404) throw new Error('Repository not found. Check URL or private access token.');
    if (response.status === 401 || response.status === 403) throw new Error('GitHub API rate limited or unauthorized. Add a Personal Access Token.');
    throw new Error(body.message || `GitHub API error: ${response.status}`);
  }

  const data = await response.json();
  if (data.truncated) {
    throw { code: 413, message: 'Repository is too large for GitHub API tree fetch. Please download/clone locally and use folder upload.' };
  }

  return data.tree || [];
}

async function fetchFileContent(owner, repo, fileSha, headers) {
  const url = `https://api.github.com/repos/${owner}/${repo}/git/blobs/${fileSha}`;
  const response = await fetch(url, { headers });
  if (!response.ok) return null;
  const data = await response.json();
  return Buffer.from(data.content, 'base64').toString('utf-8');
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { repoUrl, token } = req.body;

    if (!repoUrl) {
      return res.status(400).json({ error: 'repoUrl is required' });
    }

    const headers = {
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'CodeScanner-App',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    };

    const { owner, repo, branch } = parseGitHubUrl(repoUrl);

    let tree;
    try {
      tree = await fetchFileTree(owner, repo, branch, headers);
    } catch (err) {
      if (err.code === 413) return res.status(413).json({ error: err.message });
      throw err;
    }

    // Filter out ignored paths, non-blobs
    const validBlobs = tree.filter(item => item.type === 'blob' && !shouldIgnorePath(item.path));

    if (validBlobs.length > MAX_FILES) {
      // Pick top MAX_FILES source files
      validBlobs.length = MAX_FILES;
    }

    let totalBytes = 0;
    const files = [];
    const MAX_FILE_BYTES = 500 * 1024;

    for (const blob of validBlobs) {
      if (totalBytes > MAX_TOTAL_BYTES) break;

      const content = await fetchFileContent(owner, repo, blob.sha, headers);
      if (!content) continue;

      const byteSize = Buffer.byteLength(content, 'utf-8');
      if (byteSize > MAX_FILE_BYTES) continue;

      totalBytes += byteSize;
      files.push({ name: blob.path, content });
    }

    if (files.length === 0) {
      return res.status(422).json({ error: 'No readable source files found in repository.' });
    }

    return res.status(200).json({ files, totalFetched: files.length, totalInRepo: tree.length });

  } catch (err) {
    console.error('[fetch-github] Error:', err);
    return res.status(500).json({ error: err.message || 'Failed to fetch repository' });
  }
}
