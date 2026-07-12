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
  PieChart,
  Download
} from 'lucide-react';
import { DynamicLogo } from './branding/DynamicLogo';

interface LandingPageProps {
  onStartAuth: (mode: 'login' | 'register') => void;
  onDownloadDesktop: () => void;
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

export const LandingPage: React.FC<LandingPageProps> = ({ onStartAuth, onDownloadDesktop, appName, appTagline }) => {
  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-[#F8FAFC] text-slate-900 font-sans relative overflow-x-hidden">
      
      {/* ─── LEFT COLUMN: Hero content, Action CTA & Features (60% Width) ─── */}
      <div className="w-full lg:w-[60%] min-h-screen bg-white flex flex-col justify-between p-6 sm:p-12 relative z-20">
        
        {/* Left Header */}
        <header className="flex items-center justify-between w-full mb-8 lg:mb-0">
          <div className="flex items-center gap-2">
            <DynamicLogo />
          </div>
          <button 
            onClick={() => onStartAuth('login')}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white text-sm font-semibold px-5 py-2.5 rounded-full shadow-sm hover:shadow-md transition-all cursor-pointer"
          >
            Log In
          </button>
        </header>

        {/* Left Content (Perfectly centered vertically in the 60% viewport) */}
        <div className="my-auto max-w-2xl w-full mx-auto flex flex-col justify-center py-6 lg:py-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-100 text-xs font-semibold text-blue-600 mb-5 w-fit shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
            Real-time Analytics
          </div>
          
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900 leading-tight mb-4">
            Transform Data <br className="hidden sm:inline" />
            Into <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Actionable Insights</span>
          </h1>
          
          <p className="text-slate-500 text-sm md:text-base mb-6 max-w-xl leading-relaxed">
            {appTagline || "Powerful analytics dashboard that helps you understand your business metrics, track KPIs, and make data-driven decisions in real-time."}
          </p>
          
          <div className="flex flex-wrap gap-4 mb-8 w-full sm:w-auto">
            <button 
              onClick={() => onStartAuth('register')}
              className="flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold px-6 py-3.5 rounded-xl shadow-md hover:shadow-lg transition-all duration-200 cursor-pointer text-sm w-full sm:w-auto group"
            >
              Get Started (Web)
              <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
            </button>
            <button 
              onClick={onDownloadDesktop}
              className="flex items-center justify-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold px-6 py-3.5 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer text-sm w-full sm:w-auto group"
            >
              <Download size={16} className="text-slate-500 group-hover:translate-y-0.5 transition-transform" />
              Download for Windows
            </button>
          </div>

          {/* Embedded Features Layout (Redesigned into Premium Cards Form) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full pt-6 border-t border-slate-200/80">
            
            {/* Feature 1 Card */}
            <div className="p-4 rounded-xl border border-slate-200/60 bg-slate-50/40 hover:bg-white hover:shadow-lg hover:border-blue-500/20 transition-all duration-300 flex flex-col justify-between min-h-[128px]">
              <div>
                <div className="w-7 h-7 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-500 mb-2.5">
                  <Sparkles size={14} />
                </div>
                <h4 className="text-xs font-bold text-slate-800 leading-tight mb-1">AI Auto-Analyst</h4>
              </div>
              <p className="text-[10px] text-slate-400 font-medium leading-normal">Instant statistics & executive audits.</p>
            </div>

            {/* Feature 2 Card */}
            <div className="p-4 rounded-xl border border-slate-200/60 bg-slate-50/40 hover:bg-white hover:shadow-lg hover:border-blue-500/20 transition-all duration-300 flex flex-col justify-between min-h-[128px]">
              <div>
                <div className="w-7 h-7 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-500 mb-2.5">
                  <Wand2 size={14} />
                </div>
                <h4 className="text-xs font-bold text-slate-800 leading-tight mb-1">Data Cleaning</h4>
              </div>
              <p className="text-[10px] text-slate-400 font-medium leading-normal">Detect outliers & remove duplicate rows.</p>
            </div>

            {/* Feature 3 Card */}
            <div className="p-4 rounded-xl border border-slate-200/60 bg-slate-50/40 hover:bg-white hover:shadow-lg hover:border-blue-500/20 transition-all duration-300 flex flex-col justify-between min-h-[128px]">
              <div>
                <div className="w-7 h-7 rounded-lg bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-500 mb-2.5">
                  <PieChart size={14} />
                </div>
                <h4 className="text-xs font-bold text-slate-800 leading-tight mb-1">Visual Reports</h4>
              </div>
              <p className="text-[10px] text-slate-400 font-medium leading-normal">Interactive charts with PDF exports.</p>
            </div>
            
          </div>
        </div>

        {/* Left Footer */}
        <footer className="mt-8 lg:mt-0 pt-4 border-t border-slate-100 lg:border-none flex items-center justify-between">
          <div className="text-[10px] text-slate-400 font-bold font-mono">
            &copy; {new Date().getFullYear()} {appName}. All rights reserved.
          </div>
        </footer>
      </div>

      {/* ─── ANIMATED SEPARATOR LINE (Positioned at 60% Width) ─── */}
      {/* Vertical separator */}
      <div className="hidden lg:block absolute top-0 bottom-0 left-[60%] w-[1px] bg-slate-100 z-30">
        <div 
          className="w-[3px] h-32 bg-gradient-to-b from-transparent via-purple-500 to-transparent absolute left-[-1px] animate-flowLine"
          style={{ animation: 'flowLine 3.5s infinite linear' }}
        ></div>
      </div>
      {/* Horizontal separator */}
      <div className="block lg:hidden w-full h-[1px] bg-slate-100 relative z-30 my-2">
        <div 
          className="h-[3px] w-32 bg-gradient-to-r from-transparent via-purple-500 to-transparent absolute top-[-1px] animate-flowLineHorizontal"
          style={{ animation: 'flowLineHorizontal 3.5s infinite linear' }}
        ></div>
      </div>

      {/* ─── RIGHT COLUMN: Dashboard Preview Graphic (40% Width - Premium Dark Theme) ─── */}
      <div className="w-full lg:w-[40%] min-h-screen bg-[#070913] flex items-center justify-center p-6 sm:p-12 relative overflow-hidden z-20">
        
        {/* Soft glowing ambient spots */}
        <div className="absolute inset-0 bg-gradient-to-tr from-blue-900/25 to-purple-900/30 rounded-3xl blur-3xl pointer-events-none transform scale-90"></div>
        <div className="absolute top-[20%] left-[20%] w-[60%] h-[60%] rounded-full bg-gradient-to-br from-[#7C3AED]/10 to-indigo-900/20 blur-[120px] pointer-events-none"></div>

        {/* Dashboard Wrapper */}
        <div className="w-full max-w-[440px] bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xl relative overflow-visible select-none animate-fadeIn">
          
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

          {/* Main Area Chart */}
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
          <div className="absolute top-3 right-[-12px] bg-white border border-slate-200/80 rounded-xl shadow-lg py-1 px-2.5 flex items-center gap-1.5 animate-bounce" style={{ animationDuration: '4s' }}>
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

      {/* Dynamic Keyframe Animations Injection */}
      <style>{`
        @keyframes flowLine {
          0% { top: -128px; }
          100% { top: 100%; }
        }
        @keyframes flowLineHorizontal {
          0% { left: -128px; }
          100% { left: 100%; }
        }
      `}</style>
    </div>
  );
};
