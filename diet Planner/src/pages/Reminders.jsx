import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import toast from 'react-hot-toast';

// ─── Constants ──────────────────────────────────────────────────────────────
const SUPPLEMENT_WATER_MAP = {
  creatine: 500,
  protein: 300,
  'whey protein': 300,
  bcaa: 250,
  'pre-workout': 400,
  glutamine: 200,
};

const DEFAULT_MEAL_TIMES = {
  Breakfast: '08:00',
  'Morning Snack': '10:30',
  Lunch: '13:00',
  'Evening Snack': '16:30',
  Dinner: '20:00',
};

const TYPE_ICONS = { Meal: '🥗', Water: '💧', Supplement: '💊' };
const TYPE_COLORS = {
  Meal: { bg: '#ecfdf5', border: '#6ee7b7', text: '#065f46' },
  Water: { bg: '#eff6ff', border: '#93c5fd', text: '#1e40af' },
  Supplement: { bg: '#fdf4ff', border: '#d8b4fe', text: '#6b21a8' },
};

// ─── Beep helper ────────────────────────────────────────────────────────────
function playBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.5, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.6);
  } catch (_) { }
}

// ─── Time helpers ────────────────────────────────────────────────────────────
function nowHHMM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function addMinutes(timeStr, mins) {
  const [h, m] = timeStr.split(':').map(Number);
  const total = h * 60 + m + mins;
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function to12h(timeStr) {
  if (!timeStr) return '';
  const [h, m] = timeStr.slice(0, 5).split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  return `${((h % 12) || 12)}:${String(m).padStart(2, '0')} ${suffix}`;
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function Reminders() {
  const [reminders, setReminders] = useState([]);
  const [supplements, setSupplements] = useState([]);
  const [snoozed, setSnoozed] = useState({});         // id → snooze target HH:MM
  const [done, setDone] = useState({});          // id → bool
  const [loading, setLoading] = useState(true);
  const [notifPerm, setNotifPerm] = useState(Notification.permission);

  // Form state – reminder
  const [form, setForm] = useState({ type: 'Meal', title: '', time: '08:00', enabled: true });
  const [editId, setEditId] = useState(null);

  // Form state – supplement
  const [suppForm, setSuppForm] = useState({ name: '', water_required_ml: 300, intake_time: '07:00' });

  // Track already-fired notifications this session
  const firedRef = useRef(new Set());
  const intervalRef = useRef(null);

  // ── Fetch data ─────────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [remRes, suppRes] = await Promise.all([
      supabase.from('reminders').select('*').eq('user_id', user.id).order('time'),
      supabase.from('supplements').select('*').eq('user_id', user.id).order('intake_time'),
    ]);

    setReminders(remRes.data || []);
    setSupplements(suppRes.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Request notification permission ────────────────────────────────────────
  const requestPermission = async () => {
    const result = await Notification.requestPermission();
    setNotifPerm(result);
  };

  // ── Notification scheduler (every 30s) ─────────────────────────────────────
  useEffect(() => {
    if (notifPerm !== 'granted') return;

    const check = () => {
      const now = nowHHMM();
      reminders.forEach(r => {
        if (!r.enabled) return;
        const target = snoozed[r.id] || r.time?.slice(0, 5);
        if (!target) return;
        if (target !== now) return;
        const key = `${r.id}-${now}`;
        if (firedRef.current.has(key)) return;
        firedRef.current.add(key);

        const typeLabel = r.type === 'Meal' ? 'Meal Reminder'
          : r.type === 'Water' ? 'Hydration Reminder'
            : 'Supplement Reminder';
        const bodyEmoji = r.type === 'Meal' ? '🍽️' : r.type === 'Water' ? '💧' : '💊';

        new Notification(typeLabel, { body: `${r.title} ${bodyEmoji}`, icon: '/favicon.ico' });
        playBeep();
        toast(`${bodyEmoji} ${r.title}`, { duration: 6000 });
      });
    };

    intervalRef.current = setInterval(check, 30_000);
    return () => clearInterval(intervalRef.current);
  }, [reminders, notifPerm, snoozed]);

  // ── Auto-create meal reminders ─────────────────────────────────────────────
  const autoCreateMealReminders = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const rows = Object.entries(DEFAULT_MEAL_TIMES).map(([title, time]) => ({
      user_id: user.id, type: 'Meal', title, time, enabled: true,
    }));

    const { error } = await supabase.from('reminders').insert(rows);
    if (error) { toast.error('Failed to auto-create: ' + error.message); return; }
    toast.success('Meal reminders auto-created!');
    fetchAll();
  };

  // ── Save reminder ──────────────────────────────────────────────────────────
  const saveReminder = async (e) => {
    e.preventDefault();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (editId) {
      const { error } = await supabase.from('reminders').update({ ...form }).eq('id', editId);
      if (error) { toast.error(error.message); return; }
      toast.success('Reminder updated!');
      setEditId(null);
    } else {
      const { error } = await supabase.from('reminders').insert({ ...form, user_id: user.id });
      if (error) { toast.error(error.message); return; }
      toast.success('Reminder added!');
    }
    setForm({ type: 'Meal', title: '', time: '08:00', enabled: true });
    fetchAll();
  };

  const deleteReminder = async (id) => {
    await supabase.from('reminders').delete().eq('id', id);
    fetchAll();
  };

  const toggleReminder = async (r) => {
    await supabase.from('reminders').update({ enabled: !r.enabled }).eq('id', r.id);
    fetchAll();
  };

  const startEdit = (r) => {
    setEditId(r.id);
    setForm({ type: r.type, title: r.title, time: r.time?.slice(0, 5), enabled: r.enabled });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ── Supplement save (+ auto water reminder) ───────────────────────────────
  const saveSupplement = async (e) => {
    e.preventDefault();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Save supplement
    const { error: suppErr } = await supabase.from('supplements').insert({ ...suppForm, user_id: user.id });
    if (suppErr) { toast.error(suppErr.message); return; }

    // Auto water reminder 45 mins after intake
    const waterTime = addMinutes(suppForm.intake_time, 45);
    const { error: remErr } = await supabase.from('reminders').insert({
      user_id: user.id,
      type: 'Water',
      title: `Drink ${suppForm.water_required_ml}ml water after ${suppForm.name}`,
      time: waterTime,
      enabled: true,
    });
    if (!remErr) toast.success(`Supplement saved! 💧 Water reminder set for ${to12h(waterTime)}`);
    else toast.success('Supplement saved! (water reminder failed)');

    setSuppForm({ name: '', water_required_ml: 300, intake_time: '07:00' });
    fetchAll();
  };

  const deleteSupplement = async (id) => {
    await supabase.from('supplements').delete().eq('id', id);
    fetchAll();
  };

  // ── Snooze / Done ─────────────────────────────────────────────────────────
  const snooze = (id) => {
    const newTime = addMinutes(nowHHMM(), 10);
    setSnoozed(prev => ({ ...prev, [id]: newTime }));
    toast(`⏰ Snoozed 10 min → ${to12h(newTime)}`);
  };

  const markDone = (id) => {
    setDone(prev => ({ ...prev, [id]: true }));
    toast.success('Marked as done ✅');
  };

  // ── Today's schedule (sorted) ──────────────────────────────────────────────
  const schedule = [...reminders].sort((a, b) => (a.time > b.time ? 1 : -1));

  // ── Total extra water from supplements ────────────────────────────────────
  const extraWaterMl = supplements.reduce((sum, s) => sum + (s.water_required_ml || 0), 0);
  const totalWaterL = ((2500 + extraWaterMl) / 1000).toFixed(1);

  if (loading) return (
    <div className="flex-center" style={{ minHeight: '60vh' }}>
      <div className="animate-pulse">Loading Reminders...</div>
    </div>
  );

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      {/* ── Header ── */}
      <div className="flex-between" style={{ marginBottom: '32px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ marginBottom: '4px' }}>Teri DinCharya⏰🍛</h1>
          <p style={{ color: '#64748b', fontSize: '0.95rem' }}>
            Meal alarms · Hydration tracking · Supplement schedule
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {notifPerm !== 'granted' && (
            <button className="button-primary" onClick={requestPermission} style={{ fontSize: '0.9rem', padding: '10px 16px' }}>
              🔔 Enable Notifications
            </button>
          )}
          {notifPerm === 'granted' && (
            <span style={{ background: '#ecfdf5', color: '#065f46', padding: '8px 14px', borderRadius: '10px', fontSize: '0.85rem', fontWeight: 600, border: '1px solid #6ee7b7' }}>
              ✅ Notifications Active
            </span>
          )}
          <button className="button-primary" onClick={autoCreateMealReminders} style={{ fontSize: '0.9rem', padding: '10px 16px', background: 'linear-gradient(135deg,#f59e0b,#ef4444)' }}>
            ⚡ Auto-Create Meal Reminders
          </button>
        </div>
      </div>

      {/* ── Hydration Summary ── */}
      <div className="glass-panel" style={{ marginBottom: '28px', background: 'linear-gradient(135deg,rgba(219,234,254,0.7),rgba(236,253,245,0.7))' }}>
        <h3 style={{ marginBottom: '16px', color: '#1e40af' }}>💧 Daily Hydration Target</h3>
        <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2.4rem', fontWeight: 800, color: '#2563eb' }}>{totalWaterL}L</div>
            <div style={{ fontSize: '0.8rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Target</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2.4rem', fontWeight: 800, color: '#10b981' }}>2.5L</div>
            <div style={{ fontSize: '0.8rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Base Water</div>
          </div>
          {extraWaterMl > 0 && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2.4rem', fontWeight: 800, color: '#8b5cf6' }}>+{(extraWaterMl / 1000).toFixed(1)}L</div>
              <div style={{ fontSize: '0.8rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Supplement Extra</div>
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '28px', alignItems: 'start' }}>

        {/* ── LEFT COLUMN ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

          {/* Add / Edit Reminder Form */}
          <div className="glass-panel">
            <h3 style={{ marginBottom: '20px' }}>{editId ? '✏️ Edit Reminder' : '➕ Add Reminder'}</h3>
            <form onSubmit={saveReminder} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label>Type</label>
              <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                <option value="Meal">🥗 Meal</option>
                <option value="Water">💧 Water</option>
                <option value="Supplement">💊 Supplement</option>
              </select>

              <label>Title</label>
              <input
                type="text"
                placeholder="e.g. Breakfast, Drink water..."
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
                required
              />

              <label>Time</label>
              <input
                type="time"
                value={form.time}
                onChange={e => setForm({ ...form, time: e.target.value })}
                required
              />

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '8px 0 16px' }}>
                <div
                  onClick={() => setForm({ ...form, enabled: !form.enabled })}
                  style={{
                    width: '44px', height: '24px', borderRadius: '12px', cursor: 'pointer',
                    background: form.enabled ? '#10b981' : '#cbd5e1',
                    position: 'relative', transition: 'background 0.2s',
                  }}
                >
                  <div style={{
                    position: 'absolute', top: '3px', left: form.enabled ? '23px' : '3px',
                    width: '18px', height: '18px', borderRadius: '50%', background: '#fff',
                    transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
                  }} />
                </div>
                <span style={{ fontSize: '0.9rem', color: '#475569' }}>{form.enabled ? 'Enabled' : 'Disabled'}</span>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button className="button-primary" type="submit" style={{ flex: 1 }}>
                  {editId ? 'Update' : 'Add Reminder'}
                </button>
                {editId && (
                  <button type="button" onClick={() => { setEditId(null); setForm({ type: 'Meal', title: '', time: '08:00', enabled: true }); }}
                    style={{ flex: 1, background: 'transparent', border: '1px solid #e2e8f0', color: '#475569', borderRadius: '12px', padding: '12px', cursor: 'pointer' }}>
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Supplement Form */}
          <div className="glass-panel">
            <h3 style={{ marginBottom: '20px' }}>💊 Add Supplement</h3>
            <form onSubmit={saveSupplement} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label>Supplement Name</label>
              <input
                type="text"
                placeholder="e.g. Creatine, Protein..."
                value={suppForm.name}
                required
                onChange={e => {
                  const name = e.target.value;
                  const autoMl = SUPPLEMENT_WATER_MAP[name.toLowerCase()] || suppForm.water_required_ml;
                  setSuppForm({ ...suppForm, name, water_required_ml: autoMl });
                }}
              />

              <label>Extra Water Required (ml)</label>
              <input
                type="number"
                min="0"
                value={suppForm.water_required_ml}
                onChange={e => setSuppForm({ ...suppForm, water_required_ml: parseInt(e.target.value) })}
              />

              <label>Intake Time</label>
              <input
                type="time"
                value={suppForm.intake_time}
                onChange={e => setSuppForm({ ...suppForm, intake_time: e.target.value })}
                required
              />

              <p style={{ fontSize: '0.8rem', color: '#8b5cf6', marginBottom: '8px' }}>
                💡 A water reminder will auto-generate 45 mins after intake
              </p>

              <button className="button-primary" type="submit" style={{ background: 'linear-gradient(135deg,#8b5cf6,#3b82f6)' }}>
                Add Supplement
              </button>
            </form>

            {/* Supplement list */}
            {supplements.length > 0 && (
              <div style={{ marginTop: '20px' }}>
                <p style={{ fontSize: '0.8rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px', fontWeight: 600 }}>Your Supplements</p>
                {supplements.map(s => (
                  <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
                    <div>
                      <div style={{ fontWeight: 600, color: '#1e293b' }}>💊 {s.name}</div>
                      <div style={{ fontSize: '0.8rem', color: '#64748b' }}>+{s.water_required_ml}ml · {to12h(s.intake_time)}</div>
                    </div>
                    <button onClick={() => deleteSupplement(s.id)}
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1.1rem', color: '#ef4444', padding: '4px 8px' }}>
                      🗑️
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT COLUMN ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

          {/* Today's Schedule Timeline */}
          <div className="glass-panel">
            <h3 style={{ marginBottom: '20px' }}>📅 Today's Schedule</h3>
            {schedule.length === 0 ? (
              <p style={{ color: '#94a3b8', textAlign: 'center', padding: '24px 0' }}>
                No reminders yet. Add some above!
              </p>
            ) : (
              <div style={{ position: 'relative', paddingLeft: '28px' }}>
                {/* Timeline line */}
                <div style={{ position: 'absolute', left: '10px', top: 0, bottom: 0, width: '2px', background: 'linear-gradient(to bottom,#10b981,#3b82f6)', borderRadius: '2px' }} />

                {schedule.map((r, i) => {
                  const col = TYPE_COLORS[r.type];
                  const isDone = done[r.id];
                  const isSnoozing = snoozed[r.id];
                  const nowTime = nowHHMM();
                  const isPast = r.time?.slice(0, 5) < nowTime;

                  return (
                    <div key={r.id} style={{
                      display: 'flex', alignItems: 'flex-start', gap: '12px',
                      marginBottom: i < schedule.length - 1 ? '20px' : 0,
                      opacity: isDone ? 0.5 : 1,
                    }}>
                      {/* Dot */}
                      <div style={{
                        position: 'absolute', left: '4px',
                        width: '14px', height: '14px', borderRadius: '50%',
                        background: isDone ? '#cbd5e1' : isPast ? '#94a3b8' : col.border,
                        border: '2px solid #fff',
                        boxShadow: `0 0 0 2px ${col.border}`,
                        marginTop: '4px', flexShrink: 0,
                      }} />

                      <div style={{
                        flex: 1, padding: '12px 14px', borderRadius: '12px',
                        background: isDone ? '#f8fafc' : col.bg,
                        border: `1px solid ${col.border}`,
                        marginLeft: '8px',
                      }}>
                        <div className="flex-between">
                          <div style={{ fontWeight: 600, color: isDone ? '#94a3b8' : col.text, fontSize: '0.9rem' }}>
                            {TYPE_ICONS[r.type]} {r.title}
                            {isDone && <span style={{ marginLeft: '6px' }}>✅</span>}
                            {isSnoozing && <span style={{ marginLeft: '6px', fontSize: '0.75rem', color: '#f59e0b' }}>⏰ {to12h(isSnoozing)}</span>}
                          </div>
                          <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>
                            {to12h(r.time)}
                          </span>
                        </div>

                        {/* Action buttons */}
                        {!isDone && r.enabled && (
                          <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                            <button onClick={() => snooze(r.id)}
                              style={{ fontSize: '0.75rem', padding: '4px 10px', borderRadius: '8px', background: '#fef3c7', border: '1px solid #fcd34d', color: '#92400e', cursor: 'pointer' }}>
                              😴 Snooze 10m
                            </button>
                            <button onClick={() => markDone(r.id)}
                              style={{ fontSize: '0.75rem', padding: '4px 10px', borderRadius: '8px', background: '#ecfdf5', border: '1px solid #6ee7b7', color: '#065f46', cursor: 'pointer' }}>
                              ✅ Done
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Reminder List (manage) */}
          <div className="glass-panel">
            <h3 style={{ marginBottom: '20px' }}>🔔 All Reminders</h3>
            {reminders.length === 0 ? (
              <p style={{ color: '#94a3b8', textAlign: 'center', padding: '24px 0' }}>No reminders yet.</p>
            ) : (
              reminders.map(r => {
                const col = TYPE_COLORS[r.type];
                return (
                  <div key={r.id} style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '12px', borderRadius: '12px', marginBottom: '8px',
                    background: r.enabled ? col.bg : '#f8fafc',
                    border: `1px solid ${r.enabled ? col.border : '#e2e8f0'}`,
                    transition: 'all 0.2s',
                  }}>
                    <span style={{ fontSize: '1.2rem' }}>{TYPE_ICONS[r.type]}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, color: '#1e293b', fontSize: '0.9rem' }}>{r.title}</div>
                      <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{to12h(r.time)} · {r.type}</div>
                    </div>

                    {/* Toggle */}
                    <div onClick={() => toggleReminder(r)}
                      style={{
                        width: '36px', height: '20px', borderRadius: '10px', cursor: 'pointer',
                        background: r.enabled ? '#10b981' : '#cbd5e1', position: 'relative', transition: 'background 0.2s', flexShrink: 0
                      }}>
                      <div style={{
                        position: 'absolute', top: '2px', left: r.enabled ? '18px' : '2px',
                        width: '16px', height: '16px', borderRadius: '50%', background: '#fff',
                        transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                      }} />
                    </div>

                    <button onClick={() => startEdit(r)}
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1rem', padding: '4px' }}>
                      ✏️
                    </button>
                    <button onClick={() => deleteReminder(r.id)}
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1rem', color: '#ef4444', padding: '4px' }}>
                      🗑️
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
