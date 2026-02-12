/**
 * app.js — 主播直播数据可视化核心逻辑
 * 加载 data.json → 构建选择器 → 渲染图表 → tooltip 交互
 */

let DATA = null;
let chartFollowers = null;
let chartViewers = null;
let chartGuard = null;

// ===== 调色板 =====
const SESSION_COLORS = [
    'rgba(108, 140, 255, 0.85)',
    'rgba(168, 85, 247, 0.85)',
    'rgba(34, 211, 238, 0.85)',
    'rgba(244, 114, 182, 0.85)',
    'rgba(52, 211, 153, 0.85)',
    'rgba(251, 146, 60, 0.85)',
    'rgba(253, 224, 71, 0.85)',
    'rgba(147, 197, 253, 0.85)',
    'rgba(196, 181, 253, 0.85)',
    'rgba(110, 231, 183, 0.85)',
];

const SESSION_COLORS_BG = SESSION_COLORS.map(c => c.replace('0.85', '0.15'));

// ===== Chart.js 全局配置 =====
Chart.defaults.color = '#8892a8';
Chart.defaults.borderColor = 'rgba(100, 140, 255, 0.08)';
Chart.defaults.font.family = "'Inter', sans-serif";

// ===== 初始化 =====
async function init() {
    if (!window.LIVE_DATA) {
        document.getElementById('empty-state').innerHTML =
            `<div class="empty-icon">⚠️</div><p>未找到数据。请先运行 <code>python parse_sql.py</code> 生成 data.js</p>`;
        return;
    }
    DATA = window.LIVE_DATA;
    buildPlatformSelector();
}

function buildPlatformSelector() {
    const sel = document.getElementById('platform-select');
    for (const [key, pf] of Object.entries(DATA.platforms)) {
        const cnt = Object.keys(pf.streamers).length;
        if (cnt === 0) continue;
        const opt = document.createElement('option');
        opt.value = key;
        opt.textContent = `${pf.name} (${cnt}位主播)`;
        sel.appendChild(opt);
    }
    sel.addEventListener('change', onPlatformChange);
    document.getElementById('streamer-select').addEventListener('change', onStreamerChange);
}

function onPlatformChange() {
    const key = document.getElementById('platform-select').value;
    const sSel = document.getElementById('streamer-select');
    sSel.innerHTML = '<option value="">-- 选择主播 --</option>';
    hideAllCharts();

    if (!key) {
        sSel.disabled = true;
        return;
    }

    const streamers = DATA.platforms[key].streamers;
    const sorted = Object.entries(streamers).sort((a, b) => {
        const aRec = a[1].attention_series || a[1].follower_series || [];
        const bRec = b[1].attention_series || b[1].follower_series || [];
        return (bRec.length) - (aRec.length);
    });

    for (const [id, s] of sorted) {
        const opt = document.createElement('option');
        opt.value = id;
        opt.textContent = s.name;
        sSel.appendChild(opt);
    }
    sSel.disabled = false;
}

function onStreamerChange() {
    const pfKey = document.getElementById('platform-select').value;
    const sKey = document.getElementById('streamer-select').value;
    if (!pfKey || !sKey) {
        hideAllCharts();
        return;
    }
    const streamer = DATA.platforms[pfKey].streamers[sKey];
    if (!streamer) return;

    renderAll(streamer, pfKey);
}

function hideAllCharts() {
    document.getElementById('empty-state').style.display = '';
    ['card-ring', 'card-followers', 'card-viewers', 'card-guard'].forEach(id => {
        document.getElementById(id).style.display = 'none';
    });
    document.getElementById('streamer-info').classList.add('hidden');
}

function showCards(ids) {
    document.getElementById('empty-state').style.display = 'none';
    ids.forEach(id => {
        const el = document.getElementById(id);
        el.style.display = '';
        el.style.animationName = 'none';
        el.offsetHeight; // reflow
        el.style.animationName = '';
    });
}

// ===== 渲染入口 =====
function renderAll(streamer, platform) {
    // 显示主播信息
    const infoEl = document.getElementById('streamer-info');
    if (platform === 'bilibili') {
        infoEl.innerHTML = `<span class="info-name">${streamer.name}</span> · UID: ${streamer.uid} · 房间号: ${streamer.room_id}`;
    } else {
        infoEl.innerHTML = `<span class="info-name">${streamer.name}</span>`;
    }
    infoEl.classList.remove('hidden');

    const cards = ['card-ring', 'card-followers'];

    // 环形图
    drawRingChart(streamer.minute_distribution);

    // 粉丝曲线
    if (platform === 'bilibili') {
        drawFollowersChart(streamer.attention_series, '关注数');
    } else {
        drawFollowersChart(streamer.follower_series, '粉丝数');
    }

    // 仅 BL 有直播间人数 & 大航海
    if (platform === 'bilibili' && streamer.sessions && streamer.sessions.length > 0) {
        cards.push('card-viewers');
        drawViewersChart(streamer.sessions);
    } else {
        document.getElementById('card-viewers').style.display = 'none';
    }

    if (platform === 'bilibili' && streamer.guard_series && streamer.guard_series.length > 0) {
        cards.push('card-guard');
        drawGuardChart(streamer.guard_series);
    } else {
        document.getElementById('card-guard').style.display = 'none';
    }

    showCards(cards);
}

// ===== 1. 24小时环形开播分布 (1440分钟粒度) =====
function drawRingChart(minuteData) {
    const canvas = document.getElementById('chart-ring');
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const W = 400, H = 400;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.scale(dpr, dpr);

    const cx = W / 2, cy = H / 2;
    const outerR = 170, innerR = 110, labelR = 188;

    const maxCount = Math.max(...minuteData, 1);
    const totalSegments = 1440;
    const segAngle = (Math.PI * 2) / totalSegments;
    const startOffset = -Math.PI / 2; // 12点方向为0

    ctx.clearRect(0, 0, W, H);

    // 背景圆环
    ctx.beginPath();
    ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
    ctx.arc(cx, cy, innerR, 0, Math.PI * 2, true);
    ctx.fillStyle = 'rgba(30, 40, 70, 0.4)';
    ctx.fill();

    // 绘制1440个分钟扇形 —— 合并相邻相同透明度的段提升性能
    for (let m = 0; m < totalSegments; m++) {
        const startA = startOffset + m * segAngle;
        const endA = startA + segAngle;
        const count = minuteData[m];
        const intensity = count / maxCount;

        ctx.beginPath();
        ctx.arc(cx, cy, outerR, startA, endA);
        ctx.arc(cx, cy, innerR, endA, startA, true);
        ctx.closePath();

        if (intensity > 0) {
            // 渐变色: 低→青, 高→紫，高次数更不透明
            const r = Math.round(108 + (168 - 108) * intensity);
            const g = Math.round(200 - 100 * intensity);
            const b = Math.round(238 + (247 - 238) * intensity);
            const a = 0.25 + 0.75 * intensity;
            ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${a})`;
        } else {
            ctx.fillStyle = 'rgba(40, 50, 80, 0.15)';
        }
        ctx.fill();
    }

    // 小时分隔线 + 标签
    for (let h = 0; h < 24; h++) {
        const angle = startOffset + h * (Math.PI * 2 / 24);

        // 分隔线
        ctx.beginPath();
        ctx.moveTo(cx + innerR * Math.cos(angle), cy + innerR * Math.sin(angle));
        ctx.lineTo(cx + outerR * Math.cos(angle), cy + outerR * Math.sin(angle));
        ctx.strokeStyle = 'rgba(100, 140, 255, 0.15)';
        ctx.lineWidth = 0.5;
        ctx.stroke();

        // 标签 — 放在分隔线上（而非扇区中间），确保0在正上方
        const lx = cx + labelR * Math.cos(angle);
        const ly = cy + labelR * Math.sin(angle);
        if (h % 3 === 0) {
            ctx.fillStyle = '#8892a8';
            ctx.font = 'bold 12px Inter, sans-serif';
        } else {
            ctx.fillStyle = '#556080';
            ctx.font = '10px Inter, sans-serif';
        }
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${h}`, lx, ly);
    }

    // 中心文字
    ctx.fillStyle = '#8892a8';
    ctx.font = '600 14px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('开播', cx, cy - 8);
    ctx.fillStyle = '#556080';
    ctx.font = '12px Inter, sans-serif';
    ctx.fillText('时间分布', cx, cy + 10);

    // Hover 交互
    canvas._minuteData = minuteData;
    canvas._params = { cx, cy, outerR, innerR, segAngle, startOffset, totalSegments };
    canvas.onmousemove = ringMouseMove;
    canvas.onmouseleave = () => {
        document.getElementById('ring-tooltip').classList.add('hidden');
    };
}

function ringMouseMove(e) {
    const canvas = e.target;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const { cx, cy, outerR, innerR, segAngle, startOffset, totalSegments } = canvas._params;

    const dx = x - cx, dy = y - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);

    const tooltip = document.getElementById('ring-tooltip');

    if (dist < innerR || dist > outerR) {
        tooltip.classList.add('hidden');
        return;
    }

    let angle = Math.atan2(dy, dx) - startOffset;
    if (angle < 0) angle += Math.PI * 2;
    const minuteIdx = Math.floor(angle / segAngle);
    if (minuteIdx < 0 || minuteIdx >= totalSegments) return;

    const hour = Math.floor(minuteIdx / 60);
    const minute = minuteIdx % 60;
    const count = canvas._minuteData[minuteIdx];
    const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
    tooltip.innerHTML = `<span class="tt-hour">${timeStr}</span><br>开播次数: <span class="tt-count">${count}</span>`;
    tooltip.classList.remove('hidden');

    // 定位
    const parentRect = canvas.parentElement.getBoundingClientRect();
    tooltip.style.left = (e.clientX - parentRect.left + 12) + 'px';
    tooltip.style.top = (e.clientY - parentRect.top - 40) + 'px';
}

// ===== 2. 粉丝/关注者折线图 =====
function drawFollowersChart(series, label) {
    if (chartFollowers) chartFollowers.destroy();

    const ctx = document.getElementById('chart-followers').getContext('2d');
    const labels = series.map(d => d.time);
    const values = series.map(d => d.value);

    chartFollowers = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label,
                data: values,
                borderColor: 'rgba(108, 140, 255, 1)',
                backgroundColor: 'rgba(108, 140, 255, 0.1)',
                fill: true,
                tension: 0.3,
                pointRadius: series.length > 100 ? 0 : 2,
                pointHoverRadius: 5,
                borderWidth: 2,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(10, 14, 30, 0.95)',
                    borderColor: 'rgba(100, 140, 255, 0.25)',
                    borderWidth: 1,
                    titleFont: { size: 12 },
                    bodyFont: { size: 13 },
                    callbacks: {
                        title: (items) => {
                            const raw = items[0].label;
                            return formatDateTime(raw);
                        },
                        label: (item) => `${label}: ${item.formattedValue}`
                    }
                }
            },
            scales: {
                x: {
                    display: true,
                    ticks: {
                        maxTicksLimit: 8,
                        callback: function (val, idx) {
                            const raw = this.getLabelForValue(val);
                            return formatDateShort(raw);
                        }
                    },
                    grid: { display: false }
                },
                y: {
                    beginAtZero: false,
                    grid: { color: 'rgba(100, 140, 255, 0.06)' }
                }
            }
        }
    });
}

// ===== 3. 直播间人数变化（多场次叠加） =====
function drawViewersChart(sessions) {
    if (chartViewers) chartViewers.destroy();

    const ctx = document.getElementById('chart-viewers').getContext('2d');
    const datasets = sessions.map((session, i) => {
        const color = SESSION_COLORS[i % SESSION_COLORS.length];
        const bgColor = SESSION_COLORS_BG[i % SESSION_COLORS_BG.length];
        const startDate = formatDateShort(session.start_iso);
        return {
            label: `${startDate} ${session.title || ''}`.trim(),
            data: session.data_points.map(p => ({
                x: p.elapsed_min,
                y: p.online_num
            })),
            borderColor: color,
            backgroundColor: bgColor,
            fill: false,
            tension: 0.3,
            pointRadius: sessions.length > 3 ? 0 : 1.5,
            pointHoverRadius: 4,
            borderWidth: 2,
        };
    });

    chartViewers = new Chart(ctx, {
        type: 'line',
        data: { datasets },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            interaction: {
                mode: 'nearest',
                intersect: false,
            },
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        boxWidth: 12,
                        padding: 12,
                        font: { size: 11 },
                        usePointStyle: true,
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(10, 14, 30, 0.95)',
                    borderColor: 'rgba(100, 140, 255, 0.25)',
                    borderWidth: 1,
                    callbacks: {
                        title: (items) => `开播后 ${items[0].parsed.x.toFixed(0)} 分钟`,
                        label: (item) => `${item.dataset.label}: ${item.parsed.y} 人`
                    }
                }
            },
            scales: {
                x: {
                    type: 'linear',
                    min: 0,
                    title: {
                        display: true,
                        text: '开播后时间（分钟）',
                        color: '#556080',
                        font: { size: 12 }
                    },
                    grid: { display: false }
                },
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: '在线人数',
                        color: '#556080',
                        font: { size: 12 }
                    },
                    grid: { color: 'rgba(100, 140, 255, 0.06)' }
                }
            }
        }
    });
}

// ===== 4. 大航海上舰人数 =====
function drawGuardChart(series) {
    if (chartGuard) chartGuard.destroy();

    const ctx = document.getElementById('chart-guard').getContext('2d');
    const labels = series.map(d => d.time);
    const values = series.map(d => d.value);

    // 标记直播状态的背景色
    const statusColors = series.map(d =>
        d.live_status === 1 ? 'rgba(52, 211, 153, 0.08)' : 'rgba(0,0,0,0)'
    );

    chartGuard = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: '大航海人数',
                data: values,
                borderColor: 'rgba(251, 146, 60, 1)',
                backgroundColor: 'rgba(251, 146, 60, 0.1)',
                fill: true,
                tension: 0.3,
                pointRadius: series.length > 100 ? 0 : 2,
                pointHoverRadius: 5,
                borderWidth: 2,
                stepped: 'before',
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(10, 14, 30, 0.95)',
                    borderColor: 'rgba(251, 146, 60, 0.25)',
                    borderWidth: 1,
                    callbacks: {
                        title: (items) => formatDateTime(items[0].label),
                        label: (item) => {
                            const idx = item.dataIndex;
                            const status = series[idx].live_status === 1 ? '🟢 直播中' : '⚫ 未开播';
                            return [`大航海: ${item.formattedValue} 人`, status];
                        }
                    }
                }
            },
            scales: {
                x: {
                    display: true,
                    ticks: {
                        maxTicksLimit: 8,
                        callback: function (val, idx) {
                            return formatDateShort(this.getLabelForValue(val));
                        }
                    },
                    grid: { display: false }
                },
                y: {
                    beginAtZero: false,
                    grid: { color: 'rgba(251, 146, 60, 0.06)' }
                }
            }
        }
    });
}

// ===== 工具函数 =====
function formatDateTime(isoStr) {
    try {
        const d = new Date(isoStr);
        return d.toLocaleString('zh-CN', {
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit',
            hour12: false
        });
    } catch {
        return isoStr;
    }
}

function formatDateShort(isoStr) {
    try {
        const d = new Date(isoStr);
        return `${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    } catch {
        return isoStr;
    }
}

// ===== 启动 =====
document.addEventListener('DOMContentLoaded', init);
