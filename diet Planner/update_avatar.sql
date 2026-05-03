-- Run this in your Supabase SQL Editor
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar TEXT DEFAULT '👤';
