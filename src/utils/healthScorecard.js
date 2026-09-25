/**
 * healthScorecard.js — Overall Code Quality Grade (A+ to F) & Scorecard Calculator
 *
 * Combines metrics from:
 * 1. Security Scanner Findings — Python + JS/TS (25%)
 * 2. Cyclomatic Complexity — Python (15%) + JS/TS (10%)
 * 3. Duplication Percentage (15%)
 * 4. Dead Code & Orphan Files (12%)
 * 5. Test File Presence & License Compliance (13%)
 * 6. Import Coupling / Fan-Out — JS/TS (10%)
 */

export function computeHealthScorecard(analysisData = {}) {
  const securityIssues    = analysisData.pythonAnalysis?.securityIssues || [];
  const jsSecurityIssues  = analysisData.jsSecurityIssues || [];
  const pythonAST         = analysisData.pythonAnalysis?.pythonAST || { functions: [], classes: [] };
  const deadCode          = analysisData.deadCode        || { totalUnusedExports: 0, totalOrphanFiles: 0 };
  const duplication       = analysisData.duplication     || { duplicationPercentage: 0 };
  const licenseAudit      = analysisData.licenseAudit    || { copyleftCount: 0 };
  const metrics           = analysisData.metrics         || { totalFiles: 0, totalLines: 0, byLanguage: {} };
  const structureTree     = analysisData.structureTree   || {};
  const complexityReport  = analysisData.complexityReport || { byFile: [], highComplexityCount: 0 };
  const couplingData      = analysisData.couplingData    || { couplingMap: [], highlyCoupledCount: 0 };

  let score = 100;
  const recommendations = [];

  // 1. Security Deductions (Max -25 pts — merged Python + JS/TS issues)
  const allSecIssues = [...securityIssues, ...jsSecurityIssues];
  const highSec = allSecIssues.filter(i => i.severity?.toLowerCase() === 'high').length;
  const medSec  = allSecIssues.filter(i => i.severity?.toLowerCase() === 'medium').length;

  if (highSec > 0) {
    score -= Math.min(20, highSec * 8);
    recommendations.push({
      type: 'critical',
      text: `Fix ${highSec} high-risk static security issues (e.g. hardcoded secrets or unsafe eval()).`
    });
  }
  if (medSec > 0) {
    score -= Math.min(8, medSec * 2);
    recommendations.push({
      type: 'warning',
      text: `Review ${medSec} medium-risk security configurations.`
    });
  }

  // 2. Python Complexity Deductions (Max -15 pts)
  const functions = pythonAST.functions || [];
  const highComplexityFns = functions.filter(f => (f.complexity || 0) >= 8).length;
  let pyComplexityDed = 0;
  if (highComplexityFns > 0) {
    pyComplexityDed = Math.min(12, highComplexityFns * 4);
    score -= pyComplexityDed;
    recommendations.push({
      type: 'warning',
      text: `Refactor ${highComplexityFns} Python functions with high Cyclomatic Complexity (Score >= 8).`
    });
  }

  // 3. JS/TS Complexity Deductions (Max -10 pts)
  const highJsComplexity = complexityReport.highComplexityCount || 0;
  let jsComplexityDed = 0;
  if (highJsComplexity > 0) {
    jsComplexityDed = Math.min(10, highJsComplexity * 3);
    score -= jsComplexityDed;
    recommendations.push({
      type: 'warning',
      text: `Simplify ${highJsComplexity} JS/TS files with high branching complexity.`
    });
  }

  // 4. Duplication Deductions (Max -15 pts)
  const dupPct = duplication.duplicationPercentage || 0;
  let dupDed = 0;
  if (dupPct > 5) {
    dupDed = Math.min(15, Math.round((dupPct - 5) * 1.2));
    score -= dupDed;
    recommendations.push({
      type: 'warning',
      text: `Reduce duplicate code blocks (currently ${dupPct}% duplication).`
    });
  }

  // 5. Dead Code Deductions (Max -12 pts)
  const unusedCount = deadCode.totalUnusedExports || 0;
  const orphanCount = deadCode.totalOrphanFiles || 0;
  let deadCodeDed = 0;
  if (unusedCount > 0 || orphanCount > 0) {
    deadCodeDed = Math.min(12, unusedCount * 2 + orphanCount * 3);
    score -= deadCodeDed;
    recommendations.push({
      type: 'info',
      text: `Clean up ${unusedCount} unused exported symbols and ${orphanCount} orphan files.`
    });
  }

  // 6. Test Presence & License Deductions (Max -13 pts)
  const hasTests = JSON.stringify(structureTree).toLowerCase().includes('test') ||
                   metrics.totalFiles > 0 && Object.keys(metrics.byLanguage).some(k => k.includes('test'));

  if (!hasTests && metrics.totalFiles > 5) {
    score -= 8;
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

  // 7. Import Coupling Deductions (Max -10 pts)
  const highlyCoupled = couplingData.highlyCoupledCount || 0;
  let couplingDed = 0;
  if (highlyCoupled > 0) {
    couplingDed = Math.min(10, highlyCoupled * 3);
    score -= couplingDed;
    recommendations.push({
      type: 'info',
      text: `Reduce coupling: ${highlyCoupled} JS/TS file(s) import 8+ modules. Extract shared utilities.`
    });
  }

  // Bound score between 0 and 100
  score = Math.max(0, Math.min(100, Math.round(score)));

  // Calculate Grade
  let grade = 'A+';
  let color = 'emerald';

  if (score >= 95)      { grade = 'A+'; color = 'emerald'; }
  else if (score >= 88) { grade = 'A';  color = 'emerald'; }
  else if (score >= 80) { grade = 'B';  color = 'cyan'; }
  else if (score >= 70) { grade = 'C';  color = 'yellow'; }
  else if (score >= 60) { grade = 'D';  color = 'amber'; }
  else                  { grade = 'F';  color = 'red'; }

  if (recommendations.length === 0) {
    recommendations.push({
      type: 'success',
      text: 'Excellent codebase health! All security, complexity, coupling, and structural checks passed cleanly.'
    });
  }

  return {
    score,
    grade,
    color,
    breakdown: {
      securityScore:     Math.max(0, 25 - highSec * 8 - medSec * 2),
      pyComplexityScore: Math.max(0, 15 - pyComplexityDed),
      jsComplexityScore: Math.max(0, 10 - jsComplexityDed),
      duplicationScore:  Math.max(0, 15 - dupDed),
      deadCodeScore:     Math.max(0, 12 - deadCodeDed),
      testScore:         hasTests ? 13 : 5,
      couplingScore:     Math.max(0, 10 - couplingDed),
    },
    recommendations
  };
}
