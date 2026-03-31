// ═══════════════════════════════════════════════════════════════════════════
//  views.js  ─  Locations, Items, Search, Settings, Item Detail, Add/Edit modals
// ═══════════════════════════════════════════════════════════════════════════

// ── Locations browser ──────────────────────────────────────────────────────
async function renderLocations() {
  const tree = await api.get('/locations');
  await refreshShared();

  const locCards = (nodes, parentName) => nodes.map(n => `
    <div class="location-card" onclick="navigate('location',${n.id})">
      <div class="location-card-icon">${n.icon||'📦'}</div>
      <div class="location-card-name">${esc(n.name)}</div>
      <div class="location-card-count">${n.item_count} item${n.item_count!==1?'s':''} · ${n.children.length} sub-location${n.children.length!==1?'s':''}</div>
    </div>`).join('');

  const html = tree.length
    ? `<div class="locations-grid">${locCards(tree)}</div>`
    : `<div class="empty-state"><div class="empty-icon">📍</div><div class="empty-title">No locations yet</div><div class="empty-text">Add your first location to start organizing.</div></div>`;

  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div><div class="page-title">📍 Locations</div></div>
      <div class="page-header-actions">
        <button class="btn btn-primary" onclick="openLocationModal()">+ Add Location</button>
      </div>
    </div>
    ${html}`;
}

async function renderLocationDetail(id) {
  const [loc, items] = await Promise.all([
    api.get(`/locations/${id}`),
    api.get(`/items?location_id=${id}`),
  ]);
  await refreshShared();

  // Build breadcrumb
  const crumbs = await buildBreadcrumb(id);
  const breadcrumbHtml = crumbs.map((c,i) =>
    i < crumbs.length-1
      ? `<span class="breadcrumb-item" onclick="navigate('location',${c.id})">${esc(c.name)}</span><span class="breadcrumb-sep">›</span>`
      : `<span class="breadcrumb-current">${esc(c.name)}</span>`
  ).join('');

  const subLocHtml = loc.children.length
    ? `<div class="section">
        <div class="section-header"><div class="section-title">Sub-Locations</div></div>
        <div class="locations-grid">
          ${loc.children.map(c=>`
            <div class="location-card" onclick="navigate('location',${c.id})">
              <div class="location-card-icon">${c.icon||'📦'}</div>
              <div class="location-card-name">${esc(c.name)}</div>
              <div class="location-card-count">${c.item_count} item${c.item_count!==1?'s':''}</div>
            </div>`).join('')}
        </div></div>`
    : '';

  const itemsHtml = items.length
    ? `<div class="items-grid">${items.map(itemCardHtml).join('')}</div>`
    : `<div class="empty-state"><div class="empty-icon">📦</div><div class="empty-title">No items here</div><div class="empty-text">Add an item to this location.</div></div>`;

  document.getElementById('main-content').innerHTML = `
    <div class="breadcrumb">
      <span class="breadcrumb-item" onclick="navigate('locations')">📍 Locations</span>
      <span class="breadcrumb-sep">›</span>
      ${breadcrumbHtml}
    </div>
    <div class="page-header">
      <div>
        <div class="page-title">${loc.icon||'📦'} ${esc(loc.name)}</div>
        ${loc.description ? `<div class="page-subtitle">${esc(loc.description)}</div>` : ''}
      </div>
      <div class="page-header-actions">
        <button class="btn btn-ghost btn-sm" onclick="openLocationModal(${id})">✏️ Edit</button>
        <button class="btn btn-ghost btn-sm" onclick="openLocationModal(null,${id})">+ Sub-Location</button>
        <button class="btn btn-primary btn-sm" onclick="openAddItemModal(${id})">+ Add Item</button>
      </div>
    </div>
    ${subLocHtml}
    <div class="section">
      <div class="section-header">
        <div class="section-title">Items (${items.length})</div>
      </div>
      ${itemsHtml}
    </div>`;
}

async function buildBreadcrumb(id) {
  const flat = S.locations;
  const map = {};
  flat.forEach(l => map[l.id] = l);
  const parts = [];
  let cur = map[id];
  while (cur) { parts.unshift(cur); cur = map[cur.parent_id]; }
  return parts;
}

// ── Items list ─────────────────────────────────────────────────────────────
async function renderItems(filters = {}) {
  await refreshShared();
  let qs = [];
  if (filters.location_id) qs.push(`location_id=${filters.location_id}`);
  if (filters.category_id) qs.push(`category_id=${filters.category_id}`);
  if (filters.tag_ids) qs.push(`tag_ids=${filters.tag_ids}`);
  const items = await api.get('/items' + (qs.length ? '?' + qs.join('&') : ''));

  const locOptions = `<option value="">All Locations</option>` +
    locationPathIndented(S.locations).map(l => `<option value="${l.id}" ${filters.location_id==l.id?'selected':''}>${'—'.repeat(l.depth)} ${esc(l.name)}</option>`).join('');
  const catOptions = `<option value="">All Categories</option>` +
    S.categories.map(c => `<option value="${c.id}" ${filters.category_id==c.id?'selected':''}>${esc(c.icon||'')} ${esc(c.name)}</option>`).join('');

  const itemsHtml = items.length
    ? `<div class="items-grid">${items.map(itemCardHtml).join('')}</div>`
    : `<div class="empty-state"><div class="empty-icon">📦</div><div class="empty-title">No items found</div><div class="empty-text">Try adjusting filters or add a new item.</div></div>`;

  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div><div class="page-title">📦 All Items</div><div class="page-subtitle">${items.length} item${items.length!==1?'s':''}</div></div>
      <div class="page-header-actions">
        <button class="btn btn-primary" onclick="openAddItemModal()">+ Add Item</button>
      </div>
    </div>
    <div class="filter-bar">
      <span class="filter-label">Filter:</span>
      <select onchange="renderItems({...currentFilters(), location_id:this.value||null})">${locOptions}</select>
      <select onchange="renderItems({...currentFilters(), category_id:this.value||null})">${catOptions}</select>
    </div>
    ${itemsHtml}`;

  window._currentFilters = filters;
}

function currentFilters() { return window._currentFilters || {}; }

// ── Search ─────────────────────────────────────────────────────────────────
async function renderSearch(prefill = '') {
  await refreshShared();
  const selectedTagIds = new Set();

  const tagChips = S.tags.map(t => `
    <span class="tag-chip" id="tc-${t.id}" data-id="${t.id}" onclick="toggleSearchTag(${t.id})">#${esc(t.name)}</span>`
  ).join('');

  document.getElementById('main-content').innerHTML = `
    <div class="page-header"><div class="page-title">🔍 Search</div></div>
    <div class="search-hero">
      <div class="search-input-wrap">
        <span class="search-icon-big">🔍</span>
        <input id="search-input-big" class="search-input-big" type="text" placeholder="Search items by name, description, serial number…" autocomplete="off" value="${esc(prefill)}" oninput="doSearch()" />
      </div>
      <div class="tag-filter-chips">
        <span class="tag-filter-label">Filter by tag:</span>
        ${tagChips || '<span style="color:var(--text-3);font-size:12px">No tags yet</span>'}
      </div>
    </div>
    <div id="search-results"></div>`;

  window._searchSelectedTags = selectedTagIds;
  if (prefill) doSearch();
}

function toggleSearchTag(id) {
  const tags = window._searchSelectedTags;
  const el = document.getElementById(`tc-${id}`);
  if (tags.has(id)) { tags.delete(id); el.classList.remove('selected'); }
  else { tags.add(id); el.classList.add('selected'); }
  doSearch();
}

let _searchTimer;
function doSearch() {
  clearTimeout(_searchTimer);
  _searchTimer = setTimeout(async () => {
    const q = document.getElementById('search-input-big')?.value?.trim() || '';
    const tags = window._searchSelectedTags;
    if (!q && !tags.size) {
      document.getElementById('search-results').innerHTML = '';
      return;
    }
    let qs = [];
    if (q) qs.push(`q=${encodeURIComponent(q)}`);
    if (tags.size) qs.push(`tag_ids=${[...tags].join(',')}`);
    const items = await api.get('/search?' + qs.join('&'));
    const el = document.getElementById('search-results');
    if (!el) return;
    el.innerHTML = items.length
      ? `<div class="section-header"><div class="section-title">${items.length} result${items.length!==1?'s':''}</div></div><div class="items-grid">${items.map(itemCardHtml).join('')}</div>`
      : `<div class="empty-state"><div class="empty-icon">🔍</div><div class="empty-title">No results</div><div class="empty-text">Try different keywords or tags.</div></div>`;
  }, 250);
}

// ── Settings ───────────────────────────────────────────────────────────────
async function renderSettings() {
  await refreshShared();

  const catList = S.categories.map(c => `
    <div class="settings-item">
      <span class="settings-item-icon">${c.icon||'🏷️'}</span>
      <span class="color-dot" style="background:${c.color}"></span>
      <span class="settings-item-name">${esc(c.name)}</span>
      <div class="settings-item-actions">
        <button class="btn btn-ghost btn-sm btn-icon" onclick="editCategory(${c.id})">✏️</button>
        <button class="btn btn-danger btn-sm btn-icon" onclick="deleteCategory(${c.id})">🗑️</button>
      </div>
    </div>`).join('') || '<div style="padding:12px;color:var(--text-3);font-size:13px">No categories yet.</div>';

  const tagList = S.tags.map(t => `
    <div class="settings-item">
      <span class="settings-item-name"># ${esc(t.name)}</span>
      <div class="settings-item-actions">
        <button class="btn btn-danger btn-sm btn-icon" onclick="deleteTag(${t.id})">🗑️</button>
      </div>
    </div>`).join('') || '<div style="padding:12px;color:var(--text-3);font-size:13px">No tags yet.</div>';

  document.getElementById('main-content').innerHTML = `
    <div class="page-header"><div class="page-title">⚙️ Settings</div></div>
    <div class="settings-grid">
      <div class="settings-card">
        <div class="settings-card-header">
          <span class="settings-card-title">Categories</span>
          <button class="btn btn-primary btn-sm" onclick="openCategoryModal()">+ Add</button>
        </div>
        <div class="settings-list">${catList}</div>
      </div>
      <div class="settings-card">
        <div class="settings-card-header">
          <span class="settings-card-title">Tags</span>
          <button class="btn btn-primary btn-sm" onclick="openTagModal()">+ Add</button>
        </div>
        <div class="settings-list">${tagList}</div>
      </div>
    </div>

    <div class="settings-card" style="margin-top:24px">
      <div class="settings-card-header">
        <span class="settings-card-title">📤 Data Export</span>
      </div>
      <div style="padding:16px 20px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px">
        <div>
          <div style="font-size:14px;color:var(--text-1);font-weight:500">Export All Items to CSV</div>
          <div style="font-size:12px;color:var(--text-3);margin-top:4px">
            Includes: Name, Description, Location path, Category, Tags, Quantity, Price, Serial/Model #, Notes, Custom Fields
          </div>
        </div>
        <a href="/api/items/export" download
           class="btn btn-primary"
           style="text-decoration:none;display:inline-flex;align-items:center;gap:6px">
          ⬇️ Download CSV
        </a>
      </div>
    </div>`;

}

// ── Item Detail ────────────────────────────────────────────────────────────
async function openItemDetail(id) {
  const item = await api.get(`/items/${id}`);
  const locPath = locationPath(item.location_id);

  const imgHtml = item.image_path
    ? `<div class="detail-image"><img src="/uploads/${item.image_path}" alt="${esc(item.name)}" /></div>`
    : `<div class="detail-image">📦</div>`;

  const tagsHtml = item.tags.length
    ? item.tags.map(t => `<span class="tag">#${esc(t.name)}</span>`).join('')
    : '<span style="color:var(--text-3);font-size:12px">None</span>';

  const cfHtml = item.custom_fields.length
    ? `<table style="width:100%;font-size:13px;border-collapse:collapse">${item.custom_fields.map(cf=>`
        <tr style="border-bottom:1px solid var(--border)">
          <td style="padding:8px 12px 8px 0;color:var(--text-3);font-weight:600;width:40%">${esc(cf.key)}</td>
          <td style="padding:8px 0">${esc(cf.value||'')}</td>
        </tr>`).join('')}</table>`
    : '<div style="color:var(--text-3);font-size:13px">No custom fields.</div>';

  const docsHtml = item.documents.length
    ? `<div class="doc-list">${item.documents.map(d=>`
        <div class="doc-item">
          <span class="doc-icon">📄</span>
          <span class="doc-name">${esc(d.original_filename)}</span>
          <span class="doc-size">${formatBytes(d.size)}</span>
          <a href="/api/items/${id}/documents/${d.id}/download" class="btn btn-ghost btn-sm" target="_blank">↓</a>
          <button class="btn btn-danger btn-sm" onclick="deleteDoc(${id},${d.id})">🗑️</button>
        </div>`).join('')}</div>`
    : '<div style="color:var(--text-3);font-size:13px">No documents.</div>';

  const rows = (label, val) => val
    ? `<div class="detail-row"><div class="detail-row-label">${label}</div><div class="detail-row-value">${esc(String(val))}</div></div>` : '';

  openModal(`
    <div class="modal-header">
      <div class="modal-title">${esc(item.name)}</div>
      <button class="modal-close" onclick="closeModal()">×</button>
    </div>
    <div class="modal-body">
      <div class="detail-layout">
        <div>
          ${imgHtml}
          <div style="margin-top:10px;display:flex;gap:8px;justify-content:center">
            <label class="btn btn-ghost btn-sm" style="cursor:pointer">
              📷 ${item.image_path ? 'Change' : 'Upload'} Photo
              <input type="file" accept="image/*" style="display:none" onchange="uploadItemImage(${id},this)" />
            </label>
            ${item.image_path ? `<button class="btn btn-danger btn-sm" onclick="deleteItemImage(${id})">🗑️</button>` : ''}
          </div>
        </div>
        <div class="detail-meta">
          <div class="detail-name">${esc(item.name)}</div>
          ${item.description ? `<div style="color:var(--text-2);font-size:14px">${esc(item.description)}</div>` : ''}
          ${rows('Location', locPath)}
          ${rows('Category', item.category ? `${item.category.icon||''} ${item.category.name}` : null)}
          ${rows('Quantity', item.quantity)}
          ${rows('Price', item.purchase_price ? `$${item.purchase_price.toFixed(2)}` : null)}
          ${rows('Purchase Date', item.purchase_date)}
          ${rows('Serial #', item.serial_number)}
          ${rows('Model #', item.model_number)}
          <div class="detail-row">
            <div class="detail-row-label">Tags</div>
            <div class="detail-tags">${tagsHtml}</div>
          </div>
        </div>
      </div>

      <div style="margin-top:24px">
        <div class="detail-tabs">
          <button class="detail-tab active" onclick="switchDetailTab(event,'tab-notes')">Notes</button>
          <button class="detail-tab" onclick="switchDetailTab(event,'tab-custom')">Custom Fields</button>
          <button class="detail-tab" onclick="switchDetailTab(event,'tab-docs')">Documents</button>
        </div>
        <div id="tab-notes" class="detail-tab-panel active">
          ${item.notes ? `<div style="font-size:14px;color:var(--text-2);white-space:pre-wrap">${esc(item.notes)}</div>` : '<div style="color:var(--text-3);font-size:13px">No notes.</div>'}
        </div>
        <div id="tab-custom" class="detail-tab-panel">${cfHtml}</div>
        <div id="tab-docs" class="detail-tab-panel">
          ${docsHtml}
          <div style="margin-top:12px">
            <label class="btn btn-ghost btn-sm" style="cursor:pointer">
              + Upload Document
              <input type="file" style="display:none" onchange="uploadItemDoc(${id},this)" />
            </label>
          </div>
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-danger" onclick="confirmDeleteItem(${id})">Delete</button>
      <button class="btn btn-ghost" onclick="closeModal()">Close</button>
      <button class="btn btn-primary" onclick="closeModal();openEditItemModal(${id})">✏️ Edit</button>
    </div>`, true);
}

function switchDetailTab(e, id) {
  document.querySelectorAll('.detail-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.detail-tab-panel').forEach(p => p.classList.remove('active'));
  e.currentTarget.classList.add('active');
  document.getElementById(id).classList.add('active');
}

async function uploadItemImage(id, input) {
  const file = input.files[0]; if (!file) return;
  const fd = new FormData(); fd.append('file', file);
  try {
    await api.upload(`/items/${id}/image`, fd);
    toast('Image uploaded!', 'success');
    await openItemDetail(id);
    await loadSidebarTree();
  } catch(e) { toast(e.message, 'error'); }
}

async function deleteItemImage(id) {
  try {
    await api.delete(`/items/${id}/image`);
    toast('Image removed', 'success');
    await openItemDetail(id);
  } catch(e) { toast(e.message, 'error'); }
}

async function uploadItemDoc(id, input) {
  const file = input.files[0]; if (!file) return;
  const fd = new FormData(); fd.append('file', file);
  try {
    await api.upload(`/items/${id}/documents`, fd);
    toast('Document uploaded!', 'success');
    await openItemDetail(id);
  } catch(e) { toast(e.message, 'error'); }
}

async function deleteDoc(itemId, docId) {
  try {
    await api.delete(`/items/${itemId}/documents/${docId}`);
    toast('Document deleted', 'success');
    await openItemDetail(itemId);
  } catch(e) { toast(e.message, 'error'); }
}

async function confirmDeleteItem(id) {
  if (!confirm('Delete this item? This cannot be undone.')) return;
  try {
    await api.delete(`/items/${id}`);
    toast('Item deleted', 'success');
    closeModal();
    await loadSidebarTree();
    navigate(S.route, S.routeParam);
  } catch(e) { toast(e.message, 'error'); }
}

// ── Add / Edit Item Modal ──────────────────────────────────────────────────
async function openAddItemModal(prefillLocationId = null) {
  await refreshShared();
  _showItemForm(null, prefillLocationId);
}

async function openEditItemModal(id) {
  await refreshShared();
  const item = await api.get(`/items/${id}`);
  _showItemForm(item, null);
}

function _showItemForm(item, prefillLocId) {
  const editing = !!item;
  const locOptions = `<option value="">— None —</option>` +
    locationPathIndented(S.locations).map(l =>
      `<option value="${l.id}" ${((editing?item.location_id:prefillLocId)==l.id)?'selected':''}>${'—'.repeat(l.depth)} ${esc(l.name)}</option>`
    ).join('');
  const catOptions = `<option value="">— None —</option>` +
    S.categories.map(c =>
      `<option value="${c.id}" ${(editing&&item.category_id==c.id)?'selected':''}>${esc(c.icon||'')} ${esc(c.name)}</option>`
    ).join('');

  const existingTags = editing ? item.tags : [];
  window._itemFormTags = [...existingTags];
  window._pendingItemImage = null;

  const cfRows = (editing && item.custom_fields.length)
    ? item.custom_fields.map((_,i) => cfRowHtml(i)).join('')
    : '';

  openModal(`
    <div class="modal-header">
      <div class="modal-title">${editing ? '✏️ Edit Item' : '+ New Item'}</div>
      <button class="modal-close" onclick="closeModal()">×</button>
    </div>
    <div class="modal-body">
      <div class="form-row">
        <div class="form-group" style="grid-column:1/-1">
          <label class="form-label">Name *</label>
          <input id="if-name" class="form-input" placeholder="Item name" value="${esc(item?.name||'')}" />
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Description</label>
        <textarea id="if-desc" class="form-textarea" placeholder="Optional description">${esc(item?.description||'')}</textarea>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Location</label>
          <select id="if-loc" class="form-select">${locOptions}</select>
        </div>
        <div class="form-group">
          <label class="form-label">Category</label>
          <select id="if-cat" class="form-select">${catOptions}</select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Quantity</label>
          <input id="if-qty" class="form-input" type="number" min="0" value="${item?.quantity||1}" />
        </div>
        <div class="form-group">
          <label class="form-label">Purchase Price ($)</label>
          <input id="if-price" class="form-input" type="number" step="0.01" min="0" placeholder="0.00" value="${item?.purchase_price||''}" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Serial Number</label>
          <input id="if-serial" class="form-input" placeholder="S/N" value="${esc(item?.serial_number||'')}" />
        </div>
        <div class="form-group">
          <label class="form-label">Model Number</label>
          <input id="if-model" class="form-input" placeholder="Model" value="${esc(item?.model_number||'')}" />
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Photo</label>
        <div id="item-form-img-area" onclick="document.getElementById('item-form-img-input').click()"
          style="border:2px dashed var(--border);border-radius:8px;cursor:pointer;overflow:hidden;transition:border-color .2s;min-height:110px;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:12px;position:relative">
          <img id="item-form-img-preview" ${item?.image_path ? `src="/uploads/${item.image_path}"` : ''}
            style="width:100%;max-height:200px;object-fit:cover;border-radius:6px;display:${item?.image_path?'block':'none'}" />
          <div id="item-form-img-placeholder" style="text-align:center;${item?.image_path?'display:none':''}">
            <div style="font-size:28px;margin-bottom:6px">📷</div>
            <div style="color:var(--text-2);font-size:13px">Click to upload a photo</div>
            <div style="color:var(--text-3);font-size:11px;margin-top:3px">JPG, PNG, WebP</div>
          </div>
          <input type="file" id="item-form-img-input" accept="image/*" style="display:none" onchange="previewItemFormImage(this)" />
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Tags</label>
        <div id="tag-input-wrap" style="position:relative">
          <div class="tag-input-container" id="tag-input-container" onclick="document.getElementById('tag-field').focus()">
            ${existingTags.map(t=>`<span class="tag removable" data-id="${t.id}" onclick="removeItemFormTag(${t.id})"><span>#${esc(t.name)}</span><span class="tag-remove">×</span></span>`).join('')}
            <input id="tag-field" class="tag-input-field" placeholder="${existingTags.length?'':'Type tags, separate with spaces…'}" autocomplete="off"
              oninput="onTagFieldInput(this.value)" onkeydown="onTagFieldKey(event)" />
          </div>
          <div class="tag-suggestions hidden" id="tag-suggestions"></div>
        </div>
        <div class="form-hint">Separate multiple tags with spaces or commas — press Space or Enter to add all at once</div>
      </div>
      <div class="form-group">
        <label class="form-label">Notes</label>
        <textarea id="if-notes" class="form-textarea" placeholder="Any notes…">${esc(item?.notes||'')}</textarea>
      </div>
      <div class="form-group">
        <label class="form-label">Custom Fields</label>
        <div class="custom-fields-list" id="cf-list">
          ${editing ? (item.custom_fields||[]).map((cf,i)=>cfRowHtml(i,cf.key,cf.value)).join('') : ''}
        </div>
        <button class="btn btn-ghost btn-sm" onclick="addCfRow()">+ Add Field</button>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="saveItem(${editing?item.id:'null'})">
        ${editing ? 'Save Changes' : 'Create Item'}
      </button>
    </div>`, true);

  // Restore existing custom field values after render
  if (editing && item.custom_fields) {
    item.custom_fields.forEach((cf, i) => {
      const k = document.getElementById(`cf-key-${i}`);
      const v = document.getElementById(`cf-val-${i}`);
      if (k) k.value = cf.key;
      if (v) v.value = cf.value || '';
    });
  }
}

let _cfCount = 0;
function cfRowHtml(i, key='', val='') {
  _cfCount = Math.max(_cfCount, i+1);
  return `<div class="custom-field-row" id="cf-row-${i}">
    <input id="cf-key-${i}" class="form-input" placeholder="Field name" value="${esc(key)}" style="max-width:180px" />
    <input id="cf-val-${i}" class="form-input" placeholder="Value" value="${esc(val)}" />
    <button class="cf-remove" onclick="document.getElementById('cf-row-${i}').remove()">×</button>
  </div>`;
}

function addCfRow() {
  const list = document.getElementById('cf-list');
  const div = document.createElement('div');
  div.innerHTML = cfRowHtml(_cfCount++);
  list.appendChild(div.firstElementChild);
}

// Tag input in item form
function onTagFieldInput(val) {
  // Show suggestions for the LAST word being typed
  const parts = val.split(/[\s,]+/);
  const lastWord = parts[parts.length - 1].trim().toLowerCase();
  const sugg = document.getElementById('tag-suggestions');
  const existing = new Set(window._itemFormTags.map(t=>t.id));
  if (!lastWord) { sugg.classList.add('hidden'); return; }
  const matches = S.tags.filter(t => t.name.toLowerCase().includes(lastWord) && !existing.has(t.id));
  sugg.classList.remove('hidden');
  const wordCount = parts.filter(p=>p.trim().length>0).length;
  sugg.innerHTML = matches.slice(0,5).map(t =>
    `<div class="tag-suggestion-item" onclick="selectSuggestionTag(${t.id},'${esc(t.name)}')">#${esc(t.name)}</div>`
  ).join('') + `<div class="tag-suggestion-item" onclick="createTagsFromInput()">+ Add ${wordCount>1?wordCount+' tags':'"#'+esc(lastWord)+'"'}</div>`;
}

function onTagFieldKey(e) {
  if (e.key === ' ' || e.key === 'Enter' || e.key === ',') {
    e.preventDefault();
    createTagsFromInput();
  } else if (e.key === 'Escape') {
    document.getElementById('tag-suggestions').classList.add('hidden');
  }
}

async function createTagsFromInput() {
  const field = document.getElementById('tag-field');
  const val = field.value.trim();
  if (!val) return;
  const words = val.split(/[\s,]+/).filter(w => w.length > 0);
  for (const word of words) {
    await createAndAddTag(word);
  }
  field.value = '';
  document.getElementById('tag-suggestions').classList.add('hidden');
}

function selectSuggestionTag(id, name) {
  // Replace only the last partial word in the field, then add the tag
  const field = document.getElementById('tag-field');
  const parts = (field.value || '').split(/[\s,]+/);
  parts.pop();
  field.value = parts.filter(p=>p).join(' ');
  if (field.value) field.value += ' ';
  addItemFormTag(id, name);
  document.getElementById('tag-suggestions').classList.add('hidden');
  field.focus();
}

function addItemFormTag(id, name) {
  if (window._itemFormTags.find(t=>t.id===id)) return;
  window._itemFormTags.push({id, name});
  _renderItemFormTags();
  const field = document.getElementById('tag-field');
  if (field && !field.value.trim()) field.value = '';
  document.getElementById('tag-suggestions').classList.add('hidden');
}

async function createAndAddTag(name) {
  try {
    const tag = await api.post('/tags', {name});
    if (!S.tags.find(t=>t.id===tag.id)) S.tags.push(tag);
    addItemFormTag(tag.id, tag.name);
  } catch(e) { toast(e.message,'error'); }
}

function previewItemFormImage(input) {
  const file = input.files[0];
  if (!file) return;
  window._pendingItemImage = file;
  const reader = new FileReader();
  reader.onload = (e) => {
    const preview = document.getElementById('item-form-img-preview');
    const placeholder = document.getElementById('item-form-img-placeholder');
    preview.src = e.target.result;
    preview.style.display = 'block';
    if (placeholder) placeholder.style.display = 'none';
    document.getElementById('item-form-img-area').style.padding = '0';
  };
  reader.readAsDataURL(file);
}

function removeItemFormTag(id) {
  window._itemFormTags = window._itemFormTags.filter(t=>t.id!==id);
  _renderItemFormTags();
}

function _renderItemFormTags() {
  const container = document.getElementById('tag-input-container');
  const field = document.getElementById('tag-field');
  // Remove existing tag spans
  container.querySelectorAll('.tag').forEach(el=>el.remove());
  const tags = window._itemFormTags;
  tags.forEach(t => {
    const span = document.createElement('span');
    span.className = 'tag removable';
    span.dataset.id = t.id;
    span.innerHTML = `<span>#${esc(t.name)}</span><span class="tag-remove">×</span>`;
    span.onclick = () => removeItemFormTag(t.id);
    container.insertBefore(span, field);
  });
}

async function saveItem(id) {
  const name = document.getElementById('if-name').value.trim();
  if (!name) { toast('Name is required', 'error'); return; }

  // Collect custom fields
  const cfs = [];
  document.querySelectorAll('.custom-field-row').forEach((row, i) => {
    const k = row.querySelector('[id^="cf-key-"]')?.value?.trim();
    const v = row.querySelector('[id^="cf-val-"]')?.value?.trim();
    if (k) cfs.push({key:k, value:v||null});
  });

  const payload = {
    name,
    description: document.getElementById('if-desc').value.trim() || null,
    location_id: parseInt(document.getElementById('if-loc').value)||null,
    category_id: parseInt(document.getElementById('if-cat').value)||null,
    quantity: parseInt(document.getElementById('if-qty').value)||1,
    purchase_price: parseFloat(document.getElementById('if-price').value)||null,
    serial_number: document.getElementById('if-serial').value.trim()||null,
    model_number: document.getElementById('if-model').value.trim()||null,
    notes: document.getElementById('if-notes').value.trim()||null,
    tag_ids: window._itemFormTags.map(t=>t.id),
    custom_fields: cfs,
  };

  try {
    let savedItem;
    if (id) savedItem = await api.put(`/items/${id}`, payload);
    else savedItem = await api.post('/items', payload);

    // Upload photo if one was selected in the form
    if (window._pendingItemImage) {
      const fd = new FormData();
      fd.append('file', window._pendingItemImage);
      await api.upload(`/items/${savedItem.id}/image`, fd);
      window._pendingItemImage = null;
    }

    toast(id ? 'Item updated!' : 'Item created!', 'success');
    closeModal();
    await loadSidebarTree();
    navigate(S.route, S.routeParam);
  } catch(e) { toast(e.message, 'error'); }
}

// ── Location Modal ─────────────────────────────────────────────────────────
async function openLocationModal(editId = null, prefillParentId = null) {
  await refreshShared();
  let loc = null;
  if (editId) loc = await api.get(`/locations/${editId}`);

  const locOptions = `<option value="">— Root (no parent) —</option>` +
    locationPathIndented(S.locations)
      .filter(l => !editId || l.id !== editId)
      .map(l => `<option value="${l.id}" ${((loc?.parent_id||prefillParentId)==l.id)?'selected':''}>${'—'.repeat(l.depth)} ${esc(l.name)}</option>`)
      .join('');

  const icons = ['📦','🏠','🚪','🛏️','🛁','🍳','🍽️','🔧','🎨','📚','🧸','🎮','⚙️','🏋️','🌿','🚗','🏷️','📁'];

  openModal(`
    <div class="modal-header">
      <div class="modal-title">${editId ? '✏️ Edit Location' : '+ New Location'}</div>
      <button class="modal-close" onclick="closeModal()">×</button>
    </div>
    <div class="modal-body">
      <div class="form-group">
        <label class="form-label">Name *</label>
        <input id="lf-name" class="form-input" placeholder="e.g. Garage, Shelf A, Tub 3" value="${esc(loc?.name||'')}" />
      </div>
      <div class="form-group">
        <label class="form-label">Description</label>
        <input id="lf-desc" class="form-input" placeholder="Optional description" value="${esc(loc?.description||'')}" />
      </div>
      <div class="form-group">
        <label class="form-label">Parent Location</label>
        <select id="lf-parent" class="form-select">${locOptions}</select>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Icon</label>
          <select id="lf-icon" class="form-select">
            ${icons.map(ic=>`<option value="${ic}" ${(loc?.icon||'📦')===ic?'selected':''}>${ic} ${ic}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Color</label>
          <input id="lf-color" type="color" class="form-input" style="height:40px;padding:4px" value="${loc?.color||'#6366f1'}" />
        </div>
      </div>
    </div>
    <div class="modal-footer">
      ${editId ? `<button class="btn btn-danger" onclick="confirmDeleteLocation(${editId})">Delete</button>` : ''}
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="saveLocation(${editId||'null'})">${editId ? 'Save' : 'Create'}</button>
    </div>`);
}

async function saveLocation(id) {
  const name = document.getElementById('lf-name').value.trim();
  if (!name) { toast('Name is required', 'error'); return; }
  const payload = {
    name,
    description: document.getElementById('lf-desc').value.trim()||null,
    parent_id: parseInt(document.getElementById('lf-parent').value)||null,
    icon: document.getElementById('lf-icon').value,
    color: document.getElementById('lf-color').value,
  };
  try {
    if (id) await api.put(`/locations/${id}`, payload);
    else await api.post('/locations', payload);
    toast(id ? 'Location updated!' : 'Location created!', 'success');
    closeModal();
    await refreshShared();
    await loadSidebarTree();
    navigate(S.route, S.routeParam);
  } catch(e) { toast(e.message, 'error'); }
}

async function confirmDeleteLocation(id) {
  if (!confirm('Delete this location? Items inside will not be deleted but will lose their location.')) return;
  try {
    await api.delete(`/locations/${id}`);
    toast('Location deleted', 'success');
    closeModal();
    await refreshShared();
    await loadSidebarTree();
    navigate('locations');
  } catch(e) { toast(e.message, 'error'); }
}

// ── Category Modal ─────────────────────────────────────────────────────────
function openCategoryModal(cat = null) {
  const icons = ['🏷️','🔧','⚡','🎮','📚','🍳','🌿','🚗','🎨','👕','🧸','💊','🔑','📦'];
  openModal(`
    <div class="modal-header">
      <div class="modal-title">${cat ? '✏️ Edit Category' : '+ New Category'}</div>
      <button class="modal-close" onclick="closeModal()">×</button>
    </div>
    <div class="modal-body">
      <div class="form-group">
        <label class="form-label">Name *</label>
        <input id="catf-name" class="form-input" value="${esc(cat?.name||'')}" placeholder="Category name" />
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Icon</label>
          <select id="catf-icon" class="form-select">
            ${icons.map(ic=>`<option value="${ic}" ${(cat?.icon||'🏷️')===ic?'selected':''}>${ic} ${ic}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Color</label>
          <input id="catf-color" type="color" class="form-input" style="height:40px;padding:4px" value="${cat?.color||'#22d3ee'}" />
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="saveCategory(${cat?.id||'null'})">${cat?'Save':'Create'}</button>
    </div>`);
}

async function editCategory(id) {
  const cat = S.categories.find(c=>c.id===id);
  openCategoryModal(cat);
}

async function saveCategory(id) {
  const name = document.getElementById('catf-name').value.trim();
  if (!name) { toast('Name required','error'); return; }
  const payload = { name, icon: document.getElementById('catf-icon').value, color: document.getElementById('catf-color').value };
  try {
    if (id) await api.put(`/categories/${id}`, payload);
    else await api.post('/categories', payload);
    toast(id?'Category updated!':'Category created!','success');
    closeModal();
    await refreshShared();
    navigate('settings');
  } catch(e) { toast(e.message,'error'); }
}

async function deleteCategory(id) {
  if (!confirm('Delete this category?')) return;
  try {
    await api.delete(`/categories/${id}`);
    toast('Category deleted','success');
    await refreshShared();
    navigate('settings');
  } catch(e) { toast(e.message,'error'); }
}

// ── Tag Modal ──────────────────────────────────────────────────────────────
function openTagModal() {
  openModal(`
    <div class="modal-header">
      <div class="modal-title">+ New Tag</div>
      <button class="modal-close" onclick="closeModal()">×</button>
    </div>
    <div class="modal-body">
      <div class="form-group">
        <label class="form-label">Tag Name *</label>
        <input id="tf-name" class="form-input" placeholder="e.g. fragile, seasonal, tools" />
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="saveTag()">Create</button>
    </div>`);
}

async function saveTag() {
  const name = document.getElementById('tf-name').value.trim();
  if (!name) { toast('Name required','error'); return; }
  try {
    await api.post('/tags', {name});
    toast('Tag created!','success');
    closeModal();
    await refreshShared();
    navigate('settings');
  } catch(e) { toast(e.message,'error'); }
}

async function deleteTag(id) {
  if (!confirm('Delete this tag? It will be removed from all items.')) return;
  try {
    await api.delete(`/tags/${id}`);
    toast('Tag deleted','success');
    await refreshShared();
    navigate('settings');
  } catch(e) { toast(e.message,'error'); }
}
