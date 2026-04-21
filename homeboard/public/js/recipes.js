// public/js/recipes.js

const Recipes = {
  items: [],
  activeTag: null,
  mode: 'parent',
  myProfile: null,

  SOURCE_ICONS: { youtube: '▶', instagram: '📷', website: '🔗', email: '📧', manual: '📝' },
  SOURCE_LABELS: { youtube: 'YouTube', instagram: 'Instagram', website: 'Website', email: 'Email', manual: 'Manual' },

  async render(container, mode, myProfile) {
    this.mode = mode;
    this.myProfile = myProfile;
    container.innerHTML = '<div class="loading-state">Loading recipes…</div>';

    try {
      this.items = await API.recipes.list();
    } catch (e) {
      container.innerHTML = `<div class="empty-state"><div class="empty-state-title">Couldn't load recipes</div><div class="empty-state-desc">${e.message}</div></div>`;
      return;
    }

    this._renderContent(container);
  },

  _renderContent(container) {
    // Gather all unique tags
    const allTags = [...new Set(this.items.flatMap(r => r.tags || []))].sort();
    const filtered = this.activeTag ? this.items.filter(r => r.tags?.includes(this.activeTag)) : this.items;

    const tagsHTML = `
      <div class="filter-bar">
        <span class="filter-chip${!this.activeTag ? ' active' : ''}" onclick="Recipes.filterByTag(null)">All</span>
        ${allTags.map(t => `<span class="filter-chip${this.activeTag === t ? ' active' : ''}" onclick="Recipes.filterByTag('${t}')">${t}</span>`).join('')}
      </div>`;

    const gridHTML = filtered.length
      ? `<div class="recipes-grid">${filtered.map(r => this._renderCard(r)).join('')}</div>`
      : `<div class="empty-state">
          <div class="empty-state-emoji">🍳</div>
          <div class="empty-state-title">No recipes yet</div>
          <div class="empty-state-desc">Add recipes manually or forward a YouTube, Instagram or website link.</div>
          ${this.mode === 'parent' ? `<button class="btn primary" onclick="Recipes.showAddModal()">+ Add first recipe</button>` : ''}
        </div>`;

    const emailBanner = this.mode === 'parent' ? `
      <div class="info-banner green" style="margin-bottom:16px">
        📧 <strong>Forward recipes by email</strong> — paste a YouTube, Instagram or recipe URL into an email and forward it to your Zapier mailbox. It'll appear here automatically.
        <a href="#" onclick="Recipes.showEmailInfo(event)" style="margin-left:4px">How to set up →</a>
      </div>` : '';

    container.innerHTML = emailBanner + tagsHTML + gridHTML;
  },

  _renderCard(r) {
    const thumbContent = r.youtube_id
      ? `<img src="https://img.youtube.com/vi/${r.youtube_id}/mqdefault.jpg" alt="${r.title}" onerror="this.parentElement.innerHTML='${r.emoji || '🍳'}'">
         <span class="source-badge">▶ YouTube</span>`
      : (r.emoji || '🍳');

    const tagsHTML = (r.tags || []).map(t => `<span class="tag tag-green">${t}</span>`).join('');
    const scheduled = r.scheduled_date
      ? `<div class="recipe-scheduled">📅 ${new Date(r.scheduled_date + 'T00:00:00').toLocaleDateString('en-GB', { day:'numeric', month:'short' })}</div>`
      : '';

    return `<div class="recipe-card" onclick="Recipes.openRecipe('${r.id}')">
      <div class="recipe-thumb">${thumbContent}</div>
      <div class="recipe-body">
        <div class="recipe-title">${this._esc(r.title)}</div>
        <div class="recipe-tags">${tagsHTML}</div>
        ${scheduled}
        <div class="recipe-source">${this.SOURCE_ICONS[r.source_type] || '📝'} ${this.SOURCE_LABELS[r.source_type] || 'Manual'}</div>
      </div>
    </div>`;
  },

  filterByTag(tag) {
    this.activeTag = tag;
    this._renderContent(document.getElementById('mainContent'));
  },

  openRecipe(id) {
    const r = this.items.find(x => x.id === id);
    if (!r) return;

    const tagsHTML = (r.tags || []).map(t => `<span class="tag tag-green">${t}</span>`).join('');
    const scheduled = r.scheduled_date
      ? `<div class="tag tag-amber">📅 Scheduled: ${new Date(r.scheduled_date + 'T00:00:00').toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })}</div>`
      : '';

    const thumbHTML = r.youtube_id
      ? `<img src="https://img.youtube.com/vi/${r.youtube_id}/mqdefault.jpg" style="width:100%;border-radius:var(--radius);margin-bottom:16px">`
      : '';

    const linkHTML = r.url
      ? `<a href="${r.url}" target="_blank" rel="noopener" class="btn" style="margin-top:4px">
          ${this.SOURCE_ICONS[r.source_type]} Open ${this.SOURCE_LABELS[r.source_type] || 'link'}
        </a>`
      : '';

    const editButtons = this.mode === 'parent' ? `
      <button class="btn" onclick="Modal.close();Recipes.showEditModal('${r.id}')">Edit</button>
      <button class="btn danger" onclick="Recipes.deleteRecipe('${r.id}')">Delete</button>` : '';

    Modal.show(`<div class="modal-title">${this._esc(r.title)}</div>
      ${thumbHTML}
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px">${tagsHTML}${scheduled}</div>
      ${r.description ? `<div style="font-size:13px;color:var(--text2);line-height:1.6;margin-bottom:12px">${this._esc(r.description)}</div>` : ''}
      ${linkHTML}
      <div class="modal-actions">
        <button class="btn" onclick="Modal.close()">Close</button>
        ${editButtons}
      </div>`);
  },

  showAddModal() {
    Modal.show(`<div class="modal-title">Add Recipe</div>
      <div class="form-group">
        <label class="form-label">Recipe title</label>
        <input class="form-input" id="recTitle" placeholder="e.g. Spicy Thai Noodles">
      </div>
      <div class="form-group">
        <label class="form-label">URL (YouTube, Instagram, website — optional)</label>
        <input class="form-input" id="recUrl" placeholder="https://..." oninput="Recipes._autoTitle(this.value)">
      </div>
      <div class="form-group">
        <label class="form-label">Tags (comma-separated)</label>
        <input class="form-input" id="recTags" placeholder="e.g. Healthy, Asian, Fast">
      </div>
      <div class="form-group">
        <label class="form-label">Emoji</label>
        <input class="form-input" id="recEmoji" placeholder="🍳" style="width:60px">
      </div>
      <div class="form-group">
        <label class="form-label">Schedule for (optional)</label>
        <input class="form-input" type="date" id="recDate">
      </div>
      <div class="form-group">
        <label class="form-label">Notes (optional)</label>
        <textarea class="form-input" id="recDesc" rows="2" placeholder="Any notes or method hints"></textarea>
      </div>
      <div id="recError" class="form-error hidden"></div>
      <div class="modal-actions">
        <button class="btn" onclick="Modal.close()">Cancel</button>
        <button class="btn primary" onclick="Recipes.saveNew()">Add Recipe</button>
      </div>`);
  },

  _autoTitle(url) {
    // Attempt to suggest a title hint based on URL domain
    const titleInput = document.getElementById('recTitle');
    if (titleInput && !titleInput.value && url) {
      try {
        const hostname = new URL(url).hostname.replace('www.', '');
        titleInput.placeholder = `Recipe from ${hostname}`;
      } catch {}
    }
  },

  async saveNew() {
    const title = document.getElementById('recTitle').value.trim();
    const url = document.getElementById('recUrl').value.trim();
    const tagsRaw = document.getElementById('recTags').value;
    const emoji = document.getElementById('recEmoji').value.trim() || '🍳';
    const date = document.getElementById('recDate').value;
    const desc = document.getElementById('recDesc').value.trim();
    const errEl = document.getElementById('recError');

    if (!title) { errEl.textContent = 'Title is required'; errEl.classList.remove('hidden'); return; }

    const tags = tagsRaw.split(',').map(t => t.trim()).filter(Boolean);

    try {
      await API.recipes.create({ title, url: url || null, tags, emoji, scheduled_date: date || null, description: desc || null });
      Modal.close();
      Toast.show('Recipe added', 'success');
      this.items = await API.recipes.list();
      this._renderContent(document.getElementById('mainContent'));
    } catch (e) {
      errEl.textContent = e.message; errEl.classList.remove('hidden');
    }
  },

  showEditModal(id) {
    const r = this.items.find(x => x.id === id);
    if (!r) return;

    Modal.show(`<div class="modal-title">Edit Recipe</div>
      <div class="form-group"><label class="form-label">Title</label><input class="form-input" id="editRecTitle" value="${this._esc(r.title)}"></div>
      <div class="form-group"><label class="form-label">URL (optional)</label><input class="form-input" id="editRecUrl" value="${r.url || ''}"></div>
      <div class="form-group"><label class="form-label">Tags</label><input class="form-input" id="editRecTags" value="${(r.tags||[]).join(', ')}"></div>
      <div class="form-group"><label class="form-label">Emoji</label><input class="form-input" id="editRecEmoji" value="${r.emoji || '🍳'}" style="width:60px"></div>
      <div class="form-group"><label class="form-label">Schedule for</label><input class="form-input" type="date" id="editRecDate" value="${r.scheduled_date || ''}"></div>
      <div class="form-group"><label class="form-label">Notes</label><textarea class="form-input" id="editRecDesc" rows="2">${r.description || ''}</textarea></div>
      <div id="editRecError" class="form-error hidden"></div>
      <div class="modal-actions">
        <button class="btn" onclick="Modal.close()">Cancel</button>
        <button class="btn primary" onclick="Recipes.saveEdit('${r.id}')">Save</button>
      </div>`);
  },

  async saveEdit(id) {
    const title = document.getElementById('editRecTitle').value.trim();
    const url = document.getElementById('editRecUrl').value.trim();
    const tagsRaw = document.getElementById('editRecTags').value;
    const emoji = document.getElementById('editRecEmoji').value.trim() || '🍳';
    const date = document.getElementById('editRecDate').value;
    const desc = document.getElementById('editRecDesc').value.trim();
    const errEl = document.getElementById('editRecError');

    if (!title) { errEl.textContent = 'Title is required'; errEl.classList.remove('hidden'); return; }
    const tags = tagsRaw.split(',').map(t => t.trim()).filter(Boolean);

    try {
      await API.recipes.update(id, { title, url: url || null, tags, emoji, scheduled_date: date || null, description: desc || null });
      Modal.close();
      Toast.show('Recipe updated', 'success');
      this.items = await API.recipes.list();
      this._renderContent(document.getElementById('mainContent'));
    } catch (e) {
      errEl.textContent = e.message; errEl.classList.remove('hidden');
    }
  },

  async deleteRecipe(id) {
    if (!confirm('Delete this recipe?')) return;
    try {
      await API.recipes.delete(id);
      Modal.close();
      Toast.show('Recipe deleted');
      this.items = await API.recipes.list();
      this._renderContent(document.getElementById('mainContent'));
    } catch (e) {
      Toast.show(e.message, 'error');
    }
  },

  showEmailInfo(e) {
    if (e) e.preventDefault();
    Modal.show(`<div class="modal-title">📧 Forward Recipes by Email</div>
      <div style="font-size:13px;color:var(--text2);line-height:1.7;margin-bottom:16px">
        Found a recipe you love? Forward the email (or any email containing a URL) to your Zapier mailbox address and it'll appear in Homeboard automatically.
      </div>
      <div class="info-banner blue">
        <strong>Supported sources:</strong><br>
        ▶ YouTube recipe videos<br>
        📷 Instagram recipe posts<br>
        🔗 Any recipe website URL<br>
        📧 Newsletter emails with recipes
      </div>
      <div style="margin-top:14px">
        <div style="font-size:12px;font-weight:600;color:var(--text2);margin-bottom:8px">HOW TO SET UP</div>
        <ol style="font-size:13px;color:var(--text2);line-height:2;padding-left:18px">
          <li>Create a free account at <strong>zapier.com</strong></li>
          <li>Create a Zap: trigger = <strong>Email by Zapier</strong> (gives you an inbox address)</li>
          <li>Action = <strong>Webhooks by Zapier → POST</strong></li>
          <li>URL: <code style="background:var(--surface2);padding:2px 6px;border-radius:4px;font-size:11px">${window.location.origin}/api/inbound-email?secret=YOUR_WEBHOOK_SECRET</code></li>
          <li>Body: include <code style="background:var(--surface2);padding:2px 6px;border-radius:4px;font-size:11px">family_id</code>, <code style="background:var(--surface2);padding:2px 6px;border-radius:4px;font-size:11px">subject</code>, <code style="background:var(--surface2);padding:2px 6px;border-radius:4px;font-size:11px">body_text</code></li>
        </ol>
      </div>
      <div class="modal-actions"><button class="btn primary" onclick="Modal.close()">Got it</button></div>`);
  },

  _esc(str = '') {
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  },
};
