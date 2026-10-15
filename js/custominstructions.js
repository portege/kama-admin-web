/**
 * custominstructions.js — Custom Instruction & Articulation Template management
 */

const ARTICULATION_TEMPLATE_INFO = {
  default: {
    label: '🤖 Default',
    description: 'Standard helpful AI assistant. No extra style constraints.',
    preview: 'Clear, concise answers based strictly on the knowledge base.',
  },
  format: {
    label: '📋 Formatted',
    description: 'Structured responses using markdown — bold key terms, bullet points, and section headers.',
    preview: '**Key Specs:**\n- Engine: 1.5L VVT-i\n- Power: 109 HP\n- Transmission: CVT',
  },
  english_casual: {
    label: '🙂 English Casual',
    description: 'Friendly and approachable English tone that stays clear, professional, and informative.',
    preview: 'Great question — here\'s the quick version: this model is efficient for daily driving, comfortable in traffic, and still practical for weekend trips.',
  },
  indonesian_casual: {
    label: '🇮🇩 Santai (Indonesian Casual)',
    description: 'Bahasa Indonesia santai, hangat, dan mudah dipahami. Menggunakan sapaan "kamu".',
    preview: 'Harga Toyota Avanza mulai dari Rp 230 jutaan ya. Mau tahu cicilan per bulannya?',
  },
  indonesian_seller: {
    label: '🛍️ Seller Cewek (Indonesian Online Seller)',
    description: 'Persona penjual online wanita Indonesia — ramah, energik, bahasa gaul ala Instagram/TikTok. Sapaan "Kak"/"Sis", partikel "nih/dong/yuk", dan emoji ✨😍.',
    preview: 'Masih ready banget nih, Kak! ✨ Barangnya sisa dikit lagi lho, jangan sampai kehabisan ya. Cuss langsung di-checkout sekarang juga! 😍',
  },
  indonesian_cowok: {
    label: '🧑 Cowok Gaul (Indonesian Male Casual)',
    description: 'Gaya cowok gaul Indonesia — santai, direct, bro-like. Sapaan "Bro"/"Gan"/"Bang", slang seperti "mantul/goks/worth it bgt", cocok untuk komunitas pria, otomotif, atau tech.',
    preview: 'Mantul banget, Bro! Konsumsinya bisa 18 km/liter di tol, cuan buat dompet lo. Btw transmisi CVT-nya juga smooth, worth it bgt sih 👌',
  },
};

async function renderCustomInstructions() {
  const body = document.getElementById('pageBody');
  const user = JSON.parse(sessionStorage.getItem('admin_user') || '{}');
  const canEdit = ['superadmin', 'manager'].includes(user.role);

  body.innerHTML = `<div style="max-width:800px;margin:0 auto;">
    <div class="card" style="margin-bottom:20px;">
      <div class="card-header">
        <span class="card-title">Articulation Template</span>
        <small style="color:var(--text-muted);font-weight:400;">Choose how the AI structures and phrases its responses</small>
      </div>
      <div class="card-body">
        <div id="articulationCards" style="display:flex;flex-direction:column;gap:12px;margin-bottom:12px;"></div>
        <p style="font-size:12px;color:var(--text-muted);margin:0 0 16px;padding:8px 12px;background:var(--code-bg,rgba(0,0,0,.04));border-radius:6px;border-left:3px solid var(--primary);">
          💡 <strong>API tip:</strong> To apply a style temporarily without changing this setting, pass <code style="font-size:11px;">"articulation": "&lt;key&gt;"</code> in your <code style="font-size:11px;">/chat/stream</code> or <code style="font-size:11px;">/query/stream</code> request body.
        </p>
        ${canEdit ? `<button class="btn btn-primary" id="saveArticulationBtn" onclick="saveArticulation()">Save Template</button>` : ''}
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <span class="card-title">Custom System Instruction</span>
        <small style="color:var(--text-muted);font-weight:400;">Extra guidance injected into every LLM prompt</small>
      </div>
      <div class="card-body">
        <div class="form-group">
          <label class="form-label">Instruction Text</label>
          <textarea
            class="form-control"
            id="customInstructionText"
            rows="6"
            maxlength="2000"
            placeholder="e.g. You are Tomo, a friendly Toyota sales assistant. Always recommend scheduling a test drive."
            style="resize:vertical;font-family:inherit;"
            oninput="updateCharCount()"
            ${canEdit ? '' : 'disabled'}
          ></textarea>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px;">
            <small class="form-help">
              This text is prepended to every LLM request as system-level guidance.
              It works together with the selected articulation template.
            </small>
            <small id="ciCharCount" style="color:var(--text-muted);white-space:nowrap;margin-left:12px;">0 / 2000</small>
          </div>
        </div>
        ${canEdit ? `<button class="btn btn-primary" id="saveCIBtn" onclick="saveCustomInstruction()">Save Instruction</button>` : ''}
        ${!canEdit ? `<p style="color:var(--text-muted);font-size:13px;margin-top:8px;">⚠️ Your role does not have permission to edit these settings.</p>` : ''}
      </div>
    </div>
  </div>`;

  await loadCustomInstructionSettings();
}

async function loadCustomInstructionSettings() {
  try {
    const data = await adminFetch('/settings/custom-instruction');
    renderArticulationCards(data.articulation_template || 'default');
    const ta = document.getElementById('customInstructionText');
    if (ta) {
      ta.value = data.custom_instruction || '';
      updateCharCount();
    }
  } catch (err) {
    showToast('Failed to load settings: ' + err.message, 'error');
  }
}

function renderArticulationCards(selected) {
  const container = document.getElementById('articulationCards');
  if (!container) return;
  const user = JSON.parse(sessionStorage.getItem('admin_user') || '{}');
  const canEdit = ['superadmin', 'manager'].includes(user.role);

  container.innerHTML = Object.entries(ARTICULATION_TEMPLATE_INFO).map(([key, info]) => {
    const isActive = key === selected;
    return `
      <label style="
        display:flex;align-items:flex-start;gap:14px;cursor:${canEdit ? 'pointer' : 'default'};
        padding:14px 16px;border-radius:10px;border:2px solid ${isActive ? 'var(--primary)' : 'var(--border)'};
        background:${isActive ? 'var(--primary-light,rgba(109,40,217,.06))' : 'var(--card-bg)'};
        transition:border-color .15s,background .15s;
      ">
        <input type="radio" name="articulationTemplate" value="${key}"
               ${isActive ? 'checked' : ''} ${canEdit ? '' : 'disabled'}
               style="margin-top:3px;accent-color:var(--primary);"
               onchange="onArticulationChange('${key}')" />
        <div style="flex:1;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:2px;">
            <span style="font-weight:600;font-size:14px;">${info.label}</span>
            <code title="Pass this value as the &quot;articulation&quot; field in your API request to use this style temporarily" style="
              font-size:11px;padding:1px 7px;border-radius:4px;
              background:var(--code-bg,rgba(0,0,0,.07));color:var(--text-secondary);
              font-family:monospace;letter-spacing:.02em;cursor:default;
              border:1px solid var(--border);
            ">${escapeHtml(key)}</code>
          </div>
          <div style="font-size:13px;color:var(--text-muted);margin-bottom:6px;">${info.description}</div>
          <pre style="
            margin:0;padding:8px 10px;border-radius:6px;font-size:12px;
            background:var(--code-bg,rgba(0,0,0,.05));color:var(--text-secondary);
            white-space:pre-wrap;word-break:break-word;font-family:monospace;
          ">${escapeHtml(info.preview)}</pre>
        </div>
      </label>
    `;
  }).join('');
}

function onArticulationChange(key) {
  // Re-render cards to update active styling
  const checked = document.querySelector('input[name="articulationTemplate"]:checked');
  if (!checked) return;
  renderArticulationCards(checked.value);
}

function updateCharCount() {
  const ta = document.getElementById('customInstructionText');
  const counter = document.getElementById('ciCharCount');
  if (ta && counter) {
    const len = ta.value.length;
    counter.textContent = `${len} / 2000`;
    counter.style.color = len > 1800 ? 'var(--danger)' : 'var(--text-muted)';
  }
}

async function saveArticulation() {
  const btn = document.getElementById('saveArticulationBtn');
  const checked = document.querySelector('input[name="articulationTemplate"]:checked');
  if (!checked) return;

  const template = checked.value;
  if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }

  try {
    await adminFetch('/settings/custom-instruction', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ articulation_template: template }),
    });
    showToast('Articulation template saved ✓', 'success');
    renderArticulationCards(template);
  } catch (err) {
    showToast('Failed to save: ' + err.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Save Template'; }
  }
}

async function saveCustomInstruction() {
  const btn = document.getElementById('saveCIBtn');
  const ta = document.getElementById('customInstructionText');
  if (!ta) return;

  const instruction = ta.value;
  if (instruction.length > 2000) {
    showToast('Instruction must be 2000 characters or fewer.', 'error');
    return;
  }

  if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }

  try {
    await adminFetch('/settings/custom-instruction', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ custom_instruction: instruction }),
    });
    showToast('Custom instruction saved ✓', 'success');
  } catch (err) {
    showToast('Failed to save: ' + err.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Save Instruction'; }
  }
}
