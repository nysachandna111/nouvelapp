import { useEffect, useState } from 'react';

// Shown once on iPhone Safari when the app isn't installed yet.
function isIosSafari() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
  return ios && !standalone && !/CriOS|FxiOS|EdgiOS/.test(ua);
}

export default function InstallHint() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!isIosSafari()) return;
    if (localStorage.getItem('nouvel_install_hint_dismissed')) return;
    setShow(true);
  }, []);

  if (!show) return null;

  return (
    <div className="install-hint" role="status">
      <p><strong>Install Nouvel</strong> — tap <span aria-hidden>Share</span> (↑) then <strong>Add to Home Screen</strong>.</p>
      <button type="button" className="link" onClick={() => { localStorage.setItem('nouvel_install_hint_dismissed', '1'); setShow(false); }}>
        Got it
      </button>
    </div>
  );
}
