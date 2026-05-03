-- 1. Grant table permissions to authenticated users
GRANT ALL ON TABLE hydration_logs TO authenticated;
GRANT ALL ON TABLE coach_messages TO authenticated;
GRANT ALL ON TABLE forecasts TO authenticated;
GRANT ALL ON TABLE ai_generated_meals TO authenticated;
GRANT ALL ON TABLE daily_plans TO authenticated;

-- 2. Grant table permissions to anonymous users (for login/setup flows if needed)
GRANT ALL ON TABLE hydration_logs TO anon;
GRANT ALL ON TABLE coach_messages TO anon;
GRANT ALL ON TABLE forecasts TO anon;

-- 3. Update RLS Policies to ensure inserts/updates are allowed
DROP POLICY IF EXISTS "Users can manage their own hydration" ON hydration_logs;
CREATE POLICY "Users can manage their own hydration" 
ON hydration_logs FOR ALL TO authenticated 
USING (auth.uid() = user_id) 
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their own coach messages" ON coach_messages;
CREATE POLICY "Users can manage their own coach messages" 
ON coach_messages FOR ALL TO authenticated 
USING (auth.uid() = user_id) 
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their own forecasts" ON forecasts;
CREATE POLICY "Users can manage their own forecasts" 
ON forecasts FOR ALL TO authenticated 
USING (auth.uid() = user_id) 
WITH CHECK (auth.uid() = user_id);
