import { createClient } from '@supabase/supabase-js';

// Read env variables injected by Vite at build time
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://hitfdcgkvfkstzhanmof.supabase.co";
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhpdGZkY2drdmZrc3R6aGFubW9mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4OTAxNzAsImV4cCI6MjA5NzQ2NjE3MH0.tmhgZMrwusiyGeqmOEpFufjATYBnveyu4Zp-v3hVxgY";

if (!supabaseUrl || !supabaseKey) {
  console.warn("Supabase URL and Anon Key are missing. Check your Vercel or local environment variables.");
}

// Initialize Supabase Client once
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

// Expose globally for legacy scripts that expect window.Supa
window.Supa = {
  client: supabase,
  inited: true,
  
  init() {
    return Promise.resolve(supabase);
  },
  
  async fetchAll(table) {
    const { data, error } = await supabase.from(table).select("*");
    if (error) throw error;
    return data;
  },
  
  async fetchById(table, id) {
    const { data, error } = await supabase.from(table).select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data;
  },
  
  async insert(table, rows) {
    const payload = Array.isArray(rows) ? rows : [rows];
    const { data, error } = await supabase.from(table).insert(payload).select();
    if (error) throw error;
    return data;
  },
  
  async upsert(table, rows, conflictKey = "id") {
    const payload = Array.isArray(rows) ? rows : [rows];
    const { data, error } = await supabase.from(table).upsert(payload, { onConflict: conflictKey }).select();
    if (error) throw error;
    return data;
  },
  
  async update(table, id, updates) {
    const { data, error } = await supabase.from(table).update(updates).eq("id", id).select();
    if (error) throw error;
    return data;
  },
  
  async delete(table, id) {
    const { data, error } = await supabase.from(table).delete().eq("id", id).select();
    if (error) throw error;
    return data;
  }
};
