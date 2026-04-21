// public/js/api.js
// Thin wrapper around fetch — attaches auth token, handles errors

const API = {
  async _getToken() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    return session?.access_token || null;
  },

  async _request(method, path, body = null, params = {}) {
    const token = await this._getToken();
    const url = new URL(CONFIG.API_BASE + path, window.location.origin);
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null) url.searchParams.set(k, v); });

    const opts = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
    };
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(url.toString(), opts);
    if (res.status === 204) return null;
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  },

  get:    (path, params) => API._request('GET',    path, null, params),
  post:   (path, body)   => API._request('POST',   path, body),
  put:    (path, body, params) => API._request('PUT', path, body, params),
  delete: (path, params) => API._request('DELETE', path, null, params),

  // Auth helpers
  auth: {
    me:          ()     => API.get('/auth/me'),
    setup:       (body) => API.post('/auth/setup', body),
    join:        (body) => API.post('/auth/join', body),
  },

  // Events
  events: {
    list:   (params) => API.get('/events', params),
    create: (body)   => API.post('/events', body),
    update: (id, body) => API.put('/events', body, { id }),
    delete: (id)     => API.delete('/events', { id }),
  },

  // Recipes
  recipes: {
    list:   (params) => API.get('/recipes', params),
    create: (body)   => API.post('/recipes', body),
    update: (id, body) => API.put('/recipes', body, { id }),
    delete: (id)     => API.delete('/recipes', { id }),
  },
};
