/**
 * useranalytics.js — User Analytics Dashboard
 */

let _browserChart = null;
let _osChart = null;
let _osVersionChart = null;
let _deviceChart = null;
let _locationChart = null;

async function renderUserAnalytics() {
  const body = document.getElementById('pageBody');
  body.innerHTML = `
    <div style="max-width:1400px;margin:0 auto;">
      <!-- Header Section -->
      <div style="margin-bottom:32px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
          <div>
            <h1 style="font-size:28px;font-weight:700;margin:0 0 8px 0;color:var(--text);">User Analytics</h1>
            <p style="margin:0;color:var(--text-muted);font-size:14px;">Analyze user demographics and behavior patterns</p>
          </div>
          <button class="btn btn-primary" style="height:40px;padding:0 20px;" onclick="loadUserAnalytics()">Refresh</button>
        </div>
      </div>

      <!-- Summary Stats -->
      <div id="userSummary" style="margin-bottom:32px;"></div>

      <!-- Charts Grid -->
      <div style="display:grid;gap:24px;">
        <!-- First Row: Browser & OS -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;">
          <!-- Browser Distribution -->
          <div style="background:var(--card-bg);border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,0.1);overflow:hidden;">
            <div style="padding:24px 24px 16px 24px;border-bottom:1px solid #f0f0f0;">
              <h2 style="font-size:18px;font-weight:600;margin:0;color:var(--text);">Browser Distribution</h2>
              <p style="margin:4px 0 0 0;font-size:13px;color:var(--text-muted);">User browser preferences</p>
            </div>
            <div style="padding:24px;">
              <canvas id="browserChart" style="max-height:280px;"></canvas>
            </div>
          </div>

          <!-- OS Distribution -->
          <div style="background:var(--card-bg);border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,0.1);overflow:hidden;">
            <div style="padding:24px 24px 16px 24px;border-bottom:1px solid #f0f0f0;">
              <h2 style="font-size:18px;font-weight:600;margin:0;color:var(--text);">Operating System</h2>
              <p style="margin:4px 0 0 0;font-size:13px;color:var(--text-muted);">OS type distribution</p>
            </div>
            <div style="padding:24px;">
              <canvas id="osChart" style="max-height:280px;"></canvas>
            </div>
          </div>
        </div>

        <!-- Second Row: OS Version & Device -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;">
          <!-- OS Version Distribution -->
          <div style="background:var(--card-bg);border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,0.1);overflow:hidden;">
            <div style="padding:24px 24px 16px 24px;border-bottom:1px solid #f0f0f0;">
              <h2 style="font-size:18px;font-weight:600;margin:0;color:var(--text);">OS Version Breakdown</h2>
              <p style="margin:4px 0 0 0;font-size:13px;color:var(--text-muted);">Detailed OS version distribution</p>
            </div>
            <div style="padding:24px;">
              <canvas id="osVersionChart" style="max-height:280px;"></canvas>
            </div>
          </div>

          <!-- Device Type Distribution -->
          <div style="background:var(--card-bg);border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,0.1);overflow:hidden;">
            <div style="padding:24px 24px 16px 24px;border-bottom:1px solid #f0f0f0;">
              <h2 style="font-size:18px;font-weight:600;margin:0;color:var(--text);">Device Types</h2>
              <p style="margin:4px 0 0 0;font-size:13px;color:var(--text-muted);">Desktop, mobile, and tablet usage</p>
            </div>
            <div style="padding:24px;">
              <canvas id="deviceChart" style="max-height:280px;"></canvas>
            </div>
          </div>
        </div>

        <!-- Third Row: Location -->
        <div style="background:var(--card-bg);border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,0.1);overflow:hidden;">
          <div style="padding:24px 24px 16px 24px;border-bottom:1px solid #f0f0f0;">
            <h2 style="font-size:18px;font-weight:600;margin:0;color:var(--text);">Geographic Distribution</h2>
            <p style="margin:4px 0 0 0;font-size:13px;color:var(--text-muted);">User location on world map</p>
          </div>
          <div style="padding:24px;">
            <canvas id="locationChart" style="height:400px;"></canvas>
          </div>
        </div>
      </div>
    </div>
  `;
  
  await loadUserAnalytics();
}

async function loadUserAnalytics() {
  try {
    const data = await adminFetch('/useranalytics');
    
    // Update summary stats
    renderUserSummary(data.summary);
    
    // Render charts
    renderBrowserChart(data.browsers);
    renderOSChart(data.os_types);
    renderOSVersionChart(data.os_versions);
    renderDeviceChart(data.devices);
    renderLocationChart(data.locations);
    
  } catch (err) {
    showToast('Failed to load user analytics: ' + err.message, 'error');
  }
}

function renderUserSummary(summary) {
  const container = document.getElementById('userSummary');
  if (!container) return;
  
  container.innerHTML = `
    <div style="background:var(--card-bg);border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,0.1);padding:32px;margin-bottom:0;">
      <div style="display:flex;gap:48px;align-items:center;justify-content:space-between;">
        ${createUserStatMetric('Total Queries', summary.total_queries, '#BB86FC')}
        <div style="width:1px;height:60px;background:#e5e7eb;"></div>
        ${createUserStatMetric('Unique Browsers', summary.unique_browsers, '#8b5cf6')}
        <div style="width:1px;height:60px;background:#e5e7eb;"></div>
        ${createUserStatMetric('Operating Systems', summary.unique_os, '#10b981')}
        <div style="width:1px;height:60px;background:#e5e7eb;"></div>
        ${createUserStatMetric('Device Types', summary.unique_devices, '#f59e0b')}
      </div>
    </div>
  `;
}

function createUserStatMetric(label, value, color) {
  return `
    <div style="flex:1;text-align:center;">
      <div style="font-size:13px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">${label}</div>
      <div style="font-size:36px;font-weight:700;color:${color};margin-bottom:6px;">${value}</div>
    </div>
  `;
}

function renderBrowserChart(data) {
  const ctx = document.getElementById('browserChart');
  if (!ctx) return;
  
  if (_browserChart) {
    _browserChart.destroy();
  }
  
  const labels = data.map(d => d.browser || 'Unknown');
  const values = data.map(d => d.count);
  
  // Vibrant modern colors inspired by infographic style
  const browserColors = {
    'Chrome': '#FF6B6B',      // Coral Red
    'Safari': '#4ECDC4',      // Turquoise
    'Firefox': '#FFE66D',     // Yellow
    'Edge': '#95E1D3',        // Mint
    'Opera': '#C7CEEA',       // Lavender
    'Unknown': '#B0B0B0'      // Gray
  };
  
  const backgrounds = labels.map(label => browserColors[label] || browserColors['Unknown']);
  
  _browserChart = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: labels,
      datasets: [{
        data: values,
        backgroundColor: backgrounds,
        borderWidth: 8,
        borderColor: '#ffffff',
        hoverOffset: 20,
        hoverBorderWidth: 10,
        offset: labels.map(() => 8)
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      layout: {
        padding: 20
      },
      plugins: {
        legend: {
          position: 'right',
          labels: {
            padding: 20,
            font: {
              size: 14,
              family: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
              weight: '600'
            },
            usePointStyle: true,
            pointStyle: 'rectRounded',
            boxWidth: 20,
            boxHeight: 20,
            generateLabels: function(chart) {
              const data = chart.data;
              if (data.labels.length && data.datasets.length) {
                const total = data.datasets[0].data.reduce((a, b) => a + b, 0);
                return data.labels.map((label, i) => {
                  const value = data.datasets[0].data[i];
                  const percentage = ((value / total) * 100).toFixed(0);
                  return {
                    text: `${label}  ${percentage}%`,
                    fillStyle: data.datasets[0].backgroundColor[i],
                    hidden: false,
                    index: i
                  };
                });
              }
              return [];
            }
          }
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          titleColor: '#fff',
          bodyColor: '#fff',
          padding: 16,
          cornerRadius: 8,
          displayColors: true,
          boxPadding: 8,
          titleFont: {
            size: 14,
            weight: 'bold'
          },
          bodyFont: {
            size: 13
          },
          callbacks: {
            label: function(context) {
              const label = context.label || '';
              const value = context.parsed;
              const total = context.dataset.data.reduce((a, b) => a + b, 0);
              const percentage = ((value / total) * 100).toFixed(1);
              return `${value} queries (${percentage}%)`;
            }
          }
        }
      },
      animation: {
        animateRotate: true,
        animateScale: true,
        duration: 1000,
        easing: 'easeOutBounce'
      }
    },
    plugins: [{
      beforeDraw: function(chart) {
        const ctx = chart.ctx;
        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.15)';
        ctx.shadowBlur = 15;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 8;
        ctx.restore();
      }
    }]
  });
}

function renderOSChart(data) {
  const ctx = document.getElementById('osChart');
  if (!ctx) return;
  
  if (_osChart) {
    _osChart.destroy();
  }
  
  const labels = data.map(d => d.os || 'Unknown');
  const values = data.map(d => d.count);
  
  // Vibrant colors for OS
  const osColors = ['#FF6B6B', '#4ECDC4', '#FFE66D', '#95E1D3', '#C7CEEA', '#FFA07A', '#98D8C8', '#F7DC6F'];
  const backgrounds = labels.map((_, i) => osColors[i % osColors.length]);
  
  _osChart = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: labels,
      datasets: [{
        data: values,
        backgroundColor: backgrounds,
        borderWidth: 8,
        borderColor: '#ffffff',
        hoverOffset: 20,
        hoverBorderWidth: 10,
        offset: labels.map(() => 8)
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      layout: {
        padding: 20
      },
      plugins: {
        legend: {
          position: 'right',
          labels: {
            padding: 20,
            font: {
              size: 14,
              family: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
              weight: '600'
            },
            usePointStyle: true,
            pointStyle: 'rectRounded',
            boxWidth: 20,
            boxHeight: 20,
            generateLabels: function(chart) {
              const data = chart.data;
              if (data.labels.length && data.datasets.length) {
                const total = data.datasets[0].data.reduce((a, b) => a + b, 0);
                return data.labels.map((label, i) => {
                  const value = data.datasets[0].data[i];
                  const percentage = ((value / total) * 100).toFixed(0);
                  return {
                    text: `${label}  ${percentage}%`,
                    fillStyle: data.datasets[0].backgroundColor[i],
                    hidden: false,
                    index: i
                  };
                });
              }
              return [];
            }
          }
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          titleColor: '#fff',
          bodyColor: '#fff',
          padding: 16,
          cornerRadius: 8,
          displayColors: true,
          boxPadding: 8,
          titleFont: {
            size: 14,
            weight: 'bold'
          },
          bodyFont: {
            size: 13
          },
          callbacks: {
            label: function(context) {
              const label = context.label || '';
              const value = context.parsed;
              const total = context.dataset.data.reduce((a, b) => a + b, 0);
              const percentage = ((value / total) * 100).toFixed(1);
              return `${value} queries (${percentage}%)`;
            }
          }
        }
      },
      animation: {
        animateRotate: true,
        animateScale: true,
        duration: 1000,
        easing: 'easeOutBounce'
      }
    },
    plugins: [{
      beforeDraw: function(chart) {
        const ctx = chart.ctx;
        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.15)';
        ctx.shadowBlur = 15;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 8;
        ctx.restore();
      }
    }]
  });
}

function renderOSVersionChart(data) {
  const ctx = document.getElementById('osVersionChart');
  if (!ctx) return;
  
  if (_osVersionChart) {
    _osVersionChart.destroy();
  }
  
  const labels = data.map(d => `${d.os || 'Unknown'} ${d.version || ''}`);
  const values = data.map(d => d.count);
  
  // Vibrant colors
  const versionColors = ['#FF6B6B', '#4ECDC4', '#FFE66D', '#95E1D3', '#C7CEEA', '#FFA07A', '#98D8C8', '#F7DC6F', '#DDA0DD', '#87CEEB'];
  const backgrounds = labels.map((_, i) => versionColors[i % versionColors.length]);
  
  _osVersionChart = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: labels,
      datasets: [{
        data: values,
        backgroundColor: backgrounds,
        borderWidth: 8,
        borderColor: '#ffffff',
        hoverOffset: 20,
        hoverBorderWidth: 10,
        offset: labels.map(() => 8)
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      layout: {
        padding: 20
      },
      plugins: {
        legend: {
          position: 'right',
          labels: {
            padding: 20,
            font: {
              size: 13,
              family: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
              weight: '600'
            },
            usePointStyle: true,
            pointStyle: 'rectRounded',
            boxWidth: 18,
            boxHeight: 18,
            generateLabels: function(chart) {
              const data = chart.data;
              if (data.labels.length && data.datasets.length) {
                const total = data.datasets[0].data.reduce((a, b) => a + b, 0);
                return data.labels.map((label, i) => {
                  const value = data.datasets[0].data[i];
                  const percentage = ((value / total) * 100).toFixed(0);
                  return {
                    text: `${label}  ${percentage}%`,
                    fillStyle: data.datasets[0].backgroundColor[i],
                    hidden: false,
                    index: i
                  };
                });
              }
              return [];
            }
          }
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          titleColor: '#fff',
          bodyColor: '#fff',
          padding: 16,
          cornerRadius: 8,
          displayColors: true,
          boxPadding: 8,
          titleFont: {
            size: 14,
            weight: 'bold'
          },
          bodyFont: {
            size: 13
          },
          callbacks: {
            label: function(context) {
              const label = context.label || '';
              const value = context.parsed;
              const total = context.dataset.data.reduce((a, b) => a + b, 0);
              const percentage = ((value / total) * 100).toFixed(1);
              return `${value} queries (${percentage}%)`;
            }
          }
        }
      },
      animation: {
        animateRotate: true,
        animateScale: true,
        duration: 1000,
        easing: 'easeOutBounce'
      }
    },
    plugins: [{
      beforeDraw: function(chart) {
        const ctx = chart.ctx;
        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.15)';
        ctx.shadowBlur = 15;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 8;
        ctx.restore();
      }
    }]
  });
}

function renderDeviceChart(data) {
  const ctx = document.getElementById('deviceChart');
  if (!ctx) return;
  
  if (_deviceChart) {
    _deviceChart.destroy();
  }
  
  const labels = data.map(d => {
    const device = d.device || 'Unknown';
    return device.charAt(0).toUpperCase() + device.slice(1);
  });
  const values = data.map(d => d.count);
  
  // Vibrant colors for device types
  const deviceColors = {
    'Desktop': '#4ECDC4',
    'Mobile': '#FF6B6B',
    'Tablet': '#FFE66D',
    'Unknown': '#C7CEEA'
  };
  const backgrounds = labels.map(label => deviceColors[label] || deviceColors['Unknown']);
  
  _deviceChart = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: labels,
      datasets: [{
        data: values,
        backgroundColor: backgrounds,
        borderWidth: 8,
        borderColor: '#ffffff',
        hoverOffset: 20,
        hoverBorderWidth: 10,
        offset: labels.map(() => 8)
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      layout: {
        padding: 20
      },
      plugins: {
        legend: {
          position: 'right',
          labels: {
            padding: 20,
            font: {
              size: 14,
              family: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
              weight: '600'
            },
            usePointStyle: true,
            pointStyle: 'rectRounded',
            boxWidth: 20,
            boxHeight: 20,
            generateLabels: function(chart) {
              const data = chart.data;
              if (data.labels.length && data.datasets.length) {
                const total = data.datasets[0].data.reduce((a, b) => a + b, 0);
                return data.labels.map((label, i) => {
                  const value = data.datasets[0].data[i];
                  const percentage = ((value / total) * 100).toFixed(0);
                  return {
                    text: `${label}  ${percentage}%`,
                    fillStyle: data.datasets[0].backgroundColor[i],
                    hidden: false,
                    index: i
                  };
                });
              }
              return [];
            }
          }
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          titleColor: '#fff',
          bodyColor: '#fff',
          padding: 16,
          cornerRadius: 8,
          displayColors: true,
          boxPadding: 8,
          titleFont: {
            size: 14,
            weight: 'bold'
          },
          bodyFont: {
            size: 13
          },
          callbacks: {
            label: function(context) {
              const label = context.label || '';
              const value = context.parsed;
              const total = context.dataset.data.reduce((a, b) => a + b, 0);
              const percentage = ((value / total) * 100).toFixed(1);
              return `${value} queries (${percentage}%)`;
            }
          }
        }
      },
      animation: {
        animateRotate: true,
        animateScale: true,
        duration: 1000,
        easing: 'easeOutBounce'
      }
    },
    plugins: [{
      beforeDraw: function(chart) {
        const ctx = chart.ctx;
        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.15)';
        ctx.shadowBlur = 15;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 8;
        ctx.restore();
      }
    }]
  });
}

async function renderLocationChart(data) {
  const ctx = document.getElementById('locationChart');
  if (!ctx) return;
  
  if (_locationChart) {
    _locationChart.destroy();
  }
  
  // Debug: Check incoming data
  console.log('Location data received:', data);
  
  if (!data || data.length === 0) {
    console.log('No location data available');
    ctx.parentElement.innerHTML = '<div style="padding:40px;text-align:center;color:#999;">No location data available</div>';
    return;
  }
  
  // Fetch world map topology data
  const topology = await fetch('https://unpkg.com/world-atlas@2.0.2/countries-110m.json')
    .then(response => response.json());
  
  // Comprehensive country name → numeric ISO 3166-1 code mapping (world-atlas uses numeric IDs).
  // Handles any "City, Country" string from ip-api.com by extracting the country part dynamically.
  const COUNTRY_CODES = {
    'Afghanistan':'004','Albania':'008','Algeria':'012','Andorra':'020','Angola':'024',
    'Argentina':'032','Armenia':'051','Australia':'036','Austria':'040','Azerbaijan':'031',
    'Bahrain':'048','Bangladesh':'050','Belarus':'112','Belgium':'056','Bhutan':'064',
    'Bolivia':'068','Bosnia and Herzegovina':'070','Brazil':'076','Brunei':'096',
    'Bulgaria':'100','Cambodia':'116','Cameroon':'120','Canada':'124','Chile':'152',
    'China':'156','Colombia':'170','Congo':'180','Costa Rica':'188','Croatia':'191',
    'Cuba':'192','Cyprus':'196','Czech Republic':'203','Czechia':'203','Denmark':'208',
    'Ecuador':'218','Egypt':'818','El Salvador':'222','Estonia':'233','Ethiopia':'231',
    'Finland':'246','France':'250','Georgia':'268','Germany':'276','Ghana':'288',
    'Greece':'300','Guatemala':'320','Honduras':'340','Hungary':'348','Iceland':'352',
    'India':'356','Indonesia':'360','Iran':'364','Iraq':'368','Ireland':'372',
    'Israel':'376','Italy':'380','Jamaica':'388','Japan':'392','Jordan':'400',
    'Kazakhstan':'398','Kenya':'404','Kuwait':'414','Kyrgyzstan':'417','Laos':'418',
    'Latvia':'428','Lebanon':'422','Libya':'434','Lithuania':'440','Luxembourg':'442',
    'Malaysia':'458','Maldives':'462','Mexico':'484','Moldova':'498','Mongolia':'496',
    'Morocco':'504','Mozambique':'508','Myanmar':'104','Nepal':'524','Netherlands':'528',
    'New Zealand':'554','Nicaragua':'558','Nigeria':'566','North Korea':'408',
    'Norway':'578','Oman':'512','Pakistan':'586','Palestine':'275','Panama':'591',
    'Papua New Guinea':'598','Paraguay':'600','Peru':'604','Philippines':'608',
    'Poland':'616','Portugal':'620','Qatar':'634','Romania':'642','Russia':'643',
    'Rwanda':'646','Saudi Arabia':'682','Senegal':'686','Serbia':'688',
    'Singapore':'702','Slovakia':'703','Slovenia':'705','Somalia':'706',
    'South Africa':'710','South Korea':'410','Spain':'724','Sri Lanka':'144',
    'Sudan':'729','Sweden':'752','Switzerland':'756','Syria':'760','Taiwan':'158',
    'Tajikistan':'762','Tanzania':'834','Thailand':'764','Timor-Leste':'626',
    'Tunisia':'788','Turkey':'792','Türkiye':'792','Turkmenistan':'795',
    'UAE':'784','United Arab Emirates':'784','Uganda':'800','Ukraine':'804',
    'United Kingdom':'826','UK':'826','United States':'840','USA':'840','US':'840',
    'Uruguay':'858','Uzbekistan':'860','Venezuela':'862','Vietnam':'704',
    'Yemen':'887','Zambia':'894','Zimbabwe':'716',
  };

  // Extract country code from any "City, Country" or plain "Country" string
  const getCountryCode = (location) => {
    if (!location) return null;
    const loc = location.trim();
    // Skip non-geographic values
    if (['unknown', 'local', ''].includes(loc.toLowerCase())) return null;
    // Try full string first (plain country name like "Indonesia")
    if (COUNTRY_CODES[loc]) return COUNTRY_CODES[loc];
    // Extract country from "City, Country" — take the part after the last comma
    const parts = loc.split(',');
    if (parts.length >= 2) {
      return COUNTRY_CODES[parts[parts.length - 1].trim()] || null;
    }
    return null;
  };

  // Aggregate query counts by country code
  const countryData = {};
  const unmapped = [];
  data.forEach(item => {
    const code = getCountryCode(item.location);
    if (code) {
      countryData[code] = (countryData[code] || 0) + item.count;
    } else {
      unmapped.push(item.location);
    }
  });

  if (unmapped.length) console.log('Unmapped locations:', unmapped);

  // If no country could be resolved, show a helpful message with the raw values
  if (Object.keys(countryData).length === 0) {
    const sample = data.slice(0, 5).map(d => `"${d.location}"`).join(', ');
    ctx.parentElement.innerHTML = `<div style="padding:40px;text-align:center;color:#999;">No geographic data could be mapped.<br><small style="color:#bbb;">Raw values: ${sample}</small></div>`;
    return;
  }

  // Convert to array format for choropleth
  const chartData = Object.entries(countryData).map(([code, value]) => ({
    feature: code,
    value: value
  }));
  
  const countries = ChartGeo.topojson.feature(topology, topology.objects.countries).features;
  
  _locationChart = new Chart(ctx, {
    type: 'choropleth',
    data: {
      labels: countries.map(d => d.properties.name),
      datasets: [{
        label: 'Queries',
        data: countries.map(d => {
          const match = chartData.find(cd => String(d.id) === cd.feature);
          return {
            feature: d,
            value: match ? match.value : 0
          };
        }),
        backgroundColor: (context) => {
          if (!context.dataIndex) return '#e5e7eb';
          const value = context.raw?.value;
          if (!value || value === 0) return '#e5e7eb';
          
          // Color scale from light blue to dark blue
          const maxValue = Math.max(...chartData.map(d => d.value));
          const intensity = Math.min(value / maxValue, 1);
          const r = Math.round(59 + (229 - 59) * (1 - intensity));
          const g = Math.round(130 + (231 - 130) * (1 - intensity));
          const b = Math.round(246 + (235 - 246) * (1 - intensity));
          return `rgb(${r}, ${g}, ${b})`;
        },
        borderColor: '#d1d5db',
        borderWidth: 0.5
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              const value = context.raw?.value || 0;
              const name = context.raw?.feature?.properties?.name || 'Unknown';
              if (value === 0) return `${name}: No data`;
              const total = chartData.reduce((sum, d) => sum + d.value, 0);
              const percentage = ((value / total) * 100).toFixed(1);
              return `${name}: ${value} queries (${percentage}%)`;
            }
          }
        }
      },
      scales: {
        projection: {
          axis: 'x',
          projection: 'equalEarth'
        }
      }
    }
  });
}

function generateColors(count) {
  const baseColors = [
    'rgba(59, 130, 246, 0.8)',   // Blue
    'rgba(139, 92, 246, 0.8)',   // Purple
    'rgba(16, 185, 129, 0.8)',   // Green
    'rgba(245, 158, 11, 0.8)',   // Orange
    'rgba(239, 68, 68, 0.8)',    // Red
    'rgba(236, 72, 153, 0.8)',   // Pink
    'rgba(20, 184, 166, 0.8)',   // Teal
    'rgba(251, 146, 60, 0.8)',   // Amber
    'rgba(124, 58, 237, 0.8)',   // Violet
    'rgba(34, 197, 94, 0.8)'     // Emerald
  ];
  
  const colors = [];
  for (let i = 0; i < count; i++) {
    colors.push(baseColors[i % baseColors.length]);
  }
  return colors;
}
