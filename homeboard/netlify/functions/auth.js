// netlify/functions/auth.js
// Handles post-signup profile setup and family creation/joining

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': process.env.APP_URL || '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

async function getUser(authHeader) {
  if (!authHeader?.startsWith('Bearer ')) return null;
  const { data: { user } } = await supabase.auth.getUser(authHeader.slice(7));
  return user || null;
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers };

  const auth = event.headers.authorization || event.headers.Authorization;
  const user = await getUser(auth);
  if (!user) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };

  const path = event.path.replace('/.netlify/functions/auth', '').replace('/api/auth', '');

  // POST /api/auth/setup — create profile + family (first-time parent setup)
  if (event.httpMethod === 'POST' && path === '/setup') {
    const body = JSON.parse(event.body || '{}');
    const { family_name, display_name, role = 'parent' } = body;

    if (!family_name || !display_name) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'family_name and display_name are required' }) };
    }

    // Check if profile already exists
    const { data: existing } = await supabase
      .from('profiles')
      .select('id, family_id')
      .eq('id', user.id)
      .single();

    if (existing?.family_id) {
      return { statusCode: 409, headers, body: JSON.stringify({ error: 'Profile already set up', profile: existing }) };
    }

    // Create family first
    const { data: family, error: familyError } = await supabase
      .from('families')
      .insert({ name: family_name })
      .select()
      .single();

    if (familyError) return { statusCode: 500, headers, body: JSON.stringify({ error: familyError.message }) };

    // Create or update profile
    const initials = display_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    const colors = ['#185FA5', '#2D5A27', '#534AB7', '#993C1D', '#0F6E56', '#993556'];
    const color = colors[Math.floor(Math.random() * colors.length)];

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: user.id,
        family_id: family.id,
        display_name,
        initials,
        color,
        role,
      })
      .select()
      .single();

    if (profileError) return { statusCode: 500, headers, body: JSON.stringify({ error: profileError.message }) };

    // Update family with created_by
    await supabase.from('families').update({ created_by: profile.id }).eq('id', family.id);

    // Generate iCal token
    const icalToken = Buffer.from(`${family.id}:${process.env.ICAL_SECRET}`).toString('base64').slice(0, 32);
    const icalUrl = `${process.env.APP_URL || 'https://your-app.netlify.app'}/.netlify/functions/ical?family_id=${family.id}&token=${icalToken}`;

    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({ profile, family, ical_url: icalUrl }),
    };
  }

  // POST /api/auth/join — join existing family (for adding a child/second parent)
  if (event.httpMethod === 'POST' && path === '/join') {
    const body = JSON.parse(event.body || '{}');
    const { family_id, display_name, role = 'child', invite_code } = body;

    if (!family_id || !display_name) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'family_id and display_name are required' }) };
    }

    // Verify family + invite code
    const { data: family } = await supabase
      .from('families')
      .select('id, name, invite_code')
      .eq('id', family_id)
      .single();

    if (!family) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Family not found' }) };

    // Validate invite code if family has one set
    if (family.invite_code && family.invite_code !== invite_code) {
      return { statusCode: 403, headers, body: JSON.stringify({ error: 'Invalid invite code' }) };
    }

    const initials = display_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    const colors = ['#185FA5', '#2D5A27', '#534AB7', '#993C1D'];
    const color = colors[Math.floor(Math.random() * colors.length)];

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .upsert({ id: user.id, family_id, display_name, initials, color, role })
      .select()
      .single();

    if (profileError) return { statusCode: 500, headers, body: JSON.stringify({ error: profileError.message }) };
    return { statusCode: 201, headers, body: JSON.stringify({ profile, family }) };
  }

  // GET /api/auth/me — get current user's profile + family members
  if (event.httpMethod === 'GET' && path === '/me') {
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (!profile) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Profile not found' }) };

    const { data: members } = await supabase
      .from('profiles')
      .select('id, display_name, initials, color, role')
      .eq('family_id', profile.family_id);

    const { data: family } = await supabase
      .from('families')
      .select('id, name')
      .eq('id', profile.family_id)
      .single();

    const icalToken = Buffer.from(`${profile.family_id}:${process.env.ICAL_SECRET}`).toString('base64').slice(0, 32);
    const icalUrl = `${process.env.APP_URL || 'https://your-app.netlify.app'}/.netlify/functions/ical?family_id=${profile.family_id}&token=${icalToken}`;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ profile, family, members: members || [], ical_url: icalUrl }),
    };
  }

  return { statusCode: 404, headers, body: JSON.stringify({ error: 'Not found' }) };
};
