import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://uazepicghvwsfalqfjqm.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhemVwaWNnaHZ3c2ZhbHFmanFtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAxMjQ0OTcsImV4cCI6MjA2NTcwMDQ5N30.IIrNxUACeG2oOCS_cXTDyujMld0RNkx_VGVsqYJTzAU';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
