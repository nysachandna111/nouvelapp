import { useState } from 'react';
import { MOODS, LIFE_TAGS } from '../data/personalization.js';

// 🏷️ Entry Moods & Tags — the lightweight post-save selector. One tap, optional,
// never required. Skippable with "Not now" or by tapping the backdrop.
export default function MoodSheet({ onDone, onSkip }) {
  const [mood, setMood] = useState('');
  const [tags, setTags] = useState([]);
  const toggle = (t) => setTags(tags.includes(t) ? tags.filter((x) => x !== t) : [...tags, t]);

  return (
    <div className="sheet-backdrop" onClick={onSkip}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grip" />
        <h3 style={{ textAlign: 'center' }}>How did that feel?</h3>
        <p className="muted" style={{ textAlign: 'center', marginBottom: 16 }}>One tap — always optional.</p>
        <div className="mood-grid">
          {MOODS.map((m) => (
            <button
              key={m.key}
              type="button"
              className={`mood-emoji${mood === m.key ? ' active' : ''}`}
              onClick={() => setMood(mood === m.key ? '' : m.key)}
            >
              <span style={{ fontSize: 26 }}>{m.emoji}</span>
              <span>{m.label}</span>
            </button>
          ))}
        </div>
        <label>Life areas (optional)</label>
        <div className="moods">
          {LIFE_TAGS.map((t) => (
            <button key={t} type="button" className={`mood${tags.includes(t) ? ' active' : ''}`} onClick={() => toggle(t)}>
              {t}
            </button>
          ))}
        </div>
        <button className="btn" onClick={() => onDone({ mood, tags })}>Save label</button>
        <button className="link" style={{ display: 'block', margin: '14px auto 0' }} onClick={onSkip}>Not now</button>
      </div>
    </div>
  );
}
