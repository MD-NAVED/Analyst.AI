import React from 'react';
import { 
  AreaChart, 
  Area, 
  ResponsiveContainer, 
  LineChart, 
  Line 
} from 'recharts';
import { 
  Play, 
  ArrowRight, 
  Sparkles, 
  Bell, 
  Users, 
  TrendingUp, 
  Zap, 
  Shield, 
  FileSpreadsheet, 
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
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans relative overflow-x-hidden">
      {/* Background soft glowing gradients */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-gradient-to-br from-blue-200/40 to-indigo-200/30 blur-[120px] pointer-events-none"></div>
      <div className="absolute top-[20%] right-[-10%] w-[60%] h-[60%] rounded-full bg-gradient-to-bl from-purple-200/30 to-blue-100/20 blur-[140px] pointer-events-none"></div>

      {/* Header / Navbar */}
      <header className="sticky top-0 z-40 bg-white/70 backdrop-blur-md border-b border-slate-200/60 transition-all">
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

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-6 pt-12 pb-24 md:pt-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          {/* Hero Left Column */}
          <div className="lg:col-span-6 flex flex-col items-start text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-100 text-xs font-semibold text-blue-600 mb-6 shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
              Real-time Analytics
            </div>
            
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-slate-900 leading-none mb-6">
              Transform Data <br className="hidden sm:inline" />
              Into <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Actionable Insights</span>
            </h1>
            
            <p className="text-slate-500 text-base md:text-lg max-w-xl mb-8 leading-relaxed">
              {appTagline || "Powerful analytics dashboard that helps you understand your business metrics, track KPIs, and make data-driven decisions in real-time."}
            </p>
            
            <div className="flex flex-wrap gap-4 mb-12 w-full sm:w-auto">
              <button 
                onClick={() => onStartAuth('register')}
                className="flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold px-6 py-3.5 rounded-xl shadow-md hover:shadow-lg transition-all duration-200 cursor-pointer text-sm w-full sm:w-auto group"
              >
                Get Started
                <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
            

          </div>

          {/* Hero Right Column - Interactive Dashboard Mock */}
          <div className="lg:col-span-6 relative flex items-center justify-center lg:justify-end">
            {/* Decorative background glow under mock */}
            <div className="absolute inset-0 bg-gradient-to-tr from-blue-400/20 to-purple-400/20 rounded-3xl blur-3xl pointer-events-none transform scale-90 translate-x-4 translate-y-4"></div>

            {/* Dashboard Wrapper */}
            <div className="w-full max-w-[540px] bg-white border border-slate-200/80 rounded-2xl p-6 shadow-2xl relative overflow-visible select-none animate-fadeIn">
              
              {/* Mock Dashboard Top controls */}
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Revenue & Users</h3>
                  <div className="flex gap-3 text-[10px] text-slate-400 mt-1 font-semibold">
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500"></span> Revenue</span>
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-purple-500"></span> Users</span>
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> Growth</span>
                  </div>
                </div>
                
                {/* Growth indicator badge */}
                <span className="bg-emerald-50 border border-emerald-100 text-emerald-600 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  +24.5%
                </span>
              </div>

              {/* Main Area Chart */}
              <div className="h-[200px] w-full mb-6">
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
                    <Area type="monotone" dataKey="revenue" stroke="#3B82F6" strokeWidth={2.5} fillOpacity={1} fill="url(#mockBlueGrad)" />
                    <Area type="monotone" dataKey="users" stroke="#8B5CF6" strokeWidth={1.5} fillOpacity={1} fill="url(#mockPurpGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Bottom 3 KPI Grid */}
              <div className="grid grid-cols-3 gap-4 border-t border-slate-100 pt-4">
                
                {/* KPI Card 1: Users */}
                <div className="bg-slate-50/50 border border-slate-100 rounded-xl p-3 flex flex-col justify-between h-[80px]">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Users</div>
                  <div className="flex justify-between items-baseline mt-1">
                    <span className="text-sm font-extrabold text-slate-800">8.5K</span>
                  </div>
                  <div className="h-5 w-full mt-1">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={sparklineMock}>
                        <Line type="monotone" dataKey="val" stroke="#3B82F6" strokeWidth={1.5} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* KPI Card 2: Sources */}
                <div className="bg-slate-50/50 border border-slate-100 rounded-xl p-3 flex flex-col justify-between h-[80px]">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Sources</div>
                  <div className="flex items-center gap-2 mt-1 flex-1">
                    <span className="text-sm font-extrabold text-slate-800">80%</span>
                    {/* SVG Radial ring */}
                    <svg className="w-7 h-7 transform -rotate-90 ml-auto" viewBox="0 0 36 36">
                      <path className="text-slate-100" strokeWidth="3" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                      <path className="text-indigo-500" strokeDasharray="80, 100" strokeWidth="3" strokeLinecap="round" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                    </svg>
                  </div>
                </div>

                {/* KPI Card 3: Growth */}
                <div className="bg-slate-50/50 border border-slate-100 rounded-xl p-3 flex flex-col justify-between h-[80px]">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Growth</div>
                  <div className="text-sm font-extrabold text-slate-800 mt-1">+32%</div>
                  <div className="flex gap-1.5 w-full mt-2">
                    <span className="h-1.5 flex-1 rounded bg-[#10B981]"></span>
                    <span className="h-1.5 flex-1 rounded bg-[#10B981]"></span>
                    <span className="h-1.5 flex-1 rounded bg-[#10B981]"></span>
                    <span className="h-1.5 flex-1 rounded bg-slate-200"></span>
                  </div>
                </div>
              </div>

              {/* Floating Badge 1: Live Sync */}
              <div className="absolute top-4 right-[-16px] bg-white border border-slate-200/80 rounded-xl shadow-lg py-1.5 px-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="text-[10px] font-bold text-slate-600">Live Sync</span>
              </div>

              {/* Floating Badge 2: Active Now */}
              <div className="absolute bottom-[110px] right-[-24px] bg-white border border-slate-200/80 rounded-xl shadow-lg p-2.5 flex flex-col items-center">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Active now</span>
                <span className="text-sm font-black text-indigo-600">1,247</span>
              </div>

              {/* Floating Notification Badge: Milestone */}
              <div className="absolute bottom-[-16px] left-4 bg-white border border-slate-200/80 rounded-xl shadow-xl py-2 px-3 flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-500">
                  <Bell size={14} className="animate-bounce" />
                </div>
                <div>
                  <div className="text-[10px] font-extrabold text-slate-800">New milestone!</div>
                  <div className="text-[9px] text-slate-400 font-semibold mt-0.5">10K Users reached</div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </main>

      {/* Features Section */}
      <section id="features" className="bg-white border-t border-b border-slate-200/60 py-20 relative">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-xl mx-auto mb-16">
            <span className="inline-block text-xs font-bold uppercase tracking-wider text-blue-600 bg-blue-50 border border-blue-100 px-3 py-1.5 rounded-full mb-4">Core Features</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900">
              Everything You Need to <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Succeed</span>
            </h2>
            <p className="text-slate-500 text-sm mt-3 leading-relaxed">
              Powerful features designed to help you clean, analyze, visualize, and extract intelligence from your spreadsheet datasets effortlessly.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            
            {/* Feature 1: AI Auto-Analyst */}
            <div className="p-6 rounded-2xl border border-slate-200/80 bg-slate-50/50 hover:bg-white hover:shadow-xl hover:border-blue-500/20 transition-all duration-300">
              <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-500 mb-6">
                <Sparkles size={20} />
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-2">AI Auto-Analyst</h3>
              <p className="text-slate-500 text-sm leading-relaxed font-medium">
                Generates instant statistical overviews, data audits, and executive summaries with one-click using advanced Large Language Models.
              </p>
            </div>

            {/* Feature 2: Data Cleaning */}
            <div className="p-6 rounded-2xl border border-slate-200/80 bg-slate-50/50 hover:bg-white hover:shadow-xl hover:border-blue-500/20 transition-all duration-300">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-500 mb-6">
                <Wand2 size={20} />
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-2">Automated Data Cleaning</h3>
              <p className="text-slate-500 text-sm leading-relaxed font-medium">
                Detects outlier points, removes duplicate rows, fills missing values, and converts mismatched data formats in seconds.
              </p>
            </div>

            {/* Feature 3: Visual Reporting */}
            <div className="p-6 rounded-2xl border border-slate-200/80 bg-slate-50/50 hover:bg-white hover:shadow-xl hover:border-blue-500/20 transition-all duration-300">
              <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-500 mb-6">
                <PieChart size={20} />
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-2">Interactive Visualizations</h3>
              <p className="text-slate-500 text-sm leading-relaxed font-medium">
                Creates high-quality interactive charts (bar, scatter, pie, line, histogram) with dynamic filters and lets you export reports as PDFs.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-50 py-12 border-t border-slate-200/60 text-center">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <DynamicLogo />
          </div>
          <div className="text-xs text-slate-400 font-semibold font-mono">
            &copy; {new Date().getFullYear()} {appName}. All rights reserved.
          </div>
        </div>
      </footer>

    </div>
  );
};
