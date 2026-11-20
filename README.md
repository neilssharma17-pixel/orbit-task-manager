# Orbit — Task workspace

A responsive Kanban workspace built with React, TypeScript, Vite, Supabase Auth, and Supabase Postgres. It includes a four-stage drag-and-drop board, task creation/editing, priority, due dates, labels, search, filters, guest sessions, and row-level security.

## Run locally

1. Install Node.js 20+ and npm.
2. Clone/download this repository and run `npm install`.
3. Copy `.env.example` to `.env.local` and set your Supabase project URL and **publishable/anon key**:

   ```env
   VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
   VITE_SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_KEY
   ```

4. In Supabase, enable **Anonymous Sign-Ins** under Authentication → Sign In / Providers → Anonymous Sign-Ins.
5. Run the SQL in `supabase/schema.sql` in the Supabase SQL Editor.
6. Start the app with `npm run dev` and open the local URL printed by Vite.

Without Supabase environment variables, Orbit starts in Preview mode with sample tasks. Preview changes are held in memory and are not persisted. With Supabase configured, a guest session is created automatically and tasks are stored under that authenticated user's UUID.

## Supabase security

The frontend uses only the public anon/publishable key. The `tasks` table has RLS enabled and policies constrain select, insert, update, and delete to `auth.uid() = user_id`. Never put a service-role key in a frontend environment variable or commit `.env.local`.

## Deploy

Push the repository to GitHub, import it into Vercel (or Netlify/Cloudflare Pages), set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as build environment variables, and deploy. Add the deployed domain to Supabase Authentication URL configuration if required by your project settings.

## Included features

- Four default columns: To do, In progress, In review, Done.
- Drag-and-drop status changes with optimistic UI and database persistence on drop.
- Automatic Supabase anonymous sign-in and per-user task ownership.
- Create, edit, and delete tasks with title, description, priority, due date, and comma-separated labels.
- Search, priority filtering, and label filtering.
- Responsive layout, loading state, retryable error state, save indicator, empty-column guidance, and action feedback.

## Tradeoffs / next steps

- The included labels are task-level text tags rather than a normalized shared label catalog. A future version could add `labels` and `task_labels` tables for workspace-wide label management.
- Activity history is not yet persisted. A `task_events` table and database trigger could record status transitions and edits.
- The app currently models a personal guest workspace. Team workspaces, invitations, assignees, and role-based permissions would require membership tables and additional RLS policies.
- Supabase Realtime can be enabled for `tasks` and subscribed to for cross-tab/live collaboration; this version saves changes immediately on drop and after edits.

## Assessment submission details

- Live frontend: https://oqoyuezoyqjzrhzxbgfj.supabase.co
- GitHub repository: sb_publishable_ZKokgBw5IF5AZtTeMx10RQ_TmNaUf8t
- Full SQL schema: `supabase/schema.sql`
