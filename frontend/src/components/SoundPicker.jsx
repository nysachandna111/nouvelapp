import { SOUNDS } from '../data/personalization.js';

// 🎧 Ambient Sound picker tray. Opens from the sound icon in the editor.
export default function SoundPicker({ value, onPick, onClose }) {
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grip" />
        <h3 style={{ textAlign: 'center' }}>Set the tone</h3>
        <p className="muted" style={{ textAlign: 'center', marginBottom: 16 }}>A soft sound to write by.</p>
        <div className="sound-list">
          {SOUNDS.map((s) => (
            <button
              key={s.key}
              type="button"
              className={`sound-item${value === s.key ? ' active' : ''}`}
              onClick={() => onPick(s.key)}
            >
              <span className="sound-ico">{s.icon}</span>
              <span style={{ flex: 1, textAlign: 'left' }}>{s.label}</span>
              {value === s.key && s.key !== 'silence' && <span className="wave" aria-hidden>▮▮▮▮</span>}
            </button>
          ))}
        </div>
        <button className="btn secondary" onClick={onClose}>Done</button>
      </div>
    </div>
  );
}
