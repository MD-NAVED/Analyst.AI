import React, { useState, useEffect } from 'react';
import { CheckCircle, AlertCircle, ArrowRight, ChevronLeft, RefreshCcw, Loader2 } from 'lucide-react';
import { DynamicLogo } from './branding/DynamicLogo';
import { CustomSelect } from './CustomSelect';

// ─── Types ────────────────────────────────────────────────────────────────────

export type OnboardingScreen =
  | 'auth'
  | 'loading'
  | 'email-verify'
  | 'step-name'
  | 'step-work'
  | 'step-role'
  | 'step-workspace'
  | 'done';

export interface OnboardingData {
  firstName: string;
  lastName: string;
  workType: string;
  role: string;
  workspaceName: string;
  teamSize: string;
  industry: string;
}

interface OnboardingFlowProps {
  onComplete: (user: any, onboardingData: OnboardingData) => void;
  initialMode?: 'login' | 'register';
  onCancel?: () => void;
  // Auth handlers (passed from parent so real API calls still work)
  onAuthSubmit: (
    email: string,
    password: string,
    name: string,
    isRegister: boolean
  ) => Promise<any>;
  onSocialLogin: (provider: string) => Promise<any>;
}

// ─── Shared Style Helpers ─────────────────────────────────────────────────────

const PILL_INPUT =
  'w-full px-4 py-3 rounded-full border border-[#E2E8F0] bg-white text-[#0F172A] text-sm placeholder-[#94A3B8] focus:outline-none focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/20 transition-all';

const CHIP_BASE =
  'px-4 py-2 rounded-full border text-sm font-medium cursor-pointer transition-all duration-150 select-none';

const CHIP_IDLE = `${CHIP_BASE} border-[#E2E8F0] bg-white text-[#334155] hover:border-[#7C3AED] hover:text-[#7C3AED]`;
const CHIP_SELECTED = `${CHIP_BASE} border-[#7C3AED] bg-[#F5F3FF] text-[#7C3AED] font-semibold`;

const PRIMARY_BTN =
  'w-full py-3.5 rounded-full bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-semibold text-sm transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';

const OUTLINE_BTN =
  'py-2.5 px-5 rounded-full border border-[#E2E8F0] bg-white text-[#334155] font-medium text-sm hover:border-[#7C3AED] hover:text-[#7C3AED] transition-all duration-200 cursor-pointer';

// ─── 3D Illustrations (SVG-based, matching Mixpanel style) ───────────────────

const Illustration3DComputer = () => (
  <svg viewBox="0 0 340 320" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
    <ellipse cx="170" cy="285" rx="130" ry="20" fill="#EDE9FE" opacity="0.6" />
    <rect x="60" y="80" width="220" height="170" rx="18" fill="#DDD6FE" />
    <rect x="75" y="95" width="190" height="140" rx="12" fill="#1E1B4B" />
    <rect x="85" y="105" width="170" height="120" rx="8" fill="#0F0A2E" />
    {/* Screen content */}
    <polyline points="95,200 120,160 145,175 170,130 195,150 220,120 245,140" stroke="#A78BFA" strokeWidth="2.5" fill="none" strokeLinecap="round" />
    <polyline points="95,210 120,190 145,195 170,170 195,180 220,165 245,175" stroke="#7C3AED" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeDasharray="4 2" />
    {/* Base */}
    <rect x="140" y="250" width="60" height="16" rx="4" fill="#C4B5FD" />
    <rect x="120" y="264" width="100" height="12" rx="4" fill="#DDD6FE" />
    {/* Keyboard */}
    {[0,1,2,3,4,5,6,7,8,9].map(i => (
      <rect key={i} x={90 + i*16} y="282" width="12" height="8" rx="2" fill="#EDE9FE" opacity="0.8" />
    ))}
    {[0,1,2,3,4,5,6,7,8].map(i => (
      <rect key={i} x={98 + i*16} y="294" width="12" height="8" rx="2" fill="#EDE9FE" opacity="0.6" />
    ))}
    {/* Floating cubes */}
    <rect x="268" y="60" width="42" height="42" rx="8" fill="#FBBF24" opacity="0.85" transform="rotate(-10 268 60)" />
    <rect x="278" y="115" width="34" height="34" rx="8" fill="#C4B5FD" opacity="0.7" transform="rotate(8 278 115)" />
    <rect x="20" y="90" width="36" height="36" rx="8" fill="#A78BFA" opacity="0.5" transform="rotate(-15 20 90)" />
  </svg>
);

const Illustration3DPlanet = () => (
  <svg viewBox="0 0 340 320" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
    <ellipse cx="170" cy="290" rx="120" ry="14" fill="#EDE9FE" opacity="0.5" />
    {/* Planet */}
    <circle cx="170" cy="155" r="90" fill="url(#planetGrad)" />
    <defs>
      <radialGradient id="planetGrad" cx="40%" cy="35%">
        <stop offset="0%" stopColor="#FCA5A5" />
        <stop offset="60%" stopColor="#F87171" />
        <stop offset="100%" stopColor="#DC2626" />
      </radialGradient>
    </defs>
    {/* Orbit rings */}
    <ellipse cx="170" cy="155" rx="130" ry="38" stroke="#86EFAC" strokeWidth="2" fill="none" />
    <ellipse cx="170" cy="155" rx="130" ry="38" stroke="#86EFAC" strokeWidth="1" fill="none" transform="rotate(45 170 155)" />
    {/* Orbit dots */}
    <circle cx="300" cy="155" r="8" fill="#FCD34D" />
    <circle cx="68" cy="173" r="6" fill="#6EE7B7" />
    <circle cx="215" cy="90" r="7" fill="#A78BFA" />
    {/* Ground structures */}
    {[0,1,2,3].map(i => (
      <g key={i} transform={`translate(${75 + i * 55}, 240)`}>
        <rect x="0" y="-30" width="14" height="30" rx="3" fill="#DDD6FE" />
        <circle cx="7" cy="-34" r="6" fill="#C4B5FD" />
      </g>
    ))}
  </svg>
);

const Illustration3DBuilding = () => (
  <svg viewBox="0 0 400 380" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
    <ellipse cx="200" cy="340" rx="150" ry="22" fill="#EDE9FE" opacity="0.4" />
    {/* Tower spiral */}
    <rect x="155" y="80" width="90" height="240" rx="12" fill="#C4B5FD" opacity="0.3" />
    {[0,1,2,3,4].map(i => (
      <ellipse key={i} cx="200" cy={100 + i * 48} rx="80" ry="18" fill="white" opacity="0.15" stroke="#A78BFA" strokeWidth="1" />
    ))}
    {/* People on platforms */}
    {[
      { cx: 200, cy: 95, color: '#7C3AED' },
      { cx: 165, cy: 145, color: '#A78BFA' },
      { cx: 235, cy: 193, color: '#C4B5FD' },
      { cx: 178, cy: 241, color: '#7C3AED' },
    ].map((p, i) => (
      <g key={i}>
        <circle cx={p.cx} cy={p.cy - 10} r="6" fill={p.color} />
        <rect x={p.cx - 5} y={p.cy - 4} width="10" height="14" rx="4" fill={p.color} opacity="0.8" />
      </g>
    ))}
    {/* Decorative art panels */}
    <rect x="170" y="160" width="60" height="45" rx="4" fill="#F59E0B" opacity="0.3" />
    <rect x="178" y="168" width="20" height="29" rx="3" fill="#F59E0B" opacity="0.5" />
    <rect x="202" y="168" width="20" height="29" rx="3" fill="#EF4444" opacity="0.5" />
    {/* Light rays from top */}
    <circle cx="200" cy="60" r="18" fill="white" opacity="0.25" />
    <circle cx="200" cy="60" r="10" fill="white" opacity="0.4" />
  </svg>
);

const IllustrationRole = () => (
  <svg viewBox="0 0 340 320" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
    <ellipse cx="170" cy="290" rx="120" ry="14" fill="#EDE9FE" opacity="0.4" />
    {/* Old-style monitor */}
    <rect x="70" y="100" width="200" height="150" rx="14" fill="#DDD6FE" />
    <rect x="82" y="112" width="176" height="118" rx="8" fill="#1E1B4B" />
    {/* Wireframe cube on screen */}
    <g transform="translate(110, 125)">
      <rect x="20" y="20" width="60" height="60" rx="4" fill="none" stroke="#00FFF0" strokeWidth="1.5" />
      <rect x="35" y="5" width="60" height="60" rx="4" fill="none" stroke="#FBBF24" strokeWidth="1.5" />
      <line x1="20" y1="20" x2="35" y2="5" stroke="#A78BFA" strokeWidth="1" />
      <line x1="80" y1="20" x2="95" y2="5" stroke="#A78BFA" strokeWidth="1" />
      <line x1="80" y1="80" x2="95" y2="65" stroke="#A78BFA" strokeWidth="1" />
      <line x1="20" y1="80" x2="35" y2="65" stroke="#A78BFA" strokeWidth="1" />
    </g>
    {/* Base */}
    <rect x="140" y="250" width="60" height="14" rx="4" fill="#C4B5FD" />
    <rect x="120" y="262" width="100" height="12" rx="4" fill="#DDD6FE" />
    {/* Keyboard hint */}
    {[0,1,2,3,4,5,6].map(i => (
      <rect key={i} x={95 + i * 20} y="280" width="15" height="10" rx="3" fill="#EDE9FE" />
    ))}
    {/* Floating boxes top-right */}
    <rect x="278" y="65" width="38" height="38" rx="6" fill="#FBBF24" opacity="0.75" transform="rotate(15 278 65)" />
    <rect x="268" y="112" width="30" height="30" rx="6" fill="#C4B5FD" opacity="0.6" transform="rotate(-8 268 112)" />
    <rect x="22" y="85" width="30" height="30" rx="6" fill="#A78BFA" opacity="0.5" transform="rotate(18 22 85)" />
  </svg>
);

// ─── Screen: Auth ──────────────────────────────────────────────────────────────

interface AuthScreenProps {
  onAuthSubmit: (email: string, password: string, name: string, isRegister: boolean) => Promise<any>;
  onSocialLogin: (provider: string) => Promise<any>;
  onSuccess: (user: any, isNewUser: boolean) => void;
  initialMode: 'login' | 'register';
  onToggleMode: () => void;
}

const AuthScreen: React.FC<AuthScreenProps> = ({
  onAuthSubmit, onSocialLogin, onSuccess, initialMode, onToggleMode
}) => {
  const [isRegister, setIsRegister] = useState(initialMode === 'register');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsError, setTermsError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [emailValid, setEmailValid] = useState(false);

  useEffect(() => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    setEmailValid(emailRegex.test(email));
  }, [email]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isRegister && !termsAccepted) {
      setTermsError(true);
      return;
    }
    setTermsError(false);
    setLoading(true);
    setError('');
    try {
      const user = await onAuthSubmit(email, password, name, isRegister);
      onSuccess(user, isRegister);
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setLoading(true);
    setError('');
    try {
      const user = await onSocialLogin('Google');
      onSuccess(user, false);
    } catch (err: any) {
      setError(err.message || 'Google login failed.');
    } finally {
      setLoading(false);
    }
  };

  const toggle = () => {
    setIsRegister(r => !r);
    setError('');
    setTermsError(false);
    onToggleMode();
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden font-sans" style={{ background: 'linear-gradient(160deg, #F5F3FF 0%, #EDE9FE 50%, #DDD6FE 100%)' }}>
      {/* Gradient blobs */}
      <div className="absolute bottom-0 left-0 right-0 h-56 pointer-events-none" style={{ background: 'linear-gradient(0deg, rgba(196,181,253,0.45) 0%, transparent 100%)' }} />
      <div className="absolute bottom-0 right-0 w-64 h-64 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(167,139,250,0.4) 0%, transparent 70%)' }} />

      {/* Logo */}
      <div className="mb-8 z-10">
        <DynamicLogo />
      </div>

      {/* Card */}
      <div className="w-full max-w-sm z-10 px-4">
        <h1 className="text-2xl font-bold text-center mb-1" style={{ color: '#1E1B4B' }}>
          {isRegister ? 'Discover your next big idea' : 'Welcome back'}
        </h1>
        <p className="text-sm text-center mb-6" style={{ color: '#64748B' }}>
          {isRegister ? 'Sign up for a free account.' : 'Sign in to continue to DataLens AI.'}
        </p>

        {/* Google button */}
        <button
          onClick={handleGoogle}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 py-3 rounded-full border border-[#E2E8F0] bg-white text-[#1E293B] font-semibold text-sm hover:bg-[#F8FAFC] hover:border-[#7C3AED] transition-all duration-200 mb-4 cursor-pointer disabled:opacity-50"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#EA4335" d="M12 5.04c1.62 0 3.08.56 4.22 1.65l3.15-3.15C17.45 1.76 14.96 1 12 1 7.35 1 3.39 3.67 1.45 7.57l3.8 2.95c.9-2.7 3.4-4.48 6.75-4.48z"/>
            <path fill="#4285F4" d="M23.49 12.27c0-.81-.07-1.59-.2-2.35H12v4.51h6.44c-.28 1.48-1.12 2.73-2.38 3.58l3.7 2.87c2.16-1.99 3.73-4.92 3.73-8.61z"/>
            <path fill="#FBBC05" d="M5.25 14.52c-.23-.69-.36-1.42-.36-2.18s.13-1.49.36-2.18L1.45 7.21C.65 8.81.18 10.6.18 12.5s.47 3.69 1.27 5.29l3.8-2.97z"/>
            <path fill="#34A853" d="M12 23c3.24 0 5.97-1.08 7.96-2.91l-3.7-2.87c-1.03.69-2.35 1.1-4.26 1.1-3.35 0-6.19-2.28-7.2-5.48l-3.8 2.95C3.15 19.8 7.14 23 12 23z"/>
          </svg>
          Continue with Google
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px bg-[#E2E8F0]" />
          <span className="text-xs text-[#94A3B8]">or</span>
          <div className="flex-1 h-px bg-[#E2E8F0]" />
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {isRegister && (
            <div>
              <label className="block text-sm font-medium text-[#334155] mb-1.5">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Alex Johnson"
                className={PILL_INPUT}
                required
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-[#334155] mb-1.5">Email</label>
            <div className="relative">
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="e.g. alex@company.com"
                className={`${PILL_INPUT} pr-10`}
                required
              />
              {email && emailValid && (
                <CheckCircle className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500" size={18} />
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#334155] mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              className={PILL_INPUT}
              required
            />
          </div>

          {isRegister && (
            <div>
              <label className={`flex items-start gap-2.5 cursor-pointer text-sm ${termsError ? 'text-red-500' : 'text-[#334155]'}`}>
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={e => { setTermsAccepted(e.target.checked); if (e.target.checked) setTermsError(false); }}
                  className="mt-0.5 w-4 h-4 accent-[#7C3AED] cursor-pointer"
                />
                <span>
                  Agreed to{' '}
                  <span className="text-[#7C3AED] hover:underline cursor-pointer">terms of use</span>{' '}
                  &amp;{' '}
                  <span className="text-[#7C3AED] hover:underline cursor-pointer">privacy statements</span>
                </span>
              </label>
              {termsError && (
                <p className="text-xs text-red-500 mt-1 ml-6">Agreement is required for signup.</p>
              )}
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
              <AlertCircle size={15} />
              <span>{error}</span>
            </div>
          )}

          <button type="submit" disabled={loading} className={`${PRIMARY_BTN} mt-1 flex items-center justify-center gap-2`}>
            {loading ? <Loader2 className="animate-spin" size={18} /> : isRegister ? 'Sign Up' : 'Sign In'}
          </button>
        </form>

        <p className="text-center text-sm text-[#64748B] mt-5">
          {isRegister ? 'Already have an account? ' : "Don't have an account? "}
          <button onClick={toggle} className="text-[#7C3AED] font-semibold hover:underline cursor-pointer bg-transparent border-none">
            {isRegister ? 'Log In' : 'Sign Up'}
          </button>
        </p>
      </div>
    </div>
  );
};

// ─── Screen: Loading ──────────────────────────────────────────────────────────

const LoadingScreen: React.FC = () => (
  <div className="min-h-screen flex flex-col items-center justify-center font-sans" style={{ background: 'linear-gradient(160deg, #F5F3FF 0%, #EDE9FE 50%, #DDD6FE 100%)' }}>
    <div className="absolute bottom-0 right-0 w-64 h-64 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(167,139,250,0.4) 0%, transparent 70%)' }} />
    <DynamicLogo />
    <h2 className="text-xl font-semibold mt-8 mb-2" style={{ color: '#1E1B4B' }}>Discover your next big idea</h2>
    <p className="text-sm" style={{ color: '#64748B' }}>Sign up for a free account.</p>
    <div className="mt-8">
      <div className="w-10 h-10 rounded-full border-4 border-[#EDE9FE] border-t-[#7C3AED] animate-spin" />
    </div>
  </div>
);

// ─── Screen: Email Verify ─────────────────────────────────────────────────────

interface EmailVerifyScreenProps {
  email: string;
  onResend: () => void;
  onSkip: () => void;
}

const EmailVerifyScreen: React.FC<EmailVerifyScreenProps> = ({ email, onResend, onSkip }) => (
  <div className="min-h-screen flex flex-col items-center justify-center font-sans relative overflow-hidden" style={{ background: 'linear-gradient(160deg, #F5F3FF 0%, #EDE9FE 50%, #DDD6FE 100%)' }}>
    <div className="absolute bottom-0 right-0 w-64 h-64 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(167,139,250,0.4) 0%, transparent 70%)' }} />
    <DynamicLogo />
    <div className="mt-8 bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full mx-4 text-center z-10">
      <div className="w-14 h-14 bg-[#EDE9FE] rounded-full flex items-center justify-center mx-auto mb-4">
        <CheckCircle className="text-[#7C3AED]" size={28} />
      </div>
      <h2 className="text-xl font-bold mb-2" style={{ color: '#1E1B4B' }}>We sent a verification email to</h2>
      <div className="bg-[#F8FAFC] rounded-xl px-4 py-3 border border-[#E2E8F0] text-sm font-medium text-[#334155] mb-4 mt-3">
        {email}
      </div>
      <p className="text-sm text-[#64748B]">
        Not seeing the email?{' '}
        <button onClick={onResend} className="text-[#7C3AED] font-semibold hover:underline cursor-pointer bg-transparent border-none">
          Resend
        </button>
      </p>
      <button onClick={onSkip} className="mt-6 text-xs text-[#94A3B8] hover:text-[#7C3AED] transition-colors cursor-pointer bg-transparent border-none">
        Skip for now →
      </button>
    </div>
  </div>
);

// ─── Wizard Layout Wrapper ────────────────────────────────────────────────────

interface WizardLayoutProps {
  illustration: React.ReactNode;
  children: React.ReactNode;
  step: number;
  totalSteps: number;
}

const WizardLayout: React.FC<WizardLayoutProps> = ({ illustration, children, step, totalSteps }) => (
  <div className="min-h-screen w-full flex items-center justify-center font-sans" style={{ background: '#F0EEFF' }}>
    <div className="w-full max-w-6xl flex flex-col lg:flex-row items-center justify-between px-6 sm:px-12 py-12 gap-12 lg:gap-24">
      {/* Left content */}
      <div className="w-full lg:flex-1 max-w-md flex flex-col justify-center">
        {/* Step dots */}
        <div className="flex gap-2 mb-8">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className="h-1.5 rounded-full transition-all duration-300"
              style={{
                width: i === step ? 24 : 8,
                background: i === step ? '#7C3AED' : i < step ? '#C4B5FD' : '#E2E8F0',
              }}
            />
          ))}
        </div>
        {children}
      </div>

      {/* Right illustration */}
      <div className="hidden lg:flex lg:flex-1 items-center justify-center w-full max-w-md">
        <div className="w-full aspect-square max-h-[360px]">
          {illustration}
        </div>
      </div>
    </div>
  </div>
);

// ─── Onboarding Step 1: Name ──────────────────────────────────────────────────

interface StepNameProps {
  data: OnboardingData;
  onChange: (d: Partial<OnboardingData>) => void;
  onNext: () => void;
}

const StepName: React.FC<StepNameProps> = ({ data, onChange, onNext }) => {
  const valid = data.firstName.trim().length > 0 && data.lastName.trim().length > 0;
  return (
    <WizardLayout illustration={<Illustration3DComputer />} step={0} totalSteps={4}>
      <h1 className="text-3xl font-extrabold mb-2" style={{ color: '#1E1B4B' }}>Hi there, what's your name?</h1>
      <p className="text-sm text-[#64748B] mb-8">Help us personalize your experience by answering three quick questions</p>
      <div className="flex flex-col gap-4">
        <div>
          <label className="block text-sm font-semibold text-[#334155] mb-1.5">First Name</label>
          <input
            type="text"
            value={data.firstName}
            onChange={e => onChange({ firstName: e.target.value })}
            placeholder="First name"
            className={PILL_INPUT}
            autoFocus
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-[#334155] mb-1.5">Last Name</label>
          <input
            type="text"
            value={data.lastName}
            onChange={e => onChange({ lastName: e.target.value })}
            placeholder="Last name"
            className={PILL_INPUT}
          />
        </div>
        <button onClick={onNext} disabled={!valid} className={`${PRIMARY_BTN} mt-2`}>
          Next
        </button>
      </div>
    </WizardLayout>
  );
};

// ─── Onboarding Step 2: Work type ─────────────────────────────────────────────

const WORK_TYPES = ['Analyst', 'Data Scientist', 'Business User', 'Developer', 'Manager', 'Student', 'Researcher', 'Other'];

interface StepWorkProps {
  data: OnboardingData;
  onChange: (d: Partial<OnboardingData>) => void;
  onNext: () => void;
  onBack: () => void;
}

const StepWork: React.FC<StepWorkProps> = ({ data, onChange, onNext, onBack }) => (
  <WizardLayout illustration={<Illustration3DPlanet />} step={1} totalSteps={4}>
    <h1 className="text-3xl font-extrabold mb-2" style={{ color: '#1E1B4B' }}>What kind of work do you do?</h1>
    <p className="text-sm text-[#64748B] mb-8">Help us personalize your experience.</p>
    <div className="flex flex-wrap gap-2.5 mb-8">
      {WORK_TYPES.map(w => (
        <button
          key={w}
          onClick={() => onChange({ workType: w })}
          className={data.workType === w ? CHIP_SELECTED : CHIP_IDLE}
        >
          {w}
        </button>
      ))}
    </div>
    <div className="flex gap-3">
      <button onClick={onBack} className={OUTLINE_BTN}>
        <ChevronLeft size={16} className="inline -mt-0.5" /> Back
      </button>
      <button onClick={onNext} disabled={!data.workType} className={`${PRIMARY_BTN} flex-1`}>
        Next
      </button>
    </div>
  </WizardLayout>
);

// ─── Onboarding Step 3: Role ───────────────────────────────────────────────────

const ROLES = ['Executive', 'Freelancer / Consultant', 'C-Suite', 'Individual Contributor', 'Department Lead', 'Team Manager'];

interface StepRoleProps {
  data: OnboardingData;
  onChange: (d: Partial<OnboardingData>) => void;
  onNext: () => void;
  onBack: () => void;
}

const StepRole: React.FC<StepRoleProps> = ({ data, onChange, onNext, onBack }) => (
  <WizardLayout illustration={<IllustrationRole />} step={2} totalSteps={4}>
    <h1 className="text-3xl font-extrabold mb-2" style={{ color: '#1E1B4B' }}>What is your role?</h1>
    <p className="text-sm text-[#64748B] mb-8">Help us personalize your experience.</p>
    <div className="flex flex-wrap gap-2.5 mb-8">
      {ROLES.map(r => (
        <button
          key={r}
          onClick={() => onChange({ role: r })}
          className={data.role === r ? CHIP_SELECTED : CHIP_IDLE}
        >
          {r}
        </button>
      ))}
    </div>
    <div className="flex gap-3">
      <button onClick={onBack} className={OUTLINE_BTN}>
        <ChevronLeft size={16} className="inline -mt-0.5" /> Back
      </button>
      <button onClick={onNext} disabled={!data.role} className={`${PRIMARY_BTN} flex-1`}>
        Submit
      </button>
    </div>
  </WizardLayout>
);

// ─── Onboarding Step 4: Workspace ─────────────────────────────────────────────

const TEAM_SIZES = ['Just me', '2–10', '11–50', '51–200', '201–1000', '1000+'];
const INDUSTRIES = ['Technology', 'Finance / Banking', 'Healthcare', 'Education', 'E-commerce / Retail', 'Agency / Consulting', 'Research', 'Government', 'Other'];

interface StepWorkspaceProps {
  data: OnboardingData;
  onChange: (d: Partial<OnboardingData>) => void;
  onNext: () => void;
  onBack: () => void;
}

const StepWorkspace: React.FC<StepWorkspaceProps> = ({ data, onChange, onNext, onBack }) => {
  const valid = data.workspaceName.trim().length > 0;
  return (
    <WizardLayout illustration={<Illustration3DBuilding />} step={3} totalSteps={4}>
      <h1 className="text-3xl font-extrabold mb-2" style={{ color: '#1E1B4B' }}>Set up your workspace</h1>
      <p className="text-sm text-[#64748B] mb-8">This is where your analyses and charts will live.</p>
      <div className="flex flex-col gap-4">
        <div>
          <label className="block text-sm font-semibold text-[#334155] mb-1.5">Workspace Name</label>
          <input
            type="text"
            value={data.workspaceName}
            onChange={e => onChange({ workspaceName: e.target.value })}
            placeholder="e.g. Acme Analytics"
            className={PILL_INPUT}
            autoFocus
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-[#334155] mb-1.5">How large is your team?</label>
          <CustomSelect 
            value={data.teamSize}
            onChange={(val) => onChange({ teamSize: val })}
            options={[
              { value: '', label: 'Select one' },
              ...TEAM_SIZES.map(s => ({ value: s, label: s }))
            ]}
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-[#334155] mb-1.5">What best describes your industry?</label>
          <CustomSelect 
            value={data.industry}
            onChange={(val) => onChange({ industry: val })}
            options={[
              { value: '', label: 'Select one' },
              ...INDUSTRIES.map(i => ({ value: i, label: i }))
            ]}
          />
        </div>
        <div className="flex gap-3 mt-2">
          <button onClick={onBack} className={OUTLINE_BTN}>
            <ChevronLeft size={16} className="inline -mt-0.5" /> Back
          </button>
          <button onClick={onNext} disabled={!valid} className={`${PRIMARY_BTN} flex-1`}>
            Continue <ArrowRight size={16} className="inline ml-1 -mt-0.5" />
          </button>
        </div>
      </div>
    </WizardLayout>
  );
};

// ─── Main Orchestrator ────────────────────────────────────────────────────────

const STORAGE_KEY = 'datalens_onboarding';

const defaultOnboardingData: OnboardingData = {
  firstName: '',
  lastName: '',
  workType: '',
  role: '',
  workspaceName: '',
  teamSize: '',
  industry: '',
};

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({
  onComplete,
  initialMode = 'login',
  onCancel,
  onAuthSubmit,
  onSocialLogin,
}) => {
  const [screen, setScreen] = useState<OnboardingScreen>('auth');
  const [authMode, setAuthMode] = useState<'login' | 'register'>(initialMode);
  const [pendingUser, setPendingUser] = useState<any>(null);
  const [pendingEmail, setPendingEmail] = useState('');
  const [onboarding, setOnboarding] = useState<OnboardingData>(defaultOnboardingData);

  const updateOnboarding = (patch: Partial<OnboardingData>) =>
    setOnboarding(prev => ({ ...prev, ...patch }));

  const handleAuthSuccess = (user: any, isNewUser: boolean) => {
    setPendingUser(user);
    setPendingEmail(user?.email || '');

    if (!isNewUser) {
      // Existing user — check if they completed onboarding before
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        onComplete(user, JSON.parse(saved));
      } else {
        // Skip wizard for login
        onComplete(user, defaultOnboardingData);
      }
      return;
    }

    // New user → show loading → wizard (no fake email verify)
    setScreen('loading');
    setTimeout(() => setScreen('step-name'), 1800);
  };

  const finishOnboarding = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(onboarding));
    onComplete(pendingUser, onboarding);
  };

  if (screen === 'auth') {
    return (
      <AuthScreen
        onAuthSubmit={onAuthSubmit}
        onSocialLogin={onSocialLogin}
        onSuccess={handleAuthSuccess}
        initialMode={authMode}
        onToggleMode={() => setAuthMode(m => m === 'login' ? 'register' : 'login')}
      />
    );
  }

  if (screen === 'loading') return <LoadingScreen />;

  if (screen === 'step-name') {
    return (
      <StepName
        data={onboarding}
        onChange={updateOnboarding}
        onNext={() => setScreen('step-work')}
      />
    );
  }

  if (screen === 'step-work') {
    return (
      <StepWork
        data={onboarding}
        onChange={updateOnboarding}
        onNext={() => setScreen('step-role')}
        onBack={() => setScreen('step-name')}
      />
    );
  }

  if (screen === 'step-role') {
    return (
      <StepRole
        data={onboarding}
        onChange={updateOnboarding}
        onNext={() => setScreen('step-workspace')}
        onBack={() => setScreen('step-work')}
      />
    );
  }

  if (screen === 'step-workspace') {
    return (
      <StepWorkspace
        data={onboarding}
        onChange={updateOnboarding}
        onNext={finishOnboarding}
        onBack={() => setScreen('step-role')}
      />
    );
  }

  return null;
};

export default OnboardingFlow;
