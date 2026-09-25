# IGNOU BCA Cloud Command Centre

## GitHub structure

Keep these files at the repository root:

- `index.html`
- `ignou-student-id-card.png` (your existing file)
- `package.json`
- `vercel.json`
- `api/config.js`
- `api/cron/notices.js`
- `supabase/schema.sql`

## Vercel environment variables

Add these to the Vercel project:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CRON_SECRET`

Do NOT put `SUPABASE_SERVICE_ROLE_KEY` in `index.html`.

## Supabase

Open Supabase -> SQL Editor and run `supabase/schema.sql`.

If email confirmation is enabled, verify the email after creating the dashboard account.

## Important

The browser only receives the Supabase URL and ANON key. The service-role key is used only by the Vercel cron function.

The dashboard's official IGNOU information is hard-coded/locked. Personal assignment progress, dates, proof checkboxes and personal notes are stored in Supabase.

The daily collector reads public IGNOU/RC Guwahati pages. It does not log into Samarth.
