// netlify/functions/ical.js
// Generates an iCal (.ics) feed for a family — subscribe in Apple Calendar

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

function escapeIcal(str = '') {
  return str.replace(/[\\;,]/g, '\\$&').replace(/\n/g, '\\n');
}

function formatIcalDate(dateStr, timeStr) {
  if (timeStr) {
    const dt = new Date(`${dateStr}T${timeStr}`);
    return dt.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  }
  return dateStr.replace(/-/g, '');
}

function generateIcal(events, familyName) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//Homeboard//Family Dashboard//EN`,
    `X-WR-CALNAME:${escapeIcal(familyName)} – Homeboard`,
    'X-WR-TIMEZONE:Europe/London',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];

  for (const evt of events) {
    const uid = `${evt.id}@homeboard.app`;
    const dtstart = formatIcalDate(evt.event_date, evt.start_time);
    const dtend = evt.end_time
      ? formatIcalDate(evt.event_date, evt.end_time)
      : evt.start_time
        ? formatIcalDate(evt.event_date, evt.end_time || evt.start_time)
        : dtstart;

    const attendeeNames = (evt.event_attendees || [])
      .map(a => a.profiles?.display_name)
      .filter(Boolean)
      .join(', ');

    const description = [
      evt.description || '',
      attendeeNames ? `Attending: ${attendeeNames}` : '',
    ].filter(Boolean).join('\\n');

    lines.push(
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
      evt.start_time ? `DTSTART:${dtstart}` : `DTSTART;VALUE=DATE:${dtstart}`,
      evt.end_time ? `DTEND:${dtend}` : `DTEND;VALUE=DATE:${dtend}`,
      `SUMMARY:${escapeIcal(evt.title)}`,
      description ? `DESCRIPTION:${escapeIcal(description)}` : '',
      `CATEGORIES:${escapeIcal(evt.event_type || 'event')}`,
      'END:VEVENT'
    ).filter(Boolean);
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

export const handler = async (event) => {
  const params = event.queryStringParameters || {};
  const familyId = params.family_id;
  const token = params.token; // Simple auth: a static token stored in env per family

  // Verify token — families get a unique iCal token stored in their family record
  // For simplicity, we use ICAL_SECRET env var + family_id as a basic HMAC-style check
  // In production, generate per-family tokens and store in DB
  const expectedToken = Buffer.from(`${familyId}:${process.env.ICAL_SECRET}`).toString('base64').slice(0, 32);

  if (!familyId || !token || token !== expectedToken) {
    return {
      statusCode: 401,
      headers: { 'Content-Type': 'text/plain' },
      body: 'Unauthorized — invalid or missing token',
    };
  }

  // Fetch family
  const { data: family } = await supabase
    .from('families')
    .select('name')
    .eq('id', familyId)
    .single();

  if (!family) {
    return { statusCode: 404, headers: { 'Content-Type': 'text/plain' }, body: 'Family not found' };
  }

  // Fetch events for next 12 months
  const from = new Date().toISOString().slice(0, 10);
  const to = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const { data: events, error } = await supabase
    .from('events')
    .select(`
      id, title, description, event_date, start_time, end_time, event_type,
      event_attendees ( profiles ( display_name ) )
    `)
    .eq('family_id', familyId)
    .gte('event_date', from)
    .lte('event_date', to)
    .order('event_date', { ascending: true });

  if (error) {
    return { statusCode: 500, headers: { 'Content-Type': 'text/plain' }, body: 'Server error' };
  }

  const ical = generateIcal(events || [], family.name);

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="homeboard.ics"',
      'Cache-Control': 'no-cache, no-store',
    },
    body: ical,
  };
};
