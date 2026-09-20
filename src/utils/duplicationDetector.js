/**
 * duplicationDetector.js — Zero-LLM Token-Hashing Code Duplication Detector
 *
 * Uses sliding window n-gram line tokenization (ignoring whitespace and comments)
 * to detect identical multi-line code blocks across files.
 */

export function detectDuplication(files = [], windowSize = 4) {
  const ngramMap = new Map(); // hash -> list of { file, lineStart, snippet }
  let totalProcessedLines = 0;
  let totalDuplicateLines = 0;

  for (const file of files) {
    const filename = file.name || '';
    const content = file.content || '';
    if (!content.trim()) continue;

    const rawLines = content.split('\n');
    totalProcessedLines += rawLines.length;

    // Normalize lines: strip comments, trim spaces
    const normalizedLines = rawLines.map(line => {
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
        return '';
      }
      return trimmed;
    });

    // Create sliding n-grams
    for (let i = 0; i <= normalizedLines.length - windowSize; i++) {
      const window = normalizedLines.slice(i, i + windowSize);
      // Skip window if any line is empty or trivial brackets
      if (window.some(l => l.length < 5 || l === '{' || l === '}' || l === '};')) {
        continue;
      }

      const hashKey = window.join('\n');
      const snippet = rawLines.slice(i, i + windowSize).join('\n');

      if (!ngramMap.has(hashKey)) {
        ngramMap.set(hashKey, []);
      }

      const matches = ngramMap.get(hashKey);
      // Prevent duplicate matches within the exact same file line range
      if (!matches.some(m => m.file === filename && Math.abs(m.lineStart - (i + 1)) < windowSize)) {
        matches.push({
          file: filename,
          lineStart: i + 1,
          lineEnd: i + windowSize,
          snippet
        });
      }
    }
  }

  // Filter ngrams with occurrences in 2 or more places
  const duplicateBlocks = [];
  const trackedDuplicates = new Set();

  for (const [hashKey, occurrences] of ngramMap.entries()) {
    if (occurrences.length >= 2) {
      const lineCount = windowSize;
      totalDuplicateLines += (occurrences.length - 1) * lineCount;

      duplicateBlocks.push({
        instancesCount: occurrences.length,
        lines: lineCount,
        files: occurrences.map(o => `${o.file}:${o.lineStart}`),
        snippet: occurrences[0].snippet,
        occurrences
      });
    }
  }

  // Sort duplicate blocks by number of occurrences / lines descending
  duplicateBlocks.sort((a, b) => b.instancesCount * b.lines - a.instancesCount * a.lines);

  const duplicationPercentage = totalProcessedLines > 0
    ? Math.min(100, parseFloat(((totalDuplicateLines / totalProcessedLines) * 100).toFixed(1)))
    : 0;

  return {
    duplicationPercentage,
    totalDuplicateLines,
    totalProcessedLines,
    duplicateBlocks: duplicateBlocks.slice(0, 15)
  };
}
