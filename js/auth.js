/**
 * auth.js — Token storage, guards, API helpers
 */

// ── Token helpers ─────────────────────────────────────────────────────────────
// All session data lives in sessionStorage so each browser tab can be logged
// into a different workspace without interfering with other tabs.

function getToken()    { return sessionStorage.getItem('admin_token'); }
function getUser()     { return JSON.parse(sessionStorage.getItem('admin_user') || 'null'); }
function setToken(t)   { sessionStorage.setItem('admin_token', t); }
function setUser(u)    { sessionStorage.setItem('admin_user', JSON.stringify(u)); }
function getWorkspace(){ return sessionStorage.getItem('admin_workspace'); }

function _decodeJwtPayload(token) {
  try {
    const part = String(token || '').split('.')[1] || '';
    if (!part) return null;
    const normalized = part.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
    const json = atob(padded);
    return JSON.parse(json);
  } catch (_) {
    return null;
  }
}

function getTokenTenantId() {
  const token = getToken();
  if (!token) return '';
  const payload = _decodeJwtPayload(token);
  return String(payload?.tenant_id || '').trim();
}

function logout() {
  sessionStorage.removeItem('admin_token');
  sessionStorage.removeItem('admin_user');
  sessionStorage.removeItem('admin_api_key');
  sessionStorage.removeItem('admin_tenant_id');
  sessionStorage.removeItem('admin_workspace');
  sessionStorage.removeItem('admin_endpoint');
  sessionStorage.removeItem('admin_plan');
  sessionStorage.removeItem('admin_session_binding');
  window.location.href = 'index.html';
}

// ── Session integrity ─────────────────────────────────────────────────────
//
// At login, a SHA-256 hash of "workspace::token" is stored as
// admin_session_binding.  Before every API call we recompute the hash and
// compare it to the stored value.  If a user (or injected script) edits
// admin_workspace or admin_token in DevTools the hashes won't match and the
// session is immediately invalidated.

async function _computeBinding(workspace, token) {
  const raw = `${workspace}::${token}`;
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function verifySessionIntegrity() {
  const workspace = sessionStorage.getItem('admin_workspace');
  const token     = sessionStorage.getItem('admin_token');
  const stored    = sessionStorage.getItem('admin_session_binding');
  if (!workspace || !token || !stored) return false;
  const expected = await _computeBinding(workspace, token);
  return expected === stored;
}

// ── Guard: redirect to login if not authenticated ─────────────────────────────

function requireAuth() {
  if (!getToken()) {
    window.location.href = 'index.html';
  }
}

function _recordTiming(entry) {
  const store = window.__kamaTimings || (window.__kamaTimings = []);
  store.push({
    at: new Date().toISOString(),
    ...entry,
  });
  if (store.length > 50) {
    store.shift();
  }
  window.__kamaLastTiming = entry;
  if (console && console.debug) {
    console.debug('[KAMA timing]', entry);
  }
  if (typeof window.refreshTracingTimeline === 'function') {
    window.refreshTracingTimeline();
  }
}

function _readTimingHeaders(res) {
  return {
    serverTiming: res.headers.get('Server-Timing') || '',
    processTimeMs: res.headers.get('X-Process-Time-Ms') || '',
  };
}

function _recordFetchTiming(kind, path, started, res, extra = {}) {
  const timingHeaders = res ? _readTimingHeaders(res) : { serverTiming: '', processTimeMs: '' };
  _recordTiming({
    kind,
    path,
    status: res ? res.status : null,
    totalMs: Number((performance.now() - started).toFixed(2)),
    serverTiming: timingHeaders.serverTiming,
    processTimeMs: timingHeaders.processTimeMs,
    ...extra,
  });
}

// ── Base fetch helpers ────────────────────────────────────────────────────────

async function adminFetch(path, opts = {}) {
  const started = performance.now();
  if (!(await verifySessionIntegrity())) {
    console.warn('Session integrity check failed — forcing logout');
    logout();
    return;
  }
  const base = getApiBase();
  if (!base) {
    throw new Error('Workspace API endpoint is missing. Please log in again.');
  }
  const res = await fetch(`${base}/api/admin${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getToken()}`,
      ...(getTokenTenantId() ? { 'X-Tenant-Id': getTokenTenantId() } : {}),
      ...(opts.headers || {}),
    },
  });
  if (res.status === 401) {
    _recordFetchTiming('adminFetch', path, started, res);
    logout();
    return;
  }
  const data = await res.json();
  if (!res.ok) {
    _recordFetchTiming('adminFetch', path, started, res);
    throw new Error(data.detail || `HTTP ${res.status}`);
  }
  _recordFetchTiming('adminFetch', path, started, res);
  return data;
}

async function refreshApiKey() {
  try {
    const me = await adminFetch('/me');
    const apiKey = String(me?.api_key || '').trim();
    if (apiKey) {
      sessionStorage.setItem('admin_api_key', apiKey);
      return apiKey;
    }
  } catch (err) {
    console.warn('Failed to refresh admin API key:', err);
  }
  return String(sessionStorage.getItem('admin_api_key') || '').trim();
}

async function apiFetch(path, opts = {}) {
  const started = performance.now();
  if (!(await verifySessionIntegrity())) {
    console.warn('Session integrity check failed — forcing logout');
    logout();
    return;
  }
  const base = getApiBase();
  if (!base) {
    throw new Error('Workspace API endpoint is missing. Please log in again.');
  }

  let apiKey = String(sessionStorage.getItem('admin_api_key') || '').trim();
  if (!apiKey) {
    apiKey = await refreshApiKey();
  }

  const isFormData = opts.body instanceof FormData;
  const token = getToken();
  const tenantId = getTokenTenantId();
  let res = await fetch(`${base}/api${path}`, {
    ...opts,
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(tenantId ? { 'X-Tenant-Id': tenantId } : {}),
      'X-API-Key': apiKey,
      ...(opts.headers || {}),
    },
  });

  if (res.status === 401) {
    _recordFetchTiming('apiFetch', path, started, res);
    logout();
    return;
  }
  if (res.status === 403 && apiKey) {
    const refreshedKey = await refreshApiKey();
    if (refreshedKey && refreshedKey !== apiKey) {
      res = await fetch(`${base}/api${path}`, {
        ...opts,
        headers: {
          ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(tenantId ? { 'X-Tenant-Id': tenantId } : {}),
          'X-API-Key': refreshedKey,
          ...(opts.headers || {}),
        },
      });
      apiKey = refreshedKey;
    }
  }

  if (res.status === 401) {
    _recordFetchTiming('apiFetch', path, started, res);
    logout();
    return;
  }

  let data = null;
  try {
    data = await res.json();
  } catch (_) {
    data = null;
  }

  if (!res.ok) {
    const detail = data?.detail;
    const errorMessage =
      (typeof detail === 'string' && detail) ||
      detail?.message ||
      data?.message ||
      (detail ? JSON.stringify(detail) : '') ||
      `HTTP ${res.status}`;
    _recordFetchTiming('apiFetch', path, started, res, { retried: apiKey !== String(sessionStorage.getItem('admin_api_key') || '').trim() });
    throw new Error(errorMessage);
  }
  _recordFetchTiming('apiFetch', path, started, res, { retried: apiKey !== String(sessionStorage.getItem('admin_api_key') || '').trim() });
  return data;
}

// ── Toast ─────────────────────────────────────────────────────────────────────

function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${icons[type] || '•'}</span><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity .3s';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// ── Role-based access control ─────────────────────────────────────────────────

/**
 * Pages each role is allowed to visit.
 * superadmin gets everything so we don't list it — handled by fallback.
 */
const ROLE_PAGES = {
  analyst:  ['welcome', 'summary', 'usage', 'searchinsights', 'useranalytics', 'history', 'settings', 'settings-credentials', 'debug'],
  editor:   ['welcome', 'knowledge', 'pricing', 'productspecs', 'settings', 'settings-credentials'],
  manager:  ['welcome', 'knowledge', 'pricing', 'productspecs', 'summary', 'usage', 'searchinsights', 'useranalytics', 'history', 'settings', 'settings-credentials', 'custom-instruction', 'debug'],
};

// Maps page slug → the feature flag key in plan.features that must be true
const PLAN_FEATURE_MAP = {
  pricing:        'pricing',
  productspecs:   'product_specs',
  financing:      'financing',
  history:        'query_history',
  usage:          'query_history',   // LLM Metrics pulls from same data source
  searchinsights: 'search_insights',
  useranalytics:  'user_analytics',
  activitylog:    'activity_log',
  debug:          'search_debug',
};

function getPlan() {
  return JSON.parse(sessionStorage.getItem('admin_plan') || 'null');
}

function canAccessPage(page) {
  const user = getUser();
  if (!user) return false;

  // Plan feature gate — applies to ALL roles including superadmin
  const plan = getPlan();
  if (plan && plan.features) {
    const featureKey = PLAN_FEATURE_MAP[page];
    if (featureKey && !plan.features[featureKey]) return false;
  }

  // superadmin and admin have full access
  if (user.role === 'superadmin' || user.role === 'admin') return true;
  const allowed = ROLE_PAGES[user.role];
  return allowed ? allowed.includes(page) : false;
}

function getRoleLabel(role) {
  const labels = { superadmin: 'Super Admin', manager: 'Manager', analyst: 'Analyst', editor: 'Editor' };
  return labels[role] || role;
}
