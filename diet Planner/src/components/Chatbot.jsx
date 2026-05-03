import { useState } from 'react';

export default function Chatbot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([{ text: "👋 Hi! I'm your AI Diet Assistant. I can help with meal alternatives, calorie checks, or general nutrition advice. What's on your mind?", type: 'bot' }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMsg = input;
    setMessages(prev => [...prev, { text: userMsg, type: 'user' }]);
    setInput('');
    setLoading(true);

    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      if (!apiKey || apiKey === "YOUR_GEMINI_API_KEY_HERE") throw new Error("API key missing in .env");

      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: userMsg + " (Answer concisely as a helpful nutritionist)" }] }] })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "API Error");
      }

      setMessages(prev => [...prev, { text: data.candidates[0].content.parts[0].text, type: 'bot' }]);
    } catch (err) {
      console.error("Chatbot API Error:", err);
      setMessages(prev => [...prev, { text: `⚠️ Error: ${err.message}. Please verify your API key in the .env file and restart the dev server.`, type: 'bot' }]);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 1000 }}>
      {open && (
        <div className="glass-panel slide-up" style={{ width: '340px', height: '450px', marginBottom: '16px', display: 'flex', flexDirection: 'column' }}>
          <div className="flex-between" style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '12px', marginBottom: '12px' }}>
            <h4 style={{ margin: 0 }}>Diet Assistant</h4>
            <button style={{ background: 'transparent', padding: '0', color: 'var(--text-primary)' }} onClick={() => setOpen(false)}>✕</button>
          </div>
          
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingBottom: '12px' }}>
            {messages.map((msg, i) => (
              <div key={i} style={{ 
                background: msg.type === 'bot' ? 'var(--bg-color)' : 'var(--primary)',
                color: msg.type === 'bot' ? 'inherit' : '#fff',
                padding: '8px 12px', 
                borderRadius: '8px', 
                alignSelf: msg.type === 'bot' ? 'flex-start' : 'flex-end', 
                maxWidth: '85%',
                fontSize: '0.9rem'
              }}>
                {msg.text}
              </div>
            ))}
            {loading && <div style={{ alignSelf: 'flex-start', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Typing...</div>}
          </div>
          
          <form onSubmit={sendMessage} style={{ display: 'flex', gap: '8px' }}>
            <input 
              type="text" 
              placeholder="Ask a nutritionist..." 
              value={input}
              onChange={e => setInput(e.target.value)}
              style={{ marginBottom: 0, flex: 1 }} 
            />
            <button type="submit" style={{ padding: '0 16px' }}>➤</button>
          </form>
        </div>
      )}
      
      {!open && (
        <button 
          onClick={() => setOpen(true)}
          style={{ width: '60px', height: '60px', borderRadius: '50%', boxShadow: '0 8px 24px rgba(0,0,0,0.2)', fontSize: '1.5rem' }}>
          💬
        </button>
      )}
    </div>
  );
}
