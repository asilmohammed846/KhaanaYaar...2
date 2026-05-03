import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';

import HydrationWidget from '../components/dashboard/HydrationWidget';
import AICoachWidget from '../components/dashboard/AICoachWidget';
import MacroWidget from '../components/dashboard/MacroWidget';
import TrendsWidget from '../components/dashboard/TrendsWidget';
import ForecastWidget from '../components/dashboard/ForecastWidget';

export default function Dashboard() {
  const [consumedCalories, setConsumedCalories] = useState(0);
  const [targetCalories, setTargetCalories] = useState(2000);
  const [todayPlan, setTodayPlan] = useState(null);
  const [meals, setMeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mood, setMood] = useState(null);
  const [supplements, setSupplements] = useState([]);
  const [lastMealStatusUpdate, setLastMealStatusUpdate] = useState(null);
  const [userName, setUserName] = useState('');

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase.from('profiles').select('daily_calorie_target, supplements, name').eq('id', user.id).single();
      if (profile) {
        setTargetCalories(profile.daily_calorie_target || 2000);
        setSupplements(profile.supplements || []);
        setUserName(profile.name || '');
      }

      const today = new Date().toISOString().split('T')[0];
      const { data: moodData } = await supabase.from('daily_mood')
        .select('mood_choice')
        .eq('user_id', user.id)
        .eq('date', today)
        .single();
      if (moodData) setMood(moodData.mood_choice);
      const { data: plan } = await supabase.from('daily_plans')
        .select('*, breakfast:breakfast_id(*), lunch:lunch_id(*), dinner:dinner_id(*), snack1:snack1_id(*), snack2:snack2_id(*)')
        .eq('user_id', user.id)
        .eq('date', today)
        .single();

      if (plan) {
        setTodayPlan(plan);
        const mealList = [
          { type: 'Breakfast', ...plan.breakfast },
          { type: 'Lunch', ...plan.lunch },
          { type: 'Snack 1', ...plan.snack1 },
          { type: 'Dinner', ...plan.dinner },
          { type: 'Snack 2', ...plan.snack2 }
        ].filter(m => m.id);

        // Fetch logs for these meals
        const { data: logs } = await supabase.from('meal_logs')
          .select('*')
          .eq('daily_plan_id', plan.id);
          
        let consumed = 0;
        const mealsWithStatus = mealList.map(m => {
          const log = logs?.find(l => l.meal_id === m.id);
          if (log?.status === 'Completed') consumed += m.calories;
          return { ...m, status: log?.status || 'Pending' };
        });

        setMeals(mealsWithStatus);
        setConsumedCalories(consumed);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const updateMealStatus = async (mealId, status, calories) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      await supabase.from('meal_logs').upsert({
        user_id: user.id,
        daily_plan_id: todayPlan.id,
        meal_id: mealId,
        status: status
      }, { onConflict: 'daily_plan_id, meal_id' });

      toast.success(`Meal marked as ${status}`);
      
      const meal = meals.find(m => m.id === mealId);
      setLastMealStatusUpdate({ status, mealTitle: meal?.title || 'Meal' });

      // Optimistic update
      setMeals(meals.map(m => m.id === mealId ? { ...m, status } : m));
      if (status === 'Completed') setConsumedCalories(prev => prev + calories);
      else if (status === 'Pending') setConsumedCalories(prev => prev - calories); // simplified
      
    } catch (err) {
      toast.error('Failed to update meal status.');
    }
  };

  if (loading) return <div className="flex-center" style={{minHeight: '60vh'}}><div className="animate-pulse">Loading Dashboard...</div></div>;

  return (
    <div>
      <h1 style={{ marginBottom: '24px' }}>Welcome {userName ? userName : 'back'}! 👋</h1>
      
      {/* Top Row: Calories, AI Coach, Forecast */}
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
        <div className="glass-panel card-hover">
          <h3>Calories Today</h3>
          <div style={{ margin: '16px 0', fontSize: '2rem', fontWeight: 'bold' }}>
            {consumedCalories} / <span style={{ color: 'var(--text-secondary)' }}>{targetCalories} kcal</span>
          </div>
          <div style={{ background: 'var(--glass-border)', height: '12px', borderRadius: '6px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.min((consumedCalories/targetCalories)*100, 100)}%`, background: 'var(--primary)', transition: 'width 0.4s ease' }} />
          </div>
          {consumedCalories > targetCalories && (
            <p style={{ color: 'var(--error)', marginTop: '8px', fontSize: '0.85rem' }}>You have exceeded your daily target!</p>
          )}
        </div>
        
        <AICoachWidget lastMealStatusUpdate={lastMealStatusUpdate} />
        <ForecastWidget consumedCalories={consumedCalories} targetCalories={targetCalories} />
      </div>

      {/* Middle Row: Meals and Macros */}
      <div className="grid slide-up" style={{ marginTop: '24px', gridTemplateColumns: '2fr 1fr' }}>
        <div className="glass-panel card-hover">
          <h3>Today's Meals</h3>
          {meals.length === 0 ? (
            <div style={{ marginTop: '16px', color: 'var(--text-secondary)' }}>
              <p>No meals generated for today yet.</p>
              <Link to="/generator">
                <button className="button-primary" style={{ marginTop: '12px' }}>Generate Plan</button>
              </Link>
            </div>
          ) : (
            <ul style={{ listStyle: 'none', marginTop: '16px' }}>
              {meals.map(meal => (
                <li key={meal.id} className="flex-between" style={{ marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid var(--glass-border)' }}>
                  <div>
                    <div style={{ fontWeight: '600' }}>
                      {meal.status === 'Completed' ? '✅ ' : meal.status === 'Skipped' ? '⏭️ ' : '🍽️ '} 
                      {meal.title}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      {meal.type} • {meal.calories} kcal
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {meal.status === 'Pending' && (
                      <>
                        <button className="button-primary" onClick={() => updateMealStatus(meal.id, 'Completed', meal.calories)} style={{ padding: '6px 12px', fontSize: '0.85rem' }}>Done</button>
                        <button onClick={() => updateMealStatus(meal.id, 'Skipped', meal.calories)} style={{ padding: '6px 12px', fontSize: '0.85rem', background: 'transparent', border: '1px solid var(--glass-border)', color: 'var(--text-primary)' }}>Skip</button>
                      </>
                    )}
                    {meal.status !== 'Pending' && (
                      <span style={{ color: meal.status === 'Completed' ? 'var(--primary)' : 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 'bold' }}>
                        {meal.status}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <MacroWidget meals={meals} />
          <HydrationWidget supplements={supplements} />
        </div>
      </div>

      {/* Bottom Row: Trends */}
      <div className="grid slide-up" style={{ marginTop: '24px', gridTemplateColumns: '1fr' }}>
        <TrendsWidget />
      </div>

      <div className="grid slide-up" style={{ marginTop: '24px', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
        <div className="glass-panel card-hover">
          <h3>Today's Mood 🥗</h3>
          <div style={{ marginTop: '12px', fontSize: '1.2rem', color: mood === 'Veg' ? '#10b981' : mood === 'Non-Veg' ? '#ef4444' : 'var(--text-secondary)' }}>
            {mood ? `Feeling like ${mood} today` : 'No mood set for today'}
          </div>
        </div>

        <div className="glass-panel card-hover">
          <h3>Active Supplements 💊</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '12px' }}>
            {supplements.length > 0 ? supplements.map(s => (
              <span key={s} style={{ background: 'rgba(var(--primary-rgb), 0.1)', color: 'var(--primary)', padding: '4px 12px', borderRadius: '16px', fontSize: '0.85rem', border: '1px solid var(--primary)' }}>
                {s}
              </span>
            )) : <span style={{ color: 'var(--text-secondary)' }}>No supplements active</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
