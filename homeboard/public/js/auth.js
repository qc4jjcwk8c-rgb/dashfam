// public/js/auth.js

const Auth = {
  showLogin() {
    document.getElementById('authLogin').classList.remove('hidden');
    document.getElementById('authRegister').classList.add('hidden');
    document.getElementById('authSetup').classList.add('hidden');
  },
  showRegister() {
    document.getElementById('authLogin').classList.add('hidden');
    document.getElementById('authRegister').classList.remove('hidden');
    document.getElementById('authSetup').classList.add('hidden');
  },
  showSetup() {
    document.getElementById('authLogin').classList.add('hidden');
    document.getElementById('authRegister').classList.add('hidden');
    document.getElementById('authSetup').classList.remove('hidden');
  },
  showSetupCreate() {
    document.getElementById('setupCreate').classList.remove('hidden');
    document.getElementById('setupJoin').classList.add('hidden');
    document.getElementById('setupCreateBtn').classList.add('active');
    document.getElementById('setupJoinBtn').classList.remove('active');
  },
  showSetupJoin() {
    document.getElementById('setupCreate').classList.add('hidden');
    document.getElementById('setupJoin').classList.remove('hidden');
    document.getElementById('setupCreateBtn').classList.remove('active');
    document.getElementById('setupJoinBtn').classList.add('active');
  },

  async signIn() {
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const errEl = document.getElementById('loginError');
    errEl.classList.add('hidden');

    try {
      const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
      if (error) throw error;
      // onAuthStateChange will handle the rest
    } catch (e) {
      errEl.textContent = e.message;
      errEl.classList.remove('hidden');
    }
  },

  async signUp() {
    const email = document.getElementById('regEmail').value.trim();
    const password = document.getElementById('regPassword').value;
    const errEl = document.getElementById('registerError');
    errEl.classList.add('hidden');

    try {
      const { error } = await supabaseClient.auth.signUp({ email, password });
      if (error) throw error;
      Toast.show('Account created! Please check your email to confirm.', 'success');
      this.showSetup();
    } catch (e) {
      errEl.textContent = e.message;
      errEl.classList.remove('hidden');
    }
  },

  async setupFamily() {
    const familyName = document.getElementById('setupFamilyName').value.trim();
    const displayName = document.getElementById('setupDisplayName').value.trim();
    const role = document.getElementById('setupRole').value;
    const errEl = document.getElementById('setupError');
    errEl.classList.add('hidden');

    if (!familyName || !displayName) {
      errEl.textContent = 'Please fill in all fields';
      errEl.classList.remove('hidden');
      return;
    }

    try {
      const result = await API.auth.setup({ family_name: familyName, display_name: displayName, role });
      App.initWithData(result);
    } catch (e) {
      errEl.textContent = e.message;
      errEl.classList.remove('hidden');
    }
  },

  async joinFamily() {
    const familyId = document.getElementById('joinFamilyId').value.trim();
    const displayName = document.getElementById('joinDisplayName').value.trim();
    const role = document.getElementById('joinRole').value;
    const inviteCode = document.getElementById('joinInviteCode').value.trim();
    const errEl = document.getElementById('joinError');
    errEl.classList.add('hidden');

    try {
      const result = await API.auth.join({ family_id: familyId, display_name: displayName, role, invite_code: inviteCode || undefined });
      App.initWithData(result);
    } catch (e) {
      errEl.textContent = e.message;
      errEl.classList.remove('hidden');
    }
  },

  async signOut() {
    await supabaseClient.auth.signOut();
    App.reset();
    document.getElementById('appScreen').classList.add('hidden');
    document.getElementById('authScreen').classList.remove('hidden');
    this.showLogin();
  },
};

// Handle auth state changes — only act on explicit sign in/out events
// Page load session restore is handled separately below
supabaseClient.auth.onAuthStateChange(async (event, session) => {
  if (event === 'SIGNED_IN' && session && !App.myProfile) {
    // Only fires for actual new logins, not page reloads
    try {
      const data = await API.auth.me();
      if (data?.profile?.family_id) {
        App.initWithData(data);
      } else {
        document.getElementById('authScreen').classList.remove('hidden');
        document.getElementById('appScreen').classList.add('hidden');
        Auth.showSetup();
      }
    } catch {
      document.getElementById('authScreen').classList.remove('hidden');
      Auth.showSetup();
    }
  } else if (event === 'SIGNED_OUT') {
    document.getElementById('authScreen').classList.remove('hidden');
    document.getElementById('appScreen').classList.add('hidden');
  }
});

// On page load — check session
(async () => {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    document.getElementById('authScreen').classList.remove('hidden');
  } else {
    // Session exists — load app directly without waiting for onAuthStateChange
    try {
      const data = await API.auth.me();
      if (data?.profile?.family_id) {
        App.initWithData(data);
      } else {
        document.getElementById('authScreen').classList.remove('hidden');
        Auth.showSetup();
      }
    } catch {
      document.getElementById('authScreen').classList.remove('hidden');
      Auth.showLogin();
    }
  }
})();
