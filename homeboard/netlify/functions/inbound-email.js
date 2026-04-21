// netlify/functions/inbound-email.js
// Receives parsed email data from Zapier or Mailparser
// Secured with a shared WEBHOOK_SECRET env var

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, X-Webhook-Secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Simple keyword-based intent detection
function detectIntent(subject = '', body = '') {
  const text = `${subject} ${body}`.toLowerCase();
  const recipeKeywords = ['recipe', 'ingredients', 'cook', 'bake', 'dinner', 'youtube.com', 'youtu.be', 'instagram.com'];
  const eventKeywords = ['appointment', 'meeting', 'dentist', 'doctor', 'school', 'match', 'practice', 'birthday', 'party', 'am', 'pm', '@'];

  const recipeScore = recipeKeywords.filter(k => text.includes(k)).length;
  const eventScore = eventKeywords.filter(k => text.includes(k)).length;

  return recipeScore > eventScore ? 'recipe' : 'event';
}

// Try to extract a date from free text (very basic — enhance with a date parsing lib if needed)
function extractDate(text = '') {
  const datePatterns = [
    /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/,     // 12/06/2025 or 12-06-2025
    /(\d{4})-(\d{2})-(\d{2})/,                         // 2025-06-12
    /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+(\d{1,2}),?\s*(\d{4})?/i,
  ];

  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (match) {
      try {
        const d = new Date(match[0]);
        if (!isNaN(d)) return d.toISOString().slice(0, 10);
      } catch {}
    }
  }
  return null;
}

// Extract URLs from text
function extractUrls(text = '') {
  const urlPattern = /https?:\/\/[^\s"'<>]+/g;
  return text.match(urlPattern) || [];
}

function detectSourceType(url = '') {
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
  if (url.includes('instagram.com')) return 'instagram';
  if (url) return 'website';
  return 'email';
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  // Verify webhook secret
  const secret = event.headers['x-webhook-secret'] || event.queryStringParameters?.secret;
  if (!secret || secret !== process.env.WEBHOOK_SECRET) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Invalid webhook secret' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  // Expected payload from Zapier/Mailparser:
  // { family_id, subject, body_text, from_email, to_email, type? }
  const { family_id, subject, body_text, type } = body;

  if (!family_id) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'family_id is required' }) };
  }

  // Verify family exists
  const { data: family } = await supabase
    .from('families')
    .select('id')
    .eq('id', family_id)
    .single();

  if (!family) {
    return { statusCode: 404, headers, body: JSON.stringify({ error: 'Family not found' }) };
  }

  // Detect what this email is about
  const intent = type || detectIntent(subject, body_text);

  if (intent === 'recipe') {
    const urls = extractUrls(body_text || '');
    const firstUrl = urls[0] || null;
    const sourceType = detectSourceType(firstUrl || '');

    const { data: recipe, error } = await supabase
      .from('recipes')
      .insert({
        family_id,
        title: subject || 'Recipe from email',
        description: (body_text || '').slice(0, 500),
        url: firstUrl,
        source_type: sourceType,
        emoji: sourceType === 'youtube' ? '▶️' : sourceType === 'instagram' ? '📷' : '🔗',
        tags: ['From Email'],
      })
      .select()
      .single();

    if (error) return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    return { statusCode: 201, headers, body: JSON.stringify({ intent: 'recipe', created: recipe }) };
  }

  if (intent === 'event') {
    const eventDate = extractDate(body_text || subject || '') || new Date().toISOString().slice(0, 10);

    const { data: evt, error } = await supabase
      .from('events')
      .insert({
        family_id,
        title: subject || 'Event from email',
        description: (body_text || '').slice(0, 500),
        event_date: eventDate,
        event_type: 'appointment',
        source: 'email',
        color: '#185FA5',
        color_bg: '#E6F1FB',
      })
      .select()
      .single();

    if (error) return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    return { statusCode: 201, headers, body: JSON.stringify({ intent: 'event', created: evt }) };
  }

  return { statusCode: 200, headers, body: JSON.stringify({ message: 'Email received but no action taken', intent }) };
};
