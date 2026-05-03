import { useState } from 'react';
import { getFullCalorieTarget } from '../utils/calorieCalc';
import { supabase } from '../supabaseClient';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

export default function Onboarding() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  
  const [profile, setProfile] = useState({ 
    gender: 'Female', 
    weight: '', 
    height: '', 
    age: '', 
    activityLevel: 'Sedentary', 
    goal: 'Maintenance',
    dietType: 'Any',
    allergies: '',
    cuisine: 'Any'
  });
  
  const [target, setTarget] = useState(null);

  const calculate = () => {
    if (!profile.weight || !profile.height || !profile.age) {
      toast.error('Please fill in all physical details.');
      return;
    }
    const t = getFullCalorieTarget(
      profile.gender, parseFloat(profile.weight), parseFloat(profile.height), 
      parseInt(profile.age), profile.activityLevel, profile.goal
    );
    setTarget(t);
    setStep(2);
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('You must be logged in to save your profile.');

      // 1. Save Profile
      const { error: profileError } = await supabase.from('profiles').upsert({
        id: user.id,
        name: user.email.split('@')[0], // placeholder name
        age: parseInt(profile.age),
        gender: profile.gender,
        height: parseFloat(profile.height),
        weight: parseFloat(profile.weight),
        goal: profile.goal,
        activity_level: profile.activityLevel,
        daily_calorie_target: target
      });
      if (profileError) throw profileError;

      // 2. Save Diet Preferences
      const allergiesArray = profile.allergies.split(',').map(a => a.trim()).filter(a => a.length > 0);
      const { error: dietError } = await supabase.from('diet_preferences').upsert({
        user_id: user.id,
        diet_type: profile.dietType,
        allergies: allergiesArray,
        cuisine_preference: profile.cuisine
      }, { onConflict: 'user_id' });
      if (dietError) throw dietError;

      toast.success('Profile saved successfully!');
      navigate('/');
      
    } catch (error) {
      toast.error(error.message || 'Failed to save profile.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-center" style={{ minHeight: '60vh' }}>
      <div className="glass-panel card-hover slide-up" style={{ width: '100%', maxWidth: '500px' }}>
        <h2 style={{ marginBottom: '8px' }}>Welcome! Let's set up your profile.</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>Step {step} of 2</p>
        
        {step === 1 ? (
          <div className="slide-up">
            <h3 style={{ marginBottom: '16px' }}>Physical Details</h3>
            <div className="grid" style={{ gap: '16px' }}>
              <input type="number" placeholder="Age" value={profile.age} onChange={(e) => setProfile({...profile, age: e.target.value})} />
              <input type="number" placeholder="Weight (kg)" value={profile.weight} onChange={(e) => setProfile({...profile, weight: e.target.value})} />
            </div>
            <input type="number" placeholder="Height (cm)" value={profile.height} onChange={(e) => setProfile({...profile, height: e.target.value})} />
            
            <select onChange={(e) => setProfile({...profile, gender: e.target.value})} value={profile.gender}>
              <option value="Female">Female</option>
              <option value="Male">Male</option>
              <option value="Other">Other</option>
            </select>
            
            <h3 style={{ margin: '16px 0' }}>Lifestyle & Goal</h3>
            <select onChange={(e) => setProfile({...profile, activityLevel: e.target.value})} value={profile.activityLevel}>
              <option value="Sedentary">Sedentary</option>
              <option value="Lightly Active">Lightly Active</option>
              <option value="Moderately Active">Moderately Active</option>
              <option value="Very Active">Very Active</option>
              <option value="Super Active">Super Active</option>
            </select>

            <select onChange={(e) => setProfile({...profile, goal: e.target.value})} value={profile.goal}>
              <option value="Weight Loss">Weight Loss</option>
              <option value="Maintenance">Maintenance</option>
              <option value="Muscle Gain">Muscle Gain</option>
            </select>
            
            <button className="button-primary" style={{ width: '100%', marginTop: '16px' }} onClick={calculate}>Next Step</button>
          </div>
        ) : (
          <div className="slide-up">
            <div className="text-center" style={{ marginBottom: '24px' }}>
              <h3>Your Daily Target</h3>
              <div style={{ fontSize: '3rem', fontWeight: 'bold', color: 'var(--primary)', margin: '12px 0' }}>
                {target} <span style={{fontSize: '1.2rem', color: 'var(--text-secondary)'}}>kcal/day</span>
              </div>
            </div>

            <h3 style={{ marginBottom: '16px' }}>Dietary Preferences</h3>
            <select onChange={(e) => setProfile({...profile, dietType: e.target.value})} value={profile.dietType}>
              <option value="Any">Any Diet</option>
              <option value="Vegetarian">Vegetarian</option>
              <option value="Vegan">Vegan</option>
              <option value="Keto">Keto</option>
              <option value="Non-Veg">Non-Vegetarian</option>
            </select>

            <input 
              type="text" 
              placeholder="Allergies (comma separated, e.g., Peanuts, Dairy)" 
              value={profile.allergies} 
              onChange={(e) => setProfile({...profile, allergies: e.target.value})} 
            />

            <select onChange={(e) => setProfile({...profile, cuisine: e.target.value})} value={profile.cuisine}>
              <option value="Any">Any Cuisine</option>
              <option value="Mediterranean">Mediterranean</option>
              <option value="Asian">Asian</option>
              <option value="American">American</option>
              <option value="Indian">Indian</option>
              <option value="Mexican">Mexican</option>
            </select>

            <div className="flex-between" style={{ marginTop: '24px', gap: '16px' }}>
              <button className="button-primary"
                onClick={() => setStep(1)} 
                style={{ background: 'transparent', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', flex: 1 }}
              >
                Back
              </button>
              <button className="button-primary" onClick={handleSave} disabled={loading} style={{ flex: 2 }}>
                {loading ? <span className="animate-pulse">Saving...</span> : 'Save & Go to Dashboard'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
