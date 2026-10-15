/**
 * searchinsights.js — Word cloud visualization of search queries
 */

let _insightsPeriod = 30;

async function renderSearchInsights() {
  const body = document.getElementById('pageBody');
  body.innerHTML = `
    <div style="max-width:1400px;margin:0 auto;">
      <!-- Header Section -->
      <div style="margin-bottom:32px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
          <div>
            <h1 style="font-size:28px;font-weight:700;margin:0 0 8px 0;color:var(--text);">Search Insights</h1>
            <p style="margin:0;color:var(--text-muted);font-size:14px;">Visualize popular search terms and trending topics</p>
          </div>
          <div style="display:flex;gap:12px;align-items:center;">
            <select class="form-control" id="periodSelector" style="width:160px;height:40px;font-size:14px;" onchange="onInsightsPeriodChange(this.value)">
              <option value="7">Last 7 Days</option>
              <option value="14">Last 14 Days</option>
              <option value="30" selected>Last 30 Days</option>
              <option value="60">Last 60 Days</option>
              <option value="90">Last 90 Days</option>
            </select>
            <button class="btn btn-primary" style="height:40px;padding:0 20px;" onclick="loadSearchInsights()">Refresh</button>
          </div>
        </div>
      </div>

      <!-- Summary Stats -->
      <div id="insightsSummary" style="margin-bottom:32px;"></div>

      <!-- Word Cloud Section -->
      <div style="background:var(--card-bg);border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,0.1);overflow:hidden;">
        <div style="padding:24px 24px 16px 24px;border-bottom:1px solid #f0f0f0;">
          <h2 style="font-size:18px;font-weight:600;margin:0;color:var(--text);">Popular Search Terms</h2>
          <p style="margin:4px 0 0 0;font-size:13px;color:var(--text-muted);">Size represents search frequency</p>
        </div>
        <div style="padding:40px;min-height:500px;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%);">
          <canvas id="wordCloudCanvas" width="2000" height="1000" style="width:100%;max-width:1000px;height:500px;"></canvas>
        </div>
      </div>

      <!-- Top Queries Table -->
      <div style="background:var(--card-bg);border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,0.1);overflow:hidden;margin-top:24px;">
        <div style="padding:24px 24px 16px 24px;border-bottom:1px solid #f0f0f0;">
          <h2 style="font-size:18px;font-weight:600;margin:0;color:var(--text);">Top Search Queries</h2>
          <p style="margin:4px 0 0 0;font-size:13px;color:var(--text-muted);">Most frequent queries in selected period</p>
        </div>
        <div style="padding:24px;">
          <table id="topQueriesTable" style="width:100%;border-collapse:collapse;">
            <thead>
              <tr style="border-bottom:2px solid #e5e7eb;">
                <th style="padding:12px;text-align:left;font-size:13px;font-weight:600;color:var(--text-muted);">Rank</th>
                <th style="padding:12px;text-align:left;font-size:13px;font-weight:600;color:var(--text-muted);">Query</th>
                <th style="padding:12px;text-align:right;font-size:13px;font-weight:600;color:var(--text-muted);">Count</th>
                <th style="padding:12px;text-align:right;font-size:13px;font-weight:600;color:var(--text-muted);">Percentage</th>
              </tr>
            </thead>
            <tbody id="topQueriesBody">
              <tr><td colspan="4" style="padding:24px;text-align:center;color:var(--text-muted);">Loading...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
  
  await loadSearchInsights();
}

async function loadSearchInsights() {
  try {
    const data = await adminFetch(`/searchinsights?days=${_insightsPeriod}`);
    
    // Update summary stats
    renderInsightsSummary(data.summary);
    
    // Render word cloud
    renderWordCloud(data.word_frequencies);
    
    // Render top queries table
    renderTopQueriesTable(data.top_queries);
    
  } catch (err) {
    showToast('Failed to load search insights: ' + err.message, 'error');
  }
}

function renderInsightsSummary(summary) {
  const container = document.getElementById('insightsSummary');
  if (!container) return;
  
  container.innerHTML = `
    <div style="background:var(--card-bg);border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,0.1);padding:32px;margin-bottom:0;">
      <div style="display:flex;gap:48px;align-items:center;justify-content:space-between;">
        ${createInsightMetric('Total Searches', summary.total_queries, '#BB86FC')}
        <div style="width:1px;height:60px;background:#e5e7eb;"></div>
        ${createInsightMetric('Unique Terms', summary.unique_words, '#8b5cf6')}
        <div style="width:1px;height:60px;background:#e5e7eb;"></div>
        ${createInsightMetric('Avg Words/Query', summary.avg_words_per_query, '#10b981')}
        <div style="width:1px;height:60px;background:#e5e7eb;"></div>
        ${createInsightMetric('Unique Queries', summary.unique_queries, '#f59e0b')}
      </div>
    </div>
  `;
}

function createInsightMetric(label, value, color) {
  return `
    <div style="flex:1;text-align:center;">
      <div style="font-size:13px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">${label}</div>
      <div style="font-size:36px;font-weight:700;color:${color};margin-bottom:6px;">${value}</div>
    </div>
  `;
}

function renderWordCloud(wordFrequencies) {
  const canvas = document.getElementById('wordCloudCanvas');
  if (!canvas || !wordFrequencies || wordFrequencies.length === 0) {
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.font = '24px Inter, -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillStyle = '#9ca3af';
      ctx.textAlign = 'center';
      ctx.fillText('No search data available for this period', canvas.width / 2, canvas.height / 2);
    }
    return;
  }
  
  // Clear canvas before redrawing
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Convert to wordcloud2.js format: [[word, weight], ...]
  const list = wordFrequencies.map(item => [item.word, item.weight]);
  
  // Generate color based on weight
  const maxWeight = Math.max(...wordFrequencies.map(w => w.weight));
  
  WordCloud(canvas, {
    list: list,
    gridSize: 6,
    weightFactor: function(size) {
      // Scale weight to font size - using canvas actual size (2000x1000)
      return Math.pow(size / maxWeight, 0.5) * 120 + 20;
    },
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif',
    fontWeight: '600',
    color: function(word, weight) {
      // Color gradient based on weight
      const intensity = weight / maxWeight;
      if (intensity > 0.7) return '#9b59f5'; // Purple
      if (intensity > 0.5) return '#7c3aed'; // Purple
      if (intensity > 0.3) return '#059669'; // Green
      if (intensity > 0.15) return '#d97706'; // Orange
      return '#6b7280'; // Gray
    },
    rotateRatio: 0.2,
    rotationSteps: 2,
    backgroundColor: 'transparent',
    minSize: 20,
    drawOutOfBound: false,
    shrinkToFit: true,
    clearCanvas: true,
    click: function(item) {
      if (item) {
        showToast(`"${item[0]}" appears ${item[1]} times`, 'info');
      }
    },
    hover: function(item, dimension, event) {
      if (item) {
        canvas.style.cursor = 'pointer';
      } else {
        canvas.style.cursor = 'default';
      }
    }
  });
}

function renderTopQueriesTable(topQueries) {
  const tbody = document.getElementById('topQueriesBody');
  if (!tbody) return;
  
  if (!topQueries || topQueries.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" style="padding:24px;text-align:center;color:var(--text-muted);">
          No queries found for this period
        </td>
      </tr>
    `;
    return;
  }
  
  const totalCount = topQueries.reduce((sum, q) => sum + q.count, 0);
  
  tbody.innerHTML = topQueries.map((query, index) => {
    const percentage = ((query.count / totalCount) * 100).toFixed(1);
    const rankColor = index < 3 ? '#BB86FC' : '#6b7280';
    
    return `
      <tr style="border-bottom:1px solid #f0f0f0;">
        <td style="padding:12px;font-weight:600;color:${rankColor};">#${index + 1}</td>
        <td style="padding:12px;color:var(--text);">${esc(query.query)}</td>
        <td style="padding:12px;text-align:right;font-weight:600;color:var(--text);">${query.count}</td>
        <td style="padding:12px;text-align:right;color:var(--text-muted);">
          <div style="display:inline-flex;align-items:center;gap:8px;">
            <div style="width:60px;height:6px;background:#e5e7eb;border-radius:3px;overflow:hidden;">
              <div style="width:${percentage}%;height:100%;background:#BB86FC;"></div>
            </div>
            ${percentage}%
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function onInsightsPeriodChange(days) {
  _insightsPeriod = parseInt(days);
  loadSearchInsights();
}

// Helper function for escaping HTML (reuse from other files)
if (typeof esc === 'undefined') {
  function esc(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  }
}
