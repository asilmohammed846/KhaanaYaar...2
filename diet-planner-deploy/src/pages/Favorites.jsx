import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import toast from 'react-hot-toast';

export default function Favorites() {
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFavorites();
  }, []);

  const fetchFavorites = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('ai_generated_meals')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_favorite', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setFavorites(data || []);
    } catch (err) {
      toast.error('Failed to load favorites');
    } finally {
      setLoading(false);
    }
  };

  const removeFavorite = async (id) => {
    try {
      const { error } = await supabase
        .from('ai_generated_meals')
        .update({ is_favorite: false })
        .eq('id', id);

      if (error) throw error;
      setFavorites(favorites.filter(f => f.id !== id));
      toast.success('Removed from favorites');
    } catch (err) {
      toast.error('Failed to remove');
    }
  };

  if (loading) return <div className="flex-center" style={{minHeight: '60vh'}}><div className="animate-pulse">Loading Favorites...</div></div>;

  return (
    <div>
      <h1 style={{ marginBottom: '24px' }}>Saved Meals ❤️</h1>
      
      {favorites.length === 0 ? (
        <div className="glass-panel flex-center" style={{ minHeight: '200px', color: 'var(--text-secondary)' }}>
          You haven't saved any meals yet. Go to the Generator to find some!
        </div>
      ) : (
        <div className="grid slide-up">
          {favorites.map((meal) => (
            <div key={meal.id} className="glass-panel card-hover" style={{ display: 'flex', flexDirection: 'column' }}>
              <div className="flex-between">
                <h3 style={{ textTransform: 'capitalize', color: 'var(--accent)' }}>{meal.meal_type}</h3>
                <button 
                  onClick={() => removeFavorite(meal.id)}
                  style={{ background: 'transparent', border: 'none', padding: 0, fontSize: '1.2rem', color: 'var(--error)' }}
                >
                  ❤️
                </button>
              </div>
              
              <div style={{ marginTop: '12px', fontSize: '1.2rem', fontWeight: 'bold' }}>{meal.title}</div>
              <div style={{ marginTop: '8px', color: 'var(--text-secondary)' }}>
                🔥 {meal.calories} kcal • 🥩 {meal.protein}g protein
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
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
