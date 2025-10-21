-- Migration for workout tracking functionality

-- Create workout_requests table
CREATE TABLE IF NOT EXISTS public.workout_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    partner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    note TEXT,
    status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
    recorded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on user_id and partner_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_workout_requests_user_id ON public.workout_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_workout_requests_partner_id ON public.workout_requests(partner_id);
CREATE INDEX IF NOT EXISTS idx_workout_requests_status ON public.workout_requests(status);
CREATE INDEX IF NOT EXISTS idx_workout_requests_recorded_at ON public.workout_requests(recorded_at);

-- Enable Row Level Security
ALTER TABLE public.workout_requests ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own requests and requests from their partners
CREATE POLICY "Users can view own and partner workout requests" 
ON public.workout_requests
FOR SELECT
USING (
    auth.uid() = user_id OR 
    auth.uid() = partner_id OR
    auth.role() = 'service_role'
);

-- Policy: Users can insert their own requests
CREATE POLICY "Users can insert own workout requests"
ON public.workout_requests
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own requests
CREATE POLICY "Users can update own workout requests"
ON public.workout_requests
FOR UPDATE
USING (auth.uid() = user_id OR auth.role() = 'service_role');

-- Policy: Users can delete their own requests
CREATE POLICY "Users can delete own workout requests"
ON public.workout_requests
FOR DELETE
USING (auth.uid() = user_id);

-- Create workout_scores table for tracking scores over time
CREATE TABLE IF NOT EXISTS public.workout_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    score NUMERIC(10, 2) NOT NULL,
    recorded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on user_id and recorded_at for faster queries
CREATE INDEX IF NOT EXISTS idx_workout_scores_user_id ON public.workout_scores(user_id);
CREATE INDEX IF NOT EXISTS idx_workout_scores_recorded_at ON public.workout_scores(recorded_at);
CREATE INDEX IF NOT EXISTS idx_workout_scores_user_recorded ON public.workout_scores(user_id, recorded_at);

-- Enable Row Level Security
ALTER TABLE public.workout_scores ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own scores and their partners' scores
CREATE POLICY "Users can view own and partner scores"
ON public.workout_scores
FOR SELECT
USING (
    auth.uid() = user_id OR
    -- Allow viewing partner's scores (assuming they have a workout_request relationship)
    EXISTS (
        SELECT 1 FROM public.workout_requests wr
        WHERE (wr.user_id = auth.uid() AND wr.partner_id = workout_scores.user_id)
           OR (wr.partner_id = auth.uid() AND wr.user_id = workout_scores.user_id)
    ) OR
    auth.role() = 'service_role'
);

-- Policy: Users can insert their own scores
CREATE POLICY "Users can insert own scores"
ON public.workout_scores
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own scores
CREATE POLICY "Users can update own scores"
ON public.workout_scores
FOR UPDATE
USING (auth.uid() = user_id);

-- Policy: Users can delete their own scores
CREATE POLICY "Users can delete own scores"
ON public.workout_scores
FOR DELETE
USING (auth.uid() = user_id);

-- Trigger to update updated_at on workout_requests
CREATE TRIGGER update_workout_requests_updated_at
    BEFORE UPDATE ON public.workout_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger to update updated_at on workout_scores
CREATE TRIGGER update_workout_scores_updated_at
    BEFORE UPDATE ON public.workout_scores
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Grant necessary permissions
GRANT ALL ON public.workout_requests TO authenticated;
GRANT ALL ON public.workout_scores TO authenticated;
GRANT ALL ON public.workout_requests TO service_role;
GRANT ALL ON public.workout_scores TO service_role;
