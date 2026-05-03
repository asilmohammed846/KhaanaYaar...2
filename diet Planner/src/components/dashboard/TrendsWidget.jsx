import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function TrendsWidget() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTrends();
  }, []);

  const fetchTrends = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - 7);

      const endStr = endDate.toISOString().split('T')[0];
      const startStr = startDate.toISOString().split('T')[0];

      // Fetch daily plans
      const { data: plans } = await supabase
        .from('daily_plans')
        .select('id, date, total_calories')
        .eq('user_id', user.id)
        .gte('date', startStr)
        .lte('date', endStr)
        .order('date', { ascending: true });

      // Fetch meal logs
      const { data: logs } = await supabase
        .from('meal_logs')
        .select('status, daily_plan_id')
        .eq('user_id', user.id);

      if (plans) {
        const trendData = plans.map(plan => {
          const planLogs = logs?.filter(l => l.daily_plan_id === plan.id) || [];
          const completedCount = planLogs.filter(l => l.status === 'Completed').length;
          const skippedCount = planLogs.filter(l => l.status === 'Skipped').length;
          // Approximate completion rate
          const totalMeals = completedCount + skippedCount + planLogs.filter(l => l.status === 'Pending').length || 5;
          
          return {
            date: new Date(plan.date).toLocaleDateString('en-US', { weekday: 'short' }),
            calories: plan.total_calories || 0,
            completionRate: Math.round((completedCount / totalMeals) * 100)
          };
        });
        setData(trendData);
      }
    } catch (err) {
      console.error('Error fetching trends:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="glass-panel card-hover animate-pulse">Loading Trends...</div>;

  return (
    <div className="glass-panel card-hover" style={{ height: '350px', display: 'flex', flexDirection: 'column' }}>
      <h3>Weekly Trends 📈</h3>
      
      {data.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'var(--text-secondary)' }}>
          Not enough data yet. Keep logging!
        </div>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
            <XAxis dataKey="date" stroke="var(--text-secondary)" />
            <YAxis yAxisId="left" stroke="var(--primary)" />
            <YAxis yAxisId="right" orientation="right" stroke="#10b981" />
            <Tooltip 
              contentStyle={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: '8px' }}
              itemStyle={{ color: 'var(--text-primary)' }}
            />
            <Legend />
            <Line yAxisId="left" type="monotone" dataKey="calories" stroke="var(--primary)" name="Planned Calories" strokeWidth={2} />
            <Line yAxisId="right" type="monotone" dataKey="completionRate" stroke="#10b981" name="Completion %" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
