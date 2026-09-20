/**
 * healthScorecard.js — Overall Code Quality Grade (A+ to F) & Scorecard Calculator
 *
 * Combines metrics from:
 * 1. Security Scanner Findings (30%)
 * 2. Cyclomatic Complexity (20%)
 * 3. Duplication Percentage (20%)
 * 4. Dead Code & Orphan Files (15%)
 * 5. Test File Presence & Documentation Ratio (15%)
 */

export function computeHealthScorecard(analysisData = {}) {
  const securityIssues = analysisData.pythonAnalysis?.securityIssues || [];
  const pythonAST = analysisData.pythonAnalysis?.pythonAST || { functions: [], classes: [] };
  const deadCode = analysisData.deadCode || { totalUnusedExports: 0, totalOrphanFiles: 0 };
  const duplication = analysisData.duplication || { duplicationPercentage: 0 };
  const licenseAudit = analysisData.licenseAudit || { copyleftCount: 0 };
  const metrics = analysisData.metrics || { totalFiles: 0, totalLines: 0, byLanguage: {} };
  const structureTree = analysisData.structureTree || {};

  let score = 100;
  const recommendations = [];

  // 1. Security Deductions (Max -30 pts)
  const highSec = securityIssues.filter(i => i.severity?.toLowerCase() === 'high').length;
  const medSec = securityIssues.filter(i => i.severity?.toLowerCase() === 'medium').length;

  if (highSec > 0) {
    score -= Math.min(25, highSec * 10);
    recommendations.push({
      type: 'critical',
      text: `Fix ${highSec} high-risk static security issues (e.g. hardcoded secrets or unsafe eval()).`
    });
  }
  if (medSec > 0) {
    score -= Math.min(10, medSec * 3);
    recommendations.push({
      type: 'warning',
      text: `Review ${medSec} medium-risk security configurations.`
    });
  }

  // 2. Complexity Deductions (Max -20 pts)
  const functions = pythonAST.functions || [];
  const highComplexityFns = functions.filter(f => (f.complexity || 0) >= 8).length;
  if (highComplexityFns > 0) {
    score -= Math.min(15, highComplexityFns * 5);
    recommendations.push({
      type: 'warning',
      text: `Refactor ${highComplexityFns} functions with high Cyclomatic Complexity (Score >= 8).`
    });
  }

  // 3. Duplication Deductions (Max -20 pts)
  const dupPct = duplication.duplicationPercentage || 0;
  if (dupPct > 5) {
    const ded = Math.min(20, Math.round((dupPct - 5) * 1.5));
    score -= ded;
    recommendations.push({
      type: 'warning',
      text: `Reduce duplicate code blocks (currently ${dupPct}% duplication).`
    });
  }

  // 4. Dead Code Deductions (Max -15 pts)
  const unusedCount = deadCode.totalUnusedExports || 0;
  const orphanCount = deadCode.totalOrphanFiles || 0;
  if (unusedCount > 0 || orphanCount > 0) {
    score -= Math.min(15, unusedCount * 2 + orphanCount * 3);
    recommendations.push({
      type: 'info',
      text: `Clean up ${unusedCount} unused exported symbols and ${orphanCount} orphan files.`
    });
  }

  // 5. Test Presence & License Deductions (Max -15 pts)
  const hasTests = JSON.stringify(structureTree).toLowerCase().includes('test') ||
                   metrics.totalFiles > 0 && Object.keys(metrics.byLanguage).some(k => k.includes('test'));

  if (!hasTests && metrics.totalFiles > 5) {
    score -= 10;
    recommendations.push({
      type: 'warning',
      text: 'Add unit or integration tests (no test files identified in repository tree).'
    });
  }

  if (licenseAudit.copyleftCount > 0) {
    score -= 5;
    recommendations.push({
      type: 'info',
      text: `Audit ${licenseAudit.copyleftCount} Copyleft (GPL/AGPL) dependencies for license compliance.`
    });
  }

  // Bound score between 0 and 100
  score = Math.max(0, Math.min(100, Math.round(score)));

  // Calculate Grade
  let grade = 'A+';
  let color = 'emerald';

  if (score >= 95) { grade = 'A+'; color = 'emerald'; }
  else if (score >= 88) { grade = 'A'; color = 'emerald'; }
  else if (score >= 80) { grade = 'B'; color = 'cyan'; }
  else if (score >= 70) { grade = 'C'; color = 'yellow'; }
  else if (score >= 60) { grade = 'D'; color = 'amber'; }
  else { grade = 'F'; color = 'red'; }

  if (recommendations.length === 0) {
    recommendations.push({
      type: 'success',
      text: 'Excellent codebase health! All security, complexity, and structural checks passed cleanly.'
    });
  }

  return {
    score,
    grade,
    color,
    breakdown: {
      securityScore: Math.max(0, 30 - highSec * 10 - medSec * 3),
      complexityScore: Math.max(0, 20 - highComplexityFns * 5),
      duplicationScore: Math.max(0, 20 - (dupPct > 5 ? Math.round((dupPct - 5) * 1.5) : 0)),
      deadCodeScore: Math.max(0, 15 - unusedCount * 2 - orphanCount * 3),
      testScore: hasTests ? 15 : 5
    },
    recommendations
  };
}
