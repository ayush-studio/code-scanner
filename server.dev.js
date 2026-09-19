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

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const server = app.listen(PORT, () => {
  console.log(`\n  🚀 API Dev Server running at http://localhost:${PORT}`);
  console.log(`  📡 Routes:`);
  console.log(`     POST /api/analyze`);
  console.log(`     POST /api/fetch-github`);
  console.log(`     GET  /api/health\n`);
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`\n  ⚠ Port ${PORT} is already in use. API Dev Server is running on port ${PORT}.\n`);
  } else {
    console.error('API Dev Server error:', err);
  }
});
