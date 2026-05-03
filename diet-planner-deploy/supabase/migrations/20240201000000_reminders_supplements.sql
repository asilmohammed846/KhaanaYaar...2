-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor → New Query)

-- 1. Reminders Table
CREATE TABLE IF NOT EXISTS public.reminders (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  type text CHECK (type IN ('Meal', 'Water', 'Supplement')),
  title text,
  time time NOT NULL,
  enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- 2. Supplements Table
CREATE TABLE IF NOT EXISTS public.supplements (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text,
  water_required_ml integer,
  intake_time time,
  created_at timestamptz DEFAULT now()
);

-- 3. Enable Row Level Security
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplements ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies – reminders
CREATE POLICY "Users can manage their own reminders"
  ON public.reminders FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 5. RLS Policies – supplements
CREATE POLICY "Users can manage their own supplements"
  ON public.supplements FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 6. Grant access
GRANT ALL ON public.reminders TO authenticated;
GRANT ALL ON public.supplements TO authenticated;
