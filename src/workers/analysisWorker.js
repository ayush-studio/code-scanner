/**
 * analysisWorker.js — WebWorker Background Parallel Processing
 *
 * Runs dead code detection, token hashing duplication scanning,
 * license compliance auditing, and health scorecard calculations in a background WebWorker thread.
 */

import { detectDeadCode } from '../utils/deadCodeDetector';
import { detectDuplication } from '../utils/duplicationDetector';
import { auditLicenses } from '../utils/licenseChecker';
import { computeHealthScorecard } from '../utils/healthScorecard';

self.onmessage = function (e) {
  const { files, pythonAnalysis, metrics, structureTree } = e.data || {};

  try {
    const deadCode = detectDeadCode(files);
    const duplication = detectDuplication(files);
    const licenseAudit = auditLicenses(files);

    const fullPayload = {
      files,
      pythonAnalysis,
      metrics,
      structureTree,
      deadCode,
      duplication,
      licenseAudit
    };

    const scorecard = computeHealthScorecard(fullPayload);

    self.postMessage({
      status: 'success',
      result: {
        deadCode,
        duplication,
        licenseAudit,
        scorecard
      }
    });
  } catch (err) {
    self.postMessage({
      status: 'error',
      error: err.message || 'Worker processing failed'
    });
  }
};
