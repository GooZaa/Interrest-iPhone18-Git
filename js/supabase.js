// Supabase Configuration
const SUPABASE_URL = 'https://qunbulmqtgeqsaiabkjq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF1bmJ1bG1xdGdlcXNhaWFia2pxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk0NzcxMDgsImV4cCI6MjEwNTA1MzEwOH0.bCGIwxUjSfogLmqDoGrm6u6Zo736KoElADOC5jMpxos';

// Initialize Supabase Client
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
window.supabaseClient = supabase;
