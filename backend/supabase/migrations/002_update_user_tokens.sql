-- Migration: Update user_tokens table for standalone OAuth flow
-- This allows the app to work without Supabase Auth, using Google email as identifier

-- Drop existing constraints if they exist
ALTER TABLE IF EXISTS public.user_tokens 
DROP CONSTRAINT IF EXISTS user_tokens_user_id_fkey;

-- Add new columns for Google OAuth flow
ALTER TABLE public.user_tokens 
ADD COLUMN IF NOT EXISTS google_email TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS google_user_id TEXT;

-- Make user_id optional (nullable) since we're not using Supabase Auth
ALTER TABLE public.user_tokens 
ALTER COLUMN user_id DROP NOT NULL;

-- Create index on google_email for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_tokens_google_email 
ON public.user_tokens(google_email);

-- Update RLS policies for the new flow
DROP POLICY IF EXISTS "Users can access own tokens" ON public.user_tokens;
DROP POLICY IF EXISTS "Service role can access all tokens" ON public.user_tokens;

-- Policy: Service role can access all tokens (for edge functions)
CREATE POLICY "Service role full access"
ON public.user_tokens
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Policy: Authenticated users can read their own tokens by email
-- (This is a fallback if we add Supabase Auth later)
CREATE POLICY "Users can read own tokens"
ON public.user_tokens
FOR SELECT
TO authenticated
USING (
  google_email = current_setting('request.jwt.claims', true)::json->>'email'
);

-- Grant permissions
GRANT ALL ON public.user_tokens TO service_role;
GRANT SELECT ON public.user_tokens TO anon;
