import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { MODES, MODE_ORDER, modeEmoji } from '../data/modes.js';
import { cover, fontStack, moodEmoji, MOODS } from '../data/personalization.js';
import MoodSheet from '../components/MoodSheet.jsx';
import SoundPicker from '../components/SoundPicker.jsx';
import { play, stop } from '../ambient.js';

const wordCount = (t) => t.trim().split(/\s+/).filter(Boolean).length;

// A soft chime for the Free Write timer (Web Audio; no bundled asset).
function chime() {
  try {
    const c = new (window.AudioContext || window.webkitAudioContext)();
    const o = c.createOscillator();
    const g = c.createGain();
    o.frequency.value = 660;
    o.type = 'sine';
    o.connect(g);
    g.connect(c.destination);
    g.gain.setValueAtTime(0.0001, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.18, c.currentTime + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 1.4);
    o.start();
    o.stop(c.currentTime + 1.4);
  } catch { /* audio unavailable */ }
  if (navigator.vibrate) navigator.vibrate(120);
}

// Screen 11: Journal — a single shared editor driven by a `mode` config.
export default function Journal() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  const cv = cover(profile?.journal_cover);
  const font = fontStack(profile?.journal_font);
  const aiOptIn = Boolean(profile?.ai_opt_in);

  const [view, setView] = useState(
    location.state?.prompt || location.state?.mode ? 'editor' : 'modes'
  );
  const [mode, setMode] = useState(location.state?.mode || 'standard');
  const [historyMode, setHistoryMode] = useState('');
  const cfg = MODES[mode] || MODES.standard;

  // ---- Ambient sound (plays only while editing; pauses on exit) ----
  const [sound, setSound] = useState(
    localStorage.getItem('nouvel_sound') || profile?.ambient_sound || 'silence'
  );
  const [soundOpen, setSoundOpen] = useState(false);
  useEffect(() => {
    if (view === 'editor' && sound !== 'silence') play(sound);
    else stop();
    return () => stop();
  }, [view, sound, mode]);
  function pickSound(k) {
    setSound(k);
    localStorage.setItem('nouvel_sound', k);
    api('/profile', { method: 'PUT', body: { ambient_sound: k } }).catch(() => {});
    setSoundOpen(false);
  }

  function openMode(m) {
    setMode(m);
    setView('editor');
  }

  return (
    <div className={`screen${cfg.twilight && view === 'editor' ? ' twilight' : ''}`}>
      {view === 'modes' && (
        <ModePicker
          cover={cv}
          name={user?.name}
          onPick={openMode}
          onHistory={() => { setHistoryMode(''); setView('history'); }}
          onFreeWrites={() => { setHistoryMode('freewrite'); setView('history'); }}
        />
      )}

      {view === 'editor' && cfg.gratitude && (
        <GratitudeEditor cfg={cfg} font={font} onBack={() => setView('modes')} onDone={() => navigate('/home')} />
      )}

      {view === 'editor' && cfg.chat && (
        <ConversationEditor onBack={() => setView('modes')} onSaved={() => setView('history')} />
      )}

      {view === 'editor' && !cfg.gratitude && !cfg.chat && (
        <Editor
          cfg={cfg}
          mode={mode}
          font={font}
          aiOptIn={aiOptIn}
          userName={user?.name}
          initialPrompt={location.state?.prompt || ''}
          sound={sound}
          onOpenSound={() => setSoundOpen(true)}
          onBack={() => setView('modes')}
          onSaved={() => setView('history')}
        />
      )}

      {view === 'history' && <History font={font} initialMode={historyMode} onNew={() => setView('modes')} />}

      {soundOpen && <SoundPicker value={sound} onPick={pickSound} onClose={() => setSoundOpen(false)} />}
    </div>
  );
}

// -------------------- Mode picker (choose how to write today) --------------------
function ModePicker({ cover: cv, name, onPick, onHistory, onFreeWrites }) {
  return (
    <>
      <div className="cover-header" style={{ background: cv.header, color: cv.text }}>
        <span className="cover-emoji" aria-hidden>{cv.emoji}</span>
        <div className="eyebrow" style={{ color: cv.text, opacity: 0.85 }}>Your journal</div>
        <h1 style={{ color: cv.text, marginBottom: 0 }}>{name?.split(' ')[0] || 'Welcome'}’s space</h1>
      </div>

      {/* Quick access to Free Write + its dedicated dated archive */}
      <div className="card" style={{ marginTop: 16 }}>
        <div className="eyebrow" style={{ marginBottom: 6 }}>✏️ Free Write</div>
        <p className="muted">What’s on your mind? Write freely about anything — no prompt, no rules.</p>
        <div className="row" style={{ gap: 10 }}>
          <button className="btn" style={{ marginTop: 12 }} onClick={() => onPick('freewrite')}>Start writing</button>
          <button className="btn secondary" style={{ marginTop: 12 }} onClick={onFreeWrites}>📓 My free writes</button>
        </div>
      </div>

      <div className="row" style={{ justifyContent: 'space-between', marginTop: 8 }}>
        <h2 style={{ marginBottom: 0 }}>How do you want to write?</h2>
        <button className="link" onClick={onHistory}>Past entries</button>
      </div>
      <div className="mode-grid">
        {MODE_ORDER.map((k) => (
          <button key={k} className="mode-tile" onClick={() => onPick(k)}>
            <span className="mode-ico">{MODES[k].emoji}</span>
            <span className="mode-title">{MODES[k].title}</span>
            <span className="mode-tag">{MODES[k].tagline}</span>
          </button>
        ))}
      </div>
    </>
  );
}

// -------------------- Shared editor (all modes except gratitude/chat) --------------------
function Editor({ cfg, mode, font, aiOptIn, userName, initialPrompt, sound, onOpenSound, onBack, onSaved }) {
  const [text, setText] = useState('');
  const [recipient, setRecipient] = useState(cfg.recipients ? cfg.recipients[0] : '');
  const [reflect, setReflect] = useState(aiOptIn);
  const [error, setError] = useState('');
  const [writing, setWriting] = useState(false);
  const [savedId, setSavedId] = useState(null);
  const [calm, setCalm] = useState(false); // brain dump "fades to calm" overlay
  const savingRef = useRef(false);
  const [saveAnim, setSaveAnim] = useState(false);

  // Free Write timer
  const [minutes, setMinutes] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [goal, setGoal] = useState('');
  const timerRef = useRef(null);

  // Brain Dump idle nudge (3 min of no typing)
  const [nudge, setNudge] = useState(false);
  const idleRef = useRef(null);

  // 03 Writing Focus Mode — after ~20 chars, hide chrome while focused.
  useEffect(() => {
    const on = writing && text.trim().length >= 20;
    document.body.classList.toggle('writing-focus', on);
    return () => document.body.classList.remove('writing-focus');
  }, [writing, text]);

  // Brain Dump idle detection
  useEffect(() => {
    if (!cfg.burn) return undefined;
    clearTimeout(idleRef.current);
    setNudge(false);
    if (text.trim()) idleRef.current = setTimeout(() => setNudge(true), 180000);
    return () => clearTimeout(idleRef.current);
  }, [text, cfg.burn]);

  function startTimer(m) {
    clearInterval(timerRef.current);
    setMinutes(m);
    setRemaining(m * 60);
    timerRef.current = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(timerRef.current);
          chime();
          return 0;
        }
        return r - 1;
      });
    }, 1000);
  }
  useEffect(() => () => clearInterval(timerRef.current), []);

  function useTemplate(tpl) {
    setText((prev) => (prev ? prev + '\n\n' : '') + tpl.starters.join('\n'));
  }

  function buildPayload() {
    return {
      mode,
      prompt_text: cfg.showPrompt ? initialPrompt : cfg.prompt || '',
      journal_text: text,
      recipient: cfg.recipients ? recipient : null,
      dream_time: cfg.twilight ? new Date().toISOString() : null,
      reflect: reflect && aiOptIn,
    };
  }

  async function save() {
    if (savingRef.current) return; // guard double-tap
    if (!text.trim()) { setError('Your entry cannot be empty.'); return; }
    savingRef.current = true;
    setError('');
    setSaveAnim(true); // 04 Golden Save: ripple + checkmark
    if (cfg.burn) setTimeout(() => setCalm(true), 300); // brain dump: fades to calm
    try {
      const res = await api('/journal', { method: 'POST', body: buildPayload() });
      setTimeout(() => {
        setSaveAnim(false);
        savingRef.current = false;
        setSavedId(res.entry.id); // reveal the mood/tag sheet
      }, 2400);
    } catch (e) {
      setError(e.message);
      setSaveAnim(false);
      setCalm(false);
      savingRef.current = false;
    }
  }

  // "Burn it" — release without keeping (save briefly, then permanently delete).
  async function burn() {
    if (savingRef.current) return;
    if (!text.trim()) { setError('Nothing to release yet.'); return; }
    if (!window.confirm('Burn this entry? It will be released and permanently deleted.')) return;
    savingRef.current = true;
    try {
      const res = await api('/journal', { method: 'POST', body: buildPayload() });
      await api(`/journal/${res.entry.id}`, { method: 'DELETE' });
      setCalm(true);
      setTimeout(onSaved, 1200);
    } catch (e) {
      setError(e.message);
      savingRef.current = false;
    }
  }

  async function finishMood({ mood, tags }) {
    try {
      await api(`/journal/${savedId}`, { method: 'PATCH', body: { mood, tags: tags.join(', ') } });
    } catch { /* non-blocking */ }
    onSaved();
  }

  const mm = String(Math.floor(remaining / 60)).padStart(2, '0');
  const ss = String(remaining % 60).padStart(2, '0');
  const wc = wordCount(text);

  return (
    <>
      {/* wf-header: slides/fades away in Writing Focus Mode */}
      <div className="wf-header">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <button className="link" onClick={onBack}>← Modes</button>
          <div className="row" style={{ gap: 12 }}>
            {cfg.showTimer && (
              <span className="timer-pill">{remaining > 0 ? `${mm}:${ss}` : '⏱'}</span>
            )}
            <button className="sound-btn" title="Ambient sound" onClick={onOpenSound}>
              {sound !== 'silence' ? '🔊' : '🔈'}
            </button>
          </div>
        </div>
        <h1 style={{ marginTop: 10 }}>{cfg.emoji} {cfg.title}</h1>
        <p className="muted">{cfg.tagline}</p>
      </div>

      {/* wf-prompt: fades out in Writing Focus Mode */}
      <div className="wf-prompt">
        {cfg.opening && <div className="card"><p className="serif" style={{ color: 'var(--charcoal)' }}>{cfg.opening}</p></div>}
        {cfg.affirmation && <p className="eyebrow" style={{ marginTop: 4 }}>{cfg.affirmation}</p>}
        {cfg.header && <p className="serif" style={{ fontSize: 18, color: 'var(--charcoal)', marginTop: 6 }}>{cfg.header}</p>}
        {cfg.showPrompt && initialPrompt && (
          <div className="card"><p className="serif" style={{ color: 'var(--charcoal)' }}>{initialPrompt}</p></div>
        )}

        {/* Free Write: timer + goal setup */}
        {cfg.showTimer && remaining === 0 && (
          <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
            {[5, 10, 15, 20].map((m) => (
              <button key={m} className="chip" onClick={() => startTimer(m)}>{m} min</button>
            ))}
            <input
              style={{ width: 130 }}
              placeholder="Word goal"
              value={goal}
              onChange={(e) => setGoal(e.target.value.replace(/\D/g, ''))}
            />
          </div>
        )}

        {/* Scripting: template starters */}
        {cfg.templates && (
          <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
            {cfg.templates.map((t) => (
              <button key={t.id} className="chip" onClick={() => useTemplate(t)}>{t.title}</button>
            ))}
          </div>
        )}

        {/* Letter: recipient picker + "Dear …" chrome */}
        {cfg.recipients && (
          <>
            <label>To</label>
            <select value={recipient} onChange={(e) => setRecipient(e.target.value)}>
              {cfg.recipients.map((r) => <option key={r}>{r}</option>)}
            </select>
            <p className="muted" style={{ marginTop: 8 }}>{cfg.prompt}</p>
            <p className="serif" style={{ color: 'var(--charcoal)', marginTop: 6 }}>Dear {recipient},</p>
          </>
        )}

        {/* Dream: guided capture prompts */}
        {cfg.prompts && (
          <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
            {cfg.prompts.map((p) => (
              <button key={p} className="chip" onClick={() => setText((x) => (x ? x + '\n\n' : '') + p + ' ')}>{p}</button>
            ))}
          </div>
        )}
      </div>

      <textarea
        className={`journal-editor${cfg.loose ? ' loose' : ''}`}
        style={{ fontFamily: font, marginTop: 14 }}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onFocus={() => setWriting(true)}
        onBlur={() => setWriting(false)}
        placeholder={cfg.placeholder}
      />

      {/* Letter closing chrome */}
      {cfg.recipients && text.trim() && (
        <p className="serif" style={{ color: 'var(--charcoal-soft)', marginTop: 8 }}>With love, {userName?.split(' ')[0]}</p>
      )}

      {cfg.showWordCount && (
        <p className="muted" style={{ marginTop: 8 }}>
          {wc} words{goal ? ` · goal ${goal}` : ''}{goal && wc >= Number(goal) ? ' ✓' : ''}
        </p>
      )}

      {nudge && <p className="muted" style={{ marginTop: 8 }}>Feeling empty? You can finish whenever you’re ready. 🕊️</p>}

      {aiOptIn && !cfg.burn && (
        <label className="row" style={{ marginTop: 14, gap: 8 }}>
          <input type="checkbox" style={{ width: 'auto' }} checked={reflect} onChange={(e) => setReflect(e.target.checked)} />
          <span style={{ color: 'var(--charcoal-soft)' }}>Include a gentle AI reflection</span>
        </label>
      )}

      {error && <div className="error">{error}</div>}

      {/* 04 Golden Save Moment */}
      <div className="save-wrap">
        <button className={`btn${saveAnim ? ' is-saving' : ''}`} onClick={save}>Save entry</button>
        <span className={`save-ripple${saveAnim ? ' go' : ''}`} aria-hidden />
        <span className={`save-check${saveAnim ? ' go' : ''}`} aria-hidden>✓</span>
      </div>

      {cfg.burn && (
        <button className="btn danger" onClick={burn} style={{ marginTop: 10 }}>Burn it 🔥</button>
      )}

      {calm && <div className="calm-overlay">calm.</div>}

      {savedId && <MoodSheet onDone={finishMood} onSkip={onSaved} />}
    </>
  );
}

// -------------------- 🙏 Gratitude Log (separate 3-field screen) --------------------
function GratitudeEditor({ cfg, font, onBack, onDone }) {
  const [vals, setVals] = useState(['', '', '']);
  const [busy, setBusy] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const set = (i, v) => setVals(vals.map((x, idx) => (idx === i ? v : x)));

  async function save() {
    if (!vals.some((v) => v.trim())) return;
    setBusy(true);
    const journal_text = vals
      .map((v, i) => `${i + 1}. ${v}`)
      .filter((l) => l.trim().length > 3)
      .join('\n');
    try {
      await api('/journal', { method: 'POST', body: { mode: 'gratitude', journal_text } });
      setCelebrate(true);
      setTimeout(onDone, 2000);
    } catch { setBusy(false); }
  }

  return (
    <>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <button className="link" onClick={onBack}>← Modes</button>
      </div>
      <h1 style={{ marginTop: 10 }}>{cfg.emoji} Gratitude</h1>
      <p className="muted">{cfg.tagline}</p>
      {cfg.fields.map((label, i) => (
        <div key={i}>
          <label>{label}</label>
          <input style={{ fontFamily: font }} value={vals[i]} onChange={(e) => set(i, e.target.value)} />
        </div>
      ))}
      <button className="btn gold" disabled={busy} onClick={save}>Complete gratitude</button>
      {celebrate && (
        <div className="calm-overlay celebrate">
          <div className="stars">{'✦✧✦✧✦'.split('').map((s, i) => <span key={i} style={{ animationDelay: `${i * 90}ms` }}>{s}</span>)}</div>
          <div className="serif" style={{ fontSize: 30 }}>Beautiful ✨</div>
        </div>
      )}
    </>
  );
}

// -------------------- 💬 Conversation Mode (chat → entry) --------------------
function ConversationEditor({ onBack, onSaved }) {
  const [msgs, setMsgs] = useState([{ role: 'ai', content: 'I’m here. What’s on your mind today?' }]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const exchanges = msgs.filter((m) => m.role === 'user').length;

  async function send() {
    if (!input.trim() || busy) return;
    const next = [...msgs, { role: 'user', content: input.trim() }];
    setMsgs(next);
    setInput('');
    setBusy(true);
    try {
      const { reply } = await api('/ai/guide', { method: 'POST', body: { message: input.trim(), history: next } });
      setMsgs((m) => [...m, { role: 'ai', content: reply }]);
    } catch {
      setMsgs((m) => [...m, { role: 'ai', content: 'I’m here with you. Tell me a little more.' }]);
    } finally {
      setBusy(false);
    }
  }

  async function saveEntry() {
    setBusy(true);
    try {
      await api('/ai/conversation/save', { method: 'POST', body: { history: msgs } });
      onSaved();
    } catch { setBusy(false); }
  }

  return (
    <>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <button className="link" onClick={onBack}>← Modes</button>
        {exchanges >= 5 && <button className="link" onClick={saveEntry}>Turn into entry →</button>}
      </div>
      <h1 style={{ marginTop: 10 }}>💬 Journal with your guide</h1>
      <div className="chat" style={{ marginTop: 16 }}>
        {msgs.map((m, i) => (
          <div key={i} className={`bubble ${m.role === 'ai' ? 'ai' : 'user'}`}>{m.content}</div>
        ))}
        {busy && <div className="bubble ai">…</div>}
      </div>
      <div className="row">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder="Share what’s here…"
        />
        <button className="btn" style={{ width: 'auto', marginTop: 0 }} onClick={send} disabled={busy}>Send</button>
      </div>
      {exchanges >= 5 && (
        <button className="btn secondary" onClick={saveEntry} disabled={busy}>Save this as a journal entry</button>
      )}
    </>
  );
}

// -------------------- History --------------------
function History({ font, onNew, initialMode = '' }) {
  const [entries, setEntries] = useState([]);
  const [error, setError] = useState('');
  const [theme, setTheme] = useState('');
  const [modeFilter, setModeFilter] = useState(initialMode);
  const [moodFilter, setMoodFilter] = useState('');
  const freeOnly = initialMode === 'freewrite';

  function load() {
    const params = [];
    if (theme) params.push(`theme=${encodeURIComponent(theme)}`);
    if (modeFilter) params.push(`mode=${encodeURIComponent(modeFilter)}`);
    if (moodFilter) params.push(`mood=${encodeURIComponent(moodFilter)}`);
    api(`/journal${params.length ? `?${params.join('&')}` : ''}`)
      .then((d) => setEntries(d.entries))
      .catch((e) => setError(e.message));
  }
  useEffect(() => { load(); }, [theme, modeFilter, moodFilter]);

  async function toggleFav(id) {
    await api(`/journal/${id}/favorite`, { method: 'PATCH' });
    load();
  }

  return (
    <>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1>{freeOnly ? 'Your Free Writes' : 'Past entries'}</h1>
        <button className="link" onClick={onNew}>New entry</button>
      </div>
      {freeOnly && <p className="muted">A private archive of everything you’ve written freely, by date.</p>}
      <div className="row" style={{ gap: 8, marginTop: 10 }}>
        <input value={theme} onChange={(e) => setTheme(e.target.value)} placeholder="Filter by theme…" />
        <select value={modeFilter} onChange={(e) => setModeFilter(e.target.value)} style={{ width: 150 }}>
          <option value="">All modes</option>
          <option value="dream">Show only dreams</option>
          {MODE_ORDER.filter((m) => m !== 'dream').map((m) => <option key={m} value={m}>{MODES[m].title}</option>)}
        </select>
      </div>
      <select value={moodFilter} onChange={(e) => setMoodFilter(e.target.value)} style={{ marginTop: 8 }}>
        <option value="">Any mood</option>
        {MOODS.map((m) => <option key={m.key} value={m.key}>{m.emoji} {m.label}</option>)}
      </select>
      {error && <div className="error">{error}</div>}
      {entries.length === 0 && <p className="muted" style={{ marginTop: 20 }}>No entries yet. Your reflections will live here.</p>}
      {entries.map((e) => (
        <div key={e.id} className="card">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className="muted">
              {modeEmoji(e.mode)} {new Date(e.created_at).toLocaleDateString()}
              {e.mood && <span> · {moodEmoji(e.mood)}</span>}
            </span>
            <button className="link" onClick={() => toggleFav(e.id)}>{e.favorite ? '★ Favorited' : '☆ Favorite'}</button>
          </div>
          {e.recipient && <p className="serif" style={{ color: 'var(--charcoal)', marginTop: 6 }}>Dear {e.recipient},</p>}
          {e.prompt_text && <p className="muted" style={{ fontStyle: 'italic', marginTop: 6 }}>{e.prompt_text}</p>}
          <p style={{ color: 'var(--charcoal)', marginTop: 8, fontFamily: font, whiteSpace: 'pre-wrap' }}>{e.journal_text}</p>
          {e.tags && <div style={{ marginTop: 6 }}>{e.tags.split(',').map((t) => t.trim()).filter(Boolean).map((t) => <span key={t} className="tag">{t}</span>)}</div>}
          {e.ai_reflection && <div className="card" style={{ marginTop: 10, background: 'var(--beige)' }}><p style={{ fontSize: 13 }}>✺ {e.ai_reflection}</p></div>}
        </div>
      ))}
    </>
  );
}
