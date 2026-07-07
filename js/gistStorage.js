/* gistStorage.js — GitHub Gist persistence for the dynamic library metadata
 * (tags + favorites). Pure fetch against the GitHub REST API, no backend.
 * Exposed as a global (window.GistStore) so the plain-script app.js can use it.
 *
 * The token is a GitHub Personal Access Token with ONLY the `gist` scope.
 * It is entered by the user at runtime and kept in localStorage on this device —
 * never hard-code or commit it.
 */
window.GistStore = (function () {
  'use strict';

  const GIST_FILENAME = 'sfx-library-data.json';
  const CREDENTIALS_KEY = 'sfx_gist_credentials'; // { token, gistId }
  const PENDING_KEY = 'sfx_gist_pending';         // '1' when local edits haven't been pushed

  // ---- credentials ----
  function getCredentials() {
    try { const raw = localStorage.getItem(CREDENTIALS_KEY); return raw ? JSON.parse(raw) : null; }
    catch { return null; }
  }
  function saveCredentials(token, gistId) {
    localStorage.setItem(CREDENTIALS_KEY, JSON.stringify({ token, gistId }));
  }
  function clearCredentials() { localStorage.removeItem(CREDENTIALS_KEY); }

  // ---- pending flag (survives reloads so we can tell an interrupted sync happened) ----
  const setPending = () => localStorage.setItem(PENDING_KEY, '1');
  const clearPending = () => localStorage.removeItem(PENDING_KEY);
  const hasPending = () => !!localStorage.getItem(PENDING_KEY);

  // Accepts a raw id or a gist URL and returns the 20+ hex id.
  function extractGistId(input) {
    const trimmed = String(input || '').trim();
    const m = trimmed.match(/([a-f0-9]{20,})/i);
    return m ? m[1] : trimmed;
  }

  async function githubError(res) {
    try { const body = await res.json(); return new Error(`GitHub ${res.status}: ${body.message || JSON.stringify(body)}`); }
    catch { return new Error(`GitHub API error ${res.status}`); }
  }

  async function loadFromGist(token, gistId) {
    const res = await fetch(`https://api.github.com/gists/${gistId}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
    });
    if (!res.ok) throw await githubError(res);
    const gist = await res.json();
    const content = gist.files && gist.files[GIST_FILENAME] && gist.files[GIST_FILENAME].content;
    if (!content) throw new Error(`File "${GIST_FILENAME}" not found in gist`);
    return JSON.parse(content);
  }

  async function saveToGist(token, gistId, data) {
    const res = await fetch(`https://api.github.com/gists/${gistId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ files: { [GIST_FILENAME]: { content: JSON.stringify(data, null, 2) } } }),
    });
    if (!res.ok) throw await githubError(res);
  }

  async function createGist(token, data) {
    const res = await fetch('https://api.github.com/gists', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        description: 'SFX Library — tags & favorites',
        public: false,
        files: { [GIST_FILENAME]: { content: JSON.stringify(data, null, 2) } },
      }),
    });
    if (!res.ok) throw await githubError(res);
    const gist = await res.json();
    return gist.id;
  }

  return {
    getCredentials, saveCredentials, clearCredentials,
    setPending, clearPending, hasPending,
    extractGistId, loadFromGist, saveToGist, createGist,
  };
})();
