import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { pickDailyPractice } from '../data/daily.js';

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

const WORDS = ['zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen', 'Twenty'];
const numberWord = (n) => WORDS[n] || String(n);
const todayKey = () => new Date().toISOString().slice(0, 10);

// Screen 10: Home Dashboard.
export default function Dashboard() {
  const navigate = useNavigate();
  const { user, focusAreas } = useAuth();
  const [prompt, setPrompt] = useState('');
  const [refreshes, setRefreshes] = useState(0);
  const [areas, setAreas] = useState(focusAreas || []);
  const [practice, setPractice] = useState(null);
  const [progress, setProgress] = useState(null);
  const [pattern, setPattern] = useState(null);
  const [gratitudeDone, setGratitudeDone] = useState(false);

  // 05 Streak Celebration state
  const [displayStreak, setDisplayStreak] = useState(null);
  const [celebrating, setCelebrating] = useState(false);
  const [sparks, setSparks] = useState([]);
  const [affirm, setAffirm] = useState('');

  useEffect(() => {
    api('/prompt/daily').then((d) => setPrompt(d.prompt)).catch(() => {});
    api('/me').then((d) => setAreas(d.focusAreas || [])).catch(() => {});
    api('/practices').then((d) => {
      const daily = pickDailyPractice(d.practices || []);
      if (daily) setPractice(daily);
    }).catch(() => {});
    api('/progress').then(setProgress).catch(() => {});
    api('/patterns').then((d) => setPattern(d)).catch(() => {});
    api('/journal?mode=gratitude').then((d) => {
      setGratitudeDone((d.entries || []).some((e) => (e.created_at || '').slice(0, 10) === todayKey()));
    }).catch(() => {});
  }, []);

  // Detect an extended streak and celebrate (auto, no tap).
  useEffect(() => {
    if (!progress) return undefined;
    const prev = Number(localStorage.getItem('nouvel_last_streak') || '0');
    if (progress.streak > prev && progress.streak > 0) {
      setDisplayStreak(prev);
      const positions = Array.from({ length: 7 }, () => 15 + Math.random() * 70); // 15–85%
      const t1 = setTimeout(() => {
        setSparks(positions);
        setCelebrating(true);
        setAffirm(`${numberWord(progress.streak)} days of beautiful inner work. ✨`);
        setTimeout(() => setDisplayStreak(progress.streak), 175); // increment at the peak
        setTimeout(() => { setCelebrating(false); setSparks([]); }, 1600);
      }, 700); // a small breath before the celebration
      localStorage.setItem('nouvel_last_streak', String(progress.streak));
      return () => clearTimeout(t1);
    }
    setDisplayStreak(progress.streak);
    localStorage.setItem('nouvel_last_streak', String(progress.streak));
    return undefined;
  }, [progress]);

  async function refreshPrompt() {
    if (refreshes >= 3) return; // spec: up to 3 refreshes
    const n = refreshes + 1;
    setRefreshes(n);
    try {
      const d = await api(`/prompt/daily?refresh=${n}`);
      setPrompt(d.prompt);
    } catch { /* keep current */ }
  }
  function favoritePrompt() {
    if (prompt) api('/prompt/favorite', { method: 'POST', body: { prompt } }).catch(() => {});
  }

  return (
    <div className="screen">
      <div className="eyebrow">{greeting()}, {user?.name?.split(' ')[0] || 'friend'}</div>
      <h1>Today's focus: {areas[0]?.title?.split('&')[0]?.trim() || 'Emotional clarity'}</h1>

      <div className="card" style={{ marginTop: 18 }}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div className="eyebrow" style={{ marginBottom: 0 }}>Today's prompt</div>
          <div className="row" style={{ gap: 12 }}>
            <button className="link" title="Save to favorites" onClick={favoritePrompt}>♡</button>
            {refreshes < 3 && <button className="link" onClick={refreshPrompt}>Try another</button>}
          </div>
        </div>
        <p className="serif" style={{ fontSize: 18, color: 'var(--charcoal)', marginTop: 8 }}>{prompt || '…'}</p>
        <button className="btn" onClick={() => navigate('/journal', { state: { prompt } })}>Journal on this</button>
      </div>

      {/* 🙏 Today's Gratitude quick-access card */}
      <div className="card">
        <div className="eyebrow">Today's gratitude</div>
        {gratitudeDone ? (
          <p style={{ color: 'var(--charcoal)' }}>Complete for today ✨ — beautifully done.</p>
        ) : (
          <>
            <p className="muted">Three good things, two minutes.</p>
            <button className="btn secondary" onClick={() => navigate('/journal', { state: { mode: 'gratitude' } })}>Today's Gratitude</button>
          </>
        )}
      </div>

      {/* 📈 Pattern Recognition insight card */}
      {pattern?.insight && (
        <div className="card">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div className="eyebrow" style={{ marginBottom: 0 }}>📈 Patterns</div>
            <button className="link" onClick={() => { api(`/patterns/${pattern.id}/dismiss`, { method: 'POST' }).catch(() => {}); setPattern(null); }}>Dismiss</button>
          </div>
          <p className="serif" style={{ color: 'var(--charcoal)', marginTop: 8 }}>{pattern.insight}</p>
        </div>
      )}

      <div className="card">
        <div className="eyebrow">Practices</div>
        <p className="muted" style={{ marginTop: 6 }}>Short guided rituals for your inner work.</p>
        <button className="btn secondary" style={{ marginTop: 12 }} onClick={() => navigate('/practices')}>
          Go to daily practices
        </button>
      </div>

      {practice && (
        <div className="card">
          <div className="eyebrow">Daily practice</div>
          <h3>{practice.title}</h3>
          <p className="muted">{practice.duration} · {practice.category}</p>
          <button
            className="btn"
            onClick={() => navigate('/practices', { state: { practiceId: practice.id, autoStart: true } })}
          >
            Begin practice
          </button>
        </div>
      )}

      <div className="card">
        <div className="eyebrow">Your focus areas</div>
        {areas.map((a, i) => (
          <p key={i} style={{ color: 'var(--charcoal)', marginTop: 6 }}>• {a.title}</p>
        ))}
      </div>

      {progress && (
        <div className="card">
          <div className="eyebrow">Progress snapshot</div>
          <div className="row" style={{ marginTop: 10 }}>
            <div className="stat streak-stage">
              {sparks.map((x, i) => (
                <span key={i} className="spark" style={{ left: `${x}%`, animationDelay: `${i * 90}ms` }} aria-hidden />
              ))}
              <div className={`num streak-counter${celebrating ? ' bounce' : ''}`}>
                {displayStreak ?? progress.streak}
              </div>
              <div className="lbl">DAY STREAK</div>
            </div>
            <div className="stat"><div className="num">{progress.entryCount}</div><div className="lbl">ENTRIES</div></div>
            <div className="stat"><div className="num">{progress.completedPractices}</div><div className="lbl">PRACTICES</div></div>
          </div>
          {affirm && <p className="affirmation" style={{ textAlign: 'center' }}>{affirm}</p>}
          <button className="btn secondary" onClick={() => navigate('/progress')}>View progress</button>
        </div>
      )}
    </div>
  );
}
