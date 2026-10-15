/**
 * features.js — Feature Management Overview
 */

async function renderFeatures() {
  const body = document.getElementById('pageBody');
  
  // Fetch settings to check which features are enabled
  let featuresData = {
    pricing_enabled: true,
    specs_enabled: true,
    financing_enabled: true,
    shipping_enabled: true,
    summarizer_enabled: true,
  };

  try {
    const settings = await adminFetch('/settings/llm');
    featuresData = {
      pricing_enabled: settings.pricing_enabled !== false,
      specs_enabled: settings.specs_enabled !== false,
      financing_enabled: settings.financing_enabled !== false,
      shipping_enabled: settings.shipping_enabled !== false,
      summarizer_enabled: settings.summarizer_enabled !== false,
    };
  } catch (err) {
    console.error('Failed to load feature status:', err);
  }

  body.innerHTML = `
    <div style="max-width:1200px;margin:0 auto;">
      <div class="card">
        <div class="card-header">
          <div style="font-size:13px;color:var(--text-muted);font-weight:400;">
            Manage and monitor the status of data source features. Each feature can be enabled or disabled from the AI Engine settings.
          </div>
        </div>
        <div class="card-body">
          <div style="display:grid;grid-template-columns:repeat(2, 1fr);gap:16px;">
            ${createFeatureCard(
              'Pricing Database',
              'pricing',
              'pricing',
              featuresData.pricing_enabled,
              'Stores product pricing information including base prices, discounts, and promotional offers.',
              'Example: User asks "Berapa harga Toyota Avanza?" → System queries pricing DB for Avanza price data'
            )}
            
            ${createFeatureCard(
              'Product Specifications',
              'productspecs',
              'specs',
              featuresData.specs_enabled,
              'Contains detailed product specifications such as dimensions, engine specs, features, and technical details.',
              'Example: User asks "What are the specs of Honda CR-V?" → System retrieves CR-V specifications from specs DB'
            )}
            
            ${createFeatureCard(
              'Repayment Calculator',
              'financing',
              'financing',
              featuresData.financing_enabled,
              'Provides financing options and installment calculations based on product price, down payment, and loan terms.',
              'Example: User asks "Cicilan motor 20 juta DP 5 juta?" → System calculates monthly installments using financing DB'
            )}
            
            ${createFeatureCard(
              'Shipping Settings',
              'shipping',
              'shipping',
              featuresData.shipping_enabled,
              'Manages shipping cost calculations, delivery options, and logistics partner integrations.',
              'Example: User asks "Ongkir ke Jakarta?" → System calculates shipping costs using shipping API'
            )}
            
            ${createFeatureCard(
              'Custom API Intents',
              'customapi',
              'customapi',
              true,
              'Define custom intents that route user queries to external APIs. Create flexible integrations with third-party services.',
              'Example: User asks "Check stock for Toyota Avanza" → System calls your inventory API and returns real-time stock data'
            )}

            ${createFeatureCard(
              'Document Summarizer',
              'summarizer-feature',
              'summarizer',
              featuresData.summarizer_enabled,
              'Route summarization requests via intent router. Pass a doc_id to /api/chat or /api/query with a summarization phrase — the system loads all chunks and produces a comprehensive AI summary.',
              'Example: POST /api/query {query: "Summarize this document", doc_id: "WNJ.V09.i2"} → AI summary of the full document'
            )}
          </div>
          
          <div style="margin-top:24px;padding:14px;background:var(--card-bg);border:2px solid var(--border);border-radius:10px;">
            <div style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:8px;">💡 How Feature Routing Works</div>
            <div style="font-size:12px;color:var(--text-muted);line-height:1.6;">
              When a feature is <strong>enabled</strong>, the AI automatically routes relevant queries to that data source. 
              When <strong>disabled</strong>, those queries fall back to the Knowledge Base for general responses. 
              You can toggle feature status in <a href="#settings" style="color:var(--primary);text-decoration:none;font-weight:600;">AI Engine Settings</a>.
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function createFeatureCard(title, page, iconType, enabled, description, example) {
  const statusText = enabled
    ? '<span style="font-size:12px;font-weight:400;color:#15803d;">Enabled</span>'
    : '<span style="font-size:12px;font-weight:400;color:#dc2626;">Disabled</span>';

  const icon = getFeatureIcon(iconType);
  
  return `
      <div style="padding:18px;border:1.5px solid var(--border);border-radius:14px;background:var(--card-bg);min-height:260px;display:flex;flex-direction:column;transition:border-color 0.2s, transform 0.2s, box-shadow 0.2s;box-shadow:var(--shadow);"
        onmouseenter="this.style.borderColor='var(--primary)';this.style.transform='translateY(-2px)';this.style.boxShadow='var(--shadow-md)'" 
        onmouseleave="this.style.borderColor='var(--border)';this.style.transform='translateY(0)';this.style.boxShadow='var(--shadow)'">
      <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:12px;">
        <div style="display:flex;align-items:center;gap:12px;">
          <div style="width:52px;height:52px;border:2px solid var(--border);border-radius:12px;display:flex;align-items:center;justify-content:center;background:var(--bg);color:var(--text);">
            ${icon}
          </div>
          <div style="display:flex;flex-direction:column;gap:4px;">
            <div style="font-size:16px;font-weight:600;color:var(--text);line-height:1.2;">${title}</div>
            <div style="font-size:12px;color:var(--text-muted);">Feature module</div>
          </div>
        </div>
        ${statusText}
      </div>
      
      <div style="font-size:13px;color:var(--text-muted);line-height:1.6;margin-bottom:10px;">
        ${description}
      </div>
      
      <div style="font-size:12px;color:var(--text-muted);line-height:1.5;margin-bottom:16px;">
        <strong style="color:var(--text);font-weight:600;">Usage Example:</strong>
        ${example}
      </div>

      <div style="display:flex;justify-content:flex-end;align-items:center;margin-top:auto;">
        <button class="btn btn-secondary btn-sm" onclick="navigate('${page}')"
                style="display:inline-flex;align-items:center;gap:6px;border-radius:10px;padding:7px 13px;font-weight:500;white-space:nowrap;border-width:1.5px;">
          Open Manager
          <span style="font-size:13px;line-height:1;">→</span>
        </button>
      </div>
    </div>
  `;
}

function getFeatureIcon(iconType) {
  switch (iconType) {
    case 'pricing':
      return '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M7 4V20" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M16 4V20" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M4 8H20" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M4 16H20" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
    case 'specs':
      return '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect x="5" y="3" width="14" height="18" rx="2" stroke="currentColor" stroke-width="2"/><path d="M9 8H15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M9 12H15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M9 16H13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
    case 'financing':
      return '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect x="5" y="3" width="14" height="18" rx="2" stroke="currentColor" stroke-width="2"/><path d="M8 8H16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M9 12H9.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M12 12H12.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M15 12H15.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M9 16H9.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M12 16H12.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M15 16H15.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
    case 'shipping':
      return '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M3 7H14V16H3V7Z" stroke="currentColor" stroke-width="2"/><path d="M14 10H18L21 13V16H14V10Z" stroke="currentColor" stroke-width="2"/><circle cx="7.5" cy="17.5" r="1.5" stroke="currentColor" stroke-width="2"/><circle cx="17.5" cy="17.5" r="1.5" stroke="currentColor" stroke-width="2"/></svg>';
    case 'customapi':
      return '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M8 3L4 7L8 11" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M16 3L20 7L16 11" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 3L10 21" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    case 'summarizer':
      return '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect x="5" y="3" width="14" height="18" rx="2" stroke="currentColor" stroke-width="2"/><path d="M9 7H15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M9 11H15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M9 15H12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="17" cy="17" r="4" fill="var(--card-bg)" stroke="currentColor" stroke-width="1.5"/><path d="M15.5 17H18.5M17 15.5V18.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
    default:
      return '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="2"/></svg>';
  }
}
