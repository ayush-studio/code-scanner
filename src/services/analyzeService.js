/**
 * analyzeService.js — API wrapper for /api/analyze
 *
 * Architecture note: This service is the single gateway to the backend analysis.
 * Large folder handling: Files are filtered for ignored paths (.git, node_modules, binaries)
 * and batched in groups of 50 to avoid hitting serverless body payload limits.
 */

import axios from 'axios';
import { shouldIgnoreFile } from '../utils/fileFilter';
import { analyzeWithPython } from './pythonAnalyzeService';
import { detectDeadCode } from '../utils/deadCodeDetector';
import { detectDuplication } from '../utils/duplicationDetector';
import { auditLicenses } from '../utils/licenseChecker';
import { computeHealthScorecard } from '../utils/healthScorecard';

const BATCH_SIZE = 50;
const MAX_FILE_BYTES = 500 * 1024; // 500KB per file limit

function readFileAsText(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = () => resolve('');
    reader.readAsText(file);
  });
}

/**
 * Convert browser File objects to serializable { name, content } objects.
 * Filters out binary files, git objects, and oversized files.
 */
async function serializeFiles(fileList, onProgress) {
  const result = [];
  let processed = 0;

  for (const file of fileList) {
    const relativePath = file.webkitRelativePath || file.name;

    // Filter ignored files (.git, node_modules, binaries, lockfiles)
    if (shouldIgnoreFile(relativePath) || file.size > MAX_FILE_BYTES) {
      processed++;
      onProgress?.(processed, fileList.length);
      continue;
    }

    const content = await readFileAsText(file);
    result.push({ name: relativePath, content });

    processed++;
    onProgress?.(processed, fileList.length);
  }

  return result;
}

function chunk(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

function mergeResults(results) {
  if (results.length === 0) return null;
  if (results.length === 1) return results[0];

  const merged = {
    metrics: { totalFiles: 0, totalLines: 0, byLanguage: {} },
    requirements: { commands: [], dependencies: [] },
    hld: results[0].hld,
    lld: results[0].lld,
    lineage: results[0].lineage,
    structureTree: {},
  };

  for (const r of results) {
    if (!r || !r.metrics) continue;
    merged.metrics.totalFiles += r.metrics.totalFiles;
    merged.metrics.totalLines += r.metrics.totalLines;
    for (const [ext, lines] of Object.entries(r.metrics.byLanguage || {})) {
      merged.metrics.byLanguage[ext] = (merged.metrics.byLanguage[ext] || 0) + lines;
    }
    merged.requirements.commands = [...new Set([...merged.requirements.commands, ...(r.requirements?.commands || [])])];
    merged.requirements.dependencies.push(...(r.requirements?.dependencies || []));
    Object.assign(merged.structureTree, r.structureTree || {});
  }

  const seen = new Set();
  merged.requirements.dependencies = merged.requirements.dependencies.filter(dep => {
    if (seen.has(dep.name)) return false;
    seen.add(dep.name);
    return true;
  });

  return merged;
}

export async function analyzeFiles(fileList, onProgress) {
  const serialized = await serializeFiles(fileList, onProgress);

  if (serialized.length === 0) {
    throw new Error('No readable source code files found in selected folder.');
  }

  const batches = chunk(serialized, BATCH_SIZE);
  const results = [];

  for (const batch of batches) {
    const response = await axios.post('/api/analyze', { files: batch }, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 35000,
    });
    results.push(response.data);
  }

  const merged = mergeResults(results);
  merged.rawFiles = serialized;

  // Run Python Deep AST & Route Scanner
  try {
    const pythonData = await analyzeWithPython(serialized);
    merged.pythonAnalysis = pythonData;
  } catch (err) {
    console.warn('[analyzeService] Python analysis error:', err);
  }

  // Run Dead Code, Duplication, License Audit, and Scorecard
  try {
    merged.deadCode = detectDeadCode(serialized);
    merged.duplication = detectDuplication(serialized);
    merged.licenseAudit = auditLicenses(serialized);

    // Recompute scorecard with ALL data now available (including new JS analysis fields)
    merged.scorecard = computeHealthScorecard({
      ...merged,
      jsSecurityIssues: merged.jsSecurityIssues || [],
      complexityReport: merged.complexityReport || {},
      couplingData: merged.couplingData || {},
    });
  } catch (err) {
    console.warn('[analyzeService] Client audit suite error:', err);
  }

  return merged;
}


