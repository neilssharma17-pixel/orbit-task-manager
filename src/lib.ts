import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export type Status = 'todo' | 'in_progress' | 'in_review' | 'done';
export type Priority = 'low' | 'normal' | 'high';
export type Task = {
  id: string; title: string; description: string; status: Status;
  priority: Priority; due_date: string | null; labels: string[];
  user_id: string; created_at: string; updated_at: string;
};

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
export const isSupabaseConfigured = Boolean(url && anonKey && !url.includes('YOUR_PROJECT'));
export const supabase: SupabaseClient | null = isSupabaseConfigured ? createClient(url!, anonKey!) : null;

export async function ensureGuestSession() {
  if (!supabase) return null;
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (session?.user) return session.user;
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  return data.user;
}
