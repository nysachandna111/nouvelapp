import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';

// Screen 8: personalized results — always exactly 3 focus areas.
export default function Results() {
  const navigate = useNavigate();
  const [areas, setAreas] = useState(null);

  useEffect(() => {
    const cached = sessionStorage.getItem('nouvel_results');
    if (cached) {
      setAreas(JSON.parse(cached).focusAreas);
    } else {
      api('/results').then((d) => setAreas(d.focusAreas));
    }
  }, []);

  if (!areas) return <div className="screen center"><div className="glow" /></div>;

  return (
    <div className="screen">
      {/* 02 Focus Area Reveal — header + sub-header fade up, then each focus
          area flips into view like turning over a card. CTA fades up last. */}
      <div className="eyebrow reveal-up" style={{ animationDelay: '0ms' }}>Your reflection</div>
      <h1 className="reveal-up" style={{ animationDelay: '0ms' }}>Your Current Self-Mastery Focus</h1>
      <p className="reveal-up" style={{ marginBottom: 24, animationDelay: '100ms' }}>
        Based on your answers, Nouvel has identified the areas that may support your next level
        of growth, clarity, and emotional alignment.
      </p>
      {areas.map((a, idx) => (
        <div key={idx} className="focus flip-card" style={{ animationDelay: `${200 + idx * 220}ms` }}>
          <h3>{idx + 1}. {a.title}</h3>
          <p>{a.desc}</p>
        </div>
      ))}
      <button className="btn reveal-up" style={{ animationDelay: '900ms' }} onClick={() => navigate('/first-prompt')}>Begin My First Prompt</button>
      <button className="btn secondary reveal-up" style={{ animationDelay: '900ms' }} onClick={() => navigate('/home')}>Save My Results</button>
    </div>
  );
}
