/**
 * summarizer-feature.js — Document Summarizer Admin Page
 *
 * Configures the Summarizer intent (enable/disable, keyword hints).
 * Summarization is triggered via /api/query or /api/chat by passing
 * a doc_id — the intent router routes the request here automatically.
 */

// ══════════════════════════════════════════════════════════════════════════════
// Main render
// ══════════════════════════════════════════════════════════════════════════════

async function renderSummarizerFeature() {
  const body = document.getElementById('pageBody');

  body.innerHTML = `
    <div style="max-width:860px;margin:0 auto;display:flex;flex-direction:column;gap:20px;">

      <!-- Header card -->
      <div class="card">
        <div class="card-header">
          <span class="card-title">Document Summarizer</span>
          <button class="btn btn-secondary btn-sm" onclick="renderSummarizerFeature()">🔄 Refresh</button>
        </div>
        <div style="padding:14px 20px;background:var(--card-bg);border-bottom:1px solid var(--border);">
          <div style="font-size:13px;color:var(--text-muted);line-height:1.6;">
            <strong style="color:var(--text);">How it works:</strong>
            When this feature is <strong>enabled</strong>, the intent router automatically detects summarization
            requests from <code>/api/chat</code> or <code>/api/query</code>. The caller must supply a
            <code>doc_id</code> — the system then loads <em>all</em> content chunks of that document
            and sends them to the AI for a comprehensive summary.
            Without a <code>doc_id</code>, the API responds with a clear error message asking for one.
          </div>
        </div>
      </div>

      <!-- Enable / Disable toggle -->
      <div class="card" id="summEnableCard">
        <div class="card-header">
          <span class="card-title">Feature Toggle</span>
        </div>
        <div class="card-body" style="display:flex;flex-direction:column;gap:14px;">
          <div id="summToggleLoading" style="font-size:13px;color:var(--text-muted);">Loading…</div>
          <div id="summToggleContent" style="display:none;">
            <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">
              <div>
                <div style="font-size:14px;font-weight:600;color:var(--text);">Enable Summarizer via Intent Router</div>
                <div style="font-size:13px;color:var(--text-muted);margin-top:4px;">
                  When enabled, queries containing summarization keywords with a <code>doc_id</code>
                  will be routed to the summarizer pipeline.
                </div>
              </div>
              <label style="display:flex;align-items:center;gap:10px;cursor:pointer;user-select:none;">
                <div style="position:relative;width:44px;height:24px;">
                  <input type="checkbox" id="summEnabledToggle" style="opacity:0;width:0;height:0;position:absolute;"
                    onchange="_summToggleEnabled(this.checked)">
                  <span id="summToggleTrack"
                    style="position:absolute;inset:0;border-radius:12px;transition:background 0.2s;cursor:pointer;background:#ccc;"
                    onclick="document.getElementById('summEnabledToggle').click()"></span>
                  <span id="summToggleThumb"
                    style="position:absolute;top:3px;left:3px;width:18px;height:18px;border-radius:50%;background:#fff;transition:transform 0.2s;pointer-events:none;"></span>
                </div>
                <span id="summEnabledLabel" style="font-size:13px;font-weight:600;color:var(--text-muted);">Disabled</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      <!-- Keyword hints card -->
      <div class="card">
        <div class="card-header">
          <span class="card-title">Intent Trigger Keywords</span>
        </div>
        <div class="card-body" style="display:flex;flex-direction:column;gap:14px;">
          <div style="font-size:13px;color:var(--text-muted);line-height:1.6;">
            Comma-separated keywords that hint to the intent router that a request is a summarization query.
            These are injected into the router's classification prompt — they <em>assist</em> the LLM
            classifier but do not replace it.
          </div>
          <div style="display:flex;flex-direction:column;gap:6px;">
            <label style="font-size:13px;font-weight:600;color:var(--text);">Summarizer Keywords</label>
            <textarea id="summKeywordsInput" rows="3"
              placeholder="e.g. summarize,ringkasan,ringkas,summarise,summary,rangkum,rangkuman"
              style="padding:9px 12px;border:1px solid var(--border);border-radius:8px;
                     background:var(--card-bg);color:var(--text);font-size:14px;resize:vertical;
                     font-family:inherit;"></textarea>
            <div style="font-size:12px;color:var(--text-muted);">Max 500 characters</div>
          </div>
          <div style="display:flex;justify-content:flex-end;gap:10px;align-items:center;">
            <span id="summKwStatus" style="font-size:13px;color:var(--text-muted);"></span>
            <button class="btn btn-primary btn-sm" onclick="_summSaveKeywords()">Save Keywords</button>
          </div>
        </div>
      </div>

      <!-- Usage card -->
      <div class="card">
        <div class="card-header">
          <span class="card-title">API Usage</span>
        </div>
        <div class="card-body" style="display:flex;flex-direction:column;gap:14px;">
          <div style="font-size:13px;color:var(--text-muted);line-height:1.6;">
            To trigger summarization, call <code>/api/chat</code> or <code>/api/query</code> with
            a summarization phrase <strong>and</strong> a <code>doc_id</code>:
          </div>
          <pre style="background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:14px;
                      font-size:13px;overflow-x:auto;color:var(--text);line-height:1.6;">{
  "query": "Summarize this document",
  "doc_id": "WNJ.V09.i2"
}</pre>
          <div style="font-size:13px;color:var(--text-muted);line-height:1.6;">
            If no <code>doc_id</code> is provided the API responds with a message asking for one —
            no summarization is attempted.
          </div>
        </div>
      </div>

    </div>
  `;

  await _summLoadSettings();
}

// ══════════════════════════════════════════════════════════════════════════════
// Load current settings
// ══════════════════════════════════════════════════════════════════════════════

async function _summLoadSettings() {
  try {
    const [llmSettings, intentRules] = await Promise.all([
      adminFetch('/settings/llm'),
      adminFetch('/settings/intent-rules'),
    ]);

    const enabled = llmSettings.summarizer_enabled !== false;
    _summApplyToggleState(enabled);

    const kwInput = document.getElementById('summKeywordsInput');
    if (kwInput) kwInput.value = intentRules.summarizer_keywords || '';

    document.getElementById('summToggleLoading').style.display = 'none';
    document.getElementById('summToggleContent').style.display = '';
  } catch (err) {
    console.error('[Summarizer] Failed to load settings:', err);
    document.getElementById('summToggleLoading').textContent = 'Failed to load settings.';
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Toggle enable/disable
// ══════════════════════════════════════════════════════════════════════════════

function _summApplyToggleState(enabled) {
  const checkbox = document.getElementById('summEnabledToggle');
  const track = document.getElementById('summToggleTrack');
  const thumb = document.getElementById('summToggleThumb');
  const label = document.getElementById('summEnabledLabel');

  if (!checkbox) return;
  checkbox.checked = enabled;
  track.style.background = enabled ? 'var(--primary)' : '#ccc';
  thumb.style.transform = enabled ? 'translateX(20px)' : 'translateX(0)';
  label.textContent = enabled ? 'Enabled' : 'Disabled';
  label.style.color = enabled ? 'var(--primary)' : 'var(--text-muted)';
}

async function _summToggleEnabled(enabled) {
  try {
    await adminFetch('/settings/llm', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ summarizer_enabled: enabled }),
    });
    _summApplyToggleState(enabled);
    _summShowToast(`Summarizer ${enabled ? 'enabled' : 'disabled'}`, 'success');
  } catch (err) {
    _summShowToast(`Failed to update: ${err.message || err}`, 'error');
    // Revert toggle
    _summApplyToggleState(!enabled);
    const checkbox = document.getElementById('summEnabledToggle');
    if (checkbox) checkbox.checked = !enabled;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Save keywords
// ══════════════════════════════════════════════════════════════════════════════

async function _summSaveKeywords() {
  const kwInput = document.getElementById('summKeywordsInput');
  const status = document.getElementById('summKwStatus');
  if (!kwInput) return;

  const keywords = kwInput.value.trim();
  if (keywords.length > 500) {
    _summShowToast('Keywords must be 500 characters or fewer', 'warning');
    return;
  }

  status.textContent = 'Saving…';
  try {
    await adminFetch('/settings/intent-rules', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ summarizer_keywords: keywords }),
    });
    status.textContent = '';
    _summShowToast('Keywords saved', 'success');
  } catch (err) {
    status.textContent = '';
    _summShowToast(`Failed to save keywords: ${err.message || err}`, 'error');
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Toast
// ══════════════════════════════════════════════════════════════════════════════

function _summShowToast(message, type = 'success') {
  if (typeof showToast === 'function') {
    showToast(message, type);
    return;
  }
  console.log(`[Summarizer] ${type}: ${message}`);
}
