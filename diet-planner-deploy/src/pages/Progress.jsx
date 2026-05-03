import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { supabase } from '../supabaseClient';
import toast from 'react-hot-toast';

export default function Progress() {
  const [data, setData] = useState([]);
  const [targetWeight, setTargetWeight] = useState(null);
  const [newWeight, setNewWeight] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchProgressData();
  }, []);

  const fetchProgressData = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase.from('profiles').select('weight, goal').eq('id', user.id).single();
      
      // simplistic target logic based on goal
      let target = profile?.weight;
      if (profile?.goal === 'Weight Loss') target -= 5;
      else if (profile?.goal === 'Muscle Gain') target += 5;
      setTargetWeight(target);

      const { data: logs } = await supabase.from('weight_logs')
        .select('*')
        .eq('user_id', user.id)
        .order('logged_date', { ascending: true })
        .limit(30);

      const formattedData = logs?.map(log => ({
        name: new Date(log.logged_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
        weight: parseFloat(log.weight),
        target: target
      })) || [];

      setData(formattedData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogWeight = async (e) => {
    e.preventDefault();
    if (!newWeight) return;
    setSaving(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const today = new Date().toISOString().split('T')[0];

      await supabase.from('weight_logs').upsert({
        user_id: user.id,
        weight: parseFloat(newWeight),
        logged_date: today
      }, { onConflict: 'user_id, logged_date' });

      // Update profile weight as well
      await supabase.from('profiles').update({ weight: parseFloat(newWeight) }).eq('id', user.id);

      toast.success('Weight logged successfully!');
      setNewWeight('');
      fetchProgressData();
    } catch (error) {
      toast.error('Failed to log weight.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex-center" style={{minHeight: '60vh'}}><div className="animate-pulse">Loading Progress...</div></div>;

  return (
    <div>
      <h1 style={{ marginBottom: '24px' }}>Your Progress 📈</h1>
      
      <div className="grid" style={{ marginBottom: '24px' }}>
        <div className="glass-panel card-hover" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <h3>Log Today's Weight</h3>
          <form onSubmit={handleLogWeight} style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
            <input 
              type="number" 
              step="0.1" 
              placeholder="e.g. 75.5" 
              value={newWeight}
              onChange={e => setNewWeight(e.target.value)}
              style={{ marginBottom: 0, flex: 1 }}
            />
            <button className="button-primary" type="submit" disabled={saving}>
              {saving ? '...' : 'Save'}
            </button>
          </form>
        </div>
      </div>

      <div className="glass-panel card-hover" style={{ height: '400px' }}>
        <h3 style={{ marginBottom: '16px' }}>Weight Trend (kg)</h3>
        {data.length === 0 ? (
          <div className="flex-center" style={{ height: '80%', color: 'var(--text-secondary)' }}>
            No weight logs found. Start logging today!
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="85%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--glass-border)" />
              <XAxis dataKey="name" stroke="var(--text-secondary)" tick={{fontSize: 12}} />
              <YAxis stroke="var(--text-secondary)" domain={['dataMin - 1', 'dataMax + 1']} />
              <Tooltip 
                contentStyle={{ background: 'var(--surface-color)', border: '1px solid var(--glass-border)', borderRadius: '8px' }}
                itemStyle={{ color: 'var(--text-primary)' }}
              />
              <Line type="monotone" dataKey="weight" stroke="var(--primary)" strokeWidth={3} dot={{ r: 5 }} />
              <Line type="monotone" dataKey="target" stroke="var(--error)" strokeWidth={2} strokeDasharray="5 5" />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
