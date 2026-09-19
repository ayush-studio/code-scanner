/**
 * githubService.js — API wrapper for /api/fetch-github
 *
 * Architecture note: This service fetches repo file contents via
 * the GitHub REST API. The returned files are in the same shape as
 * those from analyzeService, so they can be fed directly into
 * analyzeFiles() for a seamless pipeline.
 */

import axios from 'axios';

/**
 * Fetch a GitHub repository's files via /api/fetch-github,
 * then pass the result to the analyze endpoint.
 *
 * @param {string} repoUrl - GitHub repository URL
 * @param {string} [token]  - Optional Personal Access Token for private repos
 * @returns {Promise<{ files: Array, totalFetched: number, totalInRepo: number }>}
 */
export async function fetchGitHubRepo(repoUrl, token) {
  const response = await axios.post('/api/fetch-github', {
    repoUrl,
    ...(token ? { token } : {}),
  }, {
    headers: { 'Content-Type': 'application/json' },
    timeout: 30000,
  });

  return response.data;
}
