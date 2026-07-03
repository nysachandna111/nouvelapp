import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api.js';

const isBreathStep = (s) => /inhal|exhal|breath|hum/i.test(s);

// An animated breathing pacer (box breathing): the circle grows on the inhale,
// holds, shrinks on the exhale, holds — with a live phase cue.
function BreathPacer() {
  const phases = [
    { label: 'Breathe in', dur: 4000, scale: 1.55 },
    { label: 'Hold', dur: 4000, scale: 1.55 },
    { label: 'Breathe out', dur: 4000, scale: 0.75 },
    { label: 'Hold', dur: 4000, scale: 0.75 },
  ];
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setI((n) => (n + 1) % phases.length), phases[i].dur);
    return () => clearTimeout(t);
  }, [i]);
  const p = phases[i];
  return (
    <div className="breath-wrap">
      <div className="breath-circle" style={{ transform: `scale(${p.scale})`, transitionDuration: `${p.dur}ms` }} />
      <div className="breath-label">{p.label}</div>
    </div>
  );
}

// A gentle countdown you can start on any step ("sit with this for a moment").
function StepTimer({ seconds = 30 }) {
  const [left, setLeft] = useState(null);
  const ref = useRef(null);
  useEffect(() => () => clearInterval(ref.current), []);
  function start() {
    clearInterval(ref.current);
    setLeft(seconds);
    ref.current = setInterval(() => {
      setLeft((l) => {
        if (l <= 1) { clearInterval(ref.current); if (navigator.vibrate) navigator.vibrate(80); return 0; }
        return l - 1;
      });
    }, 1000);
  }
  if (left === null) return <button className="chip" onClick={start}>Sit with this · {seconds}s</button>;
  const pct = ((seconds - left) / seconds) * 100;
  return (
    <div className="step-timer">
      <div className="step-timer-bar" style={{ width: `${pct}%` }} />
      <span>{left > 0 ? `${left}s` : 'Complete ✓'}</span>
    </div>
  );
}

// Full-screen guided player for one practice.
function Player({ practice, onClose, onComplete, startAt = -1 }) {
  const steps = practice.steps || [];
  const [step, setStep] = useState(startAt); // -1 = intro, steps.length = done
  const done = step >= steps.length;

  async function finish() {
    setStep(steps.length);
    onComplete();
    try { await api(`/practices/${practice.id}/complete`, { method: 'POST' }); } catch { /* offline ok */ }
  }

  return (
    <div className="player">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="eyebrow" style={{ marginBottom: 0 }}>{practice.category}</span>
        <button className="link" onClick={onClose}>Close</button>
      </div>

      {step === -1 && (
        <div className="player-body">
          <h1>{practice.title}</h1>
          <p className="muted">{practice.duration}</p>
          <p style={{ marginTop: 12 }}>{practice.description}</p>
          <button className="btn" onClick={() => setStep(0)}>Begin practice</button>
        </div>
      )}

      {step >= 0 && !done && (
        <div className="player-body">
          <div className="practice-dots">
            {steps.map((_, i) => <span key={i} className={`dot${i <= step ? ' on' : ''}`} />)}
          </div>
          <div className="eyebrow">Step {step + 1} of {steps.length}</div>
          {isBreathStep(steps[step]) && <BreathPacer />}
          <p className="serif practice-step" key={step}>{steps[step]}</p>
          {!isBreathStep(steps[step]) && <StepTimer seconds={30} />}
          <div className="row" style={{ marginTop: 18 }}>
            <button className="btn secondary" onClick={() => setStep(step - 1 < 0 ? -1 : step - 1)}>Back</button>
            {step < steps.length - 1
              ? <button className="btn" onClick={() => setStep(step + 1)}>Continue</button>
              : <button className="btn gold" onClick={finish}>Finish</button>}
          </div>
        </div>
      )}

      {done && (
        <div className="player-body center-done">
          <div className="done-check">✓</div>
          <h1>Beautifully done</h1>
          <p className="muted">You showed up for yourself. That’s the whole practice.</p>
          <button className="btn" onClick={onClose}>Return to practices</button>
        </div>
      )}
    </div>
  );
}

// Screen 13: Practices library — now an interactive, guided experience.
export default function Practices() {
  const location = useLocation();
  const navigate = useNavigate();
  const [practices, setPractices] = useState([]);
  const [active, setActive] = useState(null);
  const [autoStart, setAutoStart] = useState(false);
  const [completedIds, setCompletedIds] = useState({});
  const linkRef = useRef(location.state);

  useEffect(() => {
    api('/practices').then((d) => setPractices(d.practices)).catch(() => {});
  }, []);

  // Open a specific practice when linked from the dashboard (or elsewhere).
  useEffect(() => {
    if (!practices.length) return;
    const { practiceId, autoStart: start } = linkRef.current || {};
    if (!practiceId) return;
    const match = practices.find((p) => p.id === practiceId);
    if (!match) return;
    setActive(match);
    setAutoStart(Boolean(start));
    linkRef.current = null;
    navigate(location.pathname, { replace: true, state: {} });
  }, [practices, navigate, location.pathname]);

  function closePlayer() {
    setActive(null);
    setAutoStart(false);
  }

  if (active) {
    return (
      <div className="screen screen--breathe">
        <Player
          practice={active}
          startAt={autoStart ? 0 : -1}
          onClose={closePlayer}
          onComplete={() => setCompletedIds((c) => ({ ...c, [active.id]: true }))}
        />
      </div>
    );
  }

  return (
    <div className="screen">
      <h1>Practices</h1>
      <p className="muted" style={{ marginBottom: 18 }}>Short guided rituals — follow along, step by step.</p>
      {practices.map((p) => (
        <div key={p.id} className="card">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <h3>{p.title}{completedIds[p.id] ? ' ✓' : ''}</h3>
            <span className="muted">{p.duration}</span>
          </div>
          <p className="muted">{p.category}</p>
          <p style={{ marginTop: 8 }}>{p.description}</p>
          <button className="btn" onClick={() => setActive(p)}>
            {completedIds[p.id] ? 'Do it again' : 'Begin practice'}
          </button>
        </div>
      ))}
    </div>
  );
}
