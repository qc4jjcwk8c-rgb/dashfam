// public/js/app.js
// Top-level app controller — initialises state, handles navigation

const App = {
  mode: 'parent',
  currentSection: 'calendar',
  myProfile: null,
  family: null,
  members: [],
  icalUrl: null,

  initWithData({ profile, family, members, ical_url }) {
    this.myProfile = profile;
    this.family = family;
    this.members = members || [];
    this.icalUrl = ical_url;

    // Show app, hide auth
    document.getElementById('authScreen').classList.add('hidden');
    document.getElementById('appScreen').classList.remove('hidden');

    // Populate family name
    document.getElementById('familyNameDisplay').textContent = family?.name || 'Family';

    // Set mode based on profile role
    this.mode = profile.role === 'child' ? 'child' : 'parent';
    this._updateModeUI();

    // If child, hide parent mode button and rename child button
    if (profile.role === 'child') {
      document.getElementById('parentModeBtn').classList.add('hidden');
      document.getElementById('childModeLabel').textContent = profile.display_name || 'Child';
      document.getElementById('childModeBtn').classList.add('active');
      document.getElementById('parentModeBtn').classList.remove('active');
    } else {
      // Set child button label to first child's name, or "Child"
      const firstChild = this.members.find(m => m.role === 'child');
      document.getElementById('childModeLabel').textContent = firstChild?.display_name || 'Child view';
    }

    // Render member list in sidebar
    this._renderMemberList();

    // Render initial section
    this.showSection('calendar');
  },

  reset() {
    this.myProfile = null;
    this.family = null;
    this.members = [];
    this.icalUrl = null;
    this.mode = 'parent';
    this.currentSection = 'calendar';
  },

  setMode(m) {
    // Parents can switch between modes; children are locked to child
    if (this.myProfile?.role === 'child') return;
    this.mode = m;
    this._updateModeUI();
    this.showSection(this.currentSection);
  },

  _updateModeUI() {
    document.getElementById('parentModeBtn').classList.toggle('active', this.mode === 'parent');
    document.getElementById('childModeBtn').classList.toggle('active', this.mode === 'child');
  },

  showSection(section, navBtn) {
    this.currentSection = section;

    // Update nav highlight
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    if (navBtn) navBtn.classList.add('active');
    else {
      const allNavBtns = document.querySelectorAll('.nav-item');
      allNavBtns.forEach(btn => {
        if (btn.textContent.toLowerCase().includes(section.slice(0, 5))) btn.classList.add('active');
      });
    }

    // Update topbar title + actions
    const titles = { calendar: 'Calendar', recipes: 'Recipes' };
    document.getElementById('topbarTitle').textContent = titles[section] || section;

    const actionsEl = document.getElementById('topbarActions');
    if (this.mode === 'parent') {
      if (section === 'calendar') {
        actionsEl.innerHTML = `
          <button class="btn btn-sm" onclick="Calendar.showSyncModal()">🍎 Sync calendar</button>
          <button class="btn btn-sm primary" onclick="Calendar.showAddEventModal()">+ Add Event</button>`;
      } else if (section === 'recipes') {
        actionsEl.innerHTML = `
          <button class="btn btn-sm" onclick="Recipes.showEmailInfo()">📧 Forward recipe</button>
          <button class="btn btn-sm primary" onclick="Recipes.showAddModal()">+ Add Recipe</button>`;
      }
    } else {
      actionsEl.innerHTML = '';
    }

    // Render the section
    const container = document.getElementById('mainContent');
    const viewProfile = this.mode === 'child'
      ? (this.members.find(m => m.role === 'child' && m.id !== this.myProfile?.id) || this.myProfile)
      : this.myProfile;

    if (section === 'calendar') {
      Calendar.render(container, this.mode, viewProfile, this.members);
    } else if (section === 'recipes') {
      Recipes.render(container, this.mode, viewProfile);
    }
  },

  _renderMemberList() {
    const el = document.getElementById('membersList');
    el.innerHTML = this.members.map(m => `
      <div class="member-item">
        <span class="avatar avatar-sm" style="background:${this._memberBg(m)};color:${m.color || '#2D5A27'}">${m.initials}</span>
        <span>${m.display_name}</span>
        <span class="role-badge">${m.role}</span>
      </div>`).join('');
  },

  showFamilyInfo() {
    const familyId = this.family?.id || '—';
    Modal.show(`<div class="modal-title">Family info</div>
      <div class="form-group">
        <label class="form-label">Family name</label>
        <div style="font-size:14px;color:var(--text)">${this.family?.name || '—'}</div>
      </div>
      <div class="form-group">
        <label class="form-label">Family ID</label>
        <div style="display:flex;gap:6px">
          <input class="form-input" value="${familyId}" readonly id="familyIdInput" style="font-size:12px">
          <button class="btn btn-sm" onclick="navigator.clipboard.writeText('${familyId}');Toast.show('Copied!')">Copy</button>
        </div>
        <div style="font-size:11px;color:var(--text3);margin-top:4px">Share this ID with family members so they can join using the "Join family" option when they sign up.</div>
      </div>
      <div class="form-group">
        <label class="form-label">Members</label>
        <div>${this.members.map(m => `
          <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:0.5px solid var(--border)">
            <span class="avatar avatar-sm" style="background:${this._memberBg(m)};color:${m.color}">${m.initials}</span>
            <span style="font-size:13px">${m.display_name}</span>
            <span style="font-size:11px;color:var(--text3);margin-left:auto">${m.role}</span>
          </div>`).join('')}
        </div>
      </div>
      <div class="modal-actions"><button class="btn primary" onclick="Modal.close()">Close</button></div>`);
  },

  _memberBg(m) {
    // Derive a light background from the member color
    const colorBgMap = {
      '#185FA5': '#E6F1FB',
      '#2D5A27': '#EAF3DE',
      '#534AB7': '#EEEDFE',
      '#993C1D': '#FAECE7',
      '#0F6E56': '#E1F5EE',
      '#993556': '#FBEAF0',
    };
    return colorBgMap[m.color] || '#F0EDE8';
  },
};
