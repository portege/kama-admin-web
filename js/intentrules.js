/**
 * intentrules.js — Shared "Intent Trigger Rules" card
 *
 * Keywords are displayed as interactive tag chips.  Click × on a chip to remove
 * it; type in the inline input and press Enter or , to add a new keyword.
 *
 * Usage:
 *   renderIntentRulesCard('pricing');   // in pricing.js after body.innerHTML
 *   renderIntentRulesCard('specs');     // in productspecs.js
 *   renderIntentRulesCard('financing'); // in financing.js
 */

// ── In-memory tag state (service → string[]) ─────────────────────────────────
const _intentTags = { pricing: [], specs: [], financing: [], shipping: [] };

// Default keyword sets mirroring the backend defaults
const _INTENT_KEYWORD_DEFAULTS = {
  pricing:   'harga,price,berapa,biaya,cost,tarif,promo,diskon,discount,budget,stok,stock,tersedia,available,ready stock,indent',
  specs:     'spesifikasi,spec,fitur,feature,transmisi,mesin,engine,cc,tenaga,hp,hybrid,electric,dimensi,bahan,material,kapasitas,seat',
  financing: 'cicilan,kredit,leasing,DP,uang muka,tenor,angsuran,installment,down payment,monthly payment',
  shipping:  'ongkos kirim,shipping,pengiriman,ongkir,delivery,costs,biaya kirim,jasa pengiriman,courier,jne,tiki,pos',
};

// ── Public entry point ────────────────────────────────────────────────────────

/**
 * Append the intent-rules card for the given service to pageBody.
 * @param {'pricing'|'specs'|'financing'} service
 */
async function renderIntentRulesCard(service) {
  const body = document.getElementById('pageBody');
  if (!body) return;

  const labels = {
    pricing:   { title: 'Pricing',       icon: '', placeholder: 'Add keyword…' },
    specs:     { title: 'Product Specs', icon: '', placeholder: 'Add keyword…' },
    financing: { title: 'Financing',     icon: '', placeholder: 'Add keyword…' },
  };
  const info = labels[service];
  if (!info) return;

  const cardId    = `intentRulesCard_${service}`;
  const chipBoxId = `intentChips_${service}`;
  const inputId   = `intentKwInput_${service}`;
  const statusId  = `intentRulesStatus_${service}`;

  const card = document.createElement('div');
  card.className = 'card';
  card.id = cardId;
  card.style.cssText = 'margin-top:20px;';
  card.innerHTML = `
    <details>
      <summary style="
        list-style:none;cursor:pointer;padding:14px 20px;
        display:flex;align-items:center;gap:10px;
        font-weight:600;font-size:14px;user-select:none;
      ">
        <span style="font-size:18px;">${info.icon}</span>
        ${info.title} — Intent Trigger Rules
        <span style="margin-left:auto;font-size:12px;font-weight:400;color:var(--text-muted);">click to expand</span>
      </summary>

      <div style="padding:16px 20px;border-top:1px solid var(--border);">
        <p style="font-size:13px;color:var(--text-muted);margin:0 0 12px;">
          These keywords guide the AI intent classifier to recognise
          <strong>${info.title.toLowerCase()}</strong>-related queries.
          Click <strong>×</strong> on a tag to remove it. Type a keyword below and press
          <kbd style="font-size:11px;padding:1px 5px;border:1px solid var(--border);border-radius:3px;">Enter</kbd>
          or <kbd style="font-size:11px;padding:1px 5px;border:1px solid var(--border);border-radius:3px;">,</kbd>
          to add. Changes take effect immediately — no restart required.
        </p>

        <!-- Chip container (clicking anywhere focuses the hidden input) -->
        <div id="${chipBoxId}" onclick="_intentFocusInput('${inputId}')" style="
          display:flex;flex-wrap:wrap;gap:6px;align-items:center;
          min-height:44px;padding:8px 10px;
          border:1px solid var(--border);border-radius:8px;
          background:var(--card-bg,#fff);cursor:text;
        ">
          <!-- chips injected by _intentRenderChips() -->
          <input
            id="${inputId}"
            type="text"
            placeholder="${info.placeholder}"
            autocomplete="off"
            style="
              border:none;outline:none;background:transparent;
              font-size:13px;min-width:140px;flex:1;padding:2px 4px;
              color:var(--text-primary);
            "
            onkeydown="_intentInputKeydown(event,'${service}','${chipBoxId}','${inputId}')"
            onblur="_intentInputBlur('${service}','${chipBoxId}','${inputId}')"
          />
        </div>
        <small style="color:var(--text-muted);font-size:12px;margin-top:4px;display:block;">
          Press <strong>Enter</strong> or <strong>,</strong> to confirm. Backspace on empty input removes the last tag.
        </small>

        <!-- Actions -->
        <div style="display:flex;align-items:center;gap:12px;margin-top:14px;">
          <button class="btn btn-primary btn-sm"
            onclick="_saveIntentRules('${service}','${statusId}')">
            💾 Save Keywords
          </button>
          <button class="btn btn-secondary btn-sm"
            onclick="_resetIntentRules('${service}','${chipBoxId}','${inputId}','${statusId}')">
            ↩ Reset to Default
          </button>
          <span id="${statusId}" style="font-size:12px;color:var(--text-muted);"></span>
        </div>
      </div>
    </details>
  `;
  body.appendChild(card);

  await _loadIntentRules(service, chipBoxId, inputId);
}

// ── Data loading ──────────────────────────────────────────────────────────────

async function _loadIntentRules(service, chipBoxId, inputId) {
  try {
    const data = await adminFetch('/settings/intent-rules');
    const fieldMap = { pricing: 'pricing_keywords', specs: 'specs_keywords', financing: 'financing_keywords', shipping: 'shipping_keywords' };
    const raw = data[fieldMap[service]] || '';
    _intentTags[service] = raw.split(',').map(s => s.trim()).filter(Boolean);
    _intentRenderChips(service, chipBoxId, inputId);
  } catch (err) {
    console.warn('[IntentRules] Failed to load:', err.message);
  }
}

// ── Chip rendering ────────────────────────────────────────────────────────────

function _intentRenderChips(service, chipBoxId, inputId) {
  const box   = document.getElementById(chipBoxId);
  const input = document.getElementById(inputId);
  if (!box || !input) return;

  // Remove existing chips (keep the input element)
  Array.from(box.querySelectorAll('.intent-chip')).forEach(el => el.remove());

  _intentTags[service].forEach((tag, idx) => {
    const chip = document.createElement('span');
    chip.className = 'intent-chip';
    chip.style.cssText = `
      display:inline-flex;align-items:center;gap:4px;
      padding:3px 6px 3px 10px;border-radius:20px;
      background:var(--primary-light,rgba(109,40,217,.1));
      border:1px solid var(--primary,#6d28d9);
      color:var(--primary,#6d28d9);font-size:12px;font-weight:500;
      white-space:nowrap;max-width:200px;
    `;

    const label = document.createElement('span');
    label.textContent = tag;
    label.title = tag;
    label.style.cssText = 'overflow:hidden;text-overflow:ellipsis;max-width:160px;';

    const xBtn = document.createElement('button');
    xBtn.type = 'button';
    xBtn.innerHTML = '&times;';
    xBtn.title = `Remove "${tag}"`;
    xBtn.style.cssText = `
      border:none;background:none;cursor:pointer;
      padding:0 2px;line-height:1;font-size:15px;font-weight:700;
      color:var(--primary,#6d28d9);opacity:.6;
      display:flex;align-items:center;
    `;
    xBtn.onmouseenter = () => { xBtn.style.opacity = '1'; };
    xBtn.onmouseleave = () => { xBtn.style.opacity = '.6'; };
    xBtn.onclick = (e) => {
      e.stopPropagation();
      _intentTags[service].splice(idx, 1);
      _intentRenderChips(service, chipBoxId, inputId);
    };

    chip.appendChild(label);
    chip.appendChild(xBtn);
    box.insertBefore(chip, input);
  });
}

// ── Tag add helpers ───────────────────────────────────────────────────────────

function _intentAddTag(service, value, chipBoxId, inputId) {
  const tag = value.trim().replace(/,+$/, '').trim();
  if (!tag) return;
  if (_intentTags[service].includes(tag)) return; // no duplicates
  if ([..._intentTags[service], tag].join(',').length > 500) return; // guard limit
  _intentTags[service].push(tag);
  _intentRenderChips(service, chipBoxId, inputId);
}

function _intentFocusInput(inputId) {
  const el = document.getElementById(inputId);
  if (el) el.focus();
}

// ── Input event handlers ──────────────────────────────────────────────────────

function _intentInputKeydown(e, service, chipBoxId, inputId) {
  const input = document.getElementById(inputId);
  if (!input) return;

  if (e.key === 'Enter' || e.key === ',') {
    e.preventDefault();
    if (input.value.trim()) {
      _intentAddTag(service, input.value, chipBoxId, inputId);
      input.value = '';
    }
  } else if (e.key === 'Backspace' && input.value === '' && _intentTags[service].length) {
    // Remove the last chip on Backspace when input is empty
    _intentTags[service].pop();
    _intentRenderChips(service, chipBoxId, inputId);
  }
}

function _intentInputBlur(service, chipBoxId, inputId) {
  const input = document.getElementById(inputId);
  if (input && input.value.trim()) {
    _intentAddTag(service, input.value, chipBoxId, inputId);
    input.value = '';
  }
}

// ── Save / Reset ──────────────────────────────────────────────────────────────

async function _saveIntentRules(service, statusId) {
  const status   = document.getElementById(statusId);
  const fieldMap = { pricing: 'pricing_keywords', specs: 'specs_keywords', financing: 'financing_keywords' };
  const payload  = {};
  payload[fieldMap[service]] = _intentTags[service].join(',');

  if (status) { status.textContent = 'Saving…'; status.style.color = 'var(--text-muted)'; }
  try {
    await adminFetch('/settings/intent-rules', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (status) { status.textContent = '✓ Saved'; status.style.color = 'var(--success,#16a34a)'; }
    setTimeout(() => { if (status) status.textContent = ''; }, 3000);
  } catch (err) {
    if (status) { status.textContent = '✗ ' + err.message; status.style.color = 'var(--danger,#dc2626)'; }
  }
}

async function _resetIntentRules(service, chipBoxId, inputId, statusId) {
  if (!confirm('Reset to default keywords? This will overwrite your current settings.')) return;
  _intentTags[service] = _INTENT_KEYWORD_DEFAULTS[service].split(',').map(s => s.trim()).filter(Boolean);
  _intentRenderChips(service, chipBoxId, inputId);
  await _saveIntentRules(service, statusId);
}
