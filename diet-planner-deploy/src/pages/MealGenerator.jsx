import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import toast from 'react-hot-toast';

export default function MealGenerator() {
  const [loadingTarget, setLoadingTarget] = useState(null);
  const [plan, setPlan] = useState(null);
  const [error, setError] = useState('');
  const [showMoodPopup, setShowMoodPopup] = useState(false);
  const [todayMood, setTodayMood] = useState(null);
  const [profile, setProfile] = useState(null);
  const [regenTarget, setRegenTarget] = useState(null);

  useEffect(() => {
    checkTodayMood();
    const cached = localStorage.getItem('dailyPlan');
    if (cached) {
      setPlan(JSON.parse(cached));
    }
  }, []);

  const checkTodayMood = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      setProfile(prof);

      const today = new Date().toISOString().split('T')[0];
      const { data: moodData } = await supabase.from('daily_mood')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', today)
        .single();

      if (moodData) {
        setTodayMood(moodData.mood_choice);
      }
    } catch (err) {
      console.error("Error checking mood:", err);
    }
  };

  const handleMoodSelect = async (choice) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const today = new Date().toISOString().split('T')[0];
        await supabase.from('daily_mood').upsert({
          user_id: user.id,
          date: today,
          mood_choice: choice
        }, { onConflict: 'user_id, date' });
      }

      setTodayMood(choice);
      setShowMoodPopup(false);
      
      const target = regenTarget || 'all';
      if (target === 'all') {
        generatePlan(2, choice);
      } else {
        regenerateSingleMeal(target, choice, 2);
      }
      setRegenTarget(null);
    } catch (err) {
      toast.error("Failed to save mood");
    }
  };

  const generatePlan = async (retries = 2, selectedMood = null) => {
    const moodToUse = selectedMood || todayMood;
    
    // Fallback if somehow moodToUse is null (shouldn't happen since popup sets it)
    if (!moodToUse) {
      setRegenTarget('all');
      setShowMoodPopup(true);
      return;
    }

    setLoadingTarget('all');
    setError('');
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not logged in");

      const currentProfile = profile || (await supabase.from('profiles').select('*').eq('id', user.id).single()).data;
      
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      if (!apiKey || apiKey === "YOUR_GEMINI_API_KEY_HERE") {
        throw new Error("Gemini API Key missing or invalid. Please add a valid key to your .env file and restart the development server.");
      }

      const prompt = `Generate a personalized daily meal plan.

User Details:
- Age: ${currentProfile?.age || 'Unknown'}
- Gender: ${currentProfile?.gender || 'Unknown'}
- Goal: ${currentProfile?.goal || 'Maintenance'}
- Daily Calorie Target: ${currentProfile?.daily_calorie_target || 2000}
- Dietary Preference (Profile): ${currentProfile?.diet_type || 'Mixed'}
- TODAY'S MOOD: ${moodToUse} (CRITICAL: Prioritize this choice for meal selection)
- ACTIVE SUPPLEMENTS: ${(currentProfile?.supplements || []).join(', ') || 'None'}

Requirements:
- Provide Breakfast, Lunch, Dinner, Snack 1, Snack 2
- Include calories, protein, carbs, and fats per meal
- If "Protein Powder" is an active supplement, adjust meal protein slightly lower (assume 25g protein from supplement).
- Ensure total calories ≈ ${currentProfile?.daily_calorie_target || 2000}
- Format EXACTLY as JSON, no markdown. Shape:
{
  "breakfast": { "title": "...", "calories": ..., "protein": ..., "carbs": ..., "fats": ..., "ingredients": ["..."], "preparation_steps": "..." },
  "lunch": { "title": "...", "calories": ..., "protein": ..., "carbs": ..., "fats": ..., "ingredients": ["..."], "preparation_steps": "..." },
  "dinner": { "title": "...", "calories": ..., "protein": ..., "carbs": ..., "fats": ..., "ingredients": ["..."], "preparation_steps": "..." },
  "snack1": { "title": "...", "calories": ..., "protein": ..., "carbs": ..., "fats": ..., "ingredients": ["..."], "preparation_steps": "..." },
  "snack2": { "title": "...", "calories": ..., "protein": ..., "carbs": ..., "fats": ..., "ingredients": ["..."], "preparation_steps": "..." }
}`;

      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });

      const data = await res.json();
      if (!res.ok) {
        if (res.status === 429 || res.status >= 500) {
          if (retries > 0) {
            toast('API Busy, waiting 5s...', { icon: '⏳' });
            await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
            return await generatePlan(retries - 1, selectedMood);
          }
        }
        throw new Error(data.error?.message || 'Failed to fetch plan.');
      }
      
      const textResponse = data.candidates[0].content.parts[0].text;
      const cleanJson = textResponse.replace(/```json/g, '').replace(/```/g, '');
      const parsedPlan = JSON.parse(cleanJson);
      
      // Save to Supabase ai_generated_meals
      let totalCalories = 0;
      let totalProtein = 0;
      let totalCarbs = 0;
      let totalFats = 0;
      const mealIds = {};
      
      for (const [key, meal] of Object.entries(parsedPlan)) {
        totalCalories += meal.calories || 0;
        totalProtein += meal.protein || 0;
        totalCarbs += meal.carbs || 0;
        totalFats += meal.fats || 0;
        
        const { data: insertedMeal, error: mealErr } = await supabase.from('ai_generated_meals').insert({
          user_id: user.id,
          meal_type: key.startsWith('snack') ? 'Snack' : key.charAt(0).toUpperCase() + key.slice(1),
          title: meal.title,
          ingredients: meal.ingredients,
          preparation_steps: meal.preparation_steps,
          calories: meal.calories,
          protein: meal.protein,
          carbs: meal.carbs,
          fats: meal.fats
        }).select().single();
        
        if (mealErr) throw mealErr;
        mealIds[`${key}_id`] = insertedMeal.id;
        parsedPlan[key].id = insertedMeal.id; // append ID for favorites feature
      }

      // Save Daily Plan
      const today = new Date().toISOString().split('T')[0];
      await supabase.from('daily_plans').upsert({
        user_id: user.id,
        date: today,
        total_calories: totalCalories,
        total_protein: totalProtein,
        total_carbs: totalCarbs,
        total_fats: totalFats,
        ...mealIds
      }, { onConflict: 'user_id, date' });

      setPlan(parsedPlan);
      localStorage.setItem('dailyPlan', JSON.stringify(parsedPlan));
      toast.success('Successfully generated today\'s plan!');
      
    } catch (err) {
      setError(err.message || 'Failed to generate plan. Please try again.');
      toast.error('Error: ' + err.message);
    } finally {
      setLoadingTarget(null);
    }
  };

  const regenerateSingleMeal = async (mealKey, selectedMood, retries = 2) => {
    setLoadingTarget(mealKey);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not logged in");

      const currentProfile = profile || (await supabase.from('profiles').select('*').eq('id', user.id).single()).data;
      
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      if (!apiKey || apiKey === "YOUR_GEMINI_API_KEY_HERE") {
        throw new Error("Gemini API Key missing or invalid.");
      }

      const mealTypeLabel = mealKey.startsWith('snack') ? `Snack ${mealKey.replace('snack', '')}` : mealKey.charAt(0).toUpperCase() + mealKey.slice(1);
      
      const prompt = `Generate a single replacement meal for ${mealTypeLabel}.

User Details:
- Age: ${currentProfile?.age || 'Unknown'}
- Gender: ${currentProfile?.gender || 'Unknown'}
- Goal: ${currentProfile?.goal || 'Maintenance'}
- TODAY'S MOOD: ${selectedMood} (CRITICAL: Prioritize this choice for meal selection)
- ACTIVE SUPPLEMENTS: ${(currentProfile?.supplements || []).join(', ') || 'None'}

Requirements:
- It should be appropriate for ${mealTypeLabel}.
- Format EXACTLY as JSON, no markdown. Shape:
{
  "title": "...", "calories": ..., "protein": ..., "carbs": ..., "fats": ..., "ingredients": ["..."], "preparation_steps": "..."
}`;

      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });

      const data = await res.json();
      if (!res.ok) {
        if (res.status === 429 || res.status >= 500) {
          if (retries > 0) {
            toast('API Busy, waiting 5s...', { icon: '⏳' });
            await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
            return await regenerateSingleMeal(mealKey, selectedMood, retries - 1);
          }
        }
        throw new Error(data.error?.message || 'Failed to fetch meal.');
      }
      
      const textResponse = data.candidates[0].content.parts[0].text;
      const cleanJson = textResponse.replace(/```json/g, '').replace(/```/g, '');
      const parsedMeal = JSON.parse(cleanJson);
      
      const dbMealType = mealKey.startsWith('snack') ? 'Snack' : mealKey.charAt(0).toUpperCase() + mealKey.slice(1);
      
      const { data: insertedMeal, error: mealErr } = await supabase.from('ai_generated_meals').insert({
        user_id: user.id,
        meal_type: dbMealType,
        title: parsedMeal.title,
        ingredients: parsedMeal.ingredients,
        preparation_steps: parsedMeal.preparation_steps,
        calories: parsedMeal.calories,
        protein: parsedMeal.protein,
        carbs: parsedMeal.carbs,
        fats: parsedMeal.fats
      }).select().single();
      
      if (mealErr) throw mealErr;
      parsedMeal.id = insertedMeal.id;
      
      const newPlan = { ...plan, [mealKey]: parsedMeal };
      
      let totalCalories = 0;
      let totalProtein = 0;
      let totalCarbs = 0;
      let totalFats = 0;
      const mealIds = {};
      for (const [key, meal] of Object.entries(newPlan)) {
        totalCalories += meal.calories || 0;
        totalProtein += meal.protein || 0;
        totalCarbs += meal.carbs || 0;
        totalFats += meal.fats || 0;
        mealIds[`${key}_id`] = meal.id;
      }
      
      const today = new Date().toISOString().split('T')[0];
      await supabase.from('daily_plans').upsert({
        user_id: user.id,
        date: today,
        total_calories: totalCalories,
        total_protein: totalProtein,
        total_carbs: totalCarbs,
        total_fats: totalFats,
        ...mealIds
      }, { onConflict: 'user_id, date' });

      setPlan(newPlan);
      localStorage.setItem('dailyPlan', JSON.stringify(newPlan));
      toast.success(`Successfully regenerated ${mealTypeLabel}!`);
      
    } catch (err) {
      toast.error('Error: ' + (err.message || 'Failed to regenerate meal.'));
    } finally {
      setLoadingTarget(null);
    }
  };

  const toggleFavorite = async (mealKey) => {
    const meal = plan[mealKey];
    if (!meal?.id) return;
    
    try {
      const isFav = meal.is_favorite || false;
      const { error } = await supabase.from('ai_generated_meals').update({ is_favorite: !isFav }).eq('id', meal.id);
      if (error) throw error;
      
      const newPlan = { ...plan, [mealKey]: { ...meal, is_favorite: !isFav } };
      setPlan(newPlan);
      localStorage.setItem('dailyPlan', JSON.stringify(newPlan));
      toast.success(isFav ? 'Removed from favorites' : 'Saved to favorites');
    } catch (err) {
      toast.error('Failed to update favorites');
    }
  };

  return (
    <div>
      {showMoodPopup && <MoodPopup onSelect={handleMoodSelect} onClose={() => { setShowMoodPopup(false); setRegenTarget(null); }} />}
      <div className="flex-between" style={{ marginBottom: '24px' }}>
        <h1>AI Meal Generator 🤖</h1>
        {plan && (
          <button className="button-primary" onClick={() => { setRegenTarget('all'); setShowMoodPopup(true); }} disabled={loadingTarget !== null} style={{ background: 'transparent', border: '1px solid var(--primary)', color: 'var(--primary)' }}>
            {loadingTarget === 'all' ? 'Regenerating...' : 'Regenerate All 🔄'}
          </button>
        )}
      </div>
      
      {!plan ? (
        <div className="glass-panel card-hover flex-center" style={{ minHeight: '300px', flexDirection: 'column' }}>
          <p style={{ marginBottom: '24px', color: 'var(--text-secondary)' }}>
            Let our AI craft a personalized daily meal plan based on your current goal and preferences.
          </p>
          <button className="button-primary" onClick={() => { setRegenTarget('all'); setShowMoodPopup(true); }} disabled={loadingTarget !== null}>
            {loadingTarget === 'all' ? <span className="animate-pulse">Generating your 5 meals...</span> : 'Generate Today\'s Plan'}
          </button>
          {error && <p style={{ color: 'var(--error)', marginTop: '16px' }}>{error}</p>}
        </div>
      ) : (
        <div className="grid slide-up">
          {Object.entries(plan).map(([type, meal]) => (
            <div key={type} className="glass-panel card-hover" style={{ display: 'flex', flexDirection: 'column' }}>
              <div className="flex-between">
                <h3 style={{ textTransform: 'capitalize', color: 'var(--accent)' }}>
                  {type.startsWith('snack') ? `Snack ${type.replace('snack', '')}` : type}
                </h3>
                {meal.id && (
                  <button 
                    onClick={() => toggleFavorite(type)}
                    style={{ background: 'transparent', border: 'none', padding: 0, fontSize: '1.2rem', color: meal.is_favorite ? 'var(--error)' : 'var(--text-secondary)' }}
                  >
                    {meal.is_favorite ? '❤️' : '🤍'}
                  </button>
                )}
              </div>
              
              <div style={{ marginTop: '12px', fontSize: '1.2rem', fontWeight: 'bold' }}>{meal.title}</div>
              <div style={{ marginTop: '8px', color: 'var(--text-secondary)' }}>
                🔥 {meal.calories} kcal • 🥩 {meal.protein}g protein • 🍞 {meal.carbs}g carbs • 🥑 {meal.fats}g fats
              </div>
              
              <div style={{ marginTop: '16px' }}>
                <h4 style={{ fontSize: '0.9rem', marginBottom: '8px' }}>Ingredients</h4>
                <ul style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', paddingLeft: '20px' }}>
                  {meal.ingredients?.map((ing, i) => <li key={i}>{ing}</li>)}
                </ul>
              </div>
              
              <div style={{ marginTop: '16px', flex: 1 }}>
                <h4 style={{ fontSize: '0.9rem', marginBottom: '8px' }}>Prep</h4>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{meal.preparation_steps}</p>
              </div>

              <button className="button-primary"
                onClick={() => { setRegenTarget(type); setShowMoodPopup(true); }}
                disabled={loadingTarget !== null}
                style={{ marginTop: '24px', background: 'transparent', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', width: '100%' }}>
                {loadingTarget === type ? 'Regenerating...' : 'Regenerate This Meal 🔄'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MoodPopup({ onSelect, onClose }) {
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000 }}>
      <div className="glass-panel slide-up" style={{ padding: '32px', textAlign: 'center', maxWidth: '400px', width: '90%' }}>
        <h2 style={{ marginBottom: '16px' }}>Meal Preference 🥗</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>How would you like your meals for this regeneration?</p>
        <div style={{ display: 'flex', gap: '16px' }}>
          <button className="button-primary" onClick={() => onSelect('Veg')} style={{ flex: 1, background: '#10b981' }}>Vegetarian</button>
          <button className="button-primary" onClick={() => onSelect('Non-Veg')} style={{ flex: 1, background: '#ef4444' }}>Non-Vegetarian</button>
        </div>
        <button onClick={onClose} style={{ marginTop: '16px', background: 'transparent', color: 'var(--text-secondary)', border: 'none', cursor: 'pointer' }}>Cancel</button>
      </div>
    </div>
  );
}

