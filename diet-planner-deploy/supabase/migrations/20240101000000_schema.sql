-- जरूरी extension (UUID generation के लिए)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 0. Drop existing tables (correct order)
DROP TABLE IF EXISTS public.meal_logs CASCADE;
DROP TABLE IF EXISTS public.daily_plans CASCADE;
DROP TABLE IF EXISTS public.ai_generated_meals CASCADE;
DROP TABLE IF EXISTS public.diet_preferences CASCADE;
DROP TABLE IF EXISTS public.weight_logs CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- 1. Profiles Table
CREATE TABLE public.profiles (
  id uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  name text,
  age integer,
  gender text CHECK (gender IN ('Male', 'Female', 'Other')),
  height numeric,
  weight numeric,
  goal text CHECK (goal IN ('Weight Loss', 'Muscle Gain', 'Maintenance')),
  activity_level text CHECK (
    activity_level IN (
      'Sedentary', 'Lightly Active', 'Moderately Active',
      'Very Active', 'Super Active'
    )
  ),
  daily_calorie_target integer,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- 2. Diet Preferences
CREATE TABLE public.diet_preferences (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  diet_type text CHECK (diet_type IN ('Vegetarian', 'Vegan', 'Keto', 'Non-Veg', 'Any')),
  allergies text[],
  cuisine_preference text,
  UNIQUE(user_id)
);

-- 3. AI Generated Meals
CREATE TABLE public.ai_generated_meals (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  meal_type text CHECK (meal_type IN ('Breakfast', 'Lunch', 'Dinner', 'Snack')),
  title text NOT NULL,
  ingredients text[],
  preparation_steps text,
  calories integer,
  protein numeric,
  is_favorite boolean DEFAULT false,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- 4. Daily Plans
CREATE TABLE public.daily_plans (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  date date NOT NULL,
  total_calories integer,
  total_protein numeric,
  breakfast_id uuid REFERENCES public.ai_generated_meals(id) ON DELETE SET NULL,
  lunch_id uuid REFERENCES public.ai_generated_meals(id) ON DELETE SET NULL,
  dinner_id uuid REFERENCES public.ai_generated_meals(id) ON DELETE SET NULL,
  snack1_id uuid REFERENCES public.ai_generated_meals(id) ON DELETE SET NULL,
  snack2_id uuid REFERENCES public.ai_generated_meals(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(user_id, date)
);

-- 5. Meal Logs
CREATE TABLE public.meal_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  daily_plan_id uuid REFERENCES public.daily_plans(id) ON DELETE CASCADE,
  meal_id uuid REFERENCES public.ai_generated_meals(id) ON DELETE CASCADE,
  status text CHECK (status IN ('Pending', 'Completed', 'Skipped')),
  logged_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(daily_plan_id, meal_id)
);

-- 6. Weight Logs
CREATE TABLE public.weight_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  weight numeric NOT NULL,
  logged_date date DEFAULT CURRENT_DATE,
  UNIQUE(user_id, logged_date)
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diet_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_generated_meals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weight_logs ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
CREATE POLICY "profile_select" ON public.profiles
FOR SELECT USING (auth.uid() = id);

CREATE POLICY "profile_insert" ON public.profiles
FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "profile_update" ON public.profiles
FOR UPDATE USING (auth.uid() = id);

-- Diet Preferences Policies
CREATE POLICY "diet_select" ON public.diet_preferences
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "diet_insert" ON public.diet_preferences
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "diet_update" ON public.diet_preferences
FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "diet_delete" ON public.diet_preferences
FOR DELETE USING (auth.uid() = user_id);

-- Meals Policies
CREATE POLICY "meals_select" ON public.ai_generated_meals
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "meals_insert" ON public.ai_generated_meals
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "meals_update" ON public.ai_generated_meals
FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "meals_delete" ON public.ai_generated_meals
FOR DELETE USING (auth.uid() = user_id);

-- Daily Plans Policies
CREATE POLICY "plans_select" ON public.daily_plans
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "plans_insert" ON public.daily_plans
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "plans_update" ON public.daily_plans
FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "plans_delete" ON public.daily_plans
FOR DELETE USING (auth.uid() = user_id);

-- Meal Logs Policies
CREATE POLICY "logs_select" ON public.meal_logs
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "logs_insert" ON public.meal_logs
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "logs_update" ON public.meal_logs
FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "logs_delete" ON public.meal_logs
FOR DELETE USING (auth.uid() = user_id);

-- Weight Logs Policies
CREATE POLICY "weight_select" ON public.weight_logs
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "weight_insert" ON public.weight_logs
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "weight_update" ON public.weight_logs
FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "weight_delete" ON public.weight_logs
FOR DELETE USING (auth.uid() = user_id);
