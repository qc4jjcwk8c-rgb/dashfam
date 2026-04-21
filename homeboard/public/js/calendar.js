// public/js/calendar.js

const Calendar = {
  year: new Date().getFullYear(),
  month: new Date().getMonth(),
  events: [],
  members: [],
  myProfile: null,
  mode: 'parent',

  MONTH_NAMES: ['January','February','March','April','May','June','July','August','September','October','November','December'],
  DAY_NAMES: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],
  SHORT_MONTHS: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],

  async load(mode, myProfile, members) {
    this.mode = mode;
    this.myProfile = myProfile;
    this.members = members;

    const params = { month: `${this.year}-${String(this.month + 1).padStart(2, '0')}` };
    this.events = await API.events.list(params);
  },

  async render(container, mode, myProfile, members) {
    container.innerHTML = '<div class="loading-state">Loading calendar…</div>';
    try {
      await this.load(mode, myProfile, members);
    } catch (e) {
      container.innerHTML = `<div class="empty-state"><div class="empty-state-title">Couldn't load calendar</div><div class="empty-state-desc">${e.message}</div></div>`;
      return;
    }

    if (mode === 'child') {
      this.renderChildWeek(container);
    } else {
      this.renderParentCalendar(container);
    }
  },

  renderParentCalendar(container) {
    const icalUrl = App.icalUrl;
    const firstDay = new Date(this.year, this.month, 1);
    const lastDay = new Date(this.year, this.month + 1, 0);
    const todayStr = new Date().toISOString().slice(0, 10);

    // Start grid on Monday
    let startDow = firstDay.getDay(); if (startDow === 0) startDow = 7; startDow--;
    const totalCells = Math.ceil((startDow + lastDay.getDate()) / 7) * 7;

    let daysHTML = '';
    for (let i = 0; i < totalCells; i++) {
      const d = i - startDow + 1;
      let dateObj, otherMonth = false;

      if (d < 1) {
        dateObj = new Date(this.year, this.month, d);
        otherMonth = true;
      } else if (d > lastDay.getDate()) {
        dateObj = new Date(this.year, this.month + 1, d - lastDay.getDate());
        otherMonth = true;
      } else {
        dateObj = new Date(this.year, this.month, d);
      }

      const dateStr = dateObj.toISOString().slice(0, 10);
      const isToday = dateStr === todayStr;
      const dayNum = dateObj.getDate();
      const dayEvts = this.events.filter(e => e.event_date === dateStr);

      const dayNumHtml = isToday
        ? `<div class="day-today-num">${dayNum}</div>`
        : `<div class="day-num" style="${otherMonth ? 'color:var(--text3)' : ''}">${dayNum}</div>`;

      const evtsHtml = dayEvts.slice(0, 3).map(e =>
        `<div class="day-event" style="background:${e.color_bg || '#EAF3DE'};color:${e.color || '#2D5A27'}">${this._escHtml(e.title)}</div>`
      ).join('') + (dayEvts.length > 3 ? `<div class="day-overflow">+${dayEvts.length - 3} more</div>` : '');

      daysHTML += `<div class="day-cell${otherMonth ? ' other-month' : ''}${isToday ? ' today' : ''}" onclick="Calendar.openDayDetail('${dateStr}')">${dayNumHtml}${evtsHtml}</div>`;
    }

    // Upcoming events (next 30 days)
    const upcoming = [...this.events]
      .filter(e => e.event_date >= todayStr)
      .sort((a, b) => a.event_date.localeCompare(b.event_date))
      .slice(0, 6);

    const upcomingHTML = upcoming.length
      ? upcoming.map(e => this._renderEventItem(e)).join('')
      : `<div style="font-size:13px;color:var(--text3);text-align:center;padding:16px">No upcoming events</div>`;

    container.innerHTML = `
      <div class="info-banner blue">
        📱 <span><strong>Apple Calendar sync</strong> — Subscribe to your family calendar in the Apple Calendar app.
        <a href="#" onclick="Calendar.showSyncModal(event)">Set up sync →</a></span>
      </div>
      <div class="cal-layout">
        <div>
          <div class="cal-header">
            <div class="cal-month">${this.MONTH_NAMES[this.month]} ${this.year}</div>
            <div class="cal-nav">
              <button class="cal-nav-btn" onclick="Calendar.changeMonth(-1)">‹</button>
              <button class="cal-nav-btn" onclick="Calendar.changeMonth(1)">›</button>
            </div>
          </div>
          <div class="weekdays">${this.DAY_NAMES.map(d => `<div class="weekday">${d}</div>`).join('')}</div>
          <div class="days-grid">${daysHTML}</div>
        </div>
        <div>
          <div class="upcoming-panel">
            <div class="panel-title">Upcoming</div>
            ${upcomingHTML}
          </div>
        </div>
      </div>`;
  },

  renderChildWeek(container) {
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

    let daysHTML = '';
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const dateStr = d.toISOString().slice(0, 10);
      const isToday = dateStr === todayStr;
      const dayEvts = this.events.filter(e => e.event_date === dateStr);

      const evtsHtml = dayEvts.map(e =>
        `<div class="day-event" style="background:${e.color_bg || '#EAF3DE'};color:${e.color || '#2D5A27'}">${this._escHtml(e.title)}</div>`
      ).join('');

      daysHTML += `<div class="week-day${isToday ? ' week-today' : ''}">
        <div class="week-day-name">${dayNames[d.getDay()]}</div>
        <div class="week-day-num">${d.getDate()}</div>
        ${evtsHtml || '<div style="font-size:11px;color:var(--text3)">Free</div>'}
      </div>`;
    }

    container.innerHTML = `
      <div class="info-banner amber">
        👋 Here's your week ahead, ${this.myProfile?.display_name || 'there'}!
      </div>
      <div class="week-grid" style="margin-bottom:24px">${daysHTML}</div>
      <div class="section-header"><div class="section-title">Add something</div></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${['⚽ Football practice','📚 Study session','🏃 Out with friends','🎮 Gaming night','🎨 Art club'].map(s =>
          `<button class="btn" onclick="Calendar.addChildActivity('${s}')">${s}</button>`
        ).join('')}
        <button class="btn" onclick="Calendar.showAddActivityModal()">+ Custom</button>
      </div>`;
  },

  _renderEventItem(e) {
    const d = new Date(e.event_date + 'T00:00:00');
    const dateLabel = `${d.getDate()} ${this.SHORT_MONTHS[d.getMonth()]}`;
    const attendees = (e.event_attendees || [])
      .map(a => {
        const m = this.members.find(mb => mb.id === a.profile_id);
        return m ? `<span class="avatar avatar-sm" style="background:${m.bg || '#EAF3DE'};color:${m.color}">${m.initials}</span>` : '';
      }).join('');

    return `<div class="event-item">
      <div class="event-item-header">
        <div class="event-item-title">${this._escHtml(e.title)}</div>
        <span class="event-date-badge" style="background:${e.color_bg || '#EAF3DE'};color:${e.color || '#2D5A27'}">${dateLabel}</span>
      </div>
      ${attendees ? `<div class="event-attendees">${attendees}</div>` : ''}
    </div>`;
  },

  async changeMonth(delta) {
    this.month += delta;
    if (this.month > 11) { this.month = 0; this.year++; }
    if (this.month < 0)  { this.month = 11; this.year--; }
    await this.render(document.getElementById('mainContent'), this.mode, this.myProfile, this.members);
  },

  openDayDetail(dateStr) {
    const dayEvts = this.events.filter(e => e.event_date === dateStr);
    const d = new Date(dateStr + 'T00:00:00');
    const title = `${d.getDate()} ${this.MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;

    if (dayEvts.length === 0) {
      this.showAddEventModal(dateStr);
      return;
    }

    const eventsHtml = dayEvts.map(e => {
      const attendees = (e.event_attendees || [])
        .map(a => {
          const m = this.members.find(mb => mb.id === a.profile_id);
          return m ? `<span class="avatar avatar-sm" style="background:${m.bg||'#EAF3DE'};color:${m.color}">${m.initials}</span>` : '';
        }).join('');
      return `<div class="event-item" style="margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <div>
            <div class="event-item-title">${this._escHtml(e.title)}</div>
            ${e.start_time ? `<div style="font-size:12px;color:var(--text2);margin-top:2px">🕐 ${e.start_time.slice(0,5)}${e.end_time ? ' – ' + e.end_time.slice(0,5) : ''}</div>` : ''}
            ${e.description ? `<div style="font-size:12px;color:var(--text2);margin-top:4px">${this._escHtml(e.description)}</div>` : ''}
            ${attendees ? `<div class="event-attendees" style="margin-top:6px">${attendees}</div>` : ''}
          </div>
          ${this.mode === 'parent' ? `<button class="btn btn-sm danger" onclick="Calendar.deleteEvent('${e.id}')">Delete</button>` : ''}
        </div>
      </div>`;
    }).join('');

    Modal.show(`<div class="modal-title">${title}</div>
      ${eventsHtml}
      ${this.mode === 'parent' ? `<div class="modal-actions"><button class="btn" onclick="Modal.close()">Close</button><button class="btn primary" onclick="Modal.close();Calendar.showAddEventModal('${dateStr}')">+ Add event</button></div>` : `<div class="modal-actions"><button class="btn primary" onclick="Modal.close()">Close</button></div>`}`);
  },

  showAddEventModal(prefillDate = '') {
    const memberOpts = this.members.map(m =>
      `<span class="attendee-chip" data-id="${m.id}" onclick="this.classList.toggle('selected')" style="display:flex;align-items:center;gap:5px">
        <span class="avatar avatar-sm" style="background:${m.bg||'#EAF3DE'};color:${m.color}">${m.initials}</span>
        ${m.display_name}
      </span>`
    ).join('');

    Modal.show(`<div class="modal-title">Add Event</div>
      <div class="form-group"><label class="form-label">Title</label><input class="form-input" id="evtTitle" placeholder="e.g. Dentist appointment"></div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Date</label><input class="form-input" type="date" id="evtDate" value="${prefillDate}"></div>
        <div class="form-group"><label class="form-label">Time (optional)</label><input class="form-input" type="time" id="evtTime"></div>
      </div>
      <div class="form-group"><label class="form-label">Type</label>
        <select class="form-input" id="evtType">
          <option value="event">Event</option>
          <option value="appointment">Appointment</option>
          <option value="activity">Activity</option>
          <option value="other">Other</option>
        </select>
      </div>
      <div class="form-group"><label class="form-label">Notes (optional)</label><input class="form-input" id="evtDesc" placeholder="Any extra details"></div>
      <div class="form-group"><label class="form-label">Who's attending?</label><div class="attendee-select">${memberOpts}</div></div>
      <div id="evtError" class="form-error hidden"></div>
      <div class="modal-actions">
        <button class="btn" onclick="Modal.close()">Cancel</button>
        <button class="btn primary" onclick="Calendar.saveEvent()">Save Event</button>
      </div>`);
  },

  async saveEvent() {
    const title = document.getElementById('evtTitle').value.trim();
    const date = document.getElementById('evtDate').value;
    const time = document.getElementById('evtTime').value;
    const type = document.getElementById('evtType').value;
    const desc = document.getElementById('evtDesc').value.trim();
    const attendees = [...document.querySelectorAll('.attendee-chip.selected')].map(el => el.dataset.id);
    const errEl = document.getElementById('evtError');

    if (!title || !date) {
      errEl.textContent = 'Title and date are required';
      errEl.classList.remove('hidden');
      return;
    }

    // Assign colour by type
    const colorMap = { appointment: ['#E24B4A','#FCEBEB'], event: ['#2D5A27','#EAF3DE'], activity: ['#534AB7','#EEEDFE'], other: ['#888780','#F1EFE8'] };
    const [color, color_bg] = colorMap[type] || colorMap.event;

    try {
      await API.events.create({ title, event_date: date, start_time: time || null, event_type: type, description: desc || null, color, color_bg, attendees });
      Modal.close();
      Toast.show('Event added', 'success');
      await this.render(document.getElementById('mainContent'), this.mode, this.myProfile, this.members);
    } catch (e) {
      errEl.textContent = e.message;
      errEl.classList.remove('hidden');
    }
  },

  async deleteEvent(id) {
    if (!confirm('Delete this event?')) return;
    try {
      await API.events.delete(id);
      Modal.close();
      Toast.show('Event deleted');
      await this.render(document.getElementById('mainContent'), this.mode, this.myProfile, this.members);
    } catch (e) {
      Toast.show(e.message, 'error');
    }
  },

  addChildActivity(label) {
    const emoji = label.split(' ')[0];
    const title = label.slice(emoji.length + 1);
    this.showAddActivityModalPrefilled(title);
  },

  showAddActivityModal() {
    this.showAddActivityModalPrefilled('');
  },

  showAddActivityModalPrefilled(prefillTitle) {
    Modal.show(`<div class="modal-title">Add to my calendar</div>
      <div class="form-group"><label class="form-label">What are you up to?</label><input class="form-input" id="actTitle" value="${prefillTitle}" placeholder="e.g. Football practice"></div>
      <div class="form-group"><label class="form-label">Date</label><input class="form-input" type="date" id="actDate"></div>
      <div class="form-group"><label class="form-label">Time (optional)</label><input class="form-input" type="time" id="actTime"></div>
      <div id="actError" class="form-error hidden"></div>
      <div class="modal-actions">
        <button class="btn" onclick="Modal.close()">Cancel</button>
        <button class="btn primary" onclick="Calendar.saveActivity()">Add</button>
      </div>`);
  },

  async saveActivity() {
    const title = document.getElementById('actTitle').value.trim();
    const date = document.getElementById('actDate').value;
    const time = document.getElementById('actTime').value;
    const errEl = document.getElementById('actError');

    if (!title || !date) { errEl.textContent = 'Title and date required'; errEl.classList.remove('hidden'); return; }

    try {
      await API.events.create({
        title, event_date: date, start_time: time || null, event_type: 'activity',
        color: '#534AB7', color_bg: '#EEEDFE',
        attendees: [this.myProfile.id],
      });
      Modal.close();
      Toast.show('Added to your calendar', 'success');
      await this.render(document.getElementById('mainContent'), this.mode, this.myProfile, this.members);
    } catch (e) {
      errEl.textContent = e.message; errEl.classList.remove('hidden');
    }
  },

  showSyncModal(e) {
    if (e) e.preventDefault();
    const url = App.icalUrl || `${window.location.origin}/.netlify/functions/ical?family_id=YOUR_FAMILY_ID&token=YOUR_TOKEN`;
    Modal.show(`<div class="modal-title">🍎 Apple Calendar Sync</div>
      <div style="font-size:13px;color:var(--text2);line-height:1.6;margin-bottom:16px">
        Subscribe to your Homeboard calendar so all events appear in your Apple Calendar app automatically.
      </div>
      <div class="form-group">
        <label class="form-label">Your iCal feed URL</label>
        <div style="display:flex;gap:6px">
          <input class="form-input" id="icalUrlInput" value="${url}" readonly style="font-size:11px">
          <button class="btn btn-sm" onclick="navigator.clipboard.writeText(document.getElementById('icalUrlInput').value);Toast.show('Copied!')">Copy</button>
        </div>
      </div>
      <div class="info-banner blue" style="margin-top:12px">
        <div>
          <strong>On Mac:</strong> Open Calendar → File → New Calendar Subscription → paste URL<br>
          <strong>On iPhone:</strong> Settings → Calendar → Accounts → Add Account → Other → Add Subscribed Calendar
        </div>
      </div>
      <div class="info-banner green" style="margin-top:10px">
        📧 <strong>Add events by forwarding email:</strong><br>
        Forward event emails to the address in your Zapier setup. They'll appear here automatically.
      </div>
      <div class="modal-actions"><button class="btn primary" onclick="Modal.close()">Done</button></div>`);
  },

  _escHtml(str = '') {
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  },
};
