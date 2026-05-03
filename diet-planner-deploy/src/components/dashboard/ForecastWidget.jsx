import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';

export default function ForecastWidget({ consumedCalories, targetCalories }) {
  const [forecast, setForecast] = useState(null);
  const [confidence, setConfidence] = useState(80);

  useEffect(() => {
    calculateForecast();
  }, [consumedCalories, targetCalories]);

  const calculateForecast = async () => {
    // Basic projection model: 7700 kcal = 1 kg of body weight
    // Compare daily target vs consumed.
    // If target is maintenance, any deficit is weight loss.
    // We assume targetCalories is the daily goal (which might already include a deficit).
    // Let's just calculate based on the difference between target and consumed.
    
    let dailyDeficit = targetCalories - consumedCalories;
    
    // Project over 7 days
    let weeklyDeficit = dailyDeficit * 7;
    let predictedWeightChange = (weeklyDeficit / 7700).toFixed(2);
    
    let message = '';
    if (predictedWeightChange > 0) {
      message = `On track to lose ~${predictedWeightChange} kg this week.`;
    } else if (predictedWeightChange < 0) {
      message = `On track to gain ~${Math.abs(predictedWeightChange)} kg this week.`;
    } else {
      message = `On track to maintain current weight.`;
    }

    setForecast(message);
    
    // Confidence score based on time of day (more confident later in the day)
    const hour = new Date().getHours();
    const newConfidence = Math.min(40 + (hour / 24) * 50, 95);
    setConfidence(Math.round(newConfidence));

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const today = new Date().toISOString().split('T')[0];
      await supabase.from('forecasts').upsert({
        user_id: user.id,
        date: today,
        predicted_weight_change: predictedWeightChange,
        confidence_score: Math.round(newConfidence)
      }, { onConflict: 'user_id, date' });
    } catch (err) {
      console.error('Failed to save forecast:', err);
    }
  };

  if (!forecast) return null;

  return (
    <div className="glass-panel card-hover" style={{ display: 'flex', flexDirection: 'column' }}>
      <h3>Progress Forecast 🔮</h3>
      <div style={{ marginTop: '16px', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ fontSize: '1.2rem', textAlign: 'center', color: 'var(--text-primary)', fontWeight: 'bold' }}>
          {forecast}
        </p>
      </div>
      <div style={{ marginTop: '16px', fontSize: '0.85rem', color: 'var(--text-secondary)', textAlign: 'right' }}>
        Confidence Score: <span style={{ color: confidence > 80 ? '#10b981' : '#f59e0b' }}>{confidence}%</span>
      </div>
    </div>
  );
}
