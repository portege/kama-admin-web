/**
 * app.js — Bootstrap, routing, navigation
 */

// ── Dark mode ─────────────────────────────────────────────────────────────────

function initDarkMode() {
  const saved = localStorage.getItem('admin_dark_mode');
  // Light-first: only apply dark if explicitly saved as 'true'
  const isDark = saved === 'true';
  _applyDarkMode(isDark, false); // silent — no toast
}

function _applyDarkMode(dark, animate = true) {
  if (dark) {
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.setAttribute('data-theme', 'light');
  }
  const btn = document.getElementById('darkModeToggle');
  if (btn) btn.textContent = dark ? '☀️' : '🌙';
  localStorage.setItem('admin_dark_mode', String(dark));
}

function toggleDarkMode() {
  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  _applyDarkMode(isLight);
}

// Apply immediately on script load (before DOMContentLoaded) to avoid flash
initDarkMode();

// ── Sidebar collapse ───────────────────────────────────────────────────────────────

function initSidebar() {
  const collapsed = localStorage.getItem('admin_sidebar_collapsed') === 'true';
  if (collapsed) document.body.classList.add('sidebar-collapsed');
  _updateToggleIcon();
}

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const isMobile = window.innerWidth <= 768;
  
  if (isMobile) {
    // On mobile: toggle the 'open' class on sidebar
    sidebar.classList.toggle('open');
  } else {
    // On desktop: toggle collapsed state
    const isCollapsed = document.body.classList.toggle('sidebar-collapsed');
    localStorage.setItem('admin_sidebar_collapsed', String(isCollapsed));
  }
  
  _updateToggleIcon();
}

function _updateToggleIcon() {
  const btn = document.getElementById('sidebarToggle');
  if (!btn) return;
  const isMobile = window.innerWidth <= 768;
  
  if (isMobile) {
    // Mobile: always show menu icon
    btn.textContent = '☰';
    btn.title = 'Toggle menu';
  } else {
    // Desktop: show collapse/expand icon
    btn.textContent = document.body.classList.contains('sidebar-collapsed') ? '→' : '☰';
    btn.title = document.body.classList.contains('sidebar-collapsed') ? 'Expand sidebar' : 'Collapse sidebar';
  }
}

// Apply immediately on script load
initSidebar();

// ── Mobile sidebar handlers ────────────────────────────────────────────────────

// Close sidebar on mobile when clicking outside
document.addEventListener('click', (e) => {
  const sidebar = document.getElementById('sidebar');
  const toggleBtn = document.getElementById('sidebarToggle');
  const isMobile = window.innerWidth <= 768;
  
  if (isMobile && sidebar && sidebar.classList.contains('open')) {
    // Check if click is outside sidebar and not on toggle button
    if (!sidebar.contains(e.target) && e.target !== toggleBtn) {
      sidebar.classList.remove('open');
    }
  }
});

// Close sidebar on mobile when navigation item is clicked
function closeMobileSidebar() {
  const sidebar = document.getElementById('sidebar');
  const isMobile = window.innerWidth <= 768;
  
  if (isMobile && sidebar && sidebar.classList.contains('open')) {
    sidebar.classList.remove('open');
  }
}

const PAGE_TITLES = {
  welcome:   'Welcome',
  knowledge: 'Knowledge Base',
  pricing:   'Pricing Database',
  productspecs:  'Product Specs',
  financing: 'Repayment Calculator',
  shipping:  'Shipping',
  customapi: 'Custom API Intents',
  features:  'Features',
  summary:   'Summary',
  usage:     'Usage & Performance',
  searchinsights: 'Search Insights',
  useranalytics: 'User Analytics',
  history:   'Query History',
  users:     'Users',
  settings:  'AI Engine',
  'settings-credentials': 'Credentials',
  'custom-instruction': 'Custom Instruction',
  debug:     'Search Troubleshooter',
  activitylog: 'Activity Log',
  'interactive-faq': 'Interactive FAQ',
  summarizer: 'Summarizer',
  'summarizer-feature': 'Document Summarizer',
};

const PAGE_RENDERERS = {
  welcome:   renderWelcome,
  knowledge: renderKnowledge,
  pricing:   renderPricing,
  productspecs:  renderProductSpecs,
  financing: loadFinancingSection,
  shipping:  loadShippingSection,
  customapi: renderCustomAPI,
  features:  renderFeatures,
  summary:   renderSummary,
  usage:     renderUsage,
  searchinsights: renderSearchInsights,
  useranalytics: renderUserAnalytics,
  history:   renderHistory,
  users:     renderUsers,
  settings:  renderSettings,
  'settings-credentials': renderSettingsCredentials,
  'custom-instruction': renderCustomInstructions,
  'fallback-message': renderFallbackMessage,
  debug:     renderDebug,
  activitylog: renderActivityLog,
  'interactive-faq': renderWebWidget,
  summarizer: renderSummarizerWidget,
  'summarizer-feature': renderSummarizerFeature,
  'chatbot': renderChatbotWidget,
};

let _currentPage = null;
let _tracePanelOpen = false;

function _parseServerTiming(raw) {
  const value = String(raw || '').trim();
  if (!value) return [];
  return value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((segment) => {
      const [namePart, ...attrs] = segment.split(';').map((x) => x.trim());
      let dur = null;
      attrs.forEach((attr) => {
        const [k, v] = attr.split('=');
        if (k === 'dur') dur = Number(v);
      });
      return { name: namePart || 'unknown', dur };
    });
}

function _escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function _formatTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString();
}

function _renderTraceSegments(raw) {
  const segments = _parseServerTiming(raw);
  if (!segments.length) return '<span class="trace-cell-muted">—</span>';
  return segments.map((s) => {
    const duration = Number.isFinite(s.dur) ? `${s.dur.toFixed(2)}ms` : 'n/a';
    return `<span class="trace-segment">${_escapeHtml(s.name)}: ${_escapeHtml(duration)}</span>`;
  }).join('');
}

function _toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function _segmentColor(index) {
  const palette = [
    'rgba(3,218,198,0.95)',
    'rgba(187,134,252,0.95)',
    'rgba(245,158,11,0.95)',
    'rgba(56,189,248,0.95)',
    'rgba(239,68,68,0.95)',
    'rgba(132,204,22,0.95)',
  ];
  return palette[index % palette.length];
}

function _renderTraceGraph(list) {
  const graph = document.getElementById('traceTimelineGraph');
  const scale = document.getElementById('traceGraphScale');
  if (!graph || !scale) return;

  if (!list.length) {
    graph.innerHTML = '<div class="trace-graph-empty">No timing events yet. Trigger some API calls.</div>';
    scale.textContent = 'Scale: —';
    return;
  }

  const withDurations = list.map((item) => {
    const totalMs = _toNumber(item.totalMs);
    const processMs = _toNumber(item.processTimeMs);
    return {
      ...item,
      durationMs: totalMs ?? processMs ?? 0,
      segments: _parseServerTiming(item.serverTiming).filter((s) => Number.isFinite(s.dur) && s.dur > 0),
    };
  });

  const maxMs = Math.max(1, ...withDurations.map((item) => item.durationMs));
  scale.textContent = `Scale: max ${maxMs.toFixed(2)}ms`;

  graph.innerHTML = withDurations.map((item) => {
    const width = Math.max(2, (item.durationMs / maxMs) * 100);
    const label = item.path || item.workspace || 'unknown path';
    const meta = `${_formatTime(item.at)} • ${item.kind || 'unknown'} • ${item.durationMs.toFixed(2)}ms`;

    let barInner = '';
    if (item.segments.length) {
      barInner = item.segments.map((segment, index) => {
        const segWidth = Math.max(1, (segment.dur / item.durationMs) * 100);
        return `<span class="trace-graph-segment" title="${_escapeHtml(segment.name)}: ${segment.dur.toFixed(2)}ms" style="width:${segWidth.toFixed(2)}%;background:${_segmentColor(index)};"></span>`;
      }).join('');
    }

    return `
      <div class="trace-graph-row">
        <div class="trace-graph-label">
          <div class="trace-graph-title" title="${_escapeHtml(label)}">${_escapeHtml(label)}</div>
          <div class="trace-graph-meta">${_escapeHtml(meta)}</div>
        </div>
        <div class="trace-graph-track" title="${_escapeHtml(meta)}">
          <div class="trace-graph-bar" style="width:${width.toFixed(2)}%">
            ${barInner}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function renderTracingTimeline() {
  const body = document.getElementById('traceTimelineBody');
  const listChrono = Array.isArray(window.__kamaTimings) ? window.__kamaTimings.slice() : [];
  _renderTraceGraph(listChrono);
  if (!body) return;
  const list = listChrono.slice().reverse();
  if (!list.length) {
    body.innerHTML = '<tr><td colspan="7" class="trace-cell-muted">No timing events yet. Trigger some API calls.</td></tr>';
    return;
  }

  body.innerHTML = list.map((item) => {
    return `
      <tr>
        <td>${_escapeHtml(_formatTime(item.at))}</td>
        <td>${_escapeHtml(item.kind || 'unknown')}</td>
        <td>${_escapeHtml(item.path || item.workspace || '—')}</td>
        <td>${_escapeHtml(item.status ?? '—')}</td>
        <td>${_escapeHtml(item.totalMs ?? '—')}</td>
        <td>${_escapeHtml(item.processTimeMs || '—')}</td>
        <td>${_renderTraceSegments(item.serverTiming)}</td>
      </tr>
    `;
  }).join('');
}

function toggleTracingTimeline() {
  const panel = document.getElementById('tracePanel');
  const btn = document.getElementById('traceTimelineToggle');
  if (!panel || !btn) return;

  _tracePanelOpen = !_tracePanelOpen;
  panel.classList.toggle('hidden', !_tracePanelOpen);
  panel.setAttribute('aria-hidden', _tracePanelOpen ? 'false' : 'true');
  btn.classList.toggle('active', _tracePanelOpen);

  if (_tracePanelOpen) {
    renderTracingTimeline();
  }
}

function clearTracingTimeline() {
  window.__kamaTimings = [];
  window.__kamaLastTiming = null;
  renderTracingTimeline();
  showToast('Tracing timeline cleared.', 'info');
}

async function copyTracingTimeline() {
  const payload = JSON.stringify(window.__kamaTimings || [], null, 2);
  try {
    await navigator.clipboard.writeText(payload);
    showToast('Tracing timeline copied.', 'success');
  } catch (_) {
    showToast('Failed to copy timeline.', 'error');
  }
}

window.toggleTracingTimeline = toggleTracingTimeline;
window.clearTracingTimeline = clearTracingTimeline;
window.copyTracingTimeline = copyTracingTimeline;

window.refreshTracingTimeline = function refreshTracingTimeline() {
  if (_tracePanelOpen) {
    renderTracingTimeline();
  }
};

// ── Boot ──────────────────────────────────────────────────────────────────────

(async function init() {
  const started = performance.now();
  requireAuth();

  // Show active workspace name in sidebar logo, plus workspace_id when available
  const ws = sessionStorage.getItem('admin_workspace');
  const workspaceId = sessionStorage.getItem('admin_workspace_id');
  const workspaceLabel = document.getElementById('workspaceLabel');
  if (workspaceLabel) {
    const labelParts = [];
    if (ws) labelParts.push('Workspace: ' + ws);
    if (workspaceId) labelParts.push('ID: ' + workspaceId);
    if (labelParts.length > 0) {
      workspaceLabel.textContent = labelParts.join(' • ');
    }
  }

  // Load current user info + API key from /admin/me
  try {
    const me = await adminFetch('/me');
    const resolvedWorkspaceId = me.workspace_id || getTokenTenantId() || sessionStorage.getItem('admin_workspace_id') || '';
    if (resolvedWorkspaceId) {
      sessionStorage.setItem('admin_workspace_id', resolvedWorkspaceId);
    }
    sessionStorage.setItem('admin_api_key', me.api_key || '');
    sessionStorage.setItem('admin_user', JSON.stringify({ id: me.id, username: me.username, role: me.role }));

    if (workspaceLabel) {
      const labelParts = [];
      if (ws) labelParts.push('Workspace: ' + ws);
      if (resolvedWorkspaceId) labelParts.push('ID: ' + resolvedWorkspaceId);
      if (labelParts.length > 0) {
        workspaceLabel.textContent = labelParts.join(' • ');
      }
    }

    // Sidebar user info
    document.getElementById('sidebarUsername').textContent = me.username;
    document.getElementById('sidebarRole').textContent = getRoleLabel(me.role);
    document.getElementById('avatarInitial').textContent = me.username[0].toUpperCase();

    // Default password warning
    if (me.default_password_warning) {
      document.getElementById('defaultPwdWarning').classList.remove('hidden');
    }

    // Fetch plan info and show plan badge below workspace name
    try {
      const plan = await adminFetch('/plan');
      sessionStorage.setItem('admin_plan', JSON.stringify(plan));
      const planLabel = document.getElementById('planLabel');
      if (planLabel) {
        const pname = (plan.plan_name || 'enterprise').toLowerCase();
        planLabel.textContent = plan.plan_name.charAt(0).toUpperCase() + plan.plan_name.slice(1);
        planLabel.className = `plan-badge plan-${pname}`;
        planLabel.style.display = 'inline-block';
      }
    } catch (_) { /* plan badge is non-critical */ }

    // ── Role-based sidebar visibility ──────────────────────────────────────
    document.querySelectorAll('.nav-item[data-page]').forEach(el => {
      const page = el.dataset.page;
      el.style.display = canAccessPage(page) ? '' : 'none';
    });
    // Hide section labels whose children are all hidden
    document.querySelectorAll('.nav-section-label').forEach(label => {
      let next = label.nextElementSibling;
      let anyVisible = false;
      while (next && !next.classList.contains('nav-section-label')) {
        if (next.classList.contains('nav-item') && next.style.display !== 'none') {
          anyVisible = true;
          break;
        }
        next = next.nextElementSibling;
      }
      label.style.display = anyVisible ? '' : 'none';
    });
    // Hide Users nav item for non-superadmin
    document.querySelectorAll('.nav-item[data-page="users"]').forEach(el => {
      el.style.display = me.role === 'superadmin' ? '' : 'none';
    });
  } catch (err) {
    showToast('Failed to load session: ' + err.message, 'error');
  }

  // Navigate to page from hash or default to welcome
  const page = location.hash.replace('#', '') || 'welcome';
  navigate(page);

  window.__kamaTimings = window.__kamaTimings || [];
  window.__kamaTimings.push({
    at: new Date().toISOString(),
    kind: 'dashboardBootstrap',
    totalMs: Number((performance.now() - started).toFixed(2)),
    workspace: ws || '',
  });
  window.__kamaLastTiming = window.__kamaTimings[window.__kamaTimings.length - 1];
  if (console && console.debug) {
    console.debug('[KAMA timing]', window.__kamaLastTiming);
  }
})();

// ── Navigation ────────────────────────────────────────────────────────────────

function navigate(page) {
  // Close mobile sidebar when navigating
  closeMobileSidebar();
  
  // Role-based access guard
  if (!canAccessPage(page)) {
    page = 'welcome';
  }

  // Look up renderer: check PAGE_RENDERERS first, then fall back to global
  // renderXxx function (handles browsers that cached an older app.js).
  const globalName = 'render' + page[0].toUpperCase() + page.slice(1);
  const renderer = PAGE_RENDERERS[page] ||
    (typeof window[globalName] === 'function' ? window[globalName] : null);

  if (!renderer) {
    page = 'welcome';
  }

  _currentPage = page;

  // Update hash
  location.hash = page;

  // Update nav active state
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.page === page);
  });

  // Show/hide topbar based on page
  const topbar = document.getElementById('topbar');
  const topbarTitle = document.getElementById('topbarTitle');

  if (page === 'welcome') {
    topbar.style.display = 'none';
  } else {
    topbar.style.display = 'flex';
    topbarTitle.textContent = PAGE_TITLES[page] || page;
  }

  // Routing badge in topbar for data-source pages
  const ROUTING_BADGE_PAGES = {
    pricing:      { key: 'pricing_enabled',   label: 'Pricing DB' },
    productspecs: { key: 'specs_enabled',     label: 'Specs DB' },
    financing:    { key: 'financing_enabled', label: 'Financing DB' },
    shipping:     { key: 'shipping_enabled',  label: 'Shipping API' },
  };
  let existingBadge = document.getElementById('topbarRoutingBadge');
  if (existingBadge) existingBadge.remove();
  if (ROUTING_BADGE_PAGES[page]) {
    const { key, label } = ROUTING_BADGE_PAGES[page];
    const badge = document.createElement('span');
    badge.id = 'topbarRoutingBadge';
    badge.style.cssText = 'margin-left:10px;cursor:pointer;';
    badge.title = 'Click to toggle routing';
    topbarTitle.parentElement.appendChild(badge);
    adminFetch('/settings/llm').then(data => {
      const on = data[key] !== false;
      badge.innerHTML = on
        ? `<span style="display:inline-flex;align-items:center;gap:5px;background:#dcfce7;color:#15803d;font-weight:700;font-size:11px;padding:3px 10px;border-radius:20px;border:1px solid #86efac;">&#x2705; ${label}: ON</span>`
        : `<span style="display:inline-flex;align-items:center;gap:5px;background:#fee2e2;color:#dc2626;font-weight:700;font-size:11px;padding:3px 10px;border-radius:20px;border:1px solid #fca5a5;">&#x26D4; ${label}: OFF</span>`;
      badge.onclick = () => {
        const payload = {}; payload[key] = !on;
        adminFetch('/settings/llm', { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) })
          .then(() => { navigate(page); })
          .catch(e => alert('Failed to update: ' + e.message));
      };
    }).catch(() => {});
  }

  // Render page
  const fn = renderer || PAGE_RENDERERS['welcome'];
  fn();
}

// Handle browser back/forward
window.addEventListener('hashchange', () => {
  const page = location.hash.replace('#', '');
  if (page && page !== _currentPage) navigate(page);
});
