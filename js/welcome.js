/**
 * welcome.js — Dashboard welcome page with journey-first navigation
 */

const WELCOME_JOURNEY_DONE_PREFIX = 'welcome_journey_done_';
let _welcomeJourneyFocus = 'all';

const WELCOME_JOURNEY_STAGES = [
  {
    id: 'foundation',
    title: '1. Foundation',
    subtitle: 'Get your workspace connected and ready',
    focus: ['all', 'launch'],
    tasks: [
      { page: 'settings-credentials', icon: '🔑', title: 'Credentials', description: 'Connect API keys and service credentials', eta: '3 min' },
      { page: 'features', icon: '⚡', title: 'Features', description: 'Enable only the modules needed for this workspace', eta: '2 min' },
      { page: 'knowledge', icon: '📚', title: 'Knowledge Base', description: 'Upload and organize your core documents', eta: '5 min' },
      { page: 'pricing', icon: '💲', title: 'Pricing Database', description: 'Populate pricing records for quote-related questions', eta: '4 min' },
      { page: 'productspecs', icon: '🧩', title: 'Product Specs', description: 'Load specification datasets for technical answers', eta: '4 min' },
    ],
  },
  {
    id: 'ai-setup',
    title: '2. AI Setup',
    subtitle: 'Shape model behavior and guardrails',
    focus: ['all', 'configure'],
    tasks: [
      { page: 'settings', icon: '⚙️', title: 'AI Engine', description: 'Tune routing and model-level behavior', eta: '4 min' },
      { page: 'custom-instruction', icon: '💬', title: 'Custom Instruction', description: 'Define tone and business-specific behavior', eta: '3 min' },
      { page: 'fallback-message', icon: '🚫', title: 'Fallback Message', description: 'Set safe fallback copy when no result is found', eta: '2 min' },
      { page: 'debug', icon: '🐞', title: 'Search Troubleshooter', description: 'Validate retrieval quality and debug search', eta: '5 min' },
    ],
  },
  {
    id: 'experiences',
    title: '3. End-User Experience',
    subtitle: 'Configure interfaces your users interact with',
    focus: ['all', 'launch'],
    tasks: [
      { page: 'interactive-faq', icon: '❓', title: 'Interactive FAQ', description: 'Configure embeddable FAQ experience', eta: '3 min' },
      { page: 'summarizer', icon: '🧾', title: 'Summarizer', description: 'Set up summarizer widget behavior', eta: '3 min' },
      { page: 'chatbot', icon: '🤖', title: 'Chatbot', description: 'Configure chatbot widget and deployment settings', eta: '4 min' },
      { page: 'financing', icon: '🧮', title: 'Repayment Calculator', description: 'Prepare financing responses for payment scenarios', eta: '3 min' },
      { page: 'shipping', icon: '🚚', title: 'Shipping', description: 'Configure shipping API and delivery logic', eta: '3 min' },
    ],
  },
  {
    id: 'optimize',
    title: '4. Monitor & Improve',
    subtitle: 'Track outcomes and continuously optimize quality',
    focus: ['all', 'optimize'],
    tasks: [
      { page: 'summary', icon: '📊', title: 'Summary', description: 'Check overall workspace health and trends', eta: '2 min' },
      { page: 'usage', icon: '📈', title: 'Usage & Performance', description: 'Monitor LLM usage, latency, and performance', eta: '3 min' },
      { page: 'searchinsights', icon: '🔍', title: 'Search Insights', description: 'Analyze intents and search behavior patterns', eta: '3 min' },
      { page: 'useranalytics', icon: '👥', title: 'User Analytics', description: 'Understand user-level engagement and behavior', eta: '3 min' },
      { page: 'history', icon: '📜', title: 'Query History', description: 'Audit question-answer history by workspace handle', eta: '3 min' },
      { page: 'activitylog', icon: '📋', title: 'Activity Log', description: 'Review admin/API operations and system activity', eta: '3 min' },
      { page: 'users', icon: '👤', title: 'Users', description: 'Manage access and permissions for your admin team', eta: '2 min' },
    ],
  },
];

function isJourneyTaskDone(page) {
  return localStorage.getItem(WELCOME_JOURNEY_DONE_PREFIX + page) === '1';
}

function setJourneyTaskDone(page, done) {
  localStorage.setItem(WELCOME_JOURNEY_DONE_PREFIX + page, done ? '1' : '0');
}

function getJourneyFocusLabel(focus) {
  const labels = {
    all: 'All',
    launch: 'Launch Workspace',
    configure: 'Configure AI',
    optimize: 'Optimize Performance',
  };
  return labels[focus] || 'All';
}

function getVisibleJourneyStages() {
  return WELCOME_JOURNEY_STAGES
    .map((stage) => ({
      ...stage,
      tasks: stage.tasks.filter((task) => canAccessPage(task.page)),
    }))
    .filter((stage) => stage.tasks.length > 0)
    .filter((stage) => _welcomeJourneyFocus === 'all' || stage.focus.includes(_welcomeJourneyFocus));
}

function countJourneyProgress(stages) {
  const total = stages.reduce((sum, stage) => sum + stage.tasks.length, 0);
  const done = stages.reduce((sum, stage) => sum + stage.tasks.filter((task) => isJourneyTaskDone(task.page)).length, 0);
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;
  return { total, done, percent };
}

function createJourneyTaskCard(task) {
  const done = isJourneyTaskDone(task.page);
  return `
    <article class="welcome-task-card ${done ? 'is-done' : ''}" onclick="navigate('${task.page}')">
      <div class="welcome-task-icon">${task.icon}</div>
      <div class="welcome-task-content">
        <div class="welcome-task-topline">
          <div class="welcome-task-title">${task.title}</div>
          <span class="welcome-task-eta">${task.eta}</span>
        </div>
        <div class="welcome-task-desc">${task.description}</div>
      </div>
      <button type="button" class="welcome-task-toggle" onclick="event.stopPropagation();toggleJourneyTask('${task.page}')">
        ${done ? 'Done' : 'Mark Done'}
      </button>
    </article>
  `;
}

function createJourneyStageCard(stage) {
  const stageDone = stage.tasks.filter((task) => isJourneyTaskDone(task.page)).length;
  const stageTotal = stage.tasks.length;
  return `
    <section class="welcome-journey-stage">
      <div class="welcome-stage-head">
        <div>
          <h3 class="welcome-stage-title">${stage.title}</h3>
          <p class="welcome-stage-subtitle">${stage.subtitle}</p>
        </div>
        <div class="welcome-stage-progress">${stageDone}/${stageTotal} done</div>
      </div>
      <div class="welcome-stage-tasks">
        ${stage.tasks.map((task) => createJourneyTaskCard(task)).join('')}
      </div>
    </section>
  `;
}

function toggleJourneyTask(page) {
  if (!canAccessPage(page)) return;
  const nextDone = !isJourneyTaskDone(page);
  setJourneyTaskDone(page, nextDone);
  renderWelcome();
}

function resetJourneyProgress() {
  WELCOME_JOURNEY_STAGES.forEach((stage) => {
    stage.tasks.forEach((task) => localStorage.removeItem(WELCOME_JOURNEY_DONE_PREFIX + task.page));
  });
  renderWelcome();
}

function setWelcomeJourneyFocus(focus) {
  _welcomeJourneyFocus = focus || 'all';
  renderWelcome();
}

function continueJourney(stages) {
  const firstOpenTask = stages.flatMap((stage) => stage.tasks).find((task) => !isJourneyTaskDone(task.page));
  if (firstOpenTask) {
    navigate(firstOpenTask.page);
    return;
  }
  showToast('All visible journey steps are completed.', 'success');
}

async function renderWelcome() {
  const body = document.getElementById('pageBody');
  const user = JSON.parse(sessionStorage.getItem('admin_user') || '{}');
  const stages = getVisibleJourneyStages();
  const { total, done, percent } = countJourneyProgress(stages);
  const canSeeStats = canAccessPage('summary');

  body.innerHTML = `
    <div class="welcome-layout">
      <div class="welcome-hero">
        <div class="welcome-hero-content">
          <h1 class="welcome-hero-title">Welcome to KAMA</h1>
          <p class="welcome-hero-subtitle">Hi ${user.username || 'Admin'}, follow this journey to launch faster and improve continuously.</p>
          <div id="welcomeQuotaMeter"></div>
        </div>

        <div class="welcome-progress-panel">
          <div class="welcome-progress-header">
            <span class="welcome-progress-title">Journey Progress</span>
            <span class="welcome-progress-meta">${done}/${total} tasks</span>
          </div>
          <div class="welcome-progress-track">
            <div class="welcome-progress-fill" style="width:${percent}%;"></div>
          </div>
          <div class="welcome-progress-footer">
            <span>${percent}% complete</span>
            <div class="welcome-progress-actions">
              <button type="button" class="welcome-btn ghost" onclick="resetJourneyProgress()">Reset</button>
              <button type="button" class="welcome-btn" onclick='continueJourney(getVisibleJourneyStages())'>Continue</button>
            </div>
          </div>
        </div>
      </div>

      <div class="welcome-focus-row">
        ${['all', 'launch', 'configure', 'optimize'].map((focus) => `
          <button type="button" class="welcome-focus-chip ${_welcomeJourneyFocus === focus ? 'active' : ''}" onclick="setWelcomeJourneyFocus('${focus}')">
            ${getJourneyFocusLabel(focus)}
          </button>
        `).join('')}
      </div>

      <div class="welcome-journey-grid">
        ${stages.map((stage) => createJourneyStageCard(stage)).join('')}
      </div>

      ${canSeeStats ? `
      <section id="welcomeQuickStats" class="welcome-quick-stats">
        <div class="welcome-quick-loading">Loading quick statistics...</div>
      </section>
      ` : ''}
    </div>
  `;

  if (canSeeStats) {
    loadWelcomeStats();
  }
}

async function loadWelcomeStats() {
  const container = document.getElementById('welcomeQuickStats');
  if (!container) return;

  try {
    const data = await adminFetch('/summary');
    const plan = JSON.parse(sessionStorage.getItem('admin_plan') || 'null');

    // Render quota meter right under the greeting
    const meterEl = document.getElementById('welcomeQuotaMeter');
    if (meterEl && plan && plan.quotas && plan.quotas.max_queries_per_month > 0) {
      const used = plan.usage ? plan.usage.queries_this_month : 0;
      const max  = plan.quotas.max_queries_per_month;
      const pct  = Math.min(100, Math.round((used / max) * 100));
      const barColor = pct >= 100 ? 'var(--danger)' : pct >= 80 ? 'var(--warning)' : 'var(--success)';
      const overMsg  = pct >= 100
        ? (plan.plan_name?.toLowerCase() === 'starter'
            ? ' <span style="color:var(--danger);font-weight:600;">— Quota reached (queries blocked)</span>'
            : ' <span style="color:var(--warning);font-weight:600;">— Overages will be charged</span>')
        : '';
      meterEl.innerHTML = `
        <div style="max-width:480px;margin:14px auto 0;background:var(--card-bg);border:1px solid var(--border);
                    border-radius:10px;padding:12px 16px;box-shadow:var(--shadow);text-align:left;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:7px;">
            <span style="font-size:12px;font-weight:600;color:var(--text);">Monthly Queries${overMsg}</span>
            <span style="font-size:11px;color:var(--text-muted);">${used.toLocaleString()} / ${max.toLocaleString()} — ${plan.usage?.period || ''}</span>
          </div>
          <div style="background:var(--border);border-radius:6px;height:8px;overflow:hidden;">
            <div style="background:${barColor};height:8px;border-radius:6px;width:${pct}%;transition:width 0.5s;"></div>
          </div>
          <div style="text-align:right;font-size:10px;color:${barColor};margin-top:3px;font-weight:600;">${pct}%</div>
        </div>`;
    }

    container.innerHTML = `
      <h3 class="welcome-quick-title">Quick Statistics</h3>
      <div class="welcome-quick-grid">
        ${createStatBadge('Total Queries', formatNumber(data.queries.total))}
        ${createStatBadge('Documents', formatNumber(data.documents.total))}
        ${createStatBadge('Vector Embeddings', formatNumber(data.documents.vectors))}
        ${createStatBadge('Pricing Records', formatNumber(data.pricing.total_records))}
      </div>
    `;
  } catch (err) {
    container.innerHTML = `
      <div class="welcome-quick-loading">
        <p>Unable to load quick statistics</p>
      </div>
    `;
  }
}

function createStatBadge(label, value) {
  return `
    <div class="welcome-stat-badge">
      <div class="welcome-stat-label">${label}</div>
      <div class="welcome-stat-value">${value}</div>
    </div>
  `;
}

function formatNumber(num) {
  if (num === null || num === undefined) return '0';
  return num.toLocaleString();
}
