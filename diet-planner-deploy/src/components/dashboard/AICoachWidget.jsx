import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import toast from 'react-hot-toast';

export default function AICoachWidget({ lastMealStatusUpdate }) {
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tone, setTone] = useState('friendly');

  useEffect(() => {
    fetchLatestMessage();
  }, []);

  // When meal status changes from Dashboard parent, trigger a new message
  useEffect(() => {
    if (lastMealStatusUpdate) {
      generateNewMessage(lastMealStatusUpdate);
    }
  }, [lastMealStatusUpdate]);

  const fetchLatestMessage = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('coach_messages')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (data) {
        setMessage(data);
      }
    } catch (error) {
      if (error.code !== 'PGRST116') {
        console.error('Error fetching coach message:', error);
      }
    } finally {
      setLoading(false);
    }
  };

  const generateNewMessage = async ({ status, mealTitle }) => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      if (!apiKey) throw new Error("Gemini API key missing");

      const isCompleted = status === 'Completed';
      const prompt = `You are an AI Diet Coach named KhaanaSathi. The user just marked their meal "${mealTitle}" as ${status}. 
      Generate a short, 1-2 sentence ${isCompleted ? 'motivational' : 'encouraging reminder'} message. 
      Keep the tone ${tone}. 
      If the tone is 'funny', use witty Hinglish (Hindi + English) and include a funny diet-related shayari or a famous Bollywood-style dialogue twist.
      Do not use formatting like bold or asterisks.`;

      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });

      if (!res.ok) throw new Error("API call failed");
      const data = await res.json();
      const textResponse = data.candidates[0].content.parts[0].text.trim();

      const today = new Date().toISOString().split('T')[0];

      const { data: newMsg, error } = await supabase.from('coach_messages').insert([{
        user_id: user.id,
        type: isCompleted ? 'motivational' : 'reminder',
        message: textResponse,
        date: today
      }]).select().single();

      if (error) throw error;
      setMessage(newMsg);
      toast.success('New AI Coach message arrived!');
    } catch (err) {
      console.error(err);
      toast.error('AI Coach error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !message) return <div className="glass-panel card-hover animate-pulse">Loading AI Coach...</div>;

  return (
    <div className="glass-panel card-hover" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="flex-between">
        <h3>KhaanaSathi 🍛🤝</h3>
        <select
          value={tone}
          onChange={(e) => setTone(e.target.value)}
          style={{ background: 'rgba(255,255,255,0.1)', color: 'var(--text-primary)', border: '1px solid var(--glass-border)', borderRadius: '4px', padding: '4px' }}
        >
          <option value="friendly">Friendly</option>
          <option value="professional">Professional</option>
          <option value="strict">Strict</option>
          <option value="funny">Funny/Shayari</option>
        </select>
      </div>

      <div style={{ marginTop: '16px', flex: 1, display: 'flex', alignItems: 'center' }}>
        {message ? (
          <p style={{ fontStyle: 'italic', color: 'var(--text-secondary)', fontSize: '1.1rem', lineHeight: '1.5' }}>
            "{message.message}"
          </p>
        ) : (
          <p style={{ color: 'var(--text-secondary)' }}>No messages yet. Complete a meal to get started!</p>
        )}
      </div>
    </div>
  );
}
