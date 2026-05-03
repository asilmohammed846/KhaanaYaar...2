-- 1. Hydration Logs Table
CREATE TABLE hydration_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    amount_ml INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, date)
);

-- 2. Coach Messages Table
CREATE TABLE coach_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('motivational', 'reminder')),
    message TEXT NOT NULL,
    date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Forecasts Table
CREATE TABLE forecasts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    predicted_weight_change NUMERIC NOT NULL,
    confidence_score INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, date)
);

-- 4. Modify Existing Tables (ai_generated_meals and daily_plans)
-- Assuming these tables already exist. We add the columns if they don't exist.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ai_generated_meals' AND column_name='carbs') THEN
        ALTER TABLE ai_generated_meals ADD COLUMN carbs INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ai_generated_meals' AND column_name='fats') THEN
        ALTER TABLE ai_generated_meals ADD COLUMN fats INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='daily_plans' AND column_name='total_carbs') THEN
        ALTER TABLE daily_plans ADD COLUMN total_carbs INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='daily_plans' AND column_name='total_fats') THEN
        ALTER TABLE daily_plans ADD COLUMN total_fats INTEGER DEFAULT 0;
    END IF;
END $$;

-- 5. RLS Policies
-- Enable RLS
ALTER TABLE hydration_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE coach_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE forecasts ENABLE ROW LEVEL SECURITY;

-- Hydration RLS
CREATE POLICY "Users can manage their own hydration"
    ON hydration_logs FOR ALL
    USING (auth.uid() = user_id);

-- Coach Messages RLS
CREATE POLICY "Users can manage their own coach messages"
    ON coach_messages FOR ALL
    USING (auth.uid() = user_id);

-- Forecasts RLS
CREATE POLICY "Users can manage their own forecasts"
    ON forecasts FOR ALL
    USING (auth.uid() = user_id);

