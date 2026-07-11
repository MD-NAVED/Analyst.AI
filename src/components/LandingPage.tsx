import React from 'react';
import { 
  AreaChart, 
  Area, 
  ResponsiveContainer, 
  LineChart, 
  Line 
} from 'recharts';
import { 
  ArrowRight, 
  Sparkles, 
  Bell, 
  Wand2, 
  PieChart 
} from 'lucide-react';
import { DynamicLogo } from './branding/DynamicLogo';

interface LandingPageProps {
  onStartAuth: (mode: 'login' | 'register') => void;
  appName: string;
  appTagline: string;
}

// Mock Data for Hero Dashboard Preview
const chartDataMock = [
  { name: 'Jan', revenue: 3200, users: 1800 },
  { name: 'Feb', revenue: 4100, users: 2200 },
  { name: 'Mar', revenue: 3800, users: 2100 },
  { name: 'Apr', revenue: 5200, users: 3100 },
  { name: 'May', revenue: 4900, users: 2900 },
  { name: 'Jun', revenue: 6400, users: 4200 },
  { name: 'Jul', revenue: 6100, users: 3800 },
  { name: 'Aug', revenue: 7800, users: 5100 },
  { name: 'Sep', revenue: 7500, users: 4900 },
  { name: 'Oct', revenue: 8900, users: 6000 },
  { name: 'Nov', revenue: 8500, users: 5800 },
  { name: 'Dec', revenue: 9800, users: 6500 },
];

const sparklineMock = [
  { val: 10 }, { val: 15 }, { val: 8 }, { val: 12 }, { val: 20 }, { val: 18 }, { val: 25 }
];

export const LandingPage: React.FC<LandingPageProps> = ({ onStartAuth, appName, appTagline }) => {
  return (
    <div className="min-h-screen lg:h-screen lg:overflow-hidden bg-[#F8FAFC] text-slate-900 font-sans flex flex-col justify-between relative overflow-x-hidden">
      {/* Background soft glowing gradients */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-gradient-to-br from-blue-200/40 to-indigo-200/30 blur-[120px] pointer-events-none"></div>
      <div className="absolute top-[20%] right-[-10%] w-[60%] h-[60%] rounded-full bg-gradient-to-bl from-purple-200/30 to-blue-100/20 blur-[140px] pointer-events-none"></div>

      {/* Header / Navbar */}
      <header className="sticky top-0 z-40 bg-white/70 backdrop-blur-md border-b border-slate-200/60 transition-all flex-shrink-0">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DynamicLogo />
          </div>
          
          <div className="flex items-center gap-4">
            <button 
              onClick={() => onStartAuth('login')}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white text-sm font-semibold px-5 py-2.5 rounded-full shadow-sm hover:shadow-md transition-all cursor-pointer"
            >
              Log In
            </button>
          </div>
        </div>
      </header>

      {/* Main Single-Screen Hero Layout */}
      <main className="max-w-7xl w-full mx-auto px-6 flex-1 flex items-center py-6 lg:py-0 overflow-y-auto lg:overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16 items-center w-full my-auto">
          
          {/* Hero Left Column: Header text + Action CTA + Embedded features */}
          <div className="lg:col-span-6 flex flex-col items-start text-left lg:pr-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-100 text-xs font-semibold text-blue-600 mb-5 shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
              Real-time Analytics
            </div>
            
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 leading-tight mb-4">
              Transform Data <br className="hidden sm:inline" />
              Into <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Actionable Insights</span>
            </h1>
            
            <p className="text-slate-500 text-sm md:text-base max-w-xl mb-6 leading-relaxed">
              {appTagline || "Powerful analytics dashboard that helps you understand your business metrics, track KPIs, and make data-driven decisions in real-time."}
            </p>
            
            <div className="flex flex-wrap gap-4 mb-8 w-full sm:w-auto">
              <button 
                onClick={() => onStartAuth('register')}
                className="flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold px-6 py-3 rounded-xl shadow-md hover:shadow-lg transition-all duration-200 cursor-pointer text-sm w-full sm:w-auto group"
              >
                Get Started
                <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </button>
            </div>

            {/* Embedded Features Layout (Centered/Balanced) */}
            <div className="grid grid-cols-3 gap-4 w-full pt-5 border-t border-slate-200/80">
              {/* Feature 1 */}
              <div className="flex flex-col gap-1.5">
                <div className="w-7 h-7 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-500">
                  <Sparkles size={14} />
                </div>
                <h4 className="text-xs font-extrabold text-slate-800 leading-tight">AI Auto-Analyst</h4>
                <p className="text-[10px] text-slate-400 font-medium leading-normal">Instant statistics & executive audits.</p>
              </div>

              {/* Feature 2 */}
              <div className="flex flex-col gap-1.5">
                <div className="w-7 h-7 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-500">
                  <Wand2 size={14} />
                </div>
                <h4 className="text-xs font-extrabold text-slate-800 leading-tight">Data Cleaning</h4>
                <p className="text-[10px] text-slate-400 font-medium leading-normal">Detect outliers & remove duplicate rows.</p>
              </div>

              {/* Feature 3 */}
              <div className="flex flex-col gap-1.5">
                <div className="w-7 h-7 rounded-lg bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-500">
                  <PieChart size={14} />
                </div>
                <h4 className="text-xs font-extrabold text-slate-800 leading-tight">Visual Reports</h4>
                <p className="text-[10px] text-slate-400 font-medium leading-normal">Interactive charts with PDF exports.</p>
              </div>
            </div>
            
          </div>

          {/* Hero Right Column: Compact Mock Dashboard */}
          <div className="lg:col-span-6 relative flex items-center justify-center lg:justify-end">
            {/* Decorative background glow under mock */}
            <div className="absolute inset-0 bg-gradient-to-tr from-blue-400/20 to-purple-400/20 rounded-3xl blur-3xl pointer-events-none transform scale-90 translate-x-4 translate-y-4"></div>

            {/* Dashboard Wrapper */}
            <div className="w-full max-w-[480px] lg:max-w-[460px] xl:max-w-[500px] bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xl relative overflow-visible select-none animate-fadeIn">
              
              {/* Mock Dashboard Top controls */}
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-xs font-extrabold text-slate-800">Revenue & Users</h3>
                  <div className="flex gap-2.5 text-[9px] text-slate-400 mt-0.5 font-bold">
                    <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span> Revenue</span>
                    <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span> Users</span>
                    <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Growth</span>
                  </div>
                </div>
                
                {/* Growth indicator badge */}
                <span className="bg-emerald-50 border border-emerald-100 text-emerald-600 text-[9px] font-bold px-2 py-0.5 rounded-full">
                  +24.5%
                </span>
              </div>

              {/* Main Area Chart (Ultra-compact) */}
              <div className="h-[150px] w-full mb-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartDataMock} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                    <defs>
                      <linearGradient id="mockBlueGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.25}/>
                        <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.01}/>
                      </linearGradient>
                      <linearGradient id="mockPurpGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.15}/>
                        <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0.01}/>
                      </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="revenue" stroke="#3B82F6" strokeWidth={2} fillOpacity={1} fill="url(#mockBlueGrad)" />
                    <Area type="monotone" dataKey="users" stroke="#8B5CF6" strokeWidth={1} fillOpacity={1} fill="url(#mockPurpGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Bottom 3 KPI Grid */}
              <div className="grid grid-cols-3 gap-3 border-t border-slate-100 pt-3">
                
                {/* KPI Card 1: Users */}
                <div className="bg-slate-50/50 border border-slate-100 rounded-xl p-2.5 flex flex-col justify-between h-[72px]">
                  <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Users</div>
                  <div className="flex justify-between items-baseline mt-0.5">
                    <span className="text-xs font-black text-slate-800">8.5K</span>
                  </div>
                  <div className="h-4 w-full mt-0.5">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={sparklineMock}>
                        <Line type="monotone" dataKey="val" stroke="#3B82F6" strokeWidth={1.2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* KPI Card 2: Sources */}
                <div className="bg-slate-50/50 border border-slate-100 rounded-xl p-2.5 flex flex-col justify-between h-[72px]">
                  <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Sources</div>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-1">
                    <span className="text-xs font-black text-slate-800">80%</span>
                    <svg className="w-6 h-6 transform -rotate-90 ml-auto" viewBox="0 0 36 36">
                      <path className="text-slate-100" strokeWidth="3" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                      <path className="text-indigo-500" strokeDasharray="80, 100" strokeWidth="3" strokeLinecap="round" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                    </svg>
                  </div>
                </div>

                {/* KPI Card 3: Growth */}
                <div className="bg-slate-50/50 border border-slate-100 rounded-xl p-2.5 flex flex-col justify-between h-[72px]">
                  <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Growth</div>
                  <div className="text-xs font-black text-slate-800 mt-0.5">+32%</div>
                  <div className="flex gap-1 w-full mt-1.5">
                    <span className="h-1 flex-1 rounded bg-[#10B981]"></span>
                    <span className="h-1 flex-1 rounded bg-[#10B981]"></span>
                    <span className="h-1 flex-1 rounded bg-[#10B981]"></span>
                    <span className="h-1 flex-1 rounded bg-slate-200"></span>
                  </div>
                </div>
              </div>

              {/* Floating Badge 1: Live Sync */}
              <div className="absolute top-3 right-[-12px] bg-white border border-slate-200/80 rounded-xl shadow-lg py-1 px-2.5 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="text-[9px] font-extrabold text-slate-600">Live Sync</span>
              </div>

              {/* Floating Badge 2: Active Now */}
              <div className="absolute bottom-[96px] right-[-16px] bg-white border border-slate-200/80 rounded-xl shadow-lg p-2 flex flex-col items-center">
                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Active now</span>
                <span className="text-xs font-black text-indigo-600">1,247</span>
              </div>

              {/* Floating Notification Badge: Milestone */}
              <div className="absolute bottom-[-12px] left-4 bg-white border border-slate-200/80 rounded-xl shadow-lg py-1.5 px-2.5 flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-500 flex-shrink-0">
                  <Bell size={12} className="animate-bounce" />
                </div>
                <div>
                  <div className="text-[9px] font-black text-slate-800">New milestone!</div>
                  <div className="text-[8px] text-slate-400 font-bold mt-0.5">10K Users reached</div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </main>

      {/* Thin Footer Spanning Bottom */}
      <footer className="bg-white border-t border-slate-200/60 py-4 flex-shrink-0">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="flex items-center gap-2">
            <DynamicLogo />
          </div>
          <div className="text-[10px] text-slate-400 font-bold font-mono">
            &copy; {new Date().getFullYear()} {appName}. All rights reserved.
          </div>
        </div>
      </footer>

    </div>
  );
};
