// Supabase Configuration & Client Initialization
(function(window) {
  const SUPABASE_URL = 'https://qunbulmqtgeqsaiabkjq.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF1bmJ1bG1xdGdlcXNhaWFia2pxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk0NzcxMDgsImV4cCI6MjEwNTA1MzEwOH0.bCGIwxUjSfogLmqDoGrm6u6Zo736KoElADOC5jMpxos';

  function init() {
    const sbLib = window.supabase || (typeof supabase !== 'undefined' ? supabase : null);
    if (sbLib && typeof sbLib.createClient === 'function') {
      window.supabaseClient = sbLib.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      return window.supabaseClient;
    }
    return null;
  }

  init();
  window.getSupabaseClient = function() {
    return window.supabaseClient || init();
  };
})(window);
