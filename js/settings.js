/**
 * settings.js — LLM Model Settings
 */

async function renderSettingsCredentials() {
  const body = document.getElementById('pageBody');
  const user = JSON.parse(sessionStorage.getItem('admin_user') || '{}');

  // Fetch latest user data to get updated_at
  let lastUpdated = null;
  try {
    const userData = await adminFetch(`/users/${user.id}`);
    if (userData && userData.updated_at) {
      lastUpdated = new Date(userData.updated_at + 'Z');
    }
  } catch (_) {}

  const lastUpdatedHtml = lastUpdated
    ? `<p data-role="pw-last-updated" style="font-size:12px;color:var(--text-muted);margin-top:4px;">Last changed: ${lastUpdated.toLocaleString()}</p>`
    : '';

  body.innerHTML = `
    <div style="max-width:800px;margin:0 auto;">
      <div class="card">
        <div class="card-header"><span class="card-title">Change My Password</span></div>
        <div class="card-body" style="max-width:400px;">
          ${lastUpdatedHtml}
          <div class="form-group" style="margin-top:${lastUpdated ? '12px' : '0'}">
            <label class="form-label">New Password</label>
            <input class="form-control" type="password" id="settingsNewPw" placeholder="Min 8 chars, letters, numbers & symbol"
              oninput="validatePasswordFields()" />
            <div id="pwStrengthHint" style="font-size:11.5px;margin-top:4px;"></div>
          </div>
          <div class="form-group">
            <label class="form-label">Confirm Password</label>
            <input class="form-control" type="password" id="settingsConfirmPw" placeholder="Re-enter new password"
              oninput="validatePasswordFields()" />
            <div id="pwMatchHint" style="font-size:11.5px;margin-top:4px;"></div>
          </div>
          <button class="btn btn-primary" id="settingsPwBtn" onclick="changeMyPasswordFromSettings()" disabled>Update Password</button>
        </div>
      </div>
    </div>
  `;
}

async function renderSettings() {
  const body = document.getElementById('pageBody');
  const _settingsUser = JSON.parse(sessionStorage.getItem('admin_user') || '{}');
  const _canEditSystemSettings = ['superadmin', 'manager', 'analyst'].includes(_settingsUser.role);
  body.innerHTML = `
    <div style="max-width:800px;margin:0 auto;">
      ${_canEditSystemSettings ? `<div class="card">`  : '<!-- LLM settings hidden for this role --><div style="display:none">'}
        <div class="card-header">
          <span class="card-title">LLM Model Configuration</span>
          <small style="color:var(--text-muted);font-weight:400;">Configure which AI model to use for query responses</small>
        </div>
        <div class="card-body">
          <div style="border-bottom:1px solid var(--border);margin:-20px -20px 20px -20px;padding:0 20px;">
            <div style="display:flex;gap:0;">
              <button class="settings-tab-btn active" data-tab="model" onclick="switchSettingsTab('model')" style="padding:12px 20px;border:none;background:transparent;cursor:pointer;font-weight:600;font-size:14px;color:var(--text);border-bottom:2px solid var(--text);transition:all 0.2s;">Model</button>
              <span style="color:var(--border);padding:12px 0;font-size:14px;">|</span>
              <button class="settings-tab-btn" data-tab="retrieval" onclick="switchSettingsTab('retrieval')" style="padding:12px 20px;border:none;background:transparent;cursor:pointer;font-weight:500;font-size:14px;color:var(--text-muted);border-bottom:2px solid transparent;transition:all 0.2s;">Retrieval</button>
              <span style="color:var(--border);padding:12px 0;font-size:14px;">|</span>
              <button class="settings-tab-btn" data-tab="chunking" onclick="switchSettingsTab('chunking')" style="padding:12px 20px;border:none;background:transparent;cursor:pointer;font-weight:500;font-size:14px;color:var(--text-muted);border-bottom:2px solid transparent;transition:all 0.2s;">Chunking</button>
              <span style="color:var(--border);padding:12px 0;font-size:14px;">|</span>
              <button class="settings-tab-btn" data-tab="response" onclick="switchSettingsTab('response')" style="padding:12px 20px;border:none;background:transparent;cursor:pointer;font-weight:500;font-size:14px;color:var(--text-muted);border-bottom:2px solid transparent;transition:all 0.2s;">Response</button>
            </div>
          </div>

          <div id="settingsTab-model" class="settings-tab-panel">
            <div class="form-group">
            <label class="form-label">Answer Generator Model</label>
            <select class="form-control" id="llmModel" style="max-width:500px;">
              <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
              <option value="gemini-2.5-flash-lite">Gemini 2.5 Flash Lite</option>
              <option value="bedrock">Bedrock — use profile below</option>
            </select>
            <small class="form-help">Select model engine for query responses</small>
          </div>

          <div class="form-group" id="geminiModelGroup" style="display:none;">
            <label class="form-label">Gemini Model</label>
            <select class="form-control" id="geminiModel" style="max-width:400px;">
              <option value="gemini-2.5-flash">gemini-2.5-flash — full power, best quality</option>
              <option value="gemini-2.5-flash-lite">gemini-2.5-flash-lite — faster &amp; lighter (~30% lower latency)</option>
            </select>
            <small class="form-help">Choose the Gemini model variant. <strong>flash-lite</strong> is recommended for low-latency deployments.</small>
          </div>

          <div class="form-group" id="bedrockProfileGroup" style="display:none;">
            <label class="form-label">AWS Bedrock — Answer Model</label>
            <select class="form-control" id="bedrockProfileSelect" style="max-width:500px;" onchange="onBedrockProfileSelectChange()">
              <option value="us.anthropic.claude-sonnet-4-6">Claude Sonnet 4.6 — us.anthropic.claude-sonnet-4-6 ⭐ New</option>
              <option value="us.anthropic.claude-3-5-sonnet-20241022-v2:0">Claude 3.5 Sonnet v2 — us.anthropic.claude-3-5-sonnet-20241022-v2:0</option>
              <option value="us.anthropic.claude-3-haiku-20240307-v1:0">Claude 3 Haiku — us.anthropic.claude-3-haiku-20240307-v1:0</option>
              <option value="us.amazon.nova-pro-v1:0">Amazon Nova Pro — us.amazon.nova-pro-v1:0</option>
              <option value="us.amazon.nova-lite-v1:0">Amazon Nova Lite — us.amazon.nova-lite-v1:0</option>
              <option value="us.amazon.nova-micro-v1:0">Amazon Nova Micro — us.amazon.nova-micro-v1:0</option>
              <option value="custom">Custom profile...</option>
            </select>
            <input type="text" class="form-control" id="bedrockProfileCustom"
                   placeholder="e.g. us.anthropic.claude-3-5-sonnet-20241022-v2:0"
                   style="max-width:500px;margin-top:6px;display:none;" />
            <small class="form-help">AWS Bedrock inference profile used for answering user queries</small>
          </div>

          <div class="form-group" id="reformatProfileGroup" style="display:none;">
            <label class="form-label">AWS Bedrock — Reformat / Improve Model</label>
            <select class="form-control" id="reformatProfileSelect" style="max-width:500px;" onchange="onReformatProfileSelectChange()">
              <option value="same">Same as Answer Model</option>
              <option value="us.anthropic.claude-sonnet-4-6">Claude Sonnet 4.6 — us.anthropic.claude-sonnet-4-6 ⭐ New</option>
              <option value="us.anthropic.claude-3-5-sonnet-20241022-v2:0">Claude 3.5 Sonnet v2 — us.anthropic.claude-3-5-sonnet-20241022-v2:0</option>
              <option value="us.anthropic.claude-3-haiku-20240307-v1:0">Claude 3 Haiku — us.anthropic.claude-3-haiku-20240307-v1:0</option>
              <option value="us.amazon.nova-pro-v1:0">Amazon Nova Pro — us.amazon.nova-pro-v1:0</option>
              <option value="us.amazon.nova-lite-v1:0">Amazon Nova Lite — us.amazon.nova-lite-v1:0</option>
              <option value="custom">Custom profile...</option>
            </select>
            <input type="text" class="form-control" id="reformatProfileCustom"
                   placeholder="e.g. anthropic.claude-sonnet-4-6"
                   style="max-width:500px;margin-top:6px;display:none;" />
            <small class="form-help">Model used for KB document reformat/improve (can differ from the answer model)</small>
          </div>

            <div style="margin-bottom:16px;padding:14px;border:1px solid var(--border);border-radius:10px;background:var(--card-bg);">
              <div style="font-weight:600;margin-bottom:8px;">Model Information</div>
              <div id="modelInfo">
                <p style="color:var(--text-muted);">Select a model to see information</p>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Temperature</label>
              <div style="display:flex;align-items:center;gap:16px;">
                <input type="range" class="form-range" id="llmTemperatureSlider" 
                       min="0" max="2" step="0.1" style="flex:1;max-width:300px;" 
                       oninput="document.getElementById('llmTemperatureValue').value = this.value" />
                <input type="number" class="form-control" id="llmTemperatureValue" 
                       min="0" max="2" step="0.1" style="width:80px;" 
                       oninput="document.getElementById('llmTemperatureSlider').value = this.value" />
              </div>
              <small class="form-help">Controls creativity (0 = focused and deterministic, 2 = creative and varied)</small>
            </div>
          </div>

          <div id="settingsTab-retrieval" class="settings-tab-panel" style="display:none;">
            <div class="form-group">
            <label class="form-label">Search Method</label>
            <div style="display:flex;gap:10px;flex-wrap:wrap;">
              <label style="display:flex;align-items:center;gap:8px;cursor:pointer;padding:10px 18px;
                            border:2px solid var(--border);border-radius:8px;font-weight:500;">
                <input type="radio" name="searchMethod" value="hybrid" style="accent-color:#6d28d9;" />
                <span>⚡ Hybrid</span>
              </label>
              <label style="display:flex;align-items:center;gap:8px;cursor:pointer;padding:10px 18px;
                            border:2px solid var(--border);border-radius:8px;font-weight:500;">
                <input type="radio" name="searchMethod" value="vector" style="accent-color:#1d4ed8;" />
                <span>🔵 Vector</span>
              </label>
              <label style="display:flex;align-items:center;gap:8px;cursor:pointer;padding:10px 18px;
                            border:2px solid var(--border);border-radius:8px;font-weight:500;">
                <input type="radio" name="searchMethod" value="bm25" style="accent-color:#15803d;" />
                <span>🟢 BM25</span>
              </label>
            </div>
            <small class="form-help">
              <strong>Hybrid</strong> — combines vector similarity + full-text scoring (recommended).<br>
              <strong>Vector</strong> — semantic/embedding search only (best for conceptual queries).<br>
              <strong>BM25</strong> — BM25 full-text keyword search only (best for exact terms).
            </small>
          </div>

          <div class="form-group">
            <label class="form-label">Relevance Threshold</label>
            <div style="display:flex;align-items:center;gap:16px;">
              <input type="range" class="form-range" id="relevanceThresholdSlider" 
                     min="0" max="1" step="0.05" style="flex:1;max-width:300px;" 
                     oninput="document.getElementById('relevanceThresholdValue').value = this.value" />
              <input type="number" class="form-control" id="relevanceThresholdValue" 
                     min="0" max="1" step="0.05" style="width:80px;" 
                     oninput="document.getElementById('relevanceThresholdSlider').value = this.value" />
            </div>
            <small class="form-help">Minimum similarity score (0-1) for search results to be sent to LLM. Lower = more results, higher = more precise.</small>
          </div>
          
          <div class="form-group">
            <label class="form-label">Top K Results</label>
            <div style="display:flex;align-items:center;gap:16px;">
              <input type="range" class="form-range" id="topKSlider" 
                     min="1" max="50" step="1" style="flex:1;max-width:300px;" 
                     oninput="document.getElementById('topKValue').value = this.value" />
              <input type="number" class="form-control" id="topKValue" 
                     min="1" max="50" step="1" style="width:80px;" 
                     oninput="document.getElementById('topKSlider').value = this.value" />
            </div>
            <small class="form-help">Number of search results retrieved per query (1-50). Higher = more context for LLM, but slower responses.</small>
          </div>

          <div class="form-group">
            <label class="form-label">Max Query Length (characters)</label>
            <div style="display:flex;align-items:center;gap:16px;">
              <input type="range" class="form-range" id="maxQueryLengthSlider"
                     min="10" max="200" step="10" style="flex:1;max-width:300px;"
                     oninput="document.getElementById('maxQueryLengthValue').value = this.value" />
              <input type="number" class="form-control" id="maxQueryLengthValue"
                     min="10" max="200" step="10" style="width:90px;"
                     oninput="document.getElementById('maxQueryLengthSlider').value = this.value" />
            </div>
            <small class="form-help">Maximum number of characters allowed in a user query sent to <code>/query</code> and <code>/query/stream</code> (10–200). Default: 100.</small>
          </div>
          </div>

          <div id="settingsTab-chunking" class="settings-tab-panel" style="display:none;">
          <div style="margin-top:4px;padding-top:4px;border-top:1px solid var(--border);margin-bottom:4px;">
            <span style="font-weight:600;font-size:13px;color:var(--text);">Chunking Configuration</span>
            <span style="margin-left:8px;font-size:11px;background:#fef3c7;color:#92400e;padding:2px 8px;border-radius:8px;font-weight:600;">⚠️ Applies to new ingestions only</span>
          </div>

          <div class="form-group">
            <label class="form-label">Chunk Size</label>
            <div style="display:flex;align-items:center;gap:16px;">
              <input type="range" class="form-range" id="chunkSizeSlider"
                     min="100" max="2000" step="50" style="flex:1;max-width:300px;"
                     oninput="document.getElementById('chunkSizeValue').value = this.value" />
              <input type="number" class="form-control" id="chunkSizeValue"
                     min="100" max="2000" step="50" style="width:80px;"
                     oninput="document.getElementById('chunkSizeSlider').value = this.value" />
            </div>
            <small class="form-help">Characters per chunk (100–2000). Changing this requires re-ingesting existing documents to take effect.</small>
          </div>

          <div class="form-group">
            <label class="form-label">Chunk Overlap</label>
            <div style="display:flex;align-items:center;gap:16px;">
              <input type="range" class="form-range" id="chunkOverlapSlider"
                     min="0" max="500" step="10" style="flex:1;max-width:300px;"
                     oninput="document.getElementById('chunkOverlapValue').value = this.value" />
              <input type="number" class="form-control" id="chunkOverlapValue"
                     min="0" max="500" step="10" style="width:80px;"
                     oninput="document.getElementById('chunkOverlapSlider').value = this.value" />
            </div>
            <small class="form-help">Characters shared between adjacent chunks (0–500). Higher overlap reduces context loss at boundaries.</small>
          </div>
          </div>

          <div id="settingsTab-response" class="settings-tab-panel" style="display:none;">
          <div class="form-group">
            <label class="form-label">Max Input Tokens</label>
            <div style="display:flex;align-items:center;gap:16px;">
              <input type="range" class="form-range" id="maxInputTokensSlider"
                     min="10" max="900" step="10" style="flex:1;max-width:300px;"
                     oninput="document.getElementById('maxInputTokensValue').value = this.value" />
              <input type="number" class="form-control" id="maxInputTokensValue"
                     min="10" max="900" step="10" style="width:90px;"
                     oninput="document.getElementById('maxInputTokensSlider').value = this.value" />
            </div>
            <small class="form-help">Maximum tokens sent to the LLM as context (10–900). Prompt is truncated when exceeded (~4 chars/token). Default: 600.</small>
          </div>

          <div class="form-group">
            <label class="form-label">Max Output Tokens</label>
            <div style="display:flex;align-items:center;gap:16px;">
              <input type="range" class="form-range" id="maxOutputTokensSlider"
                     min="1" max="1200" step="10" style="flex:1;max-width:300px;"
                     oninput="document.getElementById('maxOutputTokensValue').value = this.value" />
              <input type="number" class="form-control" id="maxOutputTokensValue"
                     min="1" max="1200" step="10" style="width:90px;"
                     oninput="document.getElementById('maxOutputTokensSlider').value = this.value" />
            </div>
            <small class="form-help">Maximum tokens the LLM may generate in its response (1–1200). Default: 900.</small>
          </div>

          <div class="form-group">
            <label class="form-label">Response Mode</label>
            <div style="display:flex;gap:20px;flex-wrap:wrap;margin-top:4px;">
              <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
                <input type="checkbox" id="useLLMToggle" style="width:16px;height:16px;accent-color:#6d28d9;" />
                <span style="font-weight:500;">Use LLM to generate answers</span>
              </label>
              <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
                <input type="checkbox" id="streamingEnabledToggle" style="width:16px;height:16px;accent-color:#6d28d9;" />
                <span style="font-weight:500;">Enable streaming responses</span>
              </label>
            </div>
            <small class="form-help">
              <strong>Use LLM</strong> — generate an AI answer from retrieved chunks. Disable to return raw search results only.<br>
              <strong>Streaming</strong> — stream the LLM response word-by-word as it's generated.
            </small>
          </div>
          </div>
          
          <div style="margin-top:24px;padding-top:24px;border-top:1px solid var(--border);">
            <button class="btn btn-primary" onclick="saveLLMSettings()">
              Save Settings
            </button>
            <button class="btn btn-secondary" onclick="loadLLMSettings()" style="margin-left:8px;">
              Reset
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  if (_canEditSystemSettings) {
    await loadLLMSettings();
    updateModelInfo();
    switchSettingsTab('model');
  }
  
  // Add event listener to update info when model changes
  const modelEl = document.getElementById('llmModel');
  if (modelEl) modelEl.addEventListener('change', updateModelInfo);
}

function onBedrockProfileSelectChange() {
  const sel = document.getElementById('bedrockProfileSelect');
  const inp = document.getElementById('bedrockProfileCustom');
  if (inp) inp.style.display = sel.value === 'custom' ? '' : 'none';
}

function onReformatProfileSelectChange() {
  const sel = document.getElementById('reformatProfileSelect');
  const inp = document.getElementById('reformatProfileCustom');
  if (inp) inp.style.display = sel.value === 'custom' ? '' : 'none';
}

function switchSettingsTab(tabName) {
  document.querySelectorAll('.settings-tab-panel').forEach(panel => {
    panel.style.display = panel.id === `settingsTab-${tabName}` ? '' : 'none';
  });

  document.querySelectorAll('.settings-tab-btn').forEach(btn => {
    const active = btn.dataset.tab === tabName;
    btn.classList.toggle('active', active);
    btn.style.color = active ? 'var(--text)' : 'var(--text-muted)';
    btn.style.borderBottomColor = active ? 'var(--text)' : 'transparent';
    btn.style.fontWeight = active ? '600' : '500';
  });
}

function validatePasswordFields() {
  const newPw   = document.getElementById('settingsNewPw')?.value || '';
  const confirm = document.getElementById('settingsConfirmPw')?.value || '';
  const hintEl  = document.getElementById('pwStrengthHint');
  const matchEl = document.getElementById('pwMatchHint');
  const btn     = document.getElementById('settingsPwBtn');

  const hasLength  = newPw.length >= 8;
  const hasLetter  = /[a-zA-Z]/.test(newPw);
  const hasNumber  = /[0-9]/.test(newPw);
  const hasSymbol  = /[^a-zA-Z0-9]/.test(newPw);
  const strong     = hasLength && hasLetter && hasNumber && hasSymbol;

  if (!newPw) {
    hintEl.textContent = '';
  } else if (!hasLength) {
    hintEl.innerHTML = '<span style="color:#EF4444;">✗ At least 8 characters required</span>';
  } else if (!hasLetter || !hasNumber || !hasSymbol) {
    const missing = [];
    if (!hasLetter) missing.push('a letter');
    if (!hasNumber) missing.push('a number');
    if (!hasSymbol) missing.push('a symbol');
    hintEl.innerHTML = `<span style="color:#F59E0B;">✗ Must include ${missing.join(', ')}</span>`;
  } else {
    hintEl.innerHTML = '<span style="color:#22C55E;">✓ Password strength: good</span>';
  }

  if (!confirm) {
    matchEl.textContent = '';
  } else if (newPw !== confirm) {
    matchEl.innerHTML = '<span style="color:#EF4444;">✗ Passwords do not match</span>';
  } else {
    matchEl.innerHTML = '<span style="color:#22C55E;">✓ Passwords match</span>';
  }

  if (btn) btn.disabled = !(strong && newPw === confirm && confirm.length > 0);
}

async function changeMyPasswordFromSettings() {
  const user = JSON.parse(sessionStorage.getItem('admin_user') || '{}');
  const newPw   = document.getElementById('settingsNewPw').value;
  const confirm = document.getElementById('settingsConfirmPw').value;
  if (!newPw)                        { showToast('Enter a new password', 'warning'); return; }
  if (newPw.length < 8)             { showToast('Password must be at least 8 characters', 'warning'); return; }
  if (!/[a-zA-Z]/.test(newPw))      { showToast('Password must contain a letter', 'warning'); return; }
  if (!/[0-9]/.test(newPw))         { showToast('Password must contain a number', 'warning'); return; }
  if (!/[^a-zA-Z0-9]/.test(newPw))  { showToast('Password must contain a symbol', 'warning'); return; }
  if (newPw !== confirm)             { showToast('Passwords do not match', 'warning'); return; }
  try {
    await adminFetch(`/users/${user.id}`, {
      method: 'PUT',
      body: JSON.stringify({ password: newPw }),
    });
    document.getElementById('settingsNewPw').value = '';
    document.getElementById('settingsConfirmPw').value = '';
    validatePasswordFields();
    showToast('Password updated successfully', 'success');
    document.getElementById('defaultPwdWarning')?.classList.add('hidden');
    // Refresh last-updated timestamp
    try {
      const updated = await adminFetch(`/users/${user.id}`);
      if (updated?.updated_at) {
        const ts = new Date(updated.updated_at + 'Z');
        const el = document.querySelector('[data-role="pw-last-updated"]');
        if (el) el.textContent = `Last changed: ${ts.toLocaleString()}`;
      }
    } catch (_) {}
  } catch (err) { showToast(err.message, 'error'); }
}

async function loadLLMSettings() {
  try {
    const data = await adminFetch('/settings/llm');
    const selectedModel = data.model === 'gemini'
      ? (data.gemini_model || 'gemini-2.5-flash')
      : 'bedrock';
    document.getElementById('llmModel').value = selectedModel;

    // Bedrock answer profile
    if (data.inference_profile) {
      const presets = [
        'us.anthropic.claude-sonnet-4-6',
        'us.anthropic.claude-3-5-sonnet-20241022-v2:0',
        'us.anthropic.claude-3-haiku-20240307-v1:0',
        'us.amazon.nova-pro-v1:0',
        'us.amazon.nova-lite-v1:0',
        'us.amazon.nova-micro-v1:0',
      ];
      const bpSel = document.getElementById('bedrockProfileSelect');
      const bpInp = document.getElementById('bedrockProfileCustom');
      if (bpSel) {
        if (presets.includes(data.inference_profile)) {
          bpSel.value = data.inference_profile;
          if (bpInp) bpInp.style.display = 'none';
        } else {
          bpSel.value = 'custom';
          if (bpInp) { bpInp.value = data.inference_profile; bpInp.style.display = ''; }
        }
      }
    }

    // Reformat profile
    const reformatValue = data.reformat_inference_profile || 'same';
    const reformatPresets = [
      'same',
      'us.anthropic.claude-sonnet-4-6',
      'us.anthropic.claude-3-5-sonnet-20241022-v2:0',
      'us.anthropic.claude-3-haiku-20240307-v1:0',
      'us.amazon.nova-pro-v1:0',
      'us.amazon.nova-lite-v1:0',
    ];
    const rpSel = document.getElementById('reformatProfileSelect');
    const rpInp = document.getElementById('reformatProfileCustom');
    if (rpSel) {
      if (reformatPresets.includes(reformatValue)) {
        rpSel.value = reformatValue;
        if (rpInp) rpInp.style.display = 'none';
      } else {
        rpSel.value = 'custom';
        if (rpInp) { rpInp.value = reformatValue; rpInp.style.display = ''; }
      }
    }
    document.getElementById('llmTemperatureSlider').value = data.temperature || 0.7;
    document.getElementById('llmTemperatureValue').value = data.temperature || 0.7;
    document.getElementById('relevanceThresholdSlider').value = data.relevance_threshold || 0.35;
    document.getElementById('relevanceThresholdValue').value = data.relevance_threshold || 0.35;
    document.getElementById('topKSlider').value = data.top_k ?? 5;
    document.getElementById('topKValue').value = data.top_k ?? 5;
    document.getElementById('maxQueryLengthSlider').value = data.max_query_length ?? 100;
    document.getElementById('maxQueryLengthValue').value = data.max_query_length ?? 100;
    document.getElementById('maxInputTokensSlider').value = data.max_input_tokens ?? 600;
    document.getElementById('maxInputTokensValue').value = data.max_input_tokens ?? 600;
    document.getElementById('maxOutputTokensSlider').value = data.max_output_tokens ?? 900;
    document.getElementById('maxOutputTokensValue').value = data.max_output_tokens ?? 900;
    document.getElementById('chunkSizeSlider').value = data.chunk_size ?? 500;
    document.getElementById('chunkSizeValue').value = data.chunk_size ?? 500;
    document.getElementById('chunkOverlapSlider').value = data.chunk_overlap ?? 50;
    document.getElementById('chunkOverlapValue').value = data.chunk_overlap ?? 50;
    document.getElementById('useLLMToggle').checked = data.use_llm !== false;
    document.getElementById('streamingEnabledToggle').checked = data.streaming_enabled !== false;
    const pricingEnabled = data.pricing_enabled !== false;
    const specsEnabled   = data.specs_enabled   !== false;
    const financingEnabled = data.financing_enabled !== false;
    const shippingEnabled  = data.shipping_enabled === true;
    const pe = document.getElementById('pricingEnabledToggle');   if (pe) { pe.checked = pricingEnabled;   _refreshSourceRowBorder('rowPricingEnabled','pricingEnabledToggle'); }
    const se = document.getElementById('specsEnabledToggle');     if (se) { se.checked = specsEnabled;     _refreshSourceRowBorder('rowSpecsEnabled','specsEnabledToggle'); }
    const fe = document.getElementById('financingEnabledToggle'); if (fe) { fe.checked = financingEnabled; _refreshSourceRowBorder('rowFinancingEnabled','financingEnabledToggle'); }
    const she = document.getElementById('shippingEnabledToggle'); if (she) { she.checked = shippingEnabled; _refreshSourceRowBorder('rowShippingEnabled','shippingEnabledToggle'); }
    const searchMethod = data.search_method || 'hybrid';
    const smRadio = document.querySelector(`input[name="searchMethod"][value="${searchMethod}"]`);
    if (smRadio) smRadio.checked = true;
    updateModelInfo();
  } catch (err) {
    showToast('Failed to load settings: ' + err.message, 'error');
  }
}

async function saveLLMSettings() {
  const selectedModel = document.getElementById('llmModel').value;
  const isGemini = selectedModel.startsWith('gemini-');
  const model = isGemini ? 'gemini' : selectedModel;
  const geminiModel = isGemini ? selectedModel : 'gemini-2.5-flash';

  // Bedrock answer inference profile
  const bpSel = document.getElementById('bedrockProfileSelect');
  const bpInp = document.getElementById('bedrockProfileCustom');
  const inferenceProfile = (!isGemini && bpSel)
    ? (bpSel.value === 'custom' ? (bpInp ? bpInp.value.trim() : '') : bpSel.value)
    : null;

  // Reformat inference profile
  const rpSel = document.getElementById('reformatProfileSelect');
  const rpInp = document.getElementById('reformatProfileCustom');
  const reformatProfile = (!isGemini && rpSel)
    ? (rpSel.value === 'custom' ? (rpInp ? rpInp.value.trim() : '') : rpSel.value)
    : null;
  const temperature = parseFloat(document.getElementById('llmTemperatureValue').value);
  const relevanceThreshold = parseFloat(document.getElementById('relevanceThresholdValue').value);
  const searchMethodEl = document.querySelector('input[name="searchMethod"]:checked');
  const searchMethod = searchMethodEl ? searchMethodEl.value : 'hybrid';
  const topK = parseInt(document.getElementById('topKValue').value, 10);
  const maxQueryLength = parseInt(document.getElementById('maxQueryLengthValue').value, 10);
  const maxInputTokens = parseInt(document.getElementById('maxInputTokensValue').value, 10);
  const maxOutputTokens = parseInt(document.getElementById('maxOutputTokensValue').value, 10);
  const chunkSize = parseInt(document.getElementById('chunkSizeValue').value, 10);
  const chunkOverlap = parseInt(document.getElementById('chunkOverlapValue').value, 10);
  const useLLM = document.getElementById('useLLMToggle').checked;
  const streamingEnabled = document.getElementById('streamingEnabledToggle').checked;
  const pricingEnabledEl   = document.getElementById('pricingEnabledToggle');
  const specsEnabledEl     = document.getElementById('specsEnabledToggle');
  const financingEnabledEl = document.getElementById('financingEnabledToggle');
  
  if (isNaN(temperature) || temperature < 0 || temperature > 2) {
    showToast('Temperature must be between 0 and 2', 'warning');
    return;
  }
  
  if (isNaN(relevanceThreshold) || relevanceThreshold < 0 || relevanceThreshold > 1) {
    showToast('Relevance threshold must be between 0 and 1', 'warning');
    return;
  }

  if (isNaN(topK) || topK < 1 || topK > 50) {
    showToast('Top K must be between 1 and 50', 'warning');
    return;
  }

  if (isNaN(maxQueryLength) || maxQueryLength < 10 || maxQueryLength > 200) {
    showToast('Max Query Length must be between 10 and 200', 'warning');
    return;
  }

  if (isNaN(maxInputTokens) || maxInputTokens < 10 || maxInputTokens > 900) {
    showToast('Max Input Tokens must be between 10 and 900', 'warning');
    return;
  }

  if (isNaN(maxOutputTokens) || maxOutputTokens < 1 || maxOutputTokens > 1200) {
    showToast('Max Output Tokens must be between 1 and 1200', 'warning');
    return;
  }

  if (isNaN(chunkSize) || chunkSize < 100 || chunkSize > 2000) {
    showToast('Chunk Size must be between 100 and 2000', 'warning');
    return;
  }

  if (isNaN(chunkOverlap) || chunkOverlap < 0 || chunkOverlap >= chunkSize) {
    showToast('Chunk Overlap must be between 0 and less than Chunk Size', 'warning');
    return;
  }
  
  try {
    await adminFetch('/settings/llm', {
      method: 'PUT',
      body: JSON.stringify({
        model,
        gemini_model: geminiModel,
        ...(inferenceProfile !== null && { inference_profile: inferenceProfile }),
        ...(reformatProfile !== null && { reformat_inference_profile: reformatProfile }),
        temperature,
        relevance_threshold: relevanceThreshold,
        search_method: searchMethod,
        top_k: topK,
        max_query_length: maxQueryLength,
        max_input_tokens: maxInputTokens,
        max_output_tokens: maxOutputTokens,
        use_llm: useLLM,
        streaming_enabled: streamingEnabled,
        chunk_size: chunkSize,
        chunk_overlap: chunkOverlap,
      })
    });
    showToast('Settings saved successfully', 'success');
  } catch (err) {
    showToast('Failed to save settings: ' + err.message, 'error');
  }
}

async function saveSourceSettings() {
  const pricingEnabledEl   = document.getElementById('pricingEnabledToggle');
  const specsEnabledEl     = document.getElementById('specsEnabledToggle');
  const financingEnabledEl = document.getElementById('financingEnabledToggle');
  const shippingEnabledEl  = document.getElementById('shippingEnabledToggle');
  if (!pricingEnabledEl) return;
  try {
    await adminFetch('/settings/llm', {
      method: 'PUT',
      body: JSON.stringify({
        pricing_enabled:   pricingEnabledEl.checked,
        specs_enabled:     specsEnabledEl.checked,
        financing_enabled: financingEnabledEl.checked,
        shipping_enabled:  shippingEnabledEl ? shippingEnabledEl.checked : false,
      })
    });
    _refreshSourceRowBorder('rowPricingEnabled', 'pricingEnabledToggle');
    _refreshSourceRowBorder('rowSpecsEnabled', 'specsEnabledToggle');
    _refreshSourceRowBorder('rowFinancingEnabled', 'financingEnabledToggle');
    _refreshSourceRowBorder('rowShippingEnabled', 'shippingEnabledToggle');
    showToast('Data source settings saved ✓', 'success');
  } catch (err) {
    showToast('Failed to save: ' + err.message, 'error');
  }
}

function _refreshSourceRowBorder(rowId, toggleId) {
  const row    = document.getElementById(rowId);
  const toggle = document.getElementById(toggleId);
  if (!row || !toggle) return;
  const enabled = toggle.checked;
  row.style.borderColor      = enabled ? 'var(--border)' : '#f87171';
  row.style.background       = enabled ? '' : 'rgba(254,226,226,.3)';
  const badge = row.querySelector('.badge');
  if (badge) {
    badge.textContent         = enabled ? 'ACTIVE' : 'DISABLED';
    badge.style.background    = enabled ? '#dcfce7' : '#fee2e2';
    badge.style.color         = enabled ? '#166534' : '#dc2626';
    badge.style.fontWeight    = '700';
    badge.style.fontSize      = '11px';
    badge.style.padding       = '2px 8px';
    badge.style.borderRadius  = '8px';
  }
}

function updateModelInfo() {
  const selectedModel = document.getElementById('llmModel').value;
  const model = selectedModel.startsWith('gemini-') ? 'gemini' : selectedModel;
  const isGemini = model === 'gemini';
  const geminiModelName = isGemini ? selectedModel : 'gemini-2.5-flash';
  const infoDiv = document.getElementById('modelInfo');

  // Show/hide provider-specific groups
  const geminiGroup = document.getElementById('geminiModelGroup');
  const bedrockGroup = document.getElementById('bedrockProfileGroup');
  const reformatGroup = document.getElementById('reformatProfileGroup');
  if (geminiGroup)  geminiGroup.style.display  = isGemini  ? '' : 'none';
  if (bedrockGroup) bedrockGroup.style.display = !isGemini ? '' : 'none';
  if (reformatGroup) reformatGroup.style.display = !isGemini ? '' : 'none';

  const geminiVariants = {
    'gemini-2.5-flash': {
      name: 'Google Gemini 2.5 Flash',
      description: 'Full-power Gemini Flash model with the best quality and reasoning. Recommended when response accuracy is top priority.',
      features: ['Best reasoning quality', 'Strong multilingual support', 'Ideal for complex queries']
    },
    'gemini-2.5-flash-lite': {
      name: 'Google Gemini 2.5 Flash Lite',
      description: 'Lightweight, faster variant of Gemini Flash — ~30% lower latency than the full Flash model. Recommended for speed-sensitive deployments.',
      features: ['~30% faster response time', 'Lower cost per query', 'Good quality for factual/pricing queries', 'Recommended for production']
    },
  };

  const modelDetails = {
    gemini: {
      name: geminiVariants[geminiModelName]?.name || 'Google Gemini',
      model: geminiModelName,
      description: geminiVariants[geminiModelName]?.description || '',
      features: geminiVariants[geminiModelName]?.features || []
    },
    bedrock: {
      name: 'AWS Bedrock (Nova)',
      model: 'amazon.nova-lite-v1:0',
      description: 'Amazon\'s Nova model via AWS Bedrock, optimized for enterprise use with strong performance.',
      features: ['Enterprise-grade reliability', 'AWS infrastructure integration', 'Strong content generation', 'Optimized for production workloads']
    }
  };

  const info = modelDetails[model];
  
  infoDiv.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:12px;">
      <div>
        <h4 style="margin:0 0 4px 0;font-size:16px;font-weight:600;">${info.name}</h4>
        <code style="font-size:12px;color:var(--text-muted);background:var(--bg);padding:2px 6px;border-radius:4px;">${info.model}</code>
      </div>
      <p style="margin:0;color:var(--text-muted);line-height:1.5;">${info.description}</p>
      <div>
        <div style="font-weight:500;margin-bottom:8px;font-size:13px;">Key Features:</div>
        <ul style="margin:0;padding-left:20px;color:var(--text-muted);">
          ${info.features.map(f => `<li style="margin-bottom:4px;">${f}</li>`).join('')}
        </ul>
      </div>
    </div>
  `;
}
