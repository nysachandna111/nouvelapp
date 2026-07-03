import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { COVERS, FONTS, cover, fontStack, resolveFontKey } from '../data/personalization.js';

// Screen 15: Profile / Settings — now also hosts Phase 2 Personalize + Privacy.
export default function Profile() {
  const navigate = useNavigate();
  const { user, profile, logout, deleteAccount, refresh } = useAuth();
  const [name, setName] = useState('');
  const [intention, setIntention] = useState('');
  const [reminder, setReminder] = useState('08:00');
  const [notif, setNotif] = useState('on');
  const [areas, setAreas] = useState([]);
  const [saved, setSaved] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  // Phase 2 personalization + privacy
  const [coverKey, setCoverKey] = useState('celestial');
  const [fontKey, setFontKey] = useState('georgia');
  const [aiOptIn, setAiOptIn] = useState(false);
  const [summaryTime, setSummaryTime] = useState('19:00');
  const [excerpt, setExcerpt] = useState('');
  const [summaries, setSummaries] = useState([]);
  const [genBusy, setGenBusy] = useState(false);

  useEffect(() => {
    setName(user?.name || '');
    setIntention(profile?.intention || '');
    api('/me').then((d) => {
      setReminder(d.user.reminder_time || '08:00');
      setNotif(d.user.notification_pref || 'on');
      setAreas(d.focusAreas || []);
      const p = d.profile || {};
      setCoverKey(p.journal_cover || 'celestial');
      setFontKey(resolveFontKey(p.journal_font));
      setAiOptIn(Boolean(p.ai_opt_in));
      setSummaryTime(p.summary_time || '19:00');
    }).catch(() => {});
    api('/journal').then((d) => setExcerpt((d.entries?.[0]?.journal_text || '').slice(0, 120))).catch(() => {});
    api('/summaries').then((d) => setSummaries(d.summaries || [])).catch(() => {});
  }, [user, profile]);

  // Personalization saves immediately so the change feels live.
  function savePref(patch) {
    api('/profile', { method: 'PUT', body: patch }).then(refresh).catch(() => {});
  }
  function pickCover(k) { setCoverKey(k); savePref({ journal_cover: k }); }
  function pickFont(k) { setFontKey(k); savePref({ journal_font: k }); }
  function toggleAi() {
    const next = !aiOptIn;
    setAiOptIn(next);
    savePref({ ai_opt_in: next });
  }

  async function save() {
    await api('/profile', { method: 'PUT', body: { name, intention, summary_time: summaryTime } });
    await api('/settings', { method: 'PUT', body: { reminder_time: reminder, notification_pref: notif } });
    await refresh();
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  }

  async function generateSummary() {
    setGenBusy(true);
    try {
      const d = await api('/summaries/generate', { method: 'POST' });
      setSummaries((s) => [{ id: d.id, summary: d.summary, created_at: new Date().toISOString() }, ...s]);
    } catch (e) { setError(e.message); }
    finally { setGenBusy(false); }
  }

  async function handleDelete() {
    setDeleting(true);
    setError('');
    try {
      await deleteAccount();
      navigate('/welcome', { replace: true });
    } catch (e) {
      setError(e.message);
      setDeleting(false);
    }
  }

  const cv = cover(coverKey);
  const previewText = excerpt || 'The blank page is mine, and today I meet it with honesty.';

  return (
    <div className="screen">
      <h1>Profile</h1>
      <label>Name</label>
      <input value={name} onChange={(e) => setName(e.target.value)} />
      <label>Main intention</label>
      <input value={intention} onChange={(e) => setIntention(e.target.value)} />

      <label>Notifications</label>
      <select value={notif} onChange={(e) => setNotif(e.target.value)}>
        <option value="on">On</option>
        <option value="off">Off</option>
      </select>
      <label>Preferred reminder time</label>
      <input type="time" value={reminder} onChange={(e) => setReminder(e.target.value)} />

      {/* 🎨 Personalize — My Journal Cover */}
      <div className="card" style={{ marginTop: 22 }}>
        <div className="eyebrow">Personalize · My Journal Cover</div>
        <div className="cover-header" style={{ background: cv.header, color: cv.text, marginTop: 8 }}>
          <span className="cover-emoji" aria-hidden>{cv.emoji}</span>
          <div className="eyebrow" style={{ color: cv.text, opacity: 0.85 }}>Preview</div>
          <h2 style={{ color: cv.text, marginBottom: 0 }}>{cv.label}</h2>
        </div>
        <div className="cover-pick">
          {Object.values(COVERS).map((c) => (
            <button
              key={c.key}
              className={`cover-swatch${coverKey === c.key ? ' active' : ''}`}
              style={{ background: c.header, color: c.text }}
              onClick={() => pickCover(c.key)}
            >
              {c.emoji} {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* 🔤 Personalize — Writing Style (font) with a live preview */}
      <div className="card">
        <div className="eyebrow">Personalize · Writing Style</div>
        <p className="muted" style={{ marginBottom: 4 }}>Applies to your journal entries only.</p>
        <div className="card" style={{ background: 'var(--beige)', marginTop: 8 }}>
          <p style={{ fontFamily: fontStack(fontKey), color: 'var(--charcoal)', fontSize: 17, lineHeight: 1.6 }}>{previewText}</p>
        </div>
        {Object.values(FONTS).map((f) => (
          <button
            key={f.key}
            className={`font-option${fontKey === f.key ? ' active' : ''}`}
            style={{ fontFamily: f.stack }}
            onClick={() => pickFont(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* 🔒 Privacy — AI opt-in (required before any AI feature is used) */}
      <div className="card">
        <div className="eyebrow">Privacy</div>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <p style={{ color: 'var(--charcoal)' }}>Allow Nouvel AI to read my entries</p>
            <p className="muted" style={{ marginTop: 4 }}>
              When on, your entries can be sent to the AI to power gentle reflections, personalized
              prompts, weekly summaries, and patterns. Entries are processed only — never stored for
              training. When off, Nouvel uses offline, rule-based text and never sends your writing anywhere.
            </p>
          </div>
          <label className="switch">
            <input type="checkbox" checked={aiOptIn} onChange={toggleAi} />
            <span className="track" />
            <span className="thumb" />
          </label>
        </div>
        <label>Weekly summary time (Sunday)</label>
        <input type="time" value={summaryTime} onChange={(e) => setSummaryTime(e.target.value)} onBlur={() => savePref({ summary_time: summaryTime })} />
      </div>

      {/* 📝 My Summaries */}
      <div className="card">
        <div className="eyebrow">My Summaries</div>
        {aiOptIn ? (
          <button className="btn secondary" disabled={genBusy} onClick={generateSummary}>
            {genBusy ? 'Writing your reflection…' : 'Generate this week’s summary'}
          </button>
        ) : (
          <p className="muted">Turn on AI above to receive weekly reflections.</p>
        )}
        {summaries.map((s) => (
          <div key={s.id} className="card" style={{ background: 'var(--beige)', marginTop: 10 }}>
            <span className="muted">{new Date(s.created_at).toLocaleDateString()}</span>
            <p className="serif" style={{ color: 'var(--charcoal)', marginTop: 6 }}>{s.summary}</p>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="eyebrow">Saved results</div>
        {areas.length
          ? areas.map((a, i) => <p key={i} style={{ color: 'var(--charcoal)', marginTop: 6 }}>• {a.title}</p>)
          : <p className="muted" style={{ marginTop: 6 }}>Take the assessment to see your focus areas.</p>}
        <button className="btn secondary" onClick={() => navigate('/onboarding')}>Retake assessment</button>
      </div>

      <button className="btn" onClick={save}>{saved ? '✓ Saved' : 'Save changes'}</button>
      <button className="btn secondary" onClick={() => { logout(); navigate('/welcome'); }}>Log out</button>

      <p className="muted" style={{ marginTop: 16, textAlign: 'center' }}>
        Your journal entries are private and stored securely. They are never shared publicly.
      </p>

      {/* Danger zone — permanent account deletion (PRD §8 privacy / right to erasure). */}
      <div className="card" style={{ marginTop: 22, borderColor: '#e3c7bf' }}>
        <div className="eyebrow" style={{ color: '#a4503f' }}>Danger zone</div>
        {!confirmDelete ? (
          <>
            <p className="muted" style={{ marginBottom: 4 }}>
              Permanently delete your account and all journal entries, results, and progress. This cannot be undone.
            </p>
            <button className="btn danger" onClick={() => setConfirmDelete(true)}>Delete account</button>
          </>
        ) : (
          <>
            <p style={{ color: 'var(--charcoal)', marginBottom: 4 }}>
              Are you sure? This will erase everything for <strong>{user?.email}</strong> and cannot be undone.
            </p>
            {error && <div className="error">{error}</div>}
            <button className="btn danger" disabled={deleting} onClick={handleDelete}>
              {deleting ? 'Deleting…' : 'Yes, delete my account permanently'}
            </button>
            <button className="btn secondary" disabled={deleting} onClick={() => setConfirmDelete(false)}>Cancel</button>
          </>
        )}
      </div>
    </div>
  );
}
