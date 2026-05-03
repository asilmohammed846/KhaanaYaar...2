import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { Toaster } from 'react-hot-toast';
import Dashboard from './pages/Dashboard';
import Onboarding from './pages/Onboarding';
import MealGenerator from './pages/MealGenerator';
import Progress from './pages/Progress';
import Favorites from './pages/Favorites';
import Profile from './pages/Profile';
import Reminders from './pages/Reminders';
import Auth from './pages/Auth';
import Chatbot from './components/Chatbot';

function ProfileIcon({ user }) {
  const [avatar, setAvatar] = useState('👤');

  useEffect(() => {
    if (!user?.id) return;
    const fetchAvatar = async () => {
      const { data } = await supabase.from('profiles').select('avatar').eq('id', user.id).single();
      if (data?.avatar) setAvatar(data.avatar);
    };
    fetchAvatar();
    
    const channel = supabase.channel('profile-changes')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` }, (payload) => {
        if (payload.new?.avatar) setAvatar(payload.new.avatar);
      })
      .subscribe();
      
    return () => supabase.removeChannel(channel);
  }, [user]);

  const isUrl = avatar.startsWith('http') || avatar.startsWith('data:image');

  return (
    <Link to="/profile" style={{ 
      display: 'flex', alignItems: 'center', justifyContent: 'center', 
      width: '38px', height: '38px', borderRadius: '50%', 
      background: 'rgba(16, 185, 129, 0.1)', border: '2px solid #10b981', 
      fontSize: '1.1rem', textDecoration: 'none', marginLeft: '20px', transition: 'all 0.2s ease',
      overflow: 'hidden'
    }} title="My Profile" className="card-hover">
      {isUrl ? <img src={avatar} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : avatar}
    </Link>
  );
}

function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  if (loading) {
    return <div className="flex-center" style={{height: '100vh'}}><div className="animate-pulse">Loading...</div></div>;
  }

  return (
    <Router>
      <Toaster position="top-right" toastOptions={{
        style: {
          background: 'var(--surface-color)',
          color: 'var(--text-primary)',
          backdropFilter: 'blur(12px)',
          border: '1px solid var(--glass-border)'
        }
      }} />
      <div className="navbar">
        <Link to="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
          <img 
            src="/logo.png" 
            alt="KhaanaYaar" 
            style={{ width: '260px', height: 'auto', objectFit: 'contain', margin: '-45px 0' }}
            onError={(e) => {
              // Fallback if image not found
              e.target.style.display = 'none';
              e.target.nextSibling.style.display = 'flex';
            }}
          />
          {/* Fallback text that only shows if the image is missing */}
          <div style={{ display: 'none', flexDirection: 'column' }}>
            <div style={{ fontWeight: '800', fontSize: '1.4rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
              🧑‍🍳 <span style={{ color: '#f97316' }}>Khaana</span><span style={{ color: '#22c55e' }}>Yaar</span>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontStyle: 'italic', letterSpacing: '0.2px', marginTop: '-2px' }}>
              Kya hua agar vo busy hai, main to hu na tere Sath!...
            </div>
          </div>
        </Link>
        <div className="nav-links flex-center">
          {user && (
            <>
              <Link to="/">Dashboard</Link>
              <Link to="/generator">Meal Generator</Link>
              <Link to="/progress">Progress</Link>
              <Link to="/favorites">Favorites</Link>
              <Link to="/reminders">⏰ Reminders</Link>
              <ProfileIcon user={user} />
              <button 
                className="btn-signout"
                onClick={handleLogout}
                style={{ marginLeft: '12px' }}
              >
                Sign Out
              </button>
            </>
          )}
          <button className="btn-signout" style={{ marginLeft: '12px' }} onClick={toggleTheme}>
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
        </div>
      </div>

      <div className="container slide-up">
        {user ? (
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/generator" element={<MealGenerator />} />
            <Route path="/progress" element={<Progress />} />
            <Route path="/favorites" element={<Favorites />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/reminders" element={<Reminders />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        ) : (
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="*" element={<Navigate to="/auth" replace />} />
          </Routes>
        )}
      </div>

      {user && <Chatbot />}
    </Router>
  );
}

export default App;
