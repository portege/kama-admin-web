/**
 * customapi.js — Custom API Intent Management
 * Manage user-defined API intents that route queries to external APIs
 */

let _customAPIIntents = [];

// ══════════════════════════════════════════════════════════════════════════════
// Main render function
// ══════════════════════════════════════════════════════════════════════════════

async function renderCustomAPI() {
  const body = document.getElementById('pageBody');
  
  body.innerHTML = `
    <!-- Tabs Navigation -->
    <div class="card" style="margin-bottom:20px;">
      <div style="border-bottom:1px solid var(--border);padding:0;">
        <div style="display:flex;gap:0;">
          <button class="customapi-tab active" data-tab="intents" onclick="_switchCustomAPITab('intents')" style="
            padding:12px 20px;border:none;background:transparent;cursor:pointer;
            font-weight:600;font-size:14px;color:var(--primary,#0ea5e9);
            border-bottom:2px solid var(--primary,#0ea5e9);transition:all 0.2s;
          ">
            API Intents
          </button>
        </div>
      </div>

      <!-- Tab: Intents -->
      <div class="customapi-tab-content" data-tab="intents" style="display:block;">
        <div class="card-header">
          <span class="card-title">Custom API Intents</span>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
            <button class="btn btn-primary btn-sm" onclick="openCustomAPIModal()">＋ Add Intent</button>
            <button class="btn btn-secondary btn-sm" onclick="loadCustomAPIIntents()">🔄 Refresh</button>
          </div>
        </div>
        
        <div style="padding:14px;background:var(--card-bg);border-bottom:2px solid var(--border);">
          <div style="font-size:13px;color:var(--text-muted);line-height:1.6;">
            Define custom intents that route user queries to external APIs instead of the knowledge base. 
            When the AI router detects your intent keywords, it will call the configured API and use the response in the answer.
          </div>
        </div>

        <div id="customAPIIntentsList" style="padding:20px;">
          <div style="text-align:center;color:var(--text-muted);padding:40px;">
            Loading intents...
          </div>
        </div>
      </div>
    </div>
  `;

  await loadCustomAPIIntents();
}

// ══════════════════════════════════════════════════════════════════════════════
// Tab switching
// ══════════════════════════════════════════════════════════════════════════════

function _switchCustomAPITab(tabName) {
  // Update tab buttons
  document.querySelectorAll('.customapi-tab').forEach(tab => {
    const isActive = tab.dataset.tab === tabName;
    tab.classList.toggle('active', isActive);
    tab.style.color = isActive ? 'var(--primary,#0ea5e9)' : 'var(--text-muted)';
    tab.style.borderBottomColor = isActive ? 'var(--primary,#0ea5e9)' : 'transparent';
    tab.style.fontWeight = isActive ? '600' : '500';
  });

  // Update tab content
  document.querySelectorAll('.customapi-tab-content').forEach(content => {
    content.style.display = content.dataset.tab === tabName ? 'block' : 'none';
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// Load intents
// ══════════════════════════════════════════════════════════════════════════════

async function loadCustomAPIIntents() {
  try {
    const data = await adminFetch('/custom-intents');
    _customAPIIntents = data.intents || [];
    renderCustomAPIIntentsList();
  } catch (err) {
    console.error('Failed to load custom API intents:', err);
    showToast('Failed to load intents: ' + err.message, 'error');
    document.getElementById('customAPIIntentsList').innerHTML = `
      <div style="text-align:center;color:var(--text-danger);padding:40px;">
        Failed to load intents. ${esc(err.message)}
      </div>
    `;
  }
}

function renderCustomAPIIntentsList() {
  const container = document.getElementById('customAPIIntentsList');
  
  if (_customAPIIntents.length === 0) {
    container.innerHTML = `
      <div style="text-align:center;color:var(--text-muted);padding:40px;">
        <div style="font-size:48px;margin-bottom:16px;">🔌</div>
        <div style="font-size:16px;font-weight:600;margin-bottom:8px;">No Custom API Intents</div>
        <div style="font-size:14px;margin-bottom:20px;">Create your first API intent to route queries to external services</div>
        <button class="btn btn-primary" onclick="openCustomAPIModal()">＋ Add Intent</button>
      </div>
    `;
    return;
  }

  const intentCards = _customAPIIntents.map(intent => createIntentCard(intent)).join('');
  container.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(400px, 1fr));gap:16px;">
      ${intentCards}
    </div>
  `;
}

function createIntentCard(intent) {
  const statusBadge = intent.is_active
    ? '<span style="padding:3px 10px;background:#dcfce7;color:#15803d;border-radius:6px;font-size:11px;font-weight:600;">ACTIVE</span>'
    : '<span style="padding:3px 10px;background:#fee2e2;color:#dc2626;border-radius:6px;font-size:11px;font-weight:600;">INACTIVE</span>';

  const methodColor = {
    'GET': '#3b82f6',
    'POST': '#10b981',
    'PUT': '#f59e0b',
    'PATCH': '#8b5cf6',
    'DELETE': '#ef4444'
  }[intent.http_method] || '#6b7280';

  return `
    <div style="border:1.5px solid var(--border);border-radius:12px;padding:18px;background:var(--card-bg);transition:all 0.2s;box-shadow:var(--shadow);"
         onmouseenter="this.style.borderColor='var(--primary)';this.style.transform='translateY(-2px)';this.style.boxShadow='var(--shadow-md)'"
         onmouseleave="this.style.borderColor='var(--border)';this.style.transform='translateY(0)';this.style.boxShadow='var(--shadow)'">
      
      <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:12px;">
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="width:40px;height:40px;border-radius:10px;background:${methodColor}15;color:${methodColor};display:flex;align-items:center;justify-content:center;font-weight:700;font-size:11px;">
            ${esc(intent.http_method)}
          </div>
          <div>
            <div style="font-size:15px;font-weight:600;color:var(--text);">${esc(intent.intent_name)}</div>
            <div style="font-size:11px;color:var(--text-muted);">Intent ID: ${intent.id}</div>
          </div>
        </div>
        ${statusBadge}
      </div>

      <div style="font-size:13px;color:var(--text-muted);margin-bottom:14px;line-height:1.5;">
        ${esc(intent.description) || '<em>No description</em>'}
      </div>

      <div style="margin-bottom:12px;">
        <div style="font-size:11px;font-weight:600;color:var(--text);margin-bottom:6px;">KEYWORDS</div>
        <div style="font-size:12px;color:var(--text-muted);font-family:monospace;background:var(--bg);padding:8px;border-radius:6px;">
          ${esc(intent.keywords)}
        </div>
      </div>

      <div style="margin-bottom:16px;">
        <div style="font-size:11px;font-weight:600;color:var(--text);margin-bottom:6px;">ENDPOINT</div>
        <div style="font-size:11px;color:var(--text-muted);font-family:monospace;background:var(--bg);padding:8px;border-radius:6px;word-break:break-all;">
          ${esc(intent.endpoint_url)}
        </div>
      </div>

      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <button class="btn btn-secondary btn-sm" onclick="testCustomAPIIntent(${intent.id})" style="flex:1;">
          🧪 Test
        </button>
        <button class="btn btn-secondary btn-sm" onclick="editCustomAPIIntent(${intent.id})" style="flex:1;">
          ✏️ Edit
        </button>
        <button class="btn btn-secondary btn-sm" onclick="toggleCustomAPIIntent(${intent.id}, ${!intent.is_active})" style="padding:6px 12px;">
          ${intent.is_active ? '⏸️' : '▶️'}
        </button>
        <button class="btn btn-danger btn-sm" onclick="deleteCustomAPIIntent(${intent.id})" style="padding:6px 12px;">
          🗑️
        </button>
      </div>
    </div>
  `;
}

// ══════════════════════════════════════════════════════════════════════════════
// Create/Edit Modal
// ══════════════════════════════════════════════════════════════════════════════

function openCustomAPIModal(intentId = null) {
  const isEdit = intentId !== null;
  const intent = isEdit ? _customAPIIntents.find(i => i.id === intentId) : null;

  // Check if modal already exists, if not create it
  let modal = document.getElementById('customAPIModal');
  if (!modal) {
    const modalHTML = `
      <div class="modal-overlay hidden" id="customAPIModal">
        <div class="modal" style="max-width:700px;max-height:90vh;overflow-y:auto;">
          <div class="modal-header">
            <span class="modal-title" id="customAPIModalTitle">Create Custom API Intent</span>
            <button class="modal-close" onclick="closeCustomAPIModal()">×</button>
          </div>
          <div class="modal-body" id="customAPIModalBody" style="padding:24px;"></div>
          <div class="modal-footer">
            <button class="btn btn-secondary" onclick="closeCustomAPIModal()">Cancel</button>
            <button class="btn btn-primary" id="customAPIModalSaveBtn">Create Intent</button>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    modal = document.getElementById('customAPIModal');
  }

  // Update modal title and button
  document.getElementById('customAPIModalTitle').textContent = isEdit ? 'Edit Custom API Intent' : 'Create Custom API Intent';
  const saveBtn = document.getElementById('customAPIModalSaveBtn');
  saveBtn.textContent = isEdit ? 'Save Changes' : 'Create Intent';
  saveBtn.onclick = () => saveCustomAPIIntent(intentId);

  // Build form
  const modalBody = document.getElementById('customAPIModalBody');
  modalBody.innerHTML = `
          
          <div class="form-group">
            <label class="form-label">Intent Name <span style="color:#dc2626;">*</span></label>
            <input type="text" class="form-control" id="intentName" placeholder="e.g., stock_check" value="${esc(intent?.intent_name || '')}" ${isEdit ? 'readonly' : ''}>
            <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">Lowercase letters, numbers, underscores only. No spaces.</div>
          </div>

          <div class="form-group">
            <label class="form-label">Description</label>
            <input type="text" class="form-control" id="intentDescription" placeholder="What does this intent handle?" value="${esc(intent?.description || '')}">
          </div>

          <div class="form-group">
            <label class="form-label">Keywords <span style="color:#dc2626;">*</span></label>
            <input type="text" class="form-control" id="intentKeywords" placeholder="comma,separated,keywords" value="${esc(intent?.keywords || '')}">
            <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">Trigger keywords for the AI router (comma-separated)</div>
          </div>

          <div style="display:grid;grid-template-columns:150px 1fr;gap:12px;">
            <div class="form-group">
              <label class="form-label">HTTP Method <span style="color:#dc2626;">*</span></label>
              <select class="form-control" id="intentMethod">
                <option value="GET" ${intent?.http_method === 'GET' ? 'selected' : ''}>GET</option>
                <option value="POST" ${intent?.http_method === 'POST' ? 'selected' : ''}>POST</option>
                <option value="PUT" ${intent?.http_method === 'PUT' ? 'selected' : ''}>PUT</option>
                <option value="PATCH" ${intent?.http_method === 'PATCH' ? 'selected' : ''}>PATCH</option>
                <option value="DELETE" ${intent?.http_method === 'DELETE' ? 'selected' : ''}>DELETE</option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">Endpoint URL <span style="color:#dc2626;">*</span></label>
              <input type="text" class="form-control" id="intentEndpoint" placeholder="https://api.example.com/endpoint" value="${esc(intent?.endpoint_url || '')}">
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Payload Template</label>
            <textarea class="form-control" id="intentPayload" rows="4" placeholder='{"query": "{{query}}", "product": "{{entity}}"}'>${esc(intent?.payload_template || '')}</textarea>
            <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">
              Use <code style="background:var(--bg);padding:2px 6px;border-radius:4px;">{{'{{'}}query}}</code>, 
              <code style="background:var(--bg);padding:2px 6px;border-radius:4px;">{{'{{'}}entity}}</code>, 
              <code style="background:var(--bg);padding:2px 6px;border-radius:4px;">{{'{{'}}entity.0}}</code> placeholders
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Headers (JSON)</label>
            <textarea class="form-control" id="intentHeaders" rows="3" placeholder='{"Authorization": "Bearer TOKEN", "Content-Type": "application/json"}'>${esc(intent?.headers || '')}</textarea>
            <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">Valid JSON object with HTTP headers</div>
          </div>

          <div class="form-group">
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
              <input type="checkbox" id="intentActive" ${intent?.is_active !== 0 ? 'checked' : ''}>
              <span>Active (enable this intent)</span>
            </label>
          </div>
  `;

  // Show modal
  modal.classList.remove('hidden');
}

function closeCustomAPIModal() {
  const modal = document.getElementById('customAPIModal');
  if (modal) {
    modal.classList.add('hidden');
  }
}

async function saveCustomAPIIntent(intentId) {
  const intentName = document.getElementById('intentName').value.trim();
  const description = document.getElementById('intentDescription').value.trim();
  const keywords = document.getElementById('intentKeywords').value.trim();
  const httpMethod = document.getElementById('intentMethod').value;
  const endpointUrl = document.getElementById('intentEndpoint').value.trim();
  const payloadTemplate = document.getElementById('intentPayload').value.trim();
  const headers = document.getElementById('intentHeaders').value.trim();
  const isActive = document.getElementById('intentActive').checked;

  // Validation
  if (!intentName) {
    showToast('Intent name is required', 'error');
    return;
  }
  if (!/^[a-z][a-z0-9_]*$/.test(intentName)) {
    showToast('Intent name must start with lowercase letter and contain only lowercase letters, numbers, and underscores', 'error');
    return;
  }
  if (!keywords) {
    showToast('Keywords are required', 'error');
    return;
  }
  if (!endpointUrl) {
    showToast('Endpoint URL is required', 'error');
    return;
  }

  // Validate JSON if provided
  if (headers) {
    try {
      JSON.parse(headers);
    } catch (e) {
      showToast('Headers must be valid JSON', 'error');
      return;
    }
  }

  const payload = {
    intent_name: intentName,
    description: description,
    keywords: keywords,
    http_method: httpMethod,
    endpoint_url: endpointUrl,
    payload_template: payloadTemplate || null,
    headers: headers || null,
    is_active: isActive
  };

  try {
    if (intentId) {
      // Update existing
      delete payload.intent_name; // Can't change name
      await adminFetch(`/custom-intents/${intentId}`, { method: 'PUT', body: JSON.stringify(payload) });
      showToast('Intent updated successfully', 'success');
    } else {
      // Create new
      await adminFetch('/custom-intents', { method: 'POST', body: JSON.stringify(payload) });
      showToast('Intent created successfully', 'success');
    }
    closeCustomAPIModal();
    await loadCustomAPIIntents();
  } catch (err) {
    console.error('Failed to save intent:', err);
    showToast('Failed to save intent: ' + err.message, 'error');
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Actions
// ══════════════════════════════════════════════════════════════════════════════

function editCustomAPIIntent(intentId) {
  openCustomAPIModal(intentId);
}

async function deleteCustomAPIIntent(intentId) {
  const intent = _customAPIIntents.find(i => i.id === intentId);
  if (!intent) return;

  if (!confirm(`Delete intent "${intent.intent_name}"?\n\nThis action cannot be undone.`)) {
    return;
  }

  try {
    await adminFetch(`/custom-intents/${intentId}`, { method: 'DELETE' });
    showToast('Intent deleted successfully', 'success');
    await loadCustomAPIIntents();
  } catch (err) {
    console.error('Failed to delete intent:', err);
    showToast('Failed to delete intent: ' + err.message, 'error');
  }
}

async function toggleCustomAPIIntent(intentId, newState) {
  try {
    await adminFetch(`/custom-intents/${intentId}/toggle`, { method: 'POST', body: JSON.stringify({ is_active: newState }) });
    showToast(`Intent ${newState ? 'activated' : 'deactivated'}`, 'success');
    await loadCustomAPIIntents();
  } catch (err) {
    console.error('Failed to toggle intent:', err);
    showToast('Failed to toggle intent: ' + err.message, 'error');
  }
}

async function testCustomAPIIntent(intentId) {
  const intent = _customAPIIntents.find(i => i.id === intentId);
  if (!intent) return;

  const testQuery = prompt('Enter test query:', 'test query');
  if (!testQuery) return;

  try {
    showToast('Testing API call...', 'info');
    const result = await adminFetch(`/custom-intents/${intentId}/test`, { method: 'POST', body: JSON.stringify({ query: testQuery }) });
    
    if (result.success) {
      const preview = result.formatted_context.substring(0, 200);
      alert(`✅ Test Successful!\n\nQuery: ${testQuery}\n\nResponse Preview:\n${preview}...`);
    } else {
      alert(`❌ Test Failed\n\nError: ${result.error || 'Unknown error'}`);
    }
  } catch (err) {
    console.error('Test failed:', err);
    showToast('Test failed: ' + err.message, 'error');
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Helper
// ══════════════════════════════════════════════════════════════════════════════

function esc(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
