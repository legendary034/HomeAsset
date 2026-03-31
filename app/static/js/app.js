// ═══════════════════════════════════════════════════════════════════════════
//  app.js  ─  API client, router, sidebar, toasts, modal core, dashboard
// ═══════════════════════════════════════════════════════════════════════════

// ── State ──────────────────────────────────────────────────────────────────
const S = {
  route: 'dashboard',
  routeParam: null,
  locations: [],   // flat list
  categories: [],
  tags: [],
  sidebarExpandedIds: new Set(),
};

// ── API helpers ────────────────────────────────────────────────────────────
const api = {
  async _fetch(method, path, body) {
    const url = '/api' + path;
    const opts = { method, headers: {} };
    if (body !== undefined && !(body instanceof FormData)) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    } else if (body instanceof FormData) {
      opts.body = body;
    }
    const res = await fetch(url, opts);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || res.statusText);
    }
    if (res.status === 204) return null;
    return res.json();
  },
  get:    (p)      => api._fetch('GET', p),
  post:   (p, b)   => api._fetch('POST', p, b),
  put:    (p, b)   => api._fetch('PUT', p, b),
  delete: (p)      => api._fetch('DELETE', p),
  upload: (p, fd)  => api._fetch('POST', p, fd),
};

// ── Toast ──────────────────────────────────────────────────────────────────
function toast(msg, type = 'info') {
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span>${icons[type]}</span><span>${msg}</span>`;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => {
    el.style.animation = 'toast-out 0.3s ease forwards';
    setTimeout(() => el.remove(), 300);
  }, 3000);
}

// ── Modal ──────────────────────────────────────────────────────────────────
function openModal(html, wide = false) {
  const mc = document.getElementById('modal-container');
  mc.className = wide ? 'modal modal-wide' : 'modal';
  document.getElementById('modal-content').innerHTML = html;
  document.getElementById('modal-overlay').classList.remove('hidden');
}
function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
  document.getElementById('modal-content').innerHTML = '';
}
function handleOverlayClick(e) {
  if (e.target === document.getElementById('modal-overlay')) closeModal();
}

// ── Sidebar ────────────────────────────────────────────────────────────────
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebar-overlay').classList.toggle('active');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('active');
}

async function loadSidebarTree() {
  try {
    const tree = await api.get('/locations');
    const el = document.getElementById('sidebar-tree');
    el.innerHTML = renderTreeNodes(tree, 0);
    highlightSidebarLocation();
  } catch(e) {
    document.getElementById('sidebar-tree').innerHTML =
      '<div style="padding:12px;color:var(--text-3);font-size:12px">Could not load</div>';
  }
}

function renderTreeNodes(nodes, depth) {
  if (!nodes || !nodes.length) return '';
  return nodes.map(n => {
    const hasChildren = n.children && n.children.length > 0;
    const isOpen = S.sidebarExpandedIds.has(n.id);
    return `
      <div class="tree-node">
        <div class="tree-node-row" id="tree-${n.id}" onclick="onTreeNodeClick(event,${n.id},${hasChildren})">
          <button class="tree-toggle ${isOpen ? 'open' : ''}" style="visibility:${hasChildren ? 'visible' : 'hidden'}"
                  onclick="toggleTreeNode(event,${n.id})">▶</button>
          <span class="tree-icon">${n.icon || '📦'}</span>
          <span class="tree-label">${esc(n.name)}</span>
          ${n.item_count ? `<span class="tree-count">${n.item_count}</span>` : ''}
        </div>
        ${hasChildren ? `<div class="tree-children" id="tree-ch-${n.id}" style="display:${isOpen?'block':'none'}">${renderTreeNodes(n.children, depth+1)}</div>` : ''}
      </div>`;
  }).join('');
}

function toggleTreeNode(e, id) {
  e.stopPropagation();
  const ch = document.getElementById(`tree-ch-${id}`);
  const btn = e.currentTarget;
  if (!ch) return;
  const open = ch.style.display !== 'none';
  ch.style.display = open ? 'none' : 'block';
  btn.classList.toggle('open', !open);
  if (!open) S.sidebarExpandedIds.add(id);
  else S.sidebarExpandedIds.delete(id);
}

function onTreeNodeClick(e, id, hasChildren) {
  navigate('location', id);
}

function highlightSidebarLocation() {
  document.querySelectorAll('.tree-node-row').forEach(el => el.classList.remove('active'));
  if (S.route === 'location' && S.routeParam) {
    const el = document.getElementById(`tree-${S.routeParam}`);
    if (el) { el.classList.add('active'); expandToNode(S.routeParam); }
  }
}

function expandToNode(id) {
  // expand all ancestors
  const findParent = (nodes, target) => {
    for (const n of nodes) {
      if (n.id === target) return [];
      for (const c of (n.children || [])) {
        const path = findParent([c], target);
        if (path !== null) return [n.id, ...path];
      }
    }
    return null;
  };
}

// ── Router ──────────────────────────────────────────────────────────────────
function setActiveNav(route) {
  document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));
  const map = { dashboard:'nav-dashboard', locations:'nav-locations', items:'nav-items', search:'nav-search', settings:'nav-settings', location:'nav-locations' };
  const el = document.getElementById(map[route]);
  if (el) el.classList.add('active');
}

async function navigate(route, param = null) {
  S.route = route;
  S.routeParam = param;
  setActiveNav(route);
  highlightSidebarLocation();
  closeSidebar();
  const main = document.getElementById('main-content');
  main.innerHTML = '<div class="loader"><div class="spinner"></div> Loading…</div>';
  try {
    switch (route) {
      case 'dashboard':  await renderDashboard(); break;
      case 'locations':  await renderLocations(); break;
      case 'location':   await renderLocationDetail(param); break;
      case 'items':      await renderItems({}); break;
      case 'search':     await renderSearch(); break;
      case 'settings':   await renderSettings(); break;
      default:           await renderDashboard();
    }
  } catch(e) {
    main.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-title">Error</div><div class="empty-text">${e.message}</div></div>`;
  }
}

// ── Shared data loaders ────────────────────────────────────────────────────
async function refreshShared() {
  // Use allSettled so one failing endpoint doesn't kill the rest
  const [locs, cats, tgs] = await Promise.allSettled([
    api.get('/locations/flat'),
    api.get('/categories'),
    api.get('/tags'),
  ]);
  S.locations  = locs.status  === 'fulfilled' ? locs.value  : [];
  S.categories = cats.status  === 'fulfilled' ? cats.value  : [];
  S.tags       = tgs.status   === 'fulfilled' ? tgs.value   : [];
  if (locs.status === 'rejected') console.error('locations/flat failed:', locs.reason);
  if (cats.status === 'rejected') console.error('categories failed:', cats.reason);
  if (tgs.status  === 'rejected') console.error('tags failed:', tgs.reason);
}

// ── Quick search (topbar) ─────────────────────────────────────────────────
let _qsTimer;
function onQuickSearch(val) {
  clearTimeout(_qsTimer);
  _qsTimer = setTimeout(() => {
    navigate('search');
    setTimeout(() => {
      const si = document.getElementById('search-input-big');
      if (si) { si.value = val; si.dispatchEvent(new Event('input')); }
    }, 50);
  }, 200);
}

// ── Helper: escape HTML ────────────────────────────────────────────────────
function esc(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function formatBytes(b) {
  if (!b) return '';
  if (b < 1024) return b + ' B';
  if (b < 1048576) return (b/1024).toFixed(1) + ' KB';
  return (b/1048576).toFixed(1) + ' MB';
}

function locationPath(locId) {
  if (!locId) return '';
  const map = {};
  S.locations.forEach(l => map[l.id] = l);
  const parts = [];
  let cur = map[locId];
  while (cur) { parts.unshift(cur.name); cur = map[cur.parent_id]; }
  return parts.join(' › ');
}

function locationPathIndented(flat) {
  // returns flat list with depth for <select> options
  const map = {}, roots = [], children = {};
  flat.forEach(l => { map[l.id] = l; children[l.id] = []; });
  flat.forEach(l => { if (l.parent_id) children[l.parent_id].push(l); else roots.push(l); });
  const result = [];
  const walk = (nodes, depth) => nodes.forEach(n => {
    result.push({ ...n, depth });
    walk(children[n.id] || [], depth + 1);
  });
  walk(roots, 0);
  return result;
}

// ── Item card HTML ─────────────────────────────────────────────────────────
function itemCardHtml(item) {
  const imgHtml = item.image_path
    ? `<div class="item-card-img"><img src="/uploads/${item.image_path}" alt="${esc(item.name)}" loading="lazy" /></div>`
    : `<div class="item-card-img">📦</div>`;
  const locPath = locationPath(item.location_id);
  const catBadge = item.category
    ? `<span class="badge badge-cat" style="background:${item.category.color||'#6366f1'}22;color:${item.category.color||'#6366f1'}">${esc(item.category.icon||'')} ${esc(item.category.name)}</span>`
    : '';
  const tagHtml = (item.tags||[]).slice(0,3).map(t => `<span class="tag">${esc(t.name)}</span>`).join('');
  const more = item.tags && item.tags.length > 3 ? `<span class="tag">+${item.tags.length-3}</span>` : '';
  return `
    <div class="item-card" onclick="openItemDetail(${item.id})">
      ${imgHtml}
      <div class="item-card-body">
        <div class="item-card-name">${esc(item.name)}</div>
        ${locPath ? `<div class="item-card-location">📍 ${esc(locPath)}</div>` : ''}
        <div class="item-card-footer">
          ${catBadge}
          ${tagHtml}${more}
          <span class="badge badge-qty" style="margin-left:auto">×${item.quantity}</span>
        </div>
      </div>
    </div>`;
}

// ── Dashboard ──────────────────────────────────────────────────────────────
async function renderDashboard() {
  const [statsRes, recentRes] = await Promise.allSettled([
    api.get('/stats'),
    api.get('/items'),
  ]);
  await refreshShared();

  const stats  = statsRes.status  === 'fulfilled' ? statsRes.value  : { total_items:0, total_locations:0, total_categories:0, total_tags:0 };
  const recent = recentRes.status === 'fulfilled' ? recentRes.value : [];

  const statCards = [
    { icon:'📦', value: stats.total_items,      label:'Items' },
    { icon:'📍', value: stats.total_locations,  label:'Locations' },
    { icon:'🏷️', value: stats.total_categories, label:'Categories' },
    { icon:'🔖', value: stats.total_tags,        label:'Tags' },
  ].map(s => `
    <div class="stat-card">
      <div class="stat-icon">${s.icon}</div>
      <div class="stat-value">${s.value}</div>
      <div class="stat-label">${s.label}</div>
    </div>`).join('');

  const itemsHtml = recent.length
    ? `<div class="items-grid">${recent.map(itemCardHtml).join('')}</div>`
    : `<div class="empty-state"><div class="empty-icon">📦</div><div class="empty-title">No items yet</div><div class="empty-text">Click "+ Add Item" to get started.</div></div>`;

  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div><div class="page-title">Dashboard</div><div class="page-subtitle">Overview of your home inventory</div></div>
    </div>
    <div class="stats-grid">${statCards}</div>
    <div class="section">
      <div class="section-header">
        <div class="section-title">Recent Items</div>
        <button class="btn btn-ghost btn-sm" onclick="navigate('items')">View All →</button>
      </div>
      ${itemsHtml}
    </div>`;
}

// ── Init ───────────────────────────────────────────────────────────────────
async function init() {
  await refreshShared();
  loadSidebarTree();
  navigate('dashboard');
}

window.addEventListener('DOMContentLoaded', init);
