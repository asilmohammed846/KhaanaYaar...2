import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

export default function MacroWidget({ meals }) {
  // Calculate macros only for "Completed" meals
  const completedMeals = meals.filter(m => m.status === 'Completed');
  
  const protein = completedMeals.reduce((acc, m) => acc + (m.protein || 0), 0);
  const carbs = completedMeals.reduce((acc, m) => acc + (m.carbs || 0), 0);
  const fats = completedMeals.reduce((acc, m) => acc + (m.fats || 0), 0);

  const data = [
    { name: 'Protein', value: protein },
    { name: 'Carbs', value: carbs },
    { name: 'Fats', value: fats },
  ];

  const COLORS = ['#ef4444', '#3b82f6', '#f59e0b']; // Red, Blue, Yellow

  const totalMacros = protein + carbs + fats;

  return (
    <div className="glass-panel card-hover" style={{ height: '300px', display: 'flex', flexDirection: 'column' }}>
      <h3>Macronutrients 🥗</h3>
      {totalMacros === 0 ? (
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'var(--text-secondary)' }}>
          No macros logged yet. Complete a meal!
        </div>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={80}
              paddingAngle={5}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip 
              contentStyle={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: '8px' }} 
              itemStyle={{ color: 'var(--text-primary)' }}
            />
            <Legend verticalAlign="bottom" height={36} iconType="circle" />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
