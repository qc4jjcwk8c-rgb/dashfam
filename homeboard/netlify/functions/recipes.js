// netlify/functions/recipes.js
// CRUD for recipes — parents can write, all family members can read

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
    .select('id, family_id, role')
    .eq('id', user.id)
    .single();
  if (!profile?.family_id) return { error: 'No family assigned' };
  return { user, profile };
}

// Detect source type from URL
function detectSourceType(url) {
  if (!url) return 'manual';
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
  if (url.includes('instagram.com')) return 'instagram';
  return 'website';
}

// Extract YouTube video ID
function getYouTubeId(url) {
  const match = url?.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([^&?/]+)/);
  return match?.[1] || null;
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers };

  const auth = event.headers.authorization || event.headers.Authorization;
  const { profile, error: authError } = await getUserAndFamily(auth);
  if (authError) return { statusCode: 401, headers, body: JSON.stringify({ error: authError }) };

  const method = event.httpMethod;
  const params = event.queryStringParameters || {};

  // GET /api/recipes?tag=Healthy&scheduled=true
  if (method === 'GET') {
    let query = supabase
      .from('recipes')
      .select('*, profiles!created_by(display_name, initials)')
      .eq('family_id', profile.family_id)
      .order('created_at', { ascending: false });

    if (params.tag) {
      query = query.contains('tags', [params.tag]);
    }
    if (params.scheduled === 'true') {
      query = query.not('scheduled_date', 'is', null);
    }

    const { data, error } = await query;
    if (error) return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    return { statusCode: 200, headers, body: JSON.stringify(data) };
  }

  // POST /api/recipes
  if (method === 'POST') {
    if (profile.role === 'child') {
      return { statusCode: 403, headers, body: JSON.stringify({ error: 'Only parents can add recipes' }) };
    }

    const body = JSON.parse(event.body || '{}');
    const sourceType = body.source_type || detectSourceType(body.url);

    // Auto-extract YouTube thumbnail if applicable
    let emoji = body.emoji || '🍳';
    let ytId = null;
    if (sourceType === 'youtube' && body.url) {
      ytId = getYouTubeId(body.url);
    }

    const { data: newRecipe, error: insertError } = await supabase
      .from('recipes')
      .insert({
        title: body.title,
        description: body.description || null,
        url: body.url || null,
        source_type: sourceType,
        emoji,
        scheduled_date: body.scheduled_date || null,
        tags: body.tags || [],
        family_id: profile.family_id,
        created_by: profile.id,
        youtube_id: ytId,
      })
      .select()
      .single();

    if (insertError) return { statusCode: 500, headers, body: JSON.stringify({ error: insertError.message }) };
    return { statusCode: 201, headers, body: JSON.stringify(newRecipe) };
  }

  // PUT /api/recipes?id=<uuid>
  if (method === 'PUT') {
    if (profile.role === 'child') {
      return { statusCode: 403, headers, body: JSON.stringify({ error: 'Only parents can edit recipes' }) };
    }

    const id = params.id;
    if (!id) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing recipe id' }) };

    const body = JSON.parse(event.body || '{}');
    const { data: updated, error: updateError } = await supabase
      .from('recipes')
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('family_id', profile.family_id)
      .select()
      .single();

    if (updateError) return { statusCode: 500, headers, body: JSON.stringify({ error: updateError.message }) };
    return { statusCode: 200, headers, body: JSON.stringify(updated) };
  }

  // DELETE /api/recipes?id=<uuid>
  if (method === 'DELETE') {
    if (profile.role === 'child') {
      return { statusCode: 403, headers, body: JSON.stringify({ error: 'Only parents can delete recipes' }) };
    }

    const id = params.id;
    const { error: delError } = await supabase
      .from('recipes')
      .delete()
      .eq('id', id)
      .eq('family_id', profile.family_id);

    if (delError) return { statusCode: 500, headers, body: JSON.stringify({ error: delError.message }) };
    return { statusCode: 204, headers, body: '' };
  }

  return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
};
