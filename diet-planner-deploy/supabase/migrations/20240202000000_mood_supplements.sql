-- 1. Update profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS diet_type VARCHAR(20) DEFAULT 'Mixed' CHECK (diet_type IN ('Vegetarian','Non-Vegetarian','Vegan','Mixed')),
ADD COLUMN IF NOT EXISTS supplements JSONB DEFAULT '[]'::JSONB;

-- 2. Create daily_mood table
CREATE TABLE IF NOT EXISTS public.daily_mood (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  date DATE DEFAULT CURRENT_DATE,
  mood_choice VARCHAR(20) CHECK (mood_choice IN ('Veg','Non-Veg')),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- 3. Enable Row Level Security
ALTER TABLE public.daily_mood ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policy
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'daily_mood' AND policyname = 'Users can manage their own mood'
    ) THEN
        CREATE POLICY "Users can manage their own mood"
          ON public.daily_mood FOR ALL
          USING (auth.uid() = user_id)
          WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;

-- 5. Grant access
GRANT ALL ON public.daily_mood TO authenticated;
