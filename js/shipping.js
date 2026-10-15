/**
 * shipping.js — Admin panel for shipping (Raja Ongkir / Biteship) configuration
 */

// ── Section renderer ──────────────────────────────────────────────────────────

async function loadShippingSection() {
  const container = document.getElementById('pageBody');
  container.innerHTML = `
    <div class="section-header" style="display:flex;align-items:center;gap:10px;">
      <h2 style="margin:0;">Shipping Configuration</h2>
    </div>
    <div id="shipping-alert" style="display:none;" class="alert"></div>

    <!-- Tabs Navigation -->
    <div class="card" style="margin-bottom:20px;">
      <div style="border-bottom:1px solid var(--border);padding:0;">
        <div style="display:flex;gap:0;">
          <button class="shipping-tab active" data-tab="api" onclick="_switchShippingTab('api')" style="
            padding:12px 20px;border:none;background:transparent;cursor:pointer;
            font-weight:600;font-size:14px;color:var(--primary,#0ea5e9);
            border-bottom:2px solid var(--primary,#0ea5e9);transition:all 0.2s;
          ">
            API Configuration
          </button>
          <span style="color:var(--border);padding:12px 0;font-size:14px;">|</span>
          <button class="shipping-tab" data-tab="origin" onclick="_switchShippingTab('origin')" style="
            padding:12px 20px;border:none;background:transparent;cursor:pointer;
            font-weight:500;font-size:14px;color:var(--text-muted);
            border-bottom:2px solid transparent;transition:all 0.2s;
          ">
            Origin & Defaults
          </button>
          <span style="color:var(--border);padding:12px 0;font-size:14px;">|</span>
          <button class="shipping-tab" data-tab="intent" onclick="_switchShippingTab('intent')" style="
            padding:12px 20px;border:none;background:transparent;cursor:pointer;
            font-weight:500;font-size:14px;color:var(--text-muted);
            border-bottom:2px solid transparent;transition:all 0.2s;
          ">
            Intent Rules
          </button>
          <span style="color:var(--border);padding:12px 0;font-size:14px;">|</span>
          <button class="shipping-tab" data-tab="help" onclick="_switchShippingTab('help')" style="
            padding:12px 20px;border:none;background:transparent;cursor:pointer;
            font-weight:500;font-size:14px;color:var(--text-muted);
            border-bottom:2px solid transparent;transition:all 0.2s;
          ">
            Help
          </button>
        </div>
      </div>

      <!-- Tab: API Configuration -->
      <div class="shipping-tab-content" data-tab="api" style="display:block;">
        <div class="card-header">
          <span class="card-title">Shipping Integration</span>
          <small style="color:var(--text-muted);font-weight:400;">
            Configure shipping API credentials and courier selection
          </small>
        </div>
        <div class="card-body" id="shipping-form-body">
          <div class="loading-spinner">Loading…</div>
        </div>
      </div>

      <!-- Tab: Origin & Defaults -->
      <div class="shipping-tab-content" data-tab="origin" style="display:none;">
        <div class="card-header">
          <span class="card-title">Default Shipping Origin</span>
        </div>
        <div class="card-body">
          <p style="font-size:13px;color:var(--text-muted);margin-top:0;">
            This is the <strong>store / warehouse city</strong> used as the origin for all shipping cost calculations.
            Search and select a city — the ID will be set automatically.
          </p>

          <!-- City search -->
          <div class="form-group" style="max-width:480px;position:relative;">
            <label class="form-label">Search Origin City</label>
            <div style="display:flex;gap:8px;">
              <input class="form-control" type="text" id="shipping-city-search"
                placeholder="Type city name, e.g. Surabaya…"
                oninput="_onCitySearchInput(this.value)"
                autocomplete="off" />
              <button class="btn btn-secondary" onclick="_searchCities()" style="white-space:nowrap;">🔍 Search</button>
            </div>
            <div id="shipping-city-dropdown" style="
              display:none;position:absolute;left:0;right:0;top:100%;z-index:999;
              background:var(--card-bg,#fff);border:1px solid var(--border);border-radius:8px;
              box-shadow:0 4px 16px rgba(0,0,0,.12);max-height:220px;overflow-y:auto;margin-top:2px;">
            </div>
          </div>

          <!-- Selected city display -->
          <div id="shipping-origin-selected" style="display:none;max-width:480px;
            padding:10px 14px;border:2px solid #059669;border-radius:8px;margin-bottom:14px;
            background:var(--success-bg,#f0fdf4);">
            <div style="font-size:12px;color:var(--text-muted);margin-bottom:2px;">Selected Origin City</div>
            <div style="font-weight:600;font-size:14px;" id="shipping-origin-display">—</div>
            <div style="font-size:11px;color:var(--text-muted);margin-top:2px;">
              City ID: <code id="shipping-origin-id-display">—</code>
            </div>
          </div>

          <!-- Hidden fields carrying the actual values -->
          <input type="hidden" id="shipping-origin-name" />
          <input type="hidden" id="shipping-origin-id" />

          <div class="form-group" style="max-width:300px;">
            <label class="form-label">Default Package Weight (grams)</label>
            <input class="form-control" type="number" id="shipping-weight"
              placeholder="1000" min="1" max="30000" />
            <small style="color:var(--text-muted);font-size:11.5px;">Used when item weight is unknown. Default: 1000g (1 kg).</small>
          </div>
          <button class="btn btn-primary" onclick="_saveShippingOrigin()">Save Origin Settings</button>
        </div>
      </div>

      <!-- Tab: Intent Rules -->
      <div class="shipping-tab-content" data-tab="intent" style="display:none;">
        <div class="card-header">
          <span class="card-title">Shipping — Intent Trigger Rules</span>
        </div>
        <div class="card-body" id="shippingIntentRulesContainer"></div>
      </div>

      <!-- Tab: Help -->
      <div class="shipping-tab-content" data-tab="help" style="display:none;">
        <div class="card-header">
          <span class="card-title">Provider Reference</span>
        </div>
        <div class="card-body">
          ${_shippingProviderReference()}
        </div>
      </div>
    </div>
  `;

  await _loadShippingSettings();
  
  // Render intent rules in its container
  const intentContainer = document.getElementById('shippingIntentRulesContainer');
  if (intentContainer) {
    intentContainer.innerHTML = `
      <p style="font-size:13px;color:var(--text-muted);margin:0 0 12px;">
        These keywords guide the AI intent classifier to recognise
        <strong>shipping</strong>-related queries.
        Click <strong>×</strong> on a tag to remove it. Type a keyword below and press
        <kbd style="font-size:11px;padding:1px 5px;border:1px solid var(--border);border-radius:3px;">Enter</kbd>
        or <kbd style="font-size:11px;padding:1px 5px;border:1px solid var(--border);border-radius:3px;">,</kbd>
        to add. Changes take effect immediately — no restart required.
      </p>

      <div id="intentChips_shipping" onclick="_intentFocusInput('intentKwInput_shipping')" style="
        display:flex;flex-wrap:wrap;gap:6px;align-items:center;
        min-height:44px;padding:8px 10px;
        border:1px solid var(--border);border-radius:8px;
        background:var(--card-bg,#fff);cursor:text;
      ">
        <input
          id="intentKwInput_shipping"
          type="text"
          placeholder="Add keyword…"
          autocomplete="off"
          style="
            border:none;outline:none;background:transparent;
            font-size:13px;min-width:140px;flex:1;padding:2px 4px;
            color:var(--text-primary);
          "
          onkeydown="_intentInputKeydown(event,'shipping','intentChips_shipping','intentKwInput_shipping')"
          onblur="_intentInputBlur('shipping','intentChips_shipping','intentKwInput_shipping')"
        />
      </div>
      <small style="color:var(--text-muted);font-size:12px;margin-top:4px;display:block;">
        Press <strong>Enter</strong> or <strong>,</strong> to confirm. Backspace on empty input removes the last tag.
      </small>

      <div style="display:flex;align-items:center;gap:12px;margin-top:14px;">
        <button class="btn btn-primary btn-sm" onclick="_saveIntentRules('shipping','intentRulesStatus_shipping')">
          💾 Save Keywords
        </button>
        <button class="btn btn-secondary btn-sm" onclick="_resetIntentRules('shipping','intentChips_shipping','intentKwInput_shipping','intentRulesStatus_shipping')">
          ↩ Reset to Default
        </button>
        <span id="intentRulesStatus_shipping" style="font-size:12px;color:var(--text-muted);"></span>
      </div>
    `;
    _loadIntentRules('shipping', 'intentChips_shipping', 'intentKwInput_shipping');
  }
}

// ── Load & render form ────────────────────────────────────────────────────────

async function _loadShippingSettings() {
  try {
    const [data, keyData] = await Promise.all([
      adminFetch('/settings/shipping'),
      adminFetch('/settings/shipping/apikey').catch(() => null),
    ]);
    if (keyData?.api_key) window._shippingApiKeyForCitySearch = keyData.api_key;
    _renderShippingForm(data);
  } catch (e) {
    document.getElementById('shipping-form-body').innerHTML =
      `<p style="color:var(--danger);">Failed to load shipping settings: ${e.message}</p>`;
  }
}

function _renderShippingForm(data) {
  const provider = data.shipping_api_provider || 'rajaongkir';
  const keySet = data.shipping_api_key_set;
  const keyMasked = data.shipping_api_key_masked || '';
  const selectedCouriers = (data.shipping_couriers || '').split(':').filter(c => c);

  // All available couriers for RajaOngkir
  const allCouriers = [
    { code: 'jne', name: 'JNE' },
    { code: 'tiki', name: 'TIKI' },
    { code: 'pos', name: 'POS Indonesia' },
    { code: 'jnt', name: 'J&T Express' },
    { code: 'sicepat', name: 'SiCepat' },
    { code: 'anteraja', name: 'AnterAja' },
    { code: 'wahana', name: 'Wahana' },
    { code: 'lion', name: 'Lion Parcel' },
    { code: 'ninja', name: 'Ninja Xpress' },
    { code: 'ide', name: 'ID Express' },
    { code: 'sap', name: 'SAP Express' },
    { code: 'ncs', name: 'NCS' },
    { code: 'rex', name: 'REX' },
    { code: 'rpx', name: 'RPX' },
    { code: 'sentral', name: 'Sentral Cargo' },
    { code: 'star', name: 'Star Cargo' },
    { code: 'dse', name: 'DSE' },
  ];

  const courierCheckboxes = allCouriers.map(c => {
    const checked = selectedCouriers.includes(c.code) ? 'checked' : '';
    return `
      <label style="display:flex;align-items:center;gap:8px;padding:6px 10px;border:1px solid var(--border);
        border-radius:6px;cursor:pointer;background:var(--card-bg,#fff);transition:all 0.15s;
        ${checked ? 'background:var(--primary-light,#e0f2fe);border-color:var(--primary,#0ea5e9);' : ''}">
        <input type="checkbox" value="${c.code}" ${checked} 
          onchange="_toggleCourierHighlight(this)"
          style="cursor:pointer;width:16px;height:16px;">
        <span style="font-size:13px;font-weight:500;">${c.name}</span>
        <span style="font-size:11px;color:var(--text-muted);margin-left:auto;">${c.code}</span>
      </label>
    `;
  }).join('');

  document.getElementById('shipping-form-body').innerHTML = `
    <div style="display:flex;flex-direction:column;gap:16px;max-width:560px;">

      <div class="form-group">
        <label class="form-label">API Provider</label>
        <select class="form-control" id="shipping-provider" style="max-width:240px;">
          <option value="rajaongkir" ${provider === 'rajaongkir' ? 'selected' : ''}>Raja Ongkir</option>
          <option value="biteship" ${provider === 'biteship' ? 'selected' : ''} disabled>Biteship (not tested yet)</option>
        </select>
      </div>

      <div class="form-group">
        <label class="form-label">API Key</label>
        <div style="display:flex;gap:8px;align-items:center;">
          <input class="form-control" type="password" id="shipping-api-key"
            placeholder="${keySet ? 'Leave blank to keep existing key' : 'Paste your API key here'}"
            style="max-width:380px;" />
          ${keySet ? `<span style="font-size:12px;color:var(--text-muted);">Current: <code>${keyMasked}</code></span>` : ''}
        </div>
        <small style="color:var(--text-muted);font-size:11.5px;">
          ${keySet ? '✅ API key is configured.' : '⚠️ No API key set. Shipping queries will not work.'}
        </small>
      </div>

      <div class="form-group">
        <label class="form-label">Selected Couriers</label>
        <p style="font-size:12px;color:var(--text-muted);margin:4px 0 10px;">
          Choose which couriers to query when calculating shipping costs. 
          <strong>Note:</strong> More couriers = slower response times. Recommended: 3-5 couriers.
        </p>
        <div style="display:flex;gap:6px;margin-bottom:10px;">
          <button class="btn btn-secondary btn-sm" onclick="_selectAllCouriers()" type="button">
            ✓ Select All
          </button>
          <button class="btn btn-secondary btn-sm" onclick="_deselectAllCouriers()" type="button">
            ✗ Deselect All
          </button>
        </div>
        <div id="courier-checkboxes" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:8px;">
          ${courierCheckboxes}
        </div>
        <small style="display:block;margin-top:8px;font-size:11.5px;color:var(--text-muted);">
          Selected: <strong id="courier-count">${selectedCouriers.length}</strong> couriers
        </small>
      </div>

      <button class="btn btn-primary" onclick="_saveShippingCredentials()" style="align-self:flex-start;">
        Save API Settings
      </button>
    </div>
  `;

  // Populate origin fields
  document.getElementById('shipping-origin-name').value = data.shipping_origin_city_name || '';
  document.getElementById('shipping-origin-id').value = data.shipping_origin_city_id || '';
  document.getElementById('shipping-weight').value = data.shipping_default_weight_grams || 1000;

  // Show saved city if present
  if (data.shipping_origin_city_name && data.shipping_origin_city_id) {
    _selectCity({
      city_name: data.shipping_origin_city_name,
      city_id: data.shipping_origin_city_id,
      display: data.shipping_origin_city_name,
    }, false);
  }
}

// ── Handlers ──────────────────────────────────────────────────────────────────

async function _saveShippingCredentials() {
  const provider = document.getElementById('shipping-provider').value;
  const apiKey = document.getElementById('shipping-api-key').value.trim();
  
  // Collect selected couriers
  const checkboxes = document.querySelectorAll('#courier-checkboxes input[type="checkbox"]:checked');
  const selectedCouriers = Array.from(checkboxes).map(cb => cb.value).join(':');

  const payload = { shipping_api_provider: provider };
  if (apiKey) payload.shipping_api_key = apiKey;
  if (selectedCouriers) payload.shipping_couriers = selectedCouriers;

  try {
    const data = await adminFetch('/settings/shipping', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    // Refresh cached raw key for browser-side city lookup
    const keyData = await adminFetch('/settings/shipping/apikey').catch(() => null);
    if (keyData?.api_key) window._shippingApiKeyForCitySearch = keyData.api_key;
    _renderShippingForm(data);
    _showShippingAlert('API settings saved.', 'success');
  } catch (e) {
    _showShippingAlert(`Failed: ${e.message}`, 'error');
  }
}

async function _saveShippingOrigin() {
  const name = document.getElementById('shipping-origin-name').value.trim();
  const cityId = document.getElementById('shipping-origin-id').value.trim();
  const weight = parseInt(document.getElementById('shipping-weight').value, 10);

  if (!name || !cityId) {
    _showShippingAlert('Please fill in both City Name and City ID.', 'error');
    return;
  }
  if (!weight || weight < 1) {
    _showShippingAlert('Weight must be at least 1 gram.', 'error');
    return;
  }

  try {
    await adminFetch('/settings/shipping', {
      method: 'PUT',
      body: JSON.stringify({
        shipping_origin_city_name: name,
        shipping_origin_city_id: cityId,
        shipping_default_weight_grams: weight,
      }),
    });
    _showShippingAlert(`Origin saved: ${name} (ID: ${cityId}).`, 'success');
  } catch (e) {
    _showShippingAlert(`Failed: ${e.message}`, 'error');
  }
}

// ── City search ──────────────────────────────────────────────────────────────

let _citySearchTimer = null;

function _onCitySearchInput(val) {
  clearTimeout(_citySearchTimer);
  if (val.length < 2) {
    _hideCityDropdown();
    return;
  }
  _citySearchTimer = setTimeout(() => _searchCities(val), 350);
}

async function _searchCities(q) {
  q = q || document.getElementById('shipping-city-search').value.trim();
  if (!q) return;
  const dd = document.getElementById('shipping-city-dropdown');
  dd.style.display = 'block';
  dd.innerHTML = '<div style="padding:10px 14px;color:var(--text-muted);font-size:13px;">Searching…</div>';
  try {
    const data = await adminFetch(`/settings/shipping/cities?q=${encodeURIComponent(q)}`);
    const cities = data.cities || [];
    if (!cities.length) {
      dd.innerHTML = '<div style="padding:10px 14px;color:var(--text-muted);font-size:13px;">No cities found.</div>';
      return;
    }
    dd.innerHTML = cities.map(c => `
      <div class="city-option" onclick="_selectCity(${JSON.stringify(c).replace(/"/g, '&quot;')})" style="
        padding:9px 14px;cursor:pointer;font-size:13px;border-bottom:1px solid var(--border);
        transition:background .15s;" onmouseover="this.style.background='var(--hover-bg,#f5f7fa)'" onmouseout="this.style.background=''"
      >
        <div style="font-weight:600;">${c.type ? c.type + ' ' : ''}${c.city_name}</div>
        <div style="font-size:11px;color:var(--text-muted);">${c.province} &nbsp;·&nbsp; ID: ${c.city_id}</div>
      </div>
    `).join('');
  } catch (e) {
    dd.innerHTML = `<div style="padding:10px 14px;color:var(--danger);font-size:13px;">Error: ${e.message}</div>`;
  }
}

function _selectCity(city, closeDropdown = true) {
  document.getElementById('shipping-origin-name').value = city.city_name;
  document.getElementById('shipping-origin-id').value = city.city_id;

  const panel = document.getElementById('shipping-origin-selected');
  panel.style.display = 'block';
  document.getElementById('shipping-origin-display').textContent = city.display || `${city.type ? city.type + ' ' : ''}${city.city_name}`;
  document.getElementById('shipping-origin-id-display').textContent = city.city_id;

  if (closeDropdown) {
    _hideCityDropdown();
    document.getElementById('shipping-city-search').value = '';
  }
}

function _hideCityDropdown() {
  const dd = document.getElementById('shipping-city-dropdown');
  if (dd) dd.style.display = 'none';
}

// Close dropdown when clicking outside
document.addEventListener('click', e => {
  if (!e.target.closest('#shipping-city-search') && !e.target.closest('#shipping-city-dropdown')) {
    _hideCityDropdown();
  }
});

function _showShippingAlert(msg, type) {
  const el = document.getElementById('shipping-alert');
  el.className = `alert alert-${type === 'success' ? 'success' : 'danger'}`;
  el.textContent = msg;
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 4000);
}

// ── Provider reference card ───────────────────────────────────────────────────

function _shippingProviderReference() {
  const th = `style="background:#f0f4ff;padding:8px 12px;text-align:left;border:1px solid #dde3f0;white-space:nowrap;"`;
  const td = `style="padding:7px 12px;border:1px solid #dde3f0;vertical-align:top;font-size:13px;"`;
  return `
    <table style="border-collapse:collapse;width:100%;font-size:13px;margin-bottom:16px;">
      <thead>
        <tr>
          <th ${th}>Provider</th>
          <th ${th}>Free Tier</th>
          <th ${th}>Couriers Covered</th>
          <th ${th}>Docs / Registration</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td ${td}><strong>Raja Ongkir</strong> Recommended</td>
          <td ${td}>Free starter (JNE, TIKI, POS)</td>
          <td ${td}>30+ couriers on paid plans (J&amp;T, SiCepat, Anteraja, etc.)</td>
          <td ${td}><a href="https://rajaongkir.com" target="_blank">rajaongkir.com</a></td>
        </tr>
        <tr>
          <td ${td}><strong>Biteship</strong></td>
          <td ${td}>Developer sandbox</td>
          <td ${td}>Instant, same-day, regular — multi-courier</td>
          <td ${td}><a href="https://biteship.com/id/docs" target="_blank">biteship.com/id/docs</a></td>
        </tr>
      </tbody>
    </table>
  `;
}

// ── Courier selection helpers ─────────────────────────────────────────────────

function _toggleCourierHighlight(checkbox) {
  const label = checkbox.parentElement;
  if (checkbox.checked) {
    label.style.background = 'var(--primary-light,#e0f2fe)';
    label.style.borderColor = 'var(--primary,#0ea5e9)';
  } else {
    label.style.background = 'var(--card-bg,#fff)';
    label.style.borderColor = 'var(--border)';
  }
  _updateCourierCount();
}

function _selectAllCouriers() {
  const checkboxes = document.querySelectorAll('#courier-checkboxes input[type="checkbox"]');
  checkboxes.forEach(cb => {
    cb.checked = true;
    _toggleCourierHighlight(cb);
  });
}

function _deselectAllCouriers() {
  const checkboxes = document.querySelectorAll('#courier-checkboxes input[type="checkbox"]');
  checkboxes.forEach(cb => {
    cb.checked = false;
    _toggleCourierHighlight(cb);
  });
}

function _updateCourierCount() {
  const count = document.querySelectorAll('#courier-checkboxes input[type="checkbox"]:checked').length;
  const countEl = document.getElementById('courier-count');
  if (countEl) countEl.textContent = count;
}

// ── Tab switching ─────────────────────────────────────────────────────────────

function _switchShippingTab(tabName) {
  // Update tab buttons
  document.querySelectorAll('.shipping-tab').forEach(btn => {
    if (btn.dataset.tab === tabName) {
      btn.classList.add('active');
      btn.style.color = 'var(--primary,#0ea5e9)';
      btn.style.borderBottomColor = 'var(--primary,#0ea5e9)';
      btn.style.fontWeight = '600';
    } else {
      btn.classList.remove('active');
      btn.style.color = 'var(--text-muted)';
      btn.style.borderBottomColor = 'transparent';
      btn.style.fontWeight = '500';
    }
  });

  // Update tab content visibility
  document.querySelectorAll('.shipping-tab-content').forEach(content => {
    content.style.display = content.dataset.tab === tabName ? 'block' : 'none';
  });
}

