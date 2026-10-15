/**
 * config.js — Mapping API resolution and workspace registry
 *
 * Login is workspace-first:
 *   1. Resolve workspace name -> workspace API endpoint via the mapping API
 *   2. Send username/password only to that workspace API
 *
 * The mapping API must never receive user credentials for admin login.
 */

// ── Mapping API URL (the ONLY hardcoded URL) ────────────────────────────
const _isLocalhost = ['localhost', '127.0.0.1', ''].includes(window.location.hostname);
const _normalizeBaseUrl = (value) => {
  const v = String(value || '').trim();
  if (!v) return '';
  if (/^https?:\/\//i.test(v)) return v.replace(/\/+$/, '');
  return `https://${v.replace(/\/+$/, '')}`;
};
const MAPPING_API_URL = _isLocalhost
  //? 'http://localhost:5001'
  ? _normalizeBaseUrl('map.babeh.com')
  : _normalizeBaseUrl('map.babeh.com');

// ── Workspace registry (populated at login page load) ───────────────────
let WORKSPACE_MAP = {}; // { slug: endpoint }

/**
 * Fetch all active workspaces from the mapping API.
 * Public endpoint — no token required.
 * Populates WORKSPACE_MAP and returns it.
 */
async function loadWorkspaces() {
  try {
    const res = await fetch(`${MAPPING_API_URL}/api/workspaces/public`, {
      cache: 'no-cache',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    WORKSPACE_MAP = {};
    // Support both array and { workspaces: [...] } / { data: [...] } formats
    const list = Array.isArray(data) ? data : (data.workspaces || data.data || []);
    list.forEach(ws => {
      const slug = ws.workspace_name || ws.slug || ws.name;
      const url  = ws.endpoint || ws.url || ws.api_url || '';
      if (slug && url) WORKSPACE_MAP[slug] = url;
    });
  } catch (e) {
    console.error('❌ Failed to load workspaces from mapping API:', e);
    WORKSPACE_MAP = {};
  }
  return WORKSPACE_MAP;
}

/**
 * Look up a single workspace endpoint by slug.
 * Uses only public mapping endpoints so user credentials stay inside
 * the target workspace backend.
 */
async function lookupWorkspace(slug) {
  const key = String(slug || '').trim();
  if (!key) return null;
  let lookupError = null;

  try {
    const res = await fetch(
      `${MAPPING_API_URL}/api/workspaces/public/lookup/${encodeURIComponent(key)}`,
      { cache: 'no-cache' }
    );
    if (res.ok) {
      const data = await res.json();
      const url = data.endpoint || data.url || data.api_url || null;
      if (url) {
        WORKSPACE_MAP[key] = url;
        return url;
      }
    } else {
      throw new Error(`lookup_http_${res.status}`);
    }
  } catch (e) {
    lookupError = e;
    console.warn(`⚠️ Direct workspace lookup failed for "${key}", trying workspace list:`, e);
  }

  if (!WORKSPACE_MAP[key]) {
    await loadWorkspaces();
  }

  return WORKSPACE_MAP[key] || null;
}

// ── API base resolution ─────────────────────────────────────────────────

/**
 * Returns the workspace API base URL for the current tab's session.
 * Priority: stored endpoint (set at login) → cached map.
 * Never fall back to the mapping API for admin/data requests.
 */
function getApiBase() {
  const endpoint  = sessionStorage.getItem('admin_endpoint');
  if (endpoint) return endpoint;

  const workspace = sessionStorage.getItem('admin_workspace');
  if (workspace && WORKSPACE_MAP[workspace]) return WORKSPACE_MAP[workspace];

  return '';
}

// Legacy compat — set once at load time; use getApiBase() directly on post-login pages.
const API_BASE = getApiBase();

console.log(`🗺️ Mapping API   : ${MAPPING_API_URL}`);
console.log(`📋 Workspace    : ${sessionStorage.getItem('admin_workspace') || '(none)'}`);
console.log(`🔗 API Base     : ${API_BASE}`);
