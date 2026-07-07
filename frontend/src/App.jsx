import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import BottomNav from './components/BottomNav.jsx';
import InstallHint from './components/InstallHint.jsx';

import Splash from './pages/Splash.jsx';
import Welcome from './pages/Welcome.jsx';
import Login from './pages/Login.jsx';
import ProfileSetup from './pages/ProfileSetup.jsx';
import OnboardingIntro from './pages/OnboardingIntro.jsx';
import Assessment from './pages/Assessment.jsx';
import Loading from './pages/Loading.jsx';
import Results from './pages/Results.jsx';
import FirstPrompt from './pages/FirstPrompt.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Journal from './pages/Journal.jsx';
import Practices from './pages/Practices.jsx';
import AIGuide from './pages/AIGuide.jsx';
import Progress from './pages/Progress.jsx';
import Profile from './pages/Profile.jsx';

// Routes that show the bottom navigation (editorial cream theme).
const NAV_PATHS = ['/home', '/journal', '/practices', '/guide', '/profile', '/progress'];

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="app"><Loading label="Returning to yourself…" /></div>;
  return user ? children : <Navigate to="/welcome" replace />;
}

export default function App() {
  const location = useLocation();
  const showNav = NAV_PATHS.includes(location.pathname);
  const editorial = NAV_PATHS.includes(location.pathname);

  return (
    <div className={`app${editorial ? ' theme-editorial' : ''}`}>
      <InstallHint />
      <Routes>
        <Route path="/" element={<Splash />} />
        <Route path="/welcome" element={<Welcome />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Login mode="signup" />} />

        <Route path="/profile-setup" element={<Protected><ProfileSetup /></Protected>} />
        <Route path="/onboarding" element={<Protected><OnboardingIntro /></Protected>} />
        <Route path="/assessment" element={<Protected><Assessment /></Protected>} />
        <Route path="/loading" element={<Protected><Loading label="Creating your personalized path…" /></Protected>} />
        <Route path="/results" element={<Protected><Results /></Protected>} />
        <Route path="/first-prompt" element={<Protected><FirstPrompt /></Protected>} />

        <Route path="/home" element={<Protected><Dashboard /></Protected>} />
        <Route path="/journal" element={<Protected><Journal /></Protected>} />
        <Route path="/practices" element={<Protected><Practices /></Protected>} />
        <Route path="/guide" element={<Protected><AIGuide /></Protected>} />
        <Route path="/progress" element={<Protected><Progress /></Protected>} />
        <Route path="/profile" element={<Protected><Profile /></Protected>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {showNav && <BottomNav />}
    </div>
  );
}
