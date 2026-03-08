import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
    return createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://weduhxhwpnztxnbmdclv.supabase.co',
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndlZHVoeGh3cG56dHhuYm1kY2x2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5ODg2MTEsImV4cCI6MjA4ODU2NDYxMX0._EfeERk6WwRJWdpSRTUiXhlzDgYdEIue_ot0MpEdBUI'
    )
}
