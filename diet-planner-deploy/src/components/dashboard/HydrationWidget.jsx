import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import toast from 'react-hot-toast';

export default function HydrationWidget({ supplements }) {
  const [hydration, setHydration] = useState(0);
  const [loading, setLoading] = useState(true);

  // Calculate dynamic goal
  const baseWater = 2500;
  // Give +300ml per active supplement, up to a max or just fixed
  const supplementExtra = supplements && supplements.length > 0 ? supplements.length * 300 : 0; 
  const goal = baseWater + supplementExtra;

  useEffect(() => {
    fetchHydration();
  }, []);

  const fetchHydration = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('hydration_logs')
        .select('amount_ml')
        .eq('user_id', user.id)
        .eq('date', today)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setHydration(data.amount_ml);
      } else {
        // Create initial log
        await supabase.from('hydration_logs').insert([
          { user_id: user.id, date: today, amount_ml: 0 }
        ]);
        setHydration(0);
      }
    } catch (error) {
      console.error('Error fetching hydration:', error);
    } finally {
      setLoading(false);
    }
  };

  const addWater = async (amount) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const today = new Date().toISOString().split('T')[0];
      const newAmount = hydration + amount;

      const { error } = await supabase
        .from('hydration_logs')
        .upsert({ user_id: user.id, date: today, amount_ml: newAmount }, { onConflict: 'user_id, date' });

      if (error) throw error;

      setHydration(newAmount);
      toast.success(`Added ${amount}ml of water! 💧`);
    } catch (error) {
      toast.error('Failed to log water intake.');
    }
  };

  const progressPercentage = Math.min((hydration / goal) * 100, 100);

  if (loading) return <div className="glass-panel card-hover animate-pulse">Loading Hydration...</div>;

  return (
    <div className="glass-panel card-hover" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="flex-between">
        <h3>Hydration Tracker 💧</h3>
      </div>
      
      {supplementExtra > 0 && (
        <div style={{ display: 'flex', gap: '16px', marginTop: '16px', background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '8px' }}>
          <div>
            <div style={{ color: '#3b82f6', fontSize: '1.5rem', fontWeight: 'bold' }}>{(goal / 1000).toFixed(1)}L</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Target</div>
          </div>
          <div>
            <div style={{ color: '#10b981', fontSize: '1.5rem', fontWeight: 'bold' }}>{(baseWater / 1000).toFixed(1)}L</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Base Water</div>
          </div>
          <div>
            <div style={{ color: '#8b5cf6', fontSize: '1.5rem', fontWeight: 'bold' }}>+{(supplementExtra / 1000).toFixed(1)}L</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Supplement Extra</div>
          </div>
        </div>
      )}

      <div style={{ margin: '16px 0', fontSize: '2rem', fontWeight: 'bold' }}>
        {hydration} / <span style={{ color: 'var(--text-secondary)' }}>{goal} ml</span>
      </div>
      
      <div style={{ background: 'var(--glass-border)', height: '12px', borderRadius: '6px', overflow: 'hidden' }}>
        <div style={{ 
          height: '100%', 
          width: `${progressPercentage}%`, 
          background: progressPercentage >= 100 ? '#10b981' : '#3b82f6', 
          transition: 'width 0.4s ease' 
        }} />
      </div>

      <div style={{ display: 'flex', gap: '8px', marginTop: '20px' }}>
        <button className="button-primary" style={{ flex: 1, padding: '8px', fontSize: '0.9rem', background: '#3b82f6' }} onClick={() => addWater(250)}>
          +250ml
        </button>
        <button className="button-primary" style={{ flex: 1, padding: '8px', fontSize: '0.9rem', background: '#3b82f6' }} onClick={() => addWater(500)}>
          +500ml
        </button>
        <button className="button-primary" style={{ flex: 1, padding: '8px', fontSize: '0.9rem', background: '#2563eb' }} onClick={() => addWater(1000)}>
          +1L
        </button>
      </div>
    </div>
  );
}
