import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import toast from 'react-hot-toast';

export default function Profile() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    avatar: '👤',
    age: '',
    gender: 'Male',
    height: '',
    weight: '',
    goal: 'Maintenance',
    activity_level: 'Sedentary',
    diet_type: 'Mixed',
    supplements: []
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user logged in");

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setFormData({
          name: data.name || '',
          avatar: data.avatar || '👤',
          age: data.age || '',
          gender: data.gender || 'Male',
          height: data.height || '',
          weight: data.weight || '',
          goal: data.goal || 'Maintenance',
          activity_level: data.activity_level || 'Sedentary',
          diet_type: data.diet_type || 'Mixed',
          supplements: data.supplements || []
        });
      }
    } catch (error) {
      console.error('Error fetching profile:', error.message);
      toast.error('Failed to load profile data');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    
    // Basic validation
    if (!formData.age || !formData.height || !formData.weight) {
      toast.error('Please fill in all required fields');
      setSaving(false);
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user logged in");

      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          name: formData.name,
          avatar: formData.avatar,
          age: parseInt(formData.age),
          gender: formData.gender,
          height: parseFloat(formData.height),
          weight: parseFloat(formData.weight),
          goal: formData.goal,
          activity_level: formData.activity_level,
          diet_type: formData.diet_type,
          supplements: formData.supplements
        });

      if (error) throw error;
      toast.success('Profile updated successfully!');
    } catch (error) {
      console.error('Error updating profile:', error.message);
      toast.error(`Failed to update profile: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex-center" style={{ minHeight: '60vh' }}><div className="animate-pulse">Loading Profile...</div></div>;
  }

  return (
    <div className="fade-in" style={{ maxWidth: '600px', margin: '0 auto', padding: '20px' }}>
      <h2 style={{ marginBottom: '24px' }}>My Profile</h2>
      
      <form onSubmit={handleSubmit} className="glass-panel card-hover" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <div style={{ 
            width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.1)', 
            border: '2px solid #10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', 
            fontSize: '2.5rem', overflow: 'hidden', flexShrink: 0
          }}>
            {(formData.avatar || '').startsWith('http') || (formData.avatar || '').startsWith('data:') ? (
              <img src={formData.avatar} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              formData.avatar || '👤'
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
            <label>Profile Avatar (Emoji or Image URL)</label>
            <input type="text" name="avatar" value={formData.avatar || ''} onChange={handleChange} className="input-field" placeholder="e.g. 👤 or https://..." style={{ marginBottom: 0 }} />
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label>Name</label>
          <input type="text" name="name" value={formData.name} onChange={handleChange} className="input-field" placeholder="Enter your name" />
        </div>

        <div style={{ display: 'flex', gap: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
            <label>Age *</label>
            <input type="number" name="age" value={formData.age} onChange={handleChange} className="input-field" required />
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
            <label>Gender</label>
            <select name="gender" value={formData.gender} onChange={handleChange} className="input-field">
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
            <label>Height (cm) *</label>
            <input type="number" name="height" value={formData.height} onChange={handleChange} className="input-field" required />
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
            <label>Weight (kg) *</label>
            <input type="number" name="weight" step="0.1" value={formData.weight} onChange={handleChange} className="input-field" required />
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label>Goal</label>
          <select name="goal" value={formData.goal} onChange={handleChange} className="input-field">
            <option value="Weight Loss">Weight Loss</option>
            <option value="Maintenance">Maintenance</option>
            <option value="Muscle Gain">Muscle Gain</option>
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label>Activity Level</label>
          <select name="activity_level" value={formData.activity_level} onChange={handleChange} className="input-field">
            <option value="Sedentary">Sedentary (Little or no exercise)</option>
            <option value="Lightly Active">Lightly Active (Light exercise 1-3 days/week)</option>
            <option value="Moderately Active">Moderately Active (Moderate exercise 3-5 days/week)</option>
            <option value="Very Active">Very Active (Hard exercise 6-7 days/week)</option>
            <option value="Super Active">Super Active (Very hard exercise & physical job)</option>
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label>Dietary Preference</label>
          <select name="diet_type" value={formData.diet_type || 'Mixed'} onChange={handleChange} className="input-field">
            <option value="Vegetarian">Vegetarian</option>
            <option value="Non-Vegetarian">Non-Vegetarian</option>
            <option value="Vegan">Vegan</option>
            <option value="Mixed">Mixed</option>
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label>Active Supplements</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {['Protein Powder', 'Omega-3', 'Multivitamin', 'Creatine'].map(sup => (
              <label key={sup} className="glass-panel" style={{ 
                padding: '8px 12px', 
                borderRadius: '8px', 
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '0.9rem',
                border: (formData.supplements || []).includes(sup) ? '1px solid var(--primary)' : '1px solid var(--glass-border)',
                background: (formData.supplements || []).includes(sup) ? 'rgba(var(--primary-rgb), 0.1)' : 'transparent'
              }}>
                <input 
                  type="checkbox" 
                  checked={(formData.supplements || []).includes(sup)}
                  onChange={(e) => {
                    const current = formData.supplements || [];
                    const updated = e.target.checked 
                      ? [...current, sup]
                      : current.filter(s => s !== sup);
                    setFormData({ ...formData, supplements: updated });
                  }}
                  style={{ display: 'none' }}
                />
                {sup}
              </label>
            ))}
          </div>
        </div>

        <button type="submit" disabled={saving} className="button-primary" style={{ marginTop: '16px' }}>
          {saving ? 'Saving...' : 'Save Profile'}
        </button>
      </form>
    </div>
  );
}
