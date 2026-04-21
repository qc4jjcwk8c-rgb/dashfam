// netlify/functions/events.js
// Handles GET / POST / PUT / DELETE for calendar events
// Uses Supabase service role key — bypasses RLS for server-side auth checks

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': process.env.APP_URL || '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

async function getUserAndFamily(authHeader) {
  if (!authHeader?.startsWith('Bearer ')) return { error: 'Unauthorized' };
  const token = authHeader.slice(7);
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return { error: 'Invalid token' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, family_id, role, display_name')
    .eq('id', user.id)
    .single();

  if (!profile?.family_id) return { error: 'No family assigned' };
  return { user, profile };
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers };

  const auth = event.headers.authorization || event.headers.Authorization;
  const { user, profile, error: authError } = await getUserAndFamily(auth);
  if (authError) return { statusCode: 401, headers, body: JSON.stringify({ error: authError }) };

  const method = event.httpMethod;
  const params = event.queryStringParameters || {};

  // GET /api/events?month=2025-06
  if (method === 'GET') {
    let query = supabase
      .from('events')
      .select(`
        *,
        event_attendees ( profile_id, profiles ( id, display_name, initials, color, color_bg:color ) )
      `)
      .eq('family_id', profile.family_id)
      .order('event_date', { ascending: true });

    if (params.month) {
      const [y, m] = params.month.split('-');
      const start = `${y}-${m}-01`;
      const end = new Date(y, parseInt(m), 0).toISOString().slice(0, 10);
      query = query.gte('event_date', start).lte('event_date', end);
    }

    if (params.from && params.to) {
      query = query.gte('event_date', params.from).lte('event_date', params.to);
    }

    // Children only see events they're attending
    if (profile.role === 'child') {
      const { data: myEventIds } = await supabase
        .from('event_attendees')
        .select('event_id')
        .eq('profile_id', profile.id);
      const ids = (myEventIds || []).map(e => e.event_id);
      if (ids.length === 0) return { statusCode: 200, headers, body: JSON.stringify([]) };
      query = query.in('id', ids);
    }

    const { data, error } = await query;
    if (error) return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    return { statusCode: 200, headers, body: JSON.stringify(data) };
  }

  // POST /api/events — create event (parents only, or child adding own activity)
  if (method === 'POST') {
    const body = JSON.parse(event.body || '{}');

    if (profile.role === 'child' && body.event_type !== 'activity') {
      return { statusCode: 403, headers, body: JSON.stringify({ error: 'Children can only add activities' }) };
    }

    const { attendees, ...eventData } = body;

    const { data: newEvent, error: insertError } = await supabase
      .from('events')
      .insert({
        ...eventData,
        family_id: profile.family_id,
        created_by: profile.id,
        event_type: body.event_type || 'event',
      })
      .select()
      .single();

    if (insertError) return { statusCode: 500, headers, body: JSON.stringify({ error: insertError.message }) };

    // Add attendees
    if (attendees?.length) {
      await supabase.from('event_attendees').insert(
        attendees.map(pid => ({ event_id: newEvent.id, profile_id: pid }))
      );
    }

    return { statusCode: 201, headers, body: JSON.stringify(newEvent) };
  }

  // PUT /api/events?id=<uuid>
  if (method === 'PUT') {
    const id = params.id;
    if (!id) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing event id' }) };

    if (profile.role === 'child') {
      return { statusCode: 403, headers, body: JSON.stringify({ error: 'Children cannot edit events' }) };
    }

    const body = JSON.parse(event.body || '{}');
    const { attendees, ...eventData } = body;

    const { data: updated, error: updateError } = await supabase
      .from('events')
      .update({ ...eventData, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('family_id', profile.family_id)
      .select()
      .single();

    if (updateError) return { statusCode: 500, headers, body: JSON.stringify({ error: updateError.message }) };

    // Replace attendees
    if (attendees) {
      await supabase.from('event_attendees').delete().eq('event_id', id);
      if (attendees.length) {
        await supabase.from('event_attendees').insert(
          attendees.map(pid => ({ event_id: id, profile_id: pid }))
        );
      }
    }

    return { statusCode: 200, headers, body: JSON.stringify(updated) };
  }

  // DELETE /api/events?id=<uuid>
  if (method === 'DELETE') {
    if (profile.role === 'child') {
      return { statusCode: 403, headers, body: JSON.stringify({ error: 'Children cannot delete events' }) };
    }
    const id = params.id;
    const { error: delError } = await supabase
      .from('events')
      .delete()
      .eq('id', id)
      .eq('family_id', profile.family_id);

    if (delError) return { statusCode: 500, headers, body: JSON.stringify({ error: delError.message }) };
    return { statusCode: 204, headers, body: '' };
  }

  return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
};
