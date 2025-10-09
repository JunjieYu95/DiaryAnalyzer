-- Initial database schema for Diary Analyzer

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create user_tokens table to store Google OAuth tokens
CREATE TABLE IF NOT EXISTS public.user_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    google_access_token TEXT NOT NULL,
    google_refresh_token TEXT,
    token_expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Create index on user_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_tokens_user_id ON public.user_tokens(user_id);

-- Enable Row Level Security
ALTER TABLE public.user_tokens ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access their own tokens
CREATE POLICY "Users can access own tokens" 
ON public.user_tokens
FOR ALL 
USING (auth.uid() = user_id);

-- Policy: Service role can access all tokens (for edge functions)
CREATE POLICY "Service role can access all tokens"
ON public.user_tokens
FOR ALL
USING (auth.role() = 'service_role');

-- Create calendar_cache table (optional, for caching calendar data)
CREATE TABLE IF NOT EXISTS public.calendar_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    calendar_id TEXT NOT NULL,
    events JSONB NOT NULL,
    cached_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    UNIQUE(user_id, calendar_id)
);

-- Create index on user_id and calendar_id
CREATE INDEX IF NOT EXISTS idx_calendar_cache_user_calendar 
ON public.calendar_cache(user_id, calendar_id);

-- Create index on expires_at for cache cleanup
CREATE INDEX IF NOT EXISTS idx_calendar_cache_expires_at 
ON public.calendar_cache(expires_at);

-- Enable Row Level Security
ALTER TABLE public.calendar_cache ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access their own cache
CREATE POLICY "Users can access own cache"
ON public.calendar_cache
FOR ALL
USING (auth.uid() = user_id);

-- Policy: Service role can access all cache (for edge functions)
CREATE POLICY "Service role can access all cache"
ON public.calendar_cache
FOR ALL
USING (auth.role() = 'service_role');

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to update updated_at on user_tokens
CREATE TRIGGER update_user_tokens_updated_at
    BEFORE UPDATE ON public.user_tokens
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to clean up expired cache entries
CREATE OR REPLACE FUNCTION cleanup_expired_cache()
RETURNS void AS $$
BEGIN
    DELETE FROM public.calendar_cache
    WHERE expires_at < NOW();
END;
$$ language 'plpgsql';

-- Schedule cleanup function (run daily)
-- Note: Requires pg_cron extension (available in Supabase Pro)
-- SELECT cron.schedule('cleanup-expired-cache', '0 0 * * *', 'SELECT cleanup_expired_cache()');

-- Grant necessary permissions
GRANT ALL ON public.user_tokens TO authenticated;
GRANT ALL ON public.calendar_cache TO authenticated;
GRANT ALL ON public.user_tokens TO service_role;
GRANT ALL ON public.calendar_cache TO service_role;
