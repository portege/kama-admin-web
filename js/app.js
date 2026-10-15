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

// ── Boot ──────────────────────────────────────────────────────────────────────

(async function init() {
  requireAuth();

  // Show active workspace name in sidebar logo
  const ws = sessionStorage.getItem('admin_workspace');
  const workspaceLabel = document.getElementById('workspaceLabel');
  if (workspaceLabel && ws) {
    workspaceLabel.textContent = 'Workspace: ' + ws;
  }

  // Load current user info + API key from /admin/me
  try {
    const me = await adminFetch('/me');
    sessionStorage.setItem('admin_api_key', me.api_key || '');
    sessionStorage.setItem('admin_user', JSON.stringify({ id: me.id, username: me.username, role: me.role }));

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
