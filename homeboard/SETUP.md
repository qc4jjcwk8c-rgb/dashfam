# Homeboard — Setup Guide

## What you're deploying

A family dashboard with:
- **Calendar** — monthly view, week-ahead child view, Apple Calendar sync (iCal), email-to-event via Zapier
- **Recipes** — card grid, tags/filtering, YouTube thumbnail auto-fetch, email-to-recipe via Zapier
- **Dual roles** — parents have full access; children see a filtered view (their events only, read-only recipes)
- **Auth** — Supabase email/password, family setup + join flow

**Stack:** Vanilla JS + CSS → Netlify (hosting + serverless functions) + Supabase (auth + database)

---

## Step 1 — Supabase project

1. Go to [supabase.com](https://supabase.com) → New project
2. Choose a region close to you (e.g. West EU)
3. Note down:
   - **Project URL** — looks like `https://abcdefgh.supabase.co`
   - **Anon public key** — under Settings → API → Project API keys → `anon public`
   - **Service role key** — same page → `service_role` (keep this secret — server-side only)

4. Open the **SQL Editor** in Supabase dashboard
5. Paste the entire contents of `supabase/schema.sql` and click **Run**
   - This creates all tables, relationships, and row-level security policies

---

## Step 2 — Configure the frontend

Open `public/js/config.js` and replace the placeholder values:

```js
const CONFIG = {
  SUPABASE_URL: 'https://YOUR_PROJECT_REF.supabase.co',   // ← your Project URL
  SUPABASE_ANON_KEY: 'YOUR_SUPABASE_ANON_KEY',            // ← your anon public key
  API_BASE: '/api',
};
```

---

## Step 3 — Deploy to Netlify

### Option A — Netlify CLI (recommended for local dev)

```bash
# Install dependencies
npm install

# Install Netlify CLI globally if you don't have it
npm install -g netlify-cli

# Login to Netlify
netlify login

# Create a new site
netlify init

# Run locally
netlify dev
```

### Option B — Deploy via GitHub

1. Push this folder to a GitHub repository
2. Go to [app.netlify.com](https://app.netlify.com) → Add new site → Import from Git
3. Select your repo
4. Build settings:
   - **Build command:** *(leave blank)*
   - **Publish directory:** `public`
   - **Functions directory:** `netlify/functions`
5. Click **Deploy site**

---

## Step 4 — Set environment variables in Netlify

Go to **Netlify dashboard → Site settings → Environment variables** and add:

| Variable | Value |
|---|---|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Your Supabase service role key |
| `APP_URL` | Your Netlify site URL e.g. `https://homeboard.netlify.app` |
| `ICAL_SECRET` | Any random string — run `openssl rand -base64 32` to generate one |
| `WEBHOOK_SECRET` | Any random string — used to secure your Zapier webhook |

After adding variables, **redeploy** the site (Deploys → Trigger deploy).

---

## Step 5 — Create your first account

1. Open your Netlify site URL
2. Click **Create account** — enter your email and password
3. You'll be asked to set up your family:
   - **Family name** e.g. "The Richardson Family"
   - **Your name** e.g. "Jeff"
   - **Role:** Parent
4. Click **Continue** — you're in!

### Adding a second parent or child

Share your **Family ID** (visible in the app under "Manage family") with the other person. They:
1. Create their own account (their own email + password)
2. On the setup screen, choose **Join family**
3. Paste the Family ID
4. Enter their name and role (parent or child)

> For children too young to manage their own account, a parent can create an account using a shared/parent email address, set it up as a child role, and then use the **Elvie** mode toggle to switch to that view.

---

## Step 6 — Apple Calendar sync

Once logged in:
1. Click **🍎 Sync calendar** in the top bar
2. Copy the iCal URL shown
3. On Mac: Calendar app → File → New Calendar Subscription → paste URL
4. On iPhone: Settings → Calendar → Accounts → Add Account → Other → Add Subscribed Calendar → paste URL
5. Set refresh interval to "Every hour" or "Every day"

Events you add to Homeboard will appear in Apple Calendar within the refresh interval.

---

## Step 7 — Email forwarding via Zapier

This lets you forward an email (containing a YouTube link, recipe URL, or event info) and have it automatically appear in Homeboard.

### Set up the Zap

1. Go to [zapier.com](https://zapier.com) → Create Zap
2. **Trigger:** Email by Zapier
   - This gives you a unique `@robot.zapier.com` email address
   - Forward any email there and it'll trigger the Zap
3. **Action:** Webhooks by Zapier → POST
   - URL: `https://your-site.netlify.app/api/inbound-email`
   - Payload type: JSON
   - Data:
     ```
     family_id   →  YOUR_FAMILY_ID  (paste from "Manage family" in the app)
     subject     →  Subject (from trigger)
     body_text   →  Body Plain (from trigger)
     secret      →  YOUR_WEBHOOK_SECRET  (same value as WEBHOOK_SECRET env var)
     ```

> **How it works:** Homeboard auto-detects whether the email is a recipe (YouTube/Instagram/website URL) or an event (keywords like "dentist", "appointment", "9am"). It creates the right item automatically. You can always edit it after.

### Forwarding a YouTube recipe

1. Find a recipe video on YouTube
2. Copy the video URL
3. Send an email to your Zapier address with the URL in the body
4. Within seconds, the recipe appears in Homeboard with the YouTube thumbnail

### Forwarding an event confirmation email

1. Receive e.g. a dentist reminder or school event email
2. Forward it to your Zapier address
3. Homeboard parses the date and title and creates the event

---

## File structure

```
homeboard/
├── netlify.toml                    # Netlify config + redirects
├── package.json
├── .env.example                    # Copy to .env for local dev
├── supabase/
│   └── schema.sql                  # Run this in Supabase SQL editor
├── netlify/functions/
│   ├── auth.js                     # Profile setup, family creation/joining
│   ├── events.js                   # Calendar events CRUD
│   ├── recipes.js                  # Recipes CRUD
│   ├── ical.js                     # iCal feed for Apple Calendar
│   └── inbound-email.js            # Zapier webhook receiver
└── public/
    ├── index.html
    ├── css/
    │   └── main.css
    └── js/
        ├── config.js               # ← EDIT THIS with your Supabase keys
        ├── api.js                  # Fetch wrapper
        ├── auth.js                 # Login/signup/setup
        ├── calendar.js             # Calendar module
        ├── recipes.js              # Recipes module
        ├── modal.js                # Modal + toast
        └── app.js                  # App controller + navigation
```

---

## Local development

```bash
# Clone / open the folder
cd homeboard

# Install deps
npm install

# Create local env file
cp .env.example .env
# Edit .env with your Supabase values + secrets

# Run local dev server (Netlify Dev proxies functions automatically)
netlify dev

# Open http://localhost:8888
```

---

## Adding more modules later (Movies, Chores, Holidays)

The architecture is modular. To add a new module:

1. **Database:** Add a new table to `supabase/schema.sql` and run it in the Supabase SQL editor
2. **API function:** Create `netlify/functions/your-module.js` (copy the pattern from `recipes.js`)
3. **Frontend module:** Create `public/js/your-module.js` (copy the pattern from `recipes.js`)
4. **Wire it up:** Add a nav item in `index.html`, register it in `app.js → showSection()`

---

## Troubleshooting

| Problem | Fix |
|---|---|
| "No family assigned" error after login | You signed up but didn't complete the family setup step. Sign out and back in — it'll prompt setup again. |
| Events not showing in Apple Calendar | Check the iCal URL is correct. Also check the calendar subscription refresh setting (set to "every hour"). |
| Zapier webhook returns 401 | Make sure the `WEBHOOK_SECRET` in Netlify env vars matches what you put in the Zapier Zap's `secret` field. |
| Functions return 500 | Check `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` are set correctly in Netlify env vars and redeploy. |
| Child can see parent events | RLS policies filter by attendees for children — ensure the event has the child's profile assigned as an attendee. |
| YouTube thumbnails not loading | The thumbnail is fetched client-side from `img.youtube.com`. If the URL wasn't a YouTube link, no thumbnail is shown. |
