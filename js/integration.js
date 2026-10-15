/**
 * integration.js — Integration pages (Interactive FAQ widget, etc.)
 */

function renderWebWidget() {
  const apiBase = getApiBase();
  const apiKey  = sessionStorage.getItem('admin_api_key') || 'YOUR_API_KEY';
  const workspace = sessionStorage.getItem('admin_workspace') || 'your-workspace';

  const snippetLink = `<link rel="preconnect" href="https://fonts.googleapis.com">`;
  const snippetConfig = `<script>
  window.KBaaSConfig = {
    apiUrl: '${apiBase}',
    apiBaseUrl: '${apiBase}',
    apiKey: '${apiKey}',
  };
<\/script>`;
  const snippetWidget = `<script src="https://static.babeh.com/frontend/js/kbaas-widget.js"><\/script>
<script>
  document.addEventListener('DOMContentLoaded', function () {
    var c = document.createElement('div');
    c.id = 'kbaas-widget';
    document.body.appendChild(c);
    KBaaSWidget.init(window.KBaaSConfig);
  });
<\/script>`;

  const fullSnippet = `${snippetLink}\n${snippetConfig}\n${snippetWidget}`;

  const body = document.getElementById('pageBody');
  body.innerHTML = `
    <div class="ifaq-layout">

      <!-- ── Left column: steps ── -->
      <div class="ifaq-left">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
          <h2 class="settings-title" style="margin-bottom:0;">Interactive FAQ</h2>
          <button class="chatbot-preview-btn" onclick="openIfaqPreviewModal()" title="Show live preview">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:5px;"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            Show Preview
          </button>
        </div>
        <p class="settings-desc" style="margin-bottom:24px;">
          Embed the <strong>Interactive FAQ Widget</strong> into any webpage so visitors can
          ask questions and get instant AI-powered answers from your workspace knowledge base.
          Copy the snippet below and paste it just before the closing
          <code>&lt;/body&gt;</code> tag of your HTML page.
        </p>

        <!-- Step 1 -->
        <div class="widget-step">
          <div class="widget-step-number">1</div>
          <div class="widget-step-body">
            <div class="widget-step-title">Copy the embed snippet</div>
            <div class="widget-step-desc">
              The snippet is pre-filled with your workspace API key and endpoint.
            </div>
            <div class="widget-code-block" style="position:relative;">
              <button class="widget-copy-btn" id="copySnippetBtn" onclick="copyWidgetSnippet()" title="Copy to clipboard">
                Copy
              </button>
              <pre id="widgetSnippet" class="widget-pre">${escapeHtml(fullSnippet)}</pre>
            </div>
          </div>
        </div>

        <!-- Step 2 -->
        <div class="widget-step">
          <div class="widget-step-number">2</div>
          <div class="widget-step-body">
            <div class="widget-step-title">Paste before <code>&lt;/body&gt;</code></div>
            <div class="widget-step-desc">
              Add the snippet to every page where you want the chat widget to appear.
            </div>
          </div>
        </div>

        <!-- Step 3 -->
        <div class="widget-step">
          <div class="widget-step-number">3</div>
          <div class="widget-step-body">
            <div class="widget-step-title">Done — the widget loads automatically</div>
            <div class="widget-step-desc">
              A floating chat button will appear in the bottom-right corner of your page.
              Visitors can click it to start querying your <strong>${escapeHtml(workspace)}</strong> workspace.
            </div>
          </div>
        </div>

        <!-- API Key callout -->
        <div class="widget-callout">
          <span class="widget-callout-icon">🔑</span>
          <div>
            <strong>API Key:</strong>
            <code id="apiKeyDisplay" style="word-break:break-all;">${escapeHtml(apiKey)}</code>
            <button class="widget-key-copy" onclick="copyApiKey()" title="Copy API key">Copy</button>
          </div>
        </div>
      </div><!-- /ifaq-left -->

    </div><!-- /ifaq-layout -->

      <style>
        /* ── Two-column layout ───────────────────────────────── */
        .ifaq-layout {
          display: flex;
          gap: 32px;
          align-items: flex-start;
        }
        .ifaq-left  { flex: 0 0 100%; min-width: 0; max-width: 680px; }
        .ifaq-right { flex: 1; min-width: 0; position: sticky; top: 16px; }

        /* ── Show Preview button ─────────────────────────────── */
        .chatbot-preview-btn {
          display: inline-flex; align-items: center; gap: 4px;
          background: var(--accent, #BB86FC); color: #fff;
          border: none; border-radius: 8px;
          padding: 7px 14px; font-size: 12px; font-weight: 600;
          cursor: pointer; transition: opacity 0.2s, transform 0.15s;
          white-space: nowrap; flex-shrink: 0;
        }
        .chatbot-preview-btn:hover { opacity: 0.88; transform: translateY(-1px); }

        /* ── Existing step styles ────────────────────────────── */
        .widget-step {
          display: flex;
          gap: 16px;
          margin-bottom: 28px;
          align-items: flex-start;
        }
        .widget-step-number {
          flex-shrink: 0;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: var(--accent, #BB86FC);
          color: #fff;
          font-weight: 700;
          font-size: 13px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-top: 2px;
        }
        .widget-step-body { flex: 1; }
        .widget-step-title {
          font-weight: 600;
          font-size: 15px;
          margin-bottom: 4px;
          color: #e0e0e0;
        }
        [data-theme="light"] .widget-step-title {
          color: #1a1a1a;
        }
        .widget-step-desc {
          font-size: 13px;
          color: var(--text-secondary, rgba(255,255,255,0.6));
          margin-bottom: 10px;
        }
        [data-theme="light"] .widget-step-desc { color: rgba(0,0,0,0.55); }
        .widget-code-block {
          background: var(--surface-2, #1e1e2e);
          border: 1px solid var(--border, rgba(255,255,255,0.08));
          border-radius: 10px;
          padding: 16px;
          overflow-x: auto;
        }
        .widget-pre {
          margin: 0;
          font-family: 'Fira Code', 'Cascadia Code', 'Courier New', monospace;
          font-size: 12px;
          line-height: 1.6;
          color: var(--text-primary, #e0e0e0);
          white-space: pre;
        }
        .widget-copy-btn {
          position: absolute;
          top: 10px;
          right: 10px;
          background: var(--accent, #BB86FC);
          color: #fff;
          border: none;
          border-radius: 6px;
          padding: 4px 12px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: opacity 0.2s;
        }
        .widget-copy-btn:hover { opacity: 0.85; }
        .widget-callout {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          background: var(--surface-2, #1e1e2e);
          border: 1px solid var(--border, rgba(255,255,255,0.08));
          border-radius: 10px;
          padding: 16px;
          margin-top: 8px;
          font-size: 13px;
          color: var(--text-secondary, rgba(255,255,255,0.6));
        }
        .widget-callout-icon { font-size: 20px; margin-top: 1px; }
        .widget-key-copy {
          margin-left: 10px;
          background: transparent;
          border: 1px solid var(--border, rgba(255,255,255,0.2));
          color: var(--accent, #BB86FC);
          border-radius: 4px;
          padding: 2px 8px;
          font-size: 11px;
          cursor: pointer;
        }
        .widget-key-copy:hover { background: rgba(187,134,252,0.1); }

        /* ── Preview panel ───────────────────────────────────── */
        .ifaq-preview-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 10px;
        }
        .ifaq-preview-label {
          font-weight: 600;
          font-size: 13px;
          color: var(--text, #e0e0e0);
        }
        .ifaq-preview-badge {
          background: rgba(187,134,252,0.18);
          color: var(--accent, #BB86FC);
          border: 1px solid rgba(187,134,252,0.3);
          border-radius: 20px;
          font-size: 10px;
          font-weight: 600;
          padding: 2px 9px;
          letter-spacing: 0.04em;
        }
        .ifaq-browser {
          border: 1px solid var(--border, rgba(255,255,255,0.1));
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 4px 24px rgba(0,0,0,0.3);
        }
        .ifaq-browser-bar {
          background: var(--surface-2, #1e1e2e);
          padding: 8px 12px;
          display: flex;
          align-items: center;
          gap: 6px;
          border-bottom: 1px solid var(--border, rgba(255,255,255,0.08));
        }
        .ifaq-browser-dot {
          width: 10px; height: 10px; border-radius: 50%; display: inline-block;
        }
        .ifaq-browser-url {
          flex: 1;
          margin-left: 8px;
          background: var(--surface, #252535);
          border-radius: 6px;
          padding: 3px 10px;
          font-size: 11px;
          color: var(--text-muted, rgba(255,255,255,0.4));
          font-family: monospace;
        }
        .ifaq-browser-body {
          /* removed — direct mount replaces this */
        }
        .ifaq-live-body {
          position: relative;
          height: 560px;
          background: #f5f5f7;
          overflow: hidden;
        }

        /* ── Preview modal (must be self-contained here) ────── */
        .chatbot-modal-overlay {
          position: fixed; inset: 0; z-index: 9999;
          background: rgba(0,0,0,0.72);
          display: flex; align-items: center; justify-content: center;
          backdrop-filter: blur(4px);
          animation: cbModalIn 0.18s ease;
        }
        @keyframes cbModalIn { from { opacity:0; } to { opacity:1; } }
        .chatbot-modal {
          background: var(--surface, #1a1a2e);
          border: 1px solid var(--border, rgba(255,255,255,0.1));
          border-radius: 16px;
          box-shadow: 0 24px 64px rgba(0,0,0,0.6);
          width: 440px; max-width: calc(100vw - 32px);
          display: flex; flex-direction: column;
          overflow: hidden;
          animation: cbModalSlide 0.2s cubic-bezier(.34,1.56,.64,1);
        }
        @keyframes cbModalSlide {
          from { transform: scale(0.92) translateY(16px); opacity:0; }
          to   { transform: scale(1) translateY(0); opacity:1; }
        }
        .ifaq-modal { width: 580px; }
        .chatbot-modal-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 14px 18px;
          border-bottom: 1px solid var(--border, rgba(255,255,255,0.08));
          font-weight: 600; font-size: 13px;
          color: var(--text, #e0e0e0);
        }
        .chatbot-modal-close {
          background: transparent; border: none; cursor: pointer;
          color: var(--text-muted, rgba(255,255,255,0.4));
          font-size: 20px; line-height: 1; padding: 0 2px;
          transition: color 0.15s;
        }
        .chatbot-modal-close:hover { color: var(--text, #e0e0e0); }
        .chatbot-modal-body {
          position: relative; height: 560px;
          background: #0f0f13; overflow: hidden;
        }
        #ifaqModalMount { position: absolute; inset: 0; }

        @media (max-width: 900px) {
          .ifaq-layout { flex-direction: column; }
          .ifaq-right { position: static; flex: none; width: 100%; max-width: 500px; }
          .ifaq-modal { width: calc(100vw - 32px); }
        }
      </style>
    </div><!-- /ifaq-layout -->
  `;

  // Store snippet for copy
  window._widgetSnippetText = fullSnippet;
  window._widgetApiKey = apiKey;
}

function openIfaqPreviewModal() {
  if (document.getElementById('ifaqModalOverlay')) return;

  const apiBase = window.location.origin;
  const apiKey  = window._widgetApiKey || '';

  const ifaqConfig = {
    apiUrl: apiBase,
    apiBaseUrl: apiBase,
    apiKey: apiKey,
    containerId: 'ifaqModalMount',
    previewMode: true,
  };

  // Build overlay dynamically (same pattern as Chatbot modal)
  const overlay = document.createElement('div');
  overlay.id = 'ifaqModalOverlay';
  overlay.className = 'chatbot-modal-overlay';
  overlay.innerHTML = `
    <div class="chatbot-modal ifaq-modal">
      <div class="chatbot-modal-header">
        <span>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:6px;"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          Live Preview &mdash; Interactive FAQ Widget
        </span>
        <button class="chatbot-modal-close" onclick="closeIfaqPreviewModal()" title="Close">&times;</button>
      </div>
      <div style="background:var(--surface-2,#1e1e2e);padding:8px 14px;display:flex;align-items:center;gap:6px;border-bottom:1px solid var(--border,rgba(255,255,255,0.08));">
        <span style="width:10px;height:10px;border-radius:50%;background:#ff5f57;display:inline-block;"></span>
        <span style="width:10px;height:10px;border-radius:50%;background:#febc2e;display:inline-block;"></span>
        <span style="width:10px;height:10px;border-radius:50%;background:#28c840;display:inline-block;"></span>
        <div style="flex:1;margin-left:8px;background:var(--surface,#252535);border-radius:6px;padding:3px 10px;font-size:11px;color:var(--text-muted,rgba(255,255,255,0.4));font-family:monospace;">yoursite.com</div>
      </div>
      <div class="chatbot-modal-body">
        <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;user-select:none;">
          <span style="font-size:72px;font-weight:800;letter-spacing:-2px;color:rgba(255,255,255,0.07);text-transform:uppercase;transform:rotate(-45deg);display:inline-block;">Dummy Page</span>
        </div>
        <div id="ifaqModalMount"></div>
      </div>
    </div>
  `;
  overlay.addEventListener('click', e => { if (e.target === overlay) closeIfaqPreviewModal(); });
  overlay._escHandler = e => { if (e.key === 'Escape') closeIfaqPreviewModal(); };
  document.addEventListener('keydown', overlay._escHandler);
  document.body.appendChild(overlay);

  const mountEl = document.getElementById('ifaqModalMount');

  function injectPreviewStyles() {
    if (!mountEl) return;
    const shadow = mountEl.shadowRoot;
    if (!shadow) return;
    const st = document.createElement('style');
    st.textContent = `
      .kbaas-widget {
        position: absolute !important;
        bottom: 16px !important;
        left: 50% !important;
        transform: translateX(-50%) !important;
        width: calc(100% - 32px) !important;
        max-width: 520px !important;
      }
      .kbaas-toast-container {
        position: absolute !important;
        top: 12px !important;
        right: 12px !important;
      }
    `;
    shadow.appendChild(st);
  }

  // Reset widget state so init() can be called again
  if (typeof KBaaSWidget !== 'undefined') {
    try { KBaaSWidget.destroy(); } catch(e) {}
  }

  function bootIfaqWidget() {
    if (typeof KBaaSWidget === 'undefined') return;
    try { KBaaSWidget.init(ifaqConfig); } catch(e) { console.error('KBaaS init error', e); }
    setTimeout(injectPreviewStyles, 300);
  }

  const widgetSrc = 'https://static.babeh.com/frontend/js/kbaas-widget.js';
  if (typeof KBaaSWidget !== 'undefined') {
    bootIfaqWidget();
  } else {
    const s = document.createElement('script');
    s.id = 'ifaqWidgetScript';
    s.src = widgetSrc;
    s.onload = bootIfaqWidget;
    s.onerror = () => console.error('KBaaS Widget: failed to load', widgetSrc);
    document.head.appendChild(s);
  }
}

function closeIfaqPreviewModal() {
  const overlay = document.getElementById('ifaqModalOverlay');
  if (!overlay) return;
  if (overlay._escHandler) document.removeEventListener('keydown', overlay._escHandler);
  overlay.remove();
  if (typeof KBaaSWidget !== 'undefined') {
    try { KBaaSWidget.destroy(); } catch(e) {}
  }
}

function copyWidgetSnippet() {
  const text = window._widgetSnippetText || '';
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.getElementById('copySnippetBtn');
    if (btn) {
      btn.textContent = 'Copied!';
      setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
    }
    showToast('Widget snippet copied to clipboard', 'success');
  }).catch(() => showToast('Failed to copy', 'error'));
}

function copyApiKey() {
  const key = window._widgetApiKey || '';
  navigator.clipboard.writeText(key).then(() => {
    showToast('API key copied to clipboard', 'success');
  }).catch(() => showToast('Failed to copy', 'error'));
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ══════════════════════════════════════════════════════════════
   Chatbot Widget page
   ══════════════════════════════════════════════════════════════ */
function renderChatbotWidget() {
  const apiBase = getApiBase();
  const apiKey  = sessionStorage.getItem('admin_api_key') || 'YOUR_API_KEY';
  const workspace = sessionStorage.getItem('admin_workspace') || 'your-workspace';

  const autoSnippet =
`<script
  src="https://www.babeh.com/js/kbaas-chatbox-widget.js"
  data-api-base-url="${apiBase}"
  data-api-key="${apiKey}">
<\/script>`;

  const manualSnippet =
`<script src="https://www.babeh.com/js/kbaas-chatbox-widget.js"><\/script>
<script>
  KBaaSChat.init({
    apiBaseUrl:  '${apiBase}',
    apiKey:      '${apiKey}',
    title:       'Tanya Kami!',
    position:    'right',       // 'right' | 'left'
    accentColor: '#7c6af7',
    suggestions: [
      'Harga produk terbaru',
      'Simulasi kredit',
      'Bandingkan model',
    ],
  });
<\/script>`;

  const body = document.getElementById('pageBody');
  body.innerHTML = `
    <div class="ifaq-layout">

      <!-- ── Left column: steps ── -->
      <div class="ifaq-left">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
          <h2 class="settings-title" style="margin-bottom:0;">Chatbot Widget</h2>
          <button class="chatbot-preview-btn" onclick="openChatbotPreviewModal()" title="Show live preview">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:5px;"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            Show Preview
          </button>
        </div>
        <p class="settings-desc" style="margin-bottom:24px;">
          Embed the <strong>Chatbot Widget</strong> into any webpage as a floating chat
          bubble. Visitors can ask questions and get streaming AI-powered answers with
          session context across follow-up questions.
          Copy one of the snippets below and paste it just before
          <code>&lt;/body&gt;</code>.
        </p>

        <!-- Step 1 — auto-init snippet -->
        <div class="widget-step">
          <div class="widget-step-number">1</div>
          <div class="widget-step-body">
            <div class="widget-step-title">Option A — 1-line auto embed</div>
            <div class="widget-step-desc">
              Drop a single <code>&lt;script&gt;</code> tag. The widget initialises automatically.
            </div>
            <div class="widget-code-block" style="position:relative;">
              <button class="widget-copy-btn" id="copyAutoBtn" onclick="copyChatbotSnippet('auto')" title="Copy">Copy</button>
              <pre id="chatbotAutoSnippet" class="widget-pre">${escapeHtml(autoSnippet)}</pre>
            </div>
          </div>
        </div>

        <!-- Step 2 — manual init snippet -->
        <div class="widget-step">
          <div class="widget-step-number">2</div>
          <div class="widget-step-body">
            <div class="widget-step-title">Option B — manual init (full config)</div>
            <div class="widget-step-desc">
              Load the script then call <code>KBaaSChat.init()</code> for full control over
              title, position, accent colour, and suggestion chips.
            </div>
            <div class="widget-code-block" style="position:relative;">
              <button class="widget-copy-btn" id="copyManualBtn" onclick="copyChatbotSnippet('manual')" title="Copy">Copy</button>
              <pre id="chatbotManualSnippet" class="widget-pre">${escapeHtml(manualSnippet)}</pre>
            </div>
          </div>
        </div>

        <!-- Step 3 -->
        <div class="widget-step">
          <div class="widget-step-number">3</div>
          <div class="widget-step-body">
            <div class="widget-step-title">Done — the chat bubble appears automatically</div>
            <div class="widget-step-desc">
              A floating chat button will appear in the bottom-right corner.
              Visitors get streaming responses, session context for follow-ups, and source citations.
            </div>
          </div>
        </div>

        <!-- API Key callout -->
        <div class="widget-callout">
          <span class="widget-callout-icon">🔑</span>
          <div>
            <strong>API Key:</strong>
            <code id="chatbotApiKeyDisplay" style="word-break:break-all;">${escapeHtml(apiKey)}</code>
            <button class="widget-key-copy" onclick="copyChatbotApiKey()" title="Copy API key">Copy</button>
          </div>
        </div>

        <!-- Features callout -->
        <div class="widget-callout" style="margin-top:12px;">
          <span class="widget-callout-icon">✦</span>
          <div style="line-height:1.9;font-size:12px;">
            Streaming SSE responses &nbsp;·&nbsp; Session context for follow-ups<br>
            Source citation chips &nbsp;·&nbsp; Dark / light theme toggle<br>
            Fully isolated Shadow DOM &nbsp;·&nbsp; Mobile responsive
          </div>
        </div>
      </div><!-- /ifaq-left -->

    </div><!-- /ifaq-layout -->

    <style>
      /* ── Two-column layout ───────────────────────────────── */
      .ifaq-layout {
        display: flex;
        gap: 32px;
        align-items: flex-start;
      }
      .ifaq-left  { flex: 0 0 100%; min-width: 0; max-width: 680px; }
      .ifaq-right { flex: 1; min-width: 0; position: sticky; top: 16px; }

      /* ── Step styles ────────────────────────────────── */
      .widget-step {
        display: flex;
        gap: 16px;
        margin-bottom: 28px;
        align-items: flex-start;
      }
      .widget-step-number {
        flex-shrink: 0;
        width: 28px; height: 28px;
        border-radius: 50%;
        background: var(--accent, #BB86FC);
        color: #fff;
        font-weight: 700; font-size: 13px;
        display: flex; align-items: center; justify-content: center;
        margin-top: 2px;
      }
      .widget-step-body { flex: 1; }
      .widget-step-title {
        font-weight: 600; font-size: 15px; margin-bottom: 4px;
        color: var(--text-primary, #e0e0e0);
      }
      [data-theme="light"] .widget-step-title { color: #1a1a1a; }
      .widget-step-desc {
        font-size: 13px;
        color: var(--text-secondary, rgba(255,255,255,0.6));
        margin-bottom: 10px;
      }
      [data-theme="light"] .widget-step-desc { color: rgba(0,0,0,0.55); }
      .widget-code-block {
        background: var(--surface-2, #1e1e2e);
        border: 1px solid var(--border, rgba(255,255,255,0.08));
        border-radius: 10px; padding: 16px; overflow-x: auto;
      }
      .widget-pre {
        margin: 0;
        font-family: 'Fira Code', 'Cascadia Code', 'Courier New', monospace;
        font-size: 12px; line-height: 1.6;
        color: var(--text-primary, #e0e0e0);
        white-space: pre;
      }
      .widget-copy-btn {
        position: absolute; top: 10px; right: 10px;
        background: var(--accent, #BB86FC); color: #fff;
        border: none; border-radius: 6px;
        padding: 4px 12px; font-size: 12px; font-weight: 600;
        cursor: pointer; transition: opacity 0.2s;
      }
      .widget-copy-btn:hover { opacity: 0.85; }
      .widget-callout {
        display: flex; align-items: flex-start; gap: 12px;
        background: var(--surface-2, #1e1e2e);
        border: 1px solid var(--border, rgba(255,255,255,0.08));
        border-radius: 10px; padding: 16px; margin-top: 8px;
        font-size: 13px; color: var(--text-secondary, rgba(255,255,255,0.6));
      }
      .widget-callout-icon { font-size: 20px; margin-top: 1px; }
      .widget-key-copy {
        margin-left: 10px; background: transparent;
        border: 1px solid var(--border, rgba(255,255,255,0.2));
        color: var(--accent, #BB86FC);
        border-radius: 4px; padding: 2px 8px; font-size: 11px; cursor: pointer;
      }
      .widget-key-copy:hover { background: rgba(187,134,252,0.1); }

      /* ── Preview panel ───────────────────────────────────── */
      .ifaq-preview-header {
        display: flex; align-items: center; justify-content: space-between;
        margin-bottom: 10px;
      }
      .ifaq-preview-label { font-weight: 600; font-size: 13px; color: var(--text, #e0e0e0); }
      .ifaq-preview-badge {
        background: rgba(187,134,252,0.18);
        color: var(--accent, #BB86FC);
        border: 1px solid rgba(187,134,252,0.3);
        border-radius: 20px; font-size: 10px; font-weight: 600;
        padding: 2px 9px; letter-spacing: 0.04em;
      }
      .ifaq-browser {
        border: 1px solid var(--border, rgba(255,255,255,0.1));
        border-radius: 12px; overflow: hidden;
        box-shadow: 0 4px 24px rgba(0,0,0,0.3);
      }
      .ifaq-browser-bar {
        background: var(--surface-2, #1e1e2e);
        padding: 8px 12px; display: flex; align-items: center; gap: 6px;
        border-bottom: 1px solid var(--border, rgba(255,255,255,0.08));
      }
      .ifaq-browser-dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
      .ifaq-browser-url {
        flex: 1; margin-left: 8px;
        background: var(--surface, #252535);
        border-radius: 6px; padding: 3px 10px;
        font-size: 11px; color: var(--text-muted, rgba(255,255,255,0.4)); font-family: monospace;
      }
      .ifaq-live-body {
        position: relative; height: 560px; overflow: hidden;
      }

      /* ── Show Preview button ─────────────────────────────── */
      .chatbot-preview-btn {
        display: inline-flex; align-items: center;
        gap: 4px;
        background: var(--accent, #BB86FC);
        color: #fff;
        border: none; border-radius: 8px;
        padding: 7px 14px; font-size: 12px; font-weight: 600;
        cursor: pointer; transition: opacity 0.2s, transform 0.15s;
        white-space: nowrap; flex-shrink: 0;
      }
      .chatbot-preview-btn:hover { opacity: 0.88; transform: translateY(-1px); }

      /* ── Preview modal ───────────────────────────────────── */
      .chatbot-modal-overlay {
        position: fixed; inset: 0; z-index: 9999;
        background: rgba(0,0,0,0.72);
        display: flex; align-items: center; justify-content: center;
        backdrop-filter: blur(4px);
        animation: cbModalIn 0.18s ease;
      }
      @keyframes cbModalIn {
        from { opacity: 0; }
        to   { opacity: 1; }
      }
      .chatbot-modal {
        background: var(--surface, #1a1a2e);
        border: 1px solid var(--border, rgba(255,255,255,0.1));
        border-radius: 16px;
        box-shadow: 0 24px 64px rgba(0,0,0,0.6);
        width: 440px; max-width: calc(100vw - 32px);
        display: flex; flex-direction: column;
        overflow: hidden;
        animation: cbModalSlide 0.2s cubic-bezier(.34,1.56,.64,1);
      }
      .ifaq-modal {
        width: 580px;
      }
      @keyframes cbModalSlide {
        from { transform: scale(0.92) translateY(16px); opacity: 0; }
        to   { transform: scale(1) translateY(0); opacity: 1; }
      }
      .chatbot-modal-header {
        display: flex; align-items: center; justify-content: space-between;
        padding: 14px 18px;
        border-bottom: 1px solid var(--border, rgba(255,255,255,0.08));
        font-weight: 600; font-size: 13px;
        color: var(--text, #e0e0e0);
      }
      .chatbot-modal-close {
        background: transparent; border: none; cursor: pointer;
        color: var(--text-muted, rgba(255,255,255,0.4));
        font-size: 20px; line-height: 1; padding: 0 2px;
        transition: color 0.15s;
      }
      .chatbot-modal-close:hover { color: var(--text, #e0e0e0); }
      .chatbot-modal-body {
        position: relative;
        height: 560px;
        background: #0f0f13;
        overflow: hidden;
      }
      #chatbotModalMount { position: absolute; inset: 0; }
      #chatbotModalMount #kbaas-chat-host { position: absolute !important; inset: 0 !important; }
      #ifaqModalMount { position: absolute; inset: 0; }

      @media (max-width: 900px) {
        .ifaq-layout { flex-direction: column; }
        .ifaq-right { position: static; flex: none; width: 100%; max-width: 500px; }
      }
    </style>
  `;

  window._chatbotAutoSnippet   = autoSnippet;
  window._chatbotManualSnippet = manualSnippet;
  window._chatbotApiKey        = apiKey;
}

/* ══════════════════════════════════════════════════════════════
   Summarizer page (doc_id-aware widget)
   ══════════════════════════════════════════════════════════════ */
function renderSummarizerWidget() {
  const apiBase = getApiBase();
  const apiKey = sessionStorage.getItem('admin_api_key') || 'YOUR_API_KEY';

  const singleDocSnippet = `<script>
  // Read doc_id from the page URL — last path segment, max 24 chars
  const kbDocId = window.location.pathname.split('/').filter(Boolean).pop();
<\/script>
<script src="https://static.babeh.com/frontend/js/kbaas-widget-docid.js"><\/script>
<script>
  KBaaSWidgetDocId.init({
    apiUrl: '${apiBase}/api',
    apiBaseUrl: '${apiBase}',
    apiKey: '${apiKey}',
    containerId: 'kbaas-widget',
    docId: kbDocId,
    defaultQuery: 'Summarize this document',
  });
<\/script>`;

  const multipleDocSnippet = `<script>
  // Filter search to selected KB documents only
  const kbDocIds = ['WNJ.V09.i2', 'WNJ.V10.i1'];
<\/script>
<script src="https://static.babeh.com/frontend/js/kbaas-widget-docid.js"><\/script>
<script>
  KBaaSWidgetDocId.init({
    apiUrl: '${apiBase}/api',
    apiBaseUrl: '${apiBase}',
    apiKey: '${apiKey}',
    containerId: 'kbaas-widget',
    docIds: kbDocIds,
    defaultQuery: 'Summarize this document',
  });
<\/script>`;

  const payloadExample = `POST ${apiBase}/api/query
Content-Type: application/json
X-API-Key: ${apiKey}

{
  "query": "Summarize this document",
  "doc_id": "WNJ.V09.i2"
}`;

  window._summSingleSnippet = singleDocSnippet;
  window._summMultiSnippet = multipleDocSnippet;
  window._summPayloadSnippet = payloadExample;

  const body = document.getElementById('pageBody');
  body.innerHTML = `
    <div class="ifaq-layout">
      <div class="ifaq-left">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
          <h2 class="settings-title" style="margin-bottom:0;">Summarizer</h2>
          <button class="chatbot-preview-btn" onclick="openSummarizerPreviewModal()" title="Show live preview">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:5px;"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            Show Preview
          </button>
        </div>

        <p class="settings-desc" style="margin-bottom:24px;">
          Use <strong>kbaas-widget-docid.js</strong> to embed a chat widget that scopes queries
          to a specific KB document and triggers summarization automatically.
          Pass <code>docId</code> (single) or <code>docIds</code> (multiple) — the widget
          includes <code>doc_id</code> in every API payload. Add <code>defaultQuery</code>
          to pre-fill the input with a summarization prompt so the intent router recognises it immediately.
        </p>

        <div class="widget-step">
          <div class="widget-step-number">1</div>
          <div class="widget-step-body">
            <div class="widget-step-title">Add container to your page</div>
            <div class="widget-step-desc">Place this where the widget should mount.</div>
            <div class="widget-code-block"><pre class="widget-pre">&lt;div id="kbaas-widget"&gt;&lt;/div&gt;</pre></div>
          </div>
        </div>

        <div class="widget-step">
          <div class="widget-step-number">2</div>
          <div class="widget-step-body">
            <div class="widget-step-title">Single document — read <code>docId</code> from the URL</div>
            <div class="widget-step-desc">The doc_id is read from the last path segment and passed in every API payload. <code>defaultQuery</code> pre-fills the input so the intent router immediately recognises this as a summarizer request.</div>
            <div class="widget-code-block" style="position:relative;">
              <button class="widget-copy-btn" id="copySummSingleBtn" onclick="copySummarizerSnippet('single')" title="Copy">Copy</button>
              <pre id="summSingleSnippet" class="widget-pre">${escapeHtml(singleDocSnippet)}</pre>
            </div>
          </div>
        </div>

        <div class="widget-step">
          <div class="widget-step-number">3</div>
          <div class="widget-step-body">
            <div class="widget-step-title">Multiple documents (<code>docIds</code>)</div>
            <div class="widget-step-desc">Use this when the summary should draw from several related documents. All listed doc IDs are passed as <code>doc_ids</code> in the payload.</div>
            <div class="widget-code-block" style="position:relative;">
              <button class="widget-copy-btn" id="copySummMultiBtn" onclick="copySummarizerSnippet('multi')" title="Copy">Copy</button>
              <pre id="summMultiSnippet" class="widget-pre">${escapeHtml(multipleDocSnippet)}</pre>
            </div>
          </div>
        </div>

        <div class="widget-step">
          <div class="widget-step-number">4</div>
          <div class="widget-step-body">
            <div class="widget-step-title">Underlying API payload</div>
            <div class="widget-step-desc">The widget sends this payload format to <code>/api/query</code>.</div>
            <div class="widget-code-block" style="position:relative;">
              <button class="widget-copy-btn" id="copySummPayloadBtn" onclick="copySummarizerSnippet('payload')" title="Copy">Copy</button>
              <pre id="summPayloadSnippet" class="widget-pre">${escapeHtml(payloadExample)}</pre>
            </div>
          </div>
        </div>

        <div class="widget-callout">
          <span class="widget-callout-icon">📌</span>
          <div>
            <strong>How doc_id reaches the backend:</strong><br>
            The widget always includes <code>doc_id</code> (or <code>doc_ids</code>) in the JSON payload sent to
            <code>/api/query/stream</code>. The intent router then classifies the query — if the query contains
            a summarization phrase (e.g. "summarize", "ringkasan") it triggers the summarizer pipeline for that
            document. Without a summarizer phrase, the query runs as a filtered KB search scoped to that doc.<br><br>
            <strong>doc_id format:</strong> max 24 chars, start with letter/number, may contain
            dot (<code>.</code>), underscore (<code>_</code>), and hyphen (<code>-</code>).
          </div>
        </div>
      </div>
    </div>

    <style>
      .ifaq-layout {
        display: flex;
        gap: 32px;
        align-items: flex-start;
      }
      .ifaq-left  { flex: 0 0 100%; min-width: 0; max-width: 680px; }
      .chatbot-preview-btn {
        display: inline-flex; align-items: center; gap: 4px;
        background: var(--accent, #BB86FC); color: #fff;
        border: none; border-radius: 8px;
        padding: 7px 14px; font-size: 12px; font-weight: 600;
        cursor: pointer; transition: opacity 0.2s, transform 0.15s;
        white-space: nowrap; flex-shrink: 0;
      }
      .chatbot-preview-btn:hover { opacity: 0.88; transform: translateY(-1px); }
      .widget-step {
        display: flex; gap: 16px; margin-bottom: 28px; align-items: flex-start;
      }
      .widget-step-number {
        flex-shrink: 0; width: 28px; height: 28px; border-radius: 50%;
        background: var(--accent, #BB86FC); color: #fff;
        font-weight: 700; font-size: 13px;
        display: flex; align-items: center; justify-content: center; margin-top: 2px;
      }
      .widget-step-body { flex: 1; }
      .widget-step-title { font-weight: 600; font-size: 15px; margin-bottom: 4px; color: var(--text-primary, #e0e0e0); }
      [data-theme="light"] .widget-step-title { color: #1a1a1a; }
      .widget-step-desc { font-size: 13px; color: var(--text-secondary, rgba(255,255,255,0.6)); margin-bottom: 10px; }
      [data-theme="light"] .widget-step-desc { color: rgba(0,0,0,0.55); }
      .widget-code-block {
        background: var(--surface-2, #1e1e2e);
        border: 1px solid var(--border, rgba(255,255,255,0.08));
        border-radius: 10px; padding: 16px; overflow-x: auto;
      }
      .widget-pre {
        margin: 0;
        font-family: 'Fira Code', 'Cascadia Code', 'Courier New', monospace;
        font-size: 12px; line-height: 1.6;
        color: var(--text-primary, #e0e0e0); white-space: pre;
      }
      .widget-copy-btn {
        position: absolute; top: 10px; right: 10px;
        background: var(--accent, #BB86FC); color: #fff;
        border: none; border-radius: 6px;
        padding: 4px 12px; font-size: 12px; font-weight: 600;
        cursor: pointer; transition: opacity 0.2s;
      }
      .widget-copy-btn:hover { opacity: 0.85; }
      .widget-callout {
        display: flex; align-items: flex-start; gap: 12px;
        background: var(--surface-2, #1e1e2e);
        border: 1px solid var(--border, rgba(255,255,255,0.08));
        border-radius: 10px; padding: 16px; margin-top: 8px;
        font-size: 13px; color: var(--text-secondary, rgba(255,255,255,0.6));
      }
      .widget-callout-icon { font-size: 20px; margin-top: 1px; }
      .chatbot-modal-overlay {
        position: fixed; inset: 0; z-index: 9999;
        background: rgba(0,0,0,0.72);
        display: flex; align-items: center; justify-content: center;
        backdrop-filter: blur(4px);
        animation: cbModalIn 0.18s ease;
      }
      @keyframes cbModalIn { from { opacity:0; } to { opacity:1; } }
      .chatbot-modal {
        background: var(--surface, #1a1a2e);
        border: 1px solid var(--border, rgba(255,255,255,0.1));
        border-radius: 16px;
        box-shadow: 0 24px 64px rgba(0,0,0,0.6);
        width: 440px; max-width: calc(100vw - 32px);
        display: flex; flex-direction: column; overflow: hidden;
        animation: cbModalSlide 0.2s cubic-bezier(.34,1.56,.64,1);
      }
      .ifaq-modal { width: 580px; }
      @keyframes cbModalSlide {
        from { transform: scale(0.92) translateY(16px); opacity: 0; }
        to   { transform: scale(1) translateY(0); opacity: 1; }
      }
      .chatbot-modal-header {
        display: flex; align-items: center; justify-content: space-between;
        padding: 14px 18px;
        border-bottom: 1px solid var(--border, rgba(255,255,255,0.08));
        font-weight: 600; font-size: 13px; color: var(--text, #e0e0e0);
      }
      .chatbot-modal-close {
        background: transparent; border: none; cursor: pointer;
        color: var(--text-muted, rgba(255,255,255,0.4));
        font-size: 20px; line-height: 1; padding: 0 2px; transition: color 0.15s;
      }
      .chatbot-modal-close:hover { color: var(--text, #e0e0e0); }
      .chatbot-modal-body {
        position: relative; height: 560px; background: #0f0f13; overflow: hidden;
      }
      #summarizerModalMount { position: absolute; inset: 0; }
      @media (max-width: 900px) { .ifaq-layout { flex-direction: column; } }
    </style>
  `;
}

function copySummarizerSnippet(type) {
  let text = '';
  let btnId = '';
  if (type === 'single') {
    text = window._summSingleSnippet || '';
    btnId = 'copySummSingleBtn';
  } else if (type === 'multi') {
    text = window._summMultiSnippet || '';
    btnId = 'copySummMultiBtn';
  } else {
    text = window._summPayloadSnippet || '';
    btnId = 'copySummPayloadBtn';
  }

  navigator.clipboard.writeText(text).then(() => {
    const btn = document.getElementById(btnId);
    if (btn) {
      const original = btn.textContent;
      btn.textContent = 'Copied!';
      setTimeout(() => { btn.textContent = original; }, 1800);
    }
    showToast('Snippet copied to clipboard', 'success');
  }).catch(() => showToast('Failed to copy', 'error'));
}

function openSummarizerPreviewModal() {
  if (document.getElementById('summarizerModalOverlay')) return;

  const apiBase = getApiBase();
  const apiKey  = sessionStorage.getItem('admin_api_key') || 'YOUR_API_KEY';

  const overlay = document.createElement('div');
  overlay.id = 'summarizerModalOverlay';
  overlay.className = 'chatbot-modal-overlay';
  overlay.innerHTML = `
    <div class="chatbot-modal ifaq-modal">
      <div class="chatbot-modal-header">
        <span>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:6px;"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          Live Preview &mdash; Summarizer Widget
        </span>
        <button class="chatbot-modal-close" onclick="closeSummarizerPreviewModal()" title="Close">&times;</button>
      </div>
      <div style="background:var(--surface-2,#1e1e2e);padding:8px 14px;display:flex;align-items:center;gap:6px;border-bottom:1px solid var(--border,rgba(255,255,255,0.08));">
        <span style="width:10px;height:10px;border-radius:50%;background:#ff5f57;display:inline-block;"></span>
        <span style="width:10px;height:10px;border-radius:50%;background:#febc2e;display:inline-block;"></span>
        <span style="width:10px;height:10px;border-radius:50%;background:#28c840;display:inline-block;"></span>
        <div style="flex:1;margin-left:8px;background:var(--surface,#252535);border-radius:6px;padding:3px 10px;font-size:11px;color:var(--text-muted,rgba(255,255,255,0.4));font-family:monospace;">yoursite.com</div>
      </div>
      <div class="chatbot-modal-body">
        <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;user-select:none;">
          <span style="font-size:72px;font-weight:800;letter-spacing:-2px;color:rgba(255,255,255,0.07);text-transform:uppercase;transform:rotate(-45deg);display:inline-block;">Dummy Page</span>
        </div>
        <div id="summarizerModalMount"></div>
      </div>
    </div>
  `;

  overlay.addEventListener('click', e => { if (e.target === overlay) closeSummarizerPreviewModal(); });
  overlay._escHandler = e => { if (e.key === 'Escape') closeSummarizerPreviewModal(); };
  document.addEventListener('keydown', overlay._escHandler);
  document.body.appendChild(overlay);

  const mountEl = document.getElementById('summarizerModalMount');

  function injectPreviewStyles() {
    if (!mountEl || !mountEl.shadowRoot) return;
    const st = document.createElement('style');
    st.textContent = `
      .kbaas-widget {
        position: absolute !important;
        bottom: 16px !important;
        left: 50% !important;
        transform: translateX(-50%) !important;
        width: calc(100% - 32px) !important;
        max-width: 520px !important;
      }
      .kbaas-toast-container {
        position: absolute !important;
        top: 12px !important;
        right: 12px !important;
      }
    `;
    mountEl.shadowRoot.appendChild(st);
  }

  // Destroy any existing instance so init() can be called fresh
  if (typeof KBaaSWidgetDocId !== 'undefined') {
    try { KBaaSWidgetDocId.destroy(); } catch(e) {}
  }

  function bootSummarizerWidget() {
    if (typeof KBaaSWidgetDocId === 'undefined') return;
    try {
      KBaaSWidgetDocId.init({
        apiUrl:      apiBase + '/api',
        apiBaseUrl:  apiBase,
        apiKey:      apiKey,
        containerId: 'summarizerModalMount',
        previewMode: true,
      });
    } catch(e) { console.error('KBaaSWidgetDocId init error', e); }
    setTimeout(injectPreviewStyles, 300);
  }

  const widgetSrc = 'https://static.babeh.com/frontend/js/kbaas-widget-docid.js';
  if (typeof KBaaSWidgetDocId !== 'undefined') {
    bootSummarizerWidget();
  } else {
    const s = document.createElement('script');
    s.id = 'summarizerWidgetScript';
    s.src = widgetSrc;
    s.onload  = bootSummarizerWidget;
    s.onerror = () => console.error('KBaaSWidgetDocId: failed to load', widgetSrc);
    document.head.appendChild(s);
  }
}

function closeSummarizerPreviewModal() {
  const overlay = document.getElementById('summarizerModalOverlay');
  if (!overlay) return;
  if (overlay._escHandler) document.removeEventListener('keydown', overlay._escHandler);
  overlay.remove();
  if (typeof KBaaSWidgetDocId !== 'undefined') {
    try { KBaaSWidgetDocId.destroy(); } catch(e) {}
  }
}

function copyChatbotSnippet(type) {
  const text = type === 'manual' ? (window._chatbotManualSnippet || '') : (window._chatbotAutoSnippet || '');
  const btnId = type === 'manual' ? 'copyManualBtn' : 'copyAutoBtn';
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.getElementById(btnId);
    if (btn) { btn.textContent = 'Copied!'; setTimeout(() => { btn.textContent = 'Copy'; }, 2000); }
    showToast('Snippet copied to clipboard', 'success');
  }).catch(() => showToast('Failed to copy', 'error'));
}

function copyChatbotApiKey() {
  navigator.clipboard.writeText(window._chatbotApiKey || '').then(() => {
    showToast('API key copied to clipboard', 'success');
  }).catch(() => showToast('Failed to copy', 'error'));
}

function openChatbotPreviewModal() {
  if (document.getElementById('chatbotModalOverlay')) return;

  const overlay = document.createElement('div');
  overlay.className = 'chatbot-modal-overlay';
  overlay.id = 'chatbotModalOverlay';
  overlay.innerHTML = `
    <div class="chatbot-modal">
      <div class="chatbot-modal-header">
        <span>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:6px;"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          Live Preview — Chatbot Widget
        </span>
        <button class="chatbot-modal-close" onclick="closeChatbotPreviewModal()" title="Close">✕</button>
      </div>
      <div class="chatbot-modal-body">
        <div id="chatbotModalMount"></div>
      </div>
    </div>
  `;
  // Close on backdrop click
  overlay.addEventListener('click', e => { if (e.target === overlay) closeChatbotPreviewModal(); });
  // Close on Escape
  overlay._escHandler = e => { if (e.key === 'Escape') closeChatbotPreviewModal(); };
  document.addEventListener('keydown', overlay._escHandler);
  document.body.appendChild(overlay);

  // Boot widget inside the modal mount
  const apiBase = getApiBase();
  const apiKey  = sessionStorage.getItem('admin_api_key') || 'YOUR_API_KEY';

  function bootModal() {
    if (typeof KBaaSChat === 'undefined') return;
    KBaaSChat.init({
      apiBaseUrl:  apiBase,
      apiKey:      apiKey,
      title:       'Tanya Kami!',
      suggestions: ['Harga produk terbaru', 'Simulasi kredit', 'Bandingkan model', 'Halo!'],
      _mountTarget: '#chatbotModalMount',
    });
  }

  if (typeof KBaaSChat !== 'undefined') {
    bootModal();
  } else {
    const s = document.createElement('script');
    s.id  = 'chatbotWidgetScript';
    s.src = 'https://static.babeh.com/frontend/js/kbaas-chatbox-widget.js';
    s.onload  = bootModal;
    s.onerror = () => console.error('KBaaS Chatbot Widget: failed to load', s.src);
    document.head.appendChild(s);
  }
}

function closeChatbotPreviewModal() {
  const overlay = document.getElementById('chatbotModalOverlay');
  if (!overlay) return;
  // Destroy widget instance so it can be re-inited next time
  if (typeof KBaaSChat !== 'undefined') {
    try { KBaaSChat.destroy(); } catch(e) {}
  }
  document.removeEventListener('keydown', overlay._escHandler);
  overlay.remove();
}

