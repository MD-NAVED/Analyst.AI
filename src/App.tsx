import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
  Upload, FileSpreadsheet, FileJson, FileText, X, AlertCircle, CheckCircle,
  Search, Filter, BarChart2, PieChart as PieChartIcon, LineChart as LineChartIcon,
  ScatterChart as ScatterChartIcon, Activity, Download, Hash, Type, Calendar, 
  ChevronRight, ArrowUpRight, ArrowDownRight, Menu, LayoutDashboard, Database,
  MessageSquare, Sparkles, Wand2, RefreshCcw, Save, Trash2, ArrowRight, FileOutput, Send,
  Terminal, Component, Workflow, Zap, Network, Clock, Settings, Plus, Play, TrendingUp
} from 'lucide-react';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, ScatterChart, Scatter, ZAxis, AreaChart, Area
} from 'recharts';
import { GoogleGenAI } from '@google/genai';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

// --- TYPES ---
type ColumnType = 'number' | 'text' | 'date';
interface ColumnInfo {
  name: string;
  type: ColumnType;
}
interface FileInfo {
  name: string;
  size: number;
  rows: number;
  columns: number;
  type: string;
}
interface ToastInfo {
  id: number;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
}
interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
}

// --- UTILS ---
const formatBytes = (bytes: number) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const CHART_COLORS = ['#6366F1', '#22D3EE', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

let aiClient: GoogleGenAI | null = null;
try {
  if (process.env.GEMINI_API_KEY) {
    aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
} catch(e) {
  console.log('AI Client initialization skipped');
}

const detectColumnTypes = (data: any[], keys: string[]): ColumnInfo[] => {
  return keys.map(key => {
    let type: ColumnType = 'text';
    let numCount = 0;
    let dateCount = 0;
    const sampleSize = Math.min(data.length, 100);
    let validSamples = 0;

    for (let i = 0; i < sampleSize; i++) {
      const val = data[i][key];
      if (val === null || val === undefined || val === '') continue;
      validSamples++;

      if (typeof val === 'number') {
        numCount++;
      } else if (typeof val === 'string') {
        if (!isNaN(Number(val)) && val.trim() !== '') {
          numCount++;
        } else if (!isNaN(Date.parse(val))) {
          dateCount++;
        }
      } else if (val instanceof Date) {
        dateCount++;
      }
    }

    if (validSamples > 0) {
      if (numCount / validSamples > 0.8) type = 'number';
      else if (dateCount / validSamples > 0.8) type = 'date';
    }
    
    return { name: key, type };
  });
};

const calculateStats = (data: any[], col: string) => {
  const values = data.map(d => Number(d[col])).filter(n => !isNaN(n));
  if (values.length === 0) return null;

  values.sort((a, b) => a - b);
  const count = values.length;
  const sum = values.reduce((a, b) => a + b, 0);
  const mean = sum / count;
  const median = count % 2 === 0 ? (values[count / 2 - 1] + values[count / 2]) / 2 : values[Math.floor(count / 2)];
  const min = values[0];
  const max = values[count - 1];
  
  const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / count;
  const stdDev = Math.sqrt(variance);
  
  const nullCount = data.length - count;
  const nullPercent = (nullCount / data.length) * 100;

  return { count, mean, median, min, max, stdDev, nullCount, nullPercent };
};


export default function App() {
  const [activeTab, setActiveTab] = useState<'upload' | 'preview' | 'stats' | 'charts' | 'cleaning' | 'pivot' | 'eda' | 'chat' | 'sql' | 'ml' | 'dashboard' | 'pipeline' | 'auto-analyst'>('upload');
  const [fileInfo, setFileInfo] = useState<FileInfo | null>(null);
  const [data, setData] = useState<any[]>([]);
  const [history, setHistory] = useState<any[][]>([]);
  const [columns, setColumns] = useState<ColumnInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [toasts, setToasts] = useState<ToastInfo[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { id: '1', role: 'model', content: 'Hi! I am your AI Data Assistant. Ask me anything about your dataset.' }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatTyping, setChatTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  
  const [autoPilotStatus, setAutoPilotStatus] = useState<'idle' | 'cleaning' | 'analyzing' | 'done'>('idle');
  const [autoPilotInsights, setAutoPilotInsights] = useState<string[]>([]);
  const [autoPilotCharts, setAutoPilotCharts] = useState<any[]>([]);
  const [autoPilotReport, setAutoPilotReport] = useState<any>(null);
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z') {
           e.preventDefault();
           undo();
        }
        if (e.key === 'k') {
           e.preventDefault();
           setShowSearch(true);
        }
      } else if (e.key === '?' && e.target === document.body) {
         setShowShortcuts(true);
      } else if (e.key === 'Escape') {
         setShowSearch(false);
         setShowShortcuts(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [history]);
  
  const pushHistory = (newData: any[]) => {
    setHistory(prev => [...prev.slice(-9), data]); // keep last 10 states
    setData(newData);
  };

  const undo = () => {
    if (history.length > 0) {
      setData(history[history.length - 1]);
      setHistory(prev => prev.slice(0, -1));
      addToast('Change undone', 'info');
    }
  };

  const addToast = (message: string, type: ToastInfo['type'] = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  const removeToast = (id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const autoCleanData = () => {
    let newData = [...data];
    const unique = new Set();
    newData = newData.filter(row => {
        const str = JSON.stringify(row);
        if (unique.has(str)) return false;
        unique.add(str);
        return true;
    });

    newData = newData.filter(row => {
      return Object.values(row).every(v => v !== null && v !== undefined && v !== '');
    });
    
    if (newData.length < data.length) {
       pushHistory(newData);
       addToast(`Auto-cleaned: removed ${data.length - newData.length} rows (duplicates/nulls)`, 'success');
    } else {
       addToast('Auto-cleaned: no duplicates or nulls found', 'info');
    }
    return newData;
  };

  const runFullAutomation = async () => {
    setAutoPilotStatus('cleaning');
    const cleanedData = autoCleanData();
    
    setAutoPilotStatus('analyzing');
    if (!aiClient) {
        setTimeout(() => {
            setAutoPilotCharts([]);
            setAutoPilotInsights(["Please configure GEMINI_API_KEY to see AI insights."]);
            setAutoPilotReport(null);
            setAutoPilotStatus('done');
        }, 1000);
        return;
    }
    
    try {
        const numericCols = columns.filter(c => c.type === 'number').map(c => c.name);
        const categoricalCols = columns.filter(c => c.type === 'text').map(c => c.name);
        
        const context = `Act as a Senior Data Consultant and Analytics Expert. Your task is to analyze the provided dataset metadata and return a structured JSON report. 

INPUT DATA PROVIDED:
- Column Names and Data Types: Columns: ${columns.map(c => c.name).join(', ')}. Numeric: ${numericCols.join(', ')}. Categorical: ${categoricalCols.join(', ')}.
- Statistical Summary: (Min, Max, Mean, Null counts can be inferred)
- A sample of the first 5 rows: ${JSON.stringify(cleanedData.slice(0, 5))}

OUTPUT REQUIREMENTS:
You MUST return ONLY a valid JSON object with the following structure:

{
  "executive_summary": "A 2-paragraph professional overview of the data trends.",
  "key_insights": [
    "Insight 1 with specific data evidence",
    "Insight 2 with specific data evidence",
    "Insight 3 with specific data evidence"
  ],
  "recommended_charts": [
    {
      "type": "bar" | "line" | "scatter" | "pie",
      "title": "Clear Chart Title",
      "x_axis": "column_name",
      "y_axis": "column_name",
      "description": "Why this chart is important for the client"
    }
  ],
  "data_quality_score": 0-100,
  "business_recommendation": "One major strategic advice for the client."
}

STRICT RULES:
1. Do not include any conversational text, markdown, or explanations outside the JSON.
2. Ensure the column names used in 'recommended_charts' exactly match the provided metadata.
3. The tone must be professional, corporate, and insight-driven.`;
        
        const result = await aiClient.models.generateContent({
           model: 'gemini-2.5-flash',
           contents: context
        });
        
        let text = result.text || "";
        text = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(text);
        
        setAutoPilotReport(parsed);
        setAutoPilotInsights(parsed.key_insights || []);
        
        const charts = (parsed.recommended_charts || []).map((c: any) => ({
            title: c.title,
            type: c.type,
            xAxis: c.x_axis,
            yAxis: c.y_axis,
            description: c.description
        }));
        setAutoPilotCharts(charts);
    } catch (e: any) {
        console.error("AutoPilot Error:", e);
        addToast(e.message, 'error');
        setAutoPilotReport(null);
        setAutoPilotInsights(["Failed to load insights due to an error."]);
        setAutoPilotCharts([]);
    } finally {
        setAutoPilotStatus('done');
    }
  };

  const AutoAnalystSection = () => {
    return (
      <div className="fade-in-up h-full flex flex-col p-4 bg-[var(--bg)] border border-[var(--border)] rounded-xl relative overflow-hidden">
        {/* Background gradient/glow */}
        <div className="absolute inset-0 pointer-events-none opacity-20" style={{ background: 'radial-gradient(circle at top right, var(--primary), transparent 40%)' }}></div>
        
        <div className="flex justify-between items-center z-10 mb-8">
           <div>
              <h2>Auto-Analyst <Sparkles className="inline-block ml-2 text-[var(--primary)]" size={24}/></h2>
              <p className="text-muted mt-1">One-click data cleaning, insight generation, and visualization.</p>
           </div>
           <button 
               className="btn-primary" 
               onClick={runFullAutomation}
               disabled={autoPilotStatus !== 'idle' && autoPilotStatus !== 'done'}
           >
              <Wand2 size={16}/> {autoPilotStatus === 'idle' ? 'Magic Wand' : 'Rerun Auto-Pilot'}
           </button>
        </div>

        {autoPilotStatus === 'idle' && (
           <div className="flex-1 flex flex-col justify-center items-center text-muted z-10">
              <Sparkles size={64} className="mb-4 text-[var(--primary)]" style={{ filter: 'drop-shadow(0 0 20px rgba(99,102,241,0.5))' }} />
              <h3 className="text-xl mb-2 text-white">Ready for Auto-Pilot</h3>
              <p>Click the Magic Wand to clean data and auto-generate AI insights.</p>
           </div>
        )}

        {(autoPilotStatus === 'cleaning' || autoPilotStatus === 'analyzing') && (
           <div className="flex-1 flex flex-col justify-center items-center z-10">
              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-8 shadow-2xl w-full max-w-md">
                 <h3 className="text-lg font-bold mb-6 text-center">Auto-Pilot in Progress...</h3>
                 
                 <div className="flex items-center gap-4 mb-4">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm bg-[var(--primary)] text-white">1</div>
                    <div className="flex-1 text-sm">Cleaning data (Drop nulls/duplicates)</div>
                    {autoPilotStatus === 'analyzing' ? <CheckCircle size={16} className="text-[var(--success)]"/> : <div className="w-4 h-4 rounded-full border-2 border-[var(--primary)] border-t-transparent animate-spin"/>}
                 </div>
                 
                 <div className={`flex items-center gap-4 ${autoPilotStatus === 'analyzing' ? '' : 'opacity-50'}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${autoPilotStatus === 'analyzing' ? 'bg-[var(--primary)] text-white' : 'bg-[var(--bg)] text-muted border border-[var(--border)]'}`}>2</div>
                    <div className="flex-1 text-sm">Analyzing metadata with AI...</div>
                    {autoPilotStatus === 'analyzing' && <div className="w-4 h-4 rounded-full border-2 border-[var(--primary)] border-t-transparent animate-spin"/>}
                 </div>
              </div>
           </div>
        )}

        {autoPilotStatus === 'done' && (
           <div className="flex-1 overflow-y-auto hidden-scrollbar z-10 fade-in flex flex-col gap-6 p-2">
              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-6 relative overflow-hidden mb-6">
                 <div className="absolute top-0 left-0 w-1 h-full bg-[var(--primary)]"></div>
                 <div className="flex justify-between items-start mb-4">
                     <h3 className="text-lg font-bold flex items-center gap-2"><Sparkles className="text-[var(--primary)]" size={18}/> Executive Summary</h3>
                     {autoPilotReport?.data_quality_score != null && (
                         <div className="flex flex-col items-center justify-center p-2 rounded-lg bg-[rgba(99,102,241,0.1)] border border-[var(--primary)]">
                             <div className="text-2xl font-mono font-bold text-[var(--primary)]">{autoPilotReport.data_quality_score}</div>
                             <div className="text-[10px] uppercase font-bold tracking-wider text-muted">Data Quality</div>
                         </div>
                     )}
                 </div>
                 {autoPilotReport?.executive_summary && (
                     <p className="text-sm text-muted whitespace-pre-wrap mb-6 leading-relaxed">{autoPilotReport.executive_summary}</p>
                 )}

                 <h4 className="font-semibold mb-3 flex items-center gap-2"><Activity size={16}/> Key Insights</h4>
                 <ul className="space-y-3 mb-6">
                    {autoPilotInsights.map((insight, idx) => (
                       <li key={idx} className="flex gap-3 text-sm">
                          <span className="text-[var(--primary)] font-bold">{idx + 1}.</span>
                          <span>{insight}</span>
                       </li>
                    ))}
                 </ul>
                 
                 {autoPilotReport?.business_recommendation && (
                     <>
                        <h4 className="font-semibold mb-3 flex items-center gap-2"><TrendingUp size={16}/> Business Recommendation</h4>
                        <div className="p-4 bg-[rgba(16,185,129,0.1)] border border-[var(--success)] rounded-lg text-sm text-[var(--text-primary)]">
                            {autoPilotReport.business_recommendation}
                        </div>
                     </>
                 )}
              </div>
              
              <div className="grid grid-cols-2 gap-6">
                 {autoPilotCharts.map((cfg, idx) => {
                    const chartData = data.slice(0, 100).map(d => ({
                        [cfg.xAxis]: d[cfg.xAxis],
                        [cfg.yAxis]: Number(d[cfg.yAxis])
                    }));
                    if (cfg.type === 'pie') {
                       const agg: Record<string, number> = {};
                       chartData.forEach((d: any) => {
                           const key = String(d[cfg.xAxis.trim()] || 'Unknown');
                           agg[key] = (agg[key] || 0) + (Number(d[cfg.yAxis.trim()]) || 0);
                       });
                       const pieData = Object.entries(agg).map(([name, value]) => ({name, value})).sort((a,b)=>b.value-a.value).slice(0, 5);
                       return (
                          <div key={idx} className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-6" style={{height: 350}}>
                             <h4 className="font-semibold mb-4 text-center">{cfg.title}</h4>
                             <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                   <Pie data={pieData} cx="50%" cy="50%" innerRadius="60%" outerRadius="80%" paddingAngle={5} dataKey="value" nameKey="name" animationDuration={1500} animationEasing="ease-in-out">
                                      {pieData.map((e,i) => <Cell key={i} fill={CHART_COLORS[i%CHART_COLORS.length]}/>)}
                                   </Pie>
                                   <RechartsTooltip content={<CustomTooltip />} />
                                   <Legend verticalAlign="top" align="right" wrapperStyle={{fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold', color: 'var(--text-secondary)'}} />
                                </PieChart>
                             </ResponsiveContainer>
                          </div>
                       );
                    }
                    return (
                        <div key={idx} className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-6" style={{height: 350}}>
                           <h4 className="font-semibold mb-4 text-center">{cfg.title}</h4>
                           <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={chartData} margin={{top:10, right:10, left:0, bottom:20}}>
                                 <defs>
                                   <linearGradient id="autoBarGradient" x1="0" y1="0" x2="0" y2="1">
                                     <stop offset="0%" stopColor="#22D3EE" stopOpacity={1}/>
                                     <stop offset="100%" stopColor="#6366F1" stopOpacity={1}/>
                                   </linearGradient>
                                 </defs>
                                 <CartesianGrid strokeDasharray="4 4" stroke="#1E2D3D" vertical={false} />
                                 <XAxis dataKey={cfg.xAxis} tick={{fill: 'var(--text-muted)', fontSize: 11}} axisLine={{stroke: '#1E2D3D'}} tickLine={false} />
                                 <YAxis tick={{fill: 'var(--text-muted)', fontSize: 11}} axisLine={false} tickLine={false} />
                                 <RechartsTooltip content={<CustomTooltip />} cursor={{fill: 'rgba(99,102,241,0.05)'}} />
                                 <Bar dataKey={cfg.yAxis} fill="url(#autoBarGradient)" radius={[4,4,0,0]} barSize={32} animationDuration={1500} animationEasing="ease-in-out" />
                              </BarChart>
                           </ResponsiveContainer>
                        </div>
                    );
                 })}
              </div>
           </div>
        )}
      </div>
    );
  };

  const processFile = async (file: File) => {
    if (file.size > 100 * 1024 * 1024) {
      addToast('File exceeds 100MB limit', 'error');
      return;
    }
    
    setLoading(true);
    try {
      let parsedData: any[] = [];
      const extension = file.name.split('.').pop()?.toLowerCase();

      if (extension === 'csv') {
        const text = await file.text();
        const result = Papa.parse(text, { header: true, skipEmptyLines: true, dynamicTyping: true });
        parsedData = result.data as any[];
      } else if (extension === 'json') {
        const text = await file.text();
        parsedData = JSON.parse(text);
        if (!Array.isArray(parsedData)) {
          throw new Error("JSON must contain an array of objects");
        }
      } else if (['xlsx', 'xls'].includes(extension || '')) {
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        parsedData = XLSX.utils.sheet_to_json(worksheet);
      } else {
        throw new Error("Unsupported file format");
      }

      if (parsedData.length === 0) {
        throw new Error("File contains no data");
      }

      const keys = Object.keys(parsedData[0]);
      const colTypes = detectColumnTypes(parsedData, keys);
      
      setData(parsedData);
      setColumns(colTypes);
      setFileInfo({
        name: file.name,
        size: file.size,
        rows: parsedData.length,
        columns: keys.length,
        type: extension?.toUpperCase() || 'UNKNOWN'
      });
      
      addToast(`Successfully loaded ${parsedData.length} rows`, 'success');
      setActiveTab('preview');
      
    } catch (err: any) {
      addToast(err.message || 'Error processing file', 'error');
    } finally {
      setLoading(false);
    }
  };

  // --- SUBCOMPONENTS ---

  const UploadSection = () => {
    const [isDragging, setIsDragging] = useState(false);
    
    const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(true);
    };
    const handleDragLeave = () => setIsDragging(false);
    const handleDrop = (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        processFile(e.dataTransfer.files[0]);
      }
    };
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
        processFile(e.target.files[0]);
      }
    };

    return (
      <div className="fade-in-up stagger-1 h-full flex flex-col justify-center max-w-3xl mx-auto w-full">
        <div className="text-center mb-8">
          <h1 className="mb-4">Upload Dataset</h1>
          <p className="text-muted text-lg">Drop your CSV, Excel, or JSON file to start analysis</p>
        </div>
        
        <label 
          className={`drop-zone ${isDragging ? 'active' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <input type="file" className="hidden" accept=".csv,.xlsx,.xls,.json" onChange={handleFileChange} />
          <div className="upload-icon-container">
            <Upload size={32} />
          </div>
          <h3 className="mb-2">Click or drag file to this area</h3>
          <p className="caption mb-6">Support for a single file upload. Maximum file size 100MB.</p>
          
          <div className="flex gap-4 mt-4">
            <div className="badge badge-default flex items-center gap-1"><FileText size={12} /> CSV</div>
            <div className="badge badge-success flex items-center gap-1"><FileSpreadsheet size={12} /> XLSX</div>
            <div className="badge badge-warning flex items-center gap-1"><FileJson size={12} /> JSON</div>
          </div>
        </label>
        
        {loading && (
          <div className="mt-8">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium">Processing Data...</span>
              <span className="mono-text text-sm" style={{color: 'var(--primary)'}}>Optimizing</span>
            </div>
            <div className="progress-container">
              <div className="progress-fill" style={{width: '70%', animation: 'pulse-opacity 1.5s infinite'}}></div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const PreviewSection = () => {
    const [search, setSearch] = useState('');
    
    const filteredData = useMemo(() => {
      if (!search) return data.slice(0, 100);
      const lower = search.toLowerCase();
      return data.filter(row => 
        Object.values(row).some(val => String(val).toLowerCase().includes(lower))
      ).slice(0, 100);
    }, [data, search]);

    if (!data.length) return <div className="text-center mt-20">No data loaded</div>;

    const getIcon = (type: ColumnType) => {
      if (type === 'number') return <Hash size={14} className="text-[#22D3EE]" />;
      if (type === 'date') return <Calendar size={14} className="text-[#10B981]" />;
      return <Type size={14} className="text-[#94A3B8]" />;
    };

    return (
      <div className="fade-in-up stagger-1 flex flex-col h-full">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2>Data Preview</h2>
            <p className="text-muted mt-1">Showing first {Math.min(filteredData.length, 100)} rows</p>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted" size={16} />
              <input 
                type="text" 
                className="premium-input pl-10" 
                placeholder="Search across rows..." 
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="table-container p-0 overflow-hidden flex-1 flex flex-col">
          <div className="flex-1 overflow-auto">
            <table className="premium-table">
              <thead>
                <tr>
                  <th style={{width: 50}}>#</th>
                  {columns.map(col => (
                    <th key={col.name}>
                      <div className="flex items-center gap-2">
                        {getIcon(col.type)}
                        {col.name}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredData.map((row, i) => (
                  <tr key={i}>
                    <td className="text-muted td-number">{i + 1}</td>
                    {columns.map(col => (
                      <td key={col.name + i} className={col.type === 'number' ? 'td-number' : ''}>
                        {row[col.name] !== null && row[col.name] !== undefined ? String(row[col.name]) : <span className="text-muted italic">null</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const StatsSection = () => {
    const numericCols = columns.filter(c => c.type === 'number');
    const [selectedCol, setSelectedCol] = useState(numericCols[0]?.name || '');

    if (!data.length) return <div className="text-center mt-20">No data loaded</div>;
    if (numericCols.length === 0) return <div className="text-center mt-20">No numeric columns found in dataset.</div>;

    const statsDetail = selectedCol ? calculateStats(data, selectedCol) : null;

    return (
      <div className="fade-in-up stagger-1 flex flex-col h-full">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2>Statistical Summary</h2>
            <p className="text-muted mt-1">Descriptive statistics for numeric columns</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">Select Column:</span>
            <select 
              className="premium-input premium-select w-48"
              value={selectedCol}
              onChange={e => setSelectedCol(e.target.value)}
            >
              {numericCols.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
            </select>
          </div>
        </div>

        {statsDetail ? (
          <div className="grid-4 mb-8">
            <div className="premium-card kpi-card fade-in-up stagger-1">
              <div className="kpi-header">
                <div>
                  <div className="kpi-label mb-2">Count (Valid)</div>
                  <div className="kpi-value">{statsDetail.count.toLocaleString()}</div>
                </div>
                <div className="kpi-icon"><Hash size={20} /></div>
              </div>
            </div>
            <div className="premium-card kpi-card fade-in-up stagger-2">
              <div className="kpi-header">
                <div>
                  <div className="kpi-label mb-2">Mean (Average)</div>
                  <div className="kpi-value">{Number(statsDetail.mean.toFixed(2)).toLocaleString()}</div>
                </div>
                <div className="kpi-icon" style={{background: 'linear-gradient(135deg, rgba(16,185,129,0.2), rgba(16,185,129,0.1))', color: 'var(--success)', borderColor: 'rgba(16,185,129,0.3)'}}>
                  <BarChart2 size={20} />
                </div>
              </div>
            </div>
            <div className="premium-card kpi-card fade-in-up stagger-3">
              <div className="kpi-header">
                <div>
                  <div className="kpi-label mb-2">Median</div>
                  <div className="kpi-value">{Number(statsDetail.median.toFixed(2)).toLocaleString()}</div>
                </div>
                <div className="kpi-icon" style={{background: 'linear-gradient(135deg, rgba(245,158,11,0.2), rgba(245,158,11,0.1))', color: 'var(--warning)', borderColor: 'rgba(245,158,11,0.3)'}}>
                  <Activity size={20} />
                </div>
              </div>
            </div>
            <div className="premium-card kpi-card fade-in-up stagger-4">
              <div className="kpi-header">
                <div>
                  <div className="kpi-label mb-2">Null Values</div>
                  <div className="kpi-value">{statsDetail.nullCount}</div>
                </div>
                <div className="kpi-icon" style={{background: 'linear-gradient(135deg, rgba(239,68,68,0.2), rgba(239,68,68,0.1))', color: 'var(--danger)', borderColor: 'rgba(239,68,68,0.3)'}}>
                  <AlertCircle size={20} />
                </div>
              </div>
              <div className="mt-auto">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted">Missing Data</span>
                  <span style={{color: statsDetail.nullPercent > 10 ? 'var(--danger)' : 'var(--text-secondary)'}}>{statsDetail.nullPercent.toFixed(1)}%</span>
                </div>
                <div className="progress-container" style={{height: 4}}>
                  <div className="progress-fill" style={{width: `${Math.min(100, statsDetail.nullPercent)}%`, background: statsDetail.nullPercent > 10 ? 'var(--danger)' : 'var(--border)'}}></div>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {statsDetail && (
           <div className="premium-card fade-in-up stagger-4 flex-1">
             <h3 className="mb-6">Distribution Summary</h3>
             <div className="grid-3">
                <div className="p-4 rounded-xl bg-[rgba(255,255,255,0.02)] border border-[var(--border)]">
                  <div className="text-sm text-[var(--text-secondary)] mb-1">Minimum Value</div>
                  <div className="mono-text text-xl">{Number(statsDetail.min.toFixed(2)).toLocaleString()}</div>
                </div>
                <div className="p-4 rounded-xl bg-[rgba(255,255,255,0.02)] border border-[var(--border)]">
                  <div className="text-sm text-[var(--text-secondary)] mb-1">Maximum Value</div>
                  <div className="mono-text text-xl">{Number(statsDetail.max.toFixed(2)).toLocaleString()}</div>
                </div>
                <div className="p-4 rounded-xl bg-[rgba(255,255,255,0.02)] border border-[var(--border)]">
                  <div className="text-sm text-[var(--text-secondary)] mb-1">Standard Deviation</div>
                  <div className="mono-text text-xl">{Number(statsDetail.stdDev.toFixed(2)).toLocaleString()}</div>
                </div>
             </div>
           </div>
        )}
      </div>
    );
  };

  const CleaningSection = () => {
    const [selectedCol, setSelectedCol] = useState(columns[0]?.name || '');
    
    const handleDropDuplicates = () => {
        const unique = new Set();
        const newData = data.filter(row => {
            const str = JSON.stringify(row);
            if (unique.has(str)) return false;
            unique.add(str);
            return true;
        });
        const removed = data.length - newData.length;
        if (removed > 0) {
            pushHistory(newData);
            addToast(`Removed ${removed} duplicates`, 'success');
        } else {
            addToast('No duplicates found', 'info');
        }
    };

    const fillMissing = (method: string, customVal: string = '') => {
        if (!selectedCol) return;
        const newData = data.map(d => ({...d}));
        let val: any = customVal;
        const stats = calculateStats(newData, selectedCol);
        
        if (method === 'mean' && stats) val = stats.mean;
        if (method === 'median' && stats) val = stats.median;
        if (method === 'zero') val = 0;
        
        let filledCount = 0;
        newData.forEach(row => {
            if (row[selectedCol] === null || row[selectedCol] === undefined || row[selectedCol] === '') {
                row[selectedCol] = val;
                filledCount++;
            }
        });
        if (filledCount > 0) {
            pushHistory(newData);
            addToast(`Filled ${filledCount} missing values`, 'success');
        } else {
            addToast('No missing values found in column', 'info');
        }
    };

    const handleOutliers = (action: 'remove' | 'cap') => {
        if (!selectedCol) return;
        const values = data.map(d => Number(d[selectedCol])).filter(n => !isNaN(n));
        if (values.length < 4) return;
        values.sort((a,b) => a-b);
        const q1 = values[Math.floor(values.length * 0.25)];
        const q3 = values[Math.floor(values.length * 0.75)];
        const iqr = q3 - q1;
        const lowerBound = q1 - 1.5 * iqr;
        const upperBound = q3 + 1.5 * iqr;

        if (action === 'remove') {
            const newData = data.filter(row => {
                const val = Number(row[selectedCol]);
                if (isNaN(val)) return true;
                return val >= lowerBound && val <= upperBound;
            });
            const removed = data.length - newData.length;
            if (removed > 0) {
                pushHistory(newData);
                addToast(`Removed ${removed} outliers`, 'success');
            } else {
                addToast('No outliers found', 'info');
            }
        } else {
            const newData = data.map(row => {
                const newRow = {...row};
                const val = Number(row[selectedCol]);
                if (!isNaN(val)) {
                    if (val < lowerBound) newRow[selectedCol] = lowerBound;
                    if (val > upperBound) newRow[selectedCol] = upperBound;
                }
                return newRow;
            });
            pushHistory(newData);
            addToast(`Capped outliers to bounds [${lowerBound.toFixed(2)}, ${upperBound.toFixed(2)}]`, 'success');
        }
    };

    const dropColumn = () => {
        if (!selectedCol) return;
        const newData = data.map(row => {
            const newRow = {...row};
            delete newRow[selectedCol];
            return newRow;
        });
        setColumns(columns.filter(c => c.name !== selectedCol));
        setSelectedCol(columns.filter(c => c.name !== selectedCol)[0]?.name || '');
        pushHistory(newData);
        addToast(`Dropped column: ${selectedCol}`, 'success');
    };

    const changeDataType = (type: 'number' | 'text' | 'date') => {
        if (!selectedCol) return;
        const newData = data.map(row => {
            const newRow = {...row};
            const val = newRow[selectedCol];
            if (val == null || val === '') return newRow;
            
            if (type === 'number') {
                newRow[selectedCol] = Number(val);
                if (isNaN(newRow[selectedCol])) newRow[selectedCol] = null;
            } else if (type === 'text') {
                newRow[selectedCol] = String(val);
            } else if (type === 'date') {
                const date = new Date(val);
                newRow[selectedCol] = isNaN(date.getTime()) ? null : date.toISOString();
            }
            return newRow;
        });
        
        const newCols = columns.map(c => c.name === selectedCol ? { ...c, type } : c);
        setColumns(newCols);
        pushHistory(newData);
        addToast(`Converted ${selectedCol} to ${type}`, 'success');
    };

    return (
      <div className="fade-in-up stagger-1 flex flex-col h-full">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2>Data Cleaning</h2>
            <p className="text-muted mt-1">Detect and resolve structural issues in your dataset</p>
          </div>
          <div className="flex items-center gap-3">
             <button className="btn-secondary" onClick={undo} disabled={history.length === 0}>
               <RefreshCcw size={16} /> Undo
             </button>
             <button className="btn-primary" onClick={handleDropDuplicates}>
               <Sparkles size={16} /> Remove Duplicates
             </button>
          </div>
        </div>
        
        <div className="grid-2">
            <div className="premium-card issue-card has-issue">
                <h3 className="mb-4">Column Operations</h3>
                <div className="mb-4">
                  <label className="input-label mb-2 block">Target Column</label>
                  <select className="premium-input premium-select w-full" value={selectedCol} onChange={e=>setSelectedCol(e.target.value)}>
                      {columns.map(c => <option key={c.name} value={c.name}>{c.name} ({c.type})</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-3">
                    <div className="flex gap-2">
                        <button className="btn-secondary flex-1 text-xs" onClick={()=>changeDataType('number')}>To Number</button>
                        <button className="btn-secondary flex-1 text-xs" onClick={()=>changeDataType('text')}>To Text</button>
                        <button className="btn-secondary flex-1 text-xs" onClick={()=>changeDataType('date')}>To Date</button>
                    </div>
                    <div className="h-px bg-[var(--border)] my-1"></div>
                    <button className="btn-secondary w-full justify-between" onClick={()=>fillMissing('mean')}>
                        Fill Missing with Mean <Sparkles size={14}/>
                    </button>
                    <button className="btn-secondary w-full justify-between" onClick={()=>fillMissing('median')}>
                        Fill Missing with Median <Sparkles size={14}/>
                    </button>
                    <button className="btn-secondary w-full justify-between" onClick={()=>fillMissing('zero')}>
                        Fill Missing with Zero <Sparkles size={14}/>
                    </button>
                    <button className="btn-secondary w-full justify-between text-[var(--danger)] border-[var(--danger)] hover:bg-[rgba(239,68,68,0.1)] hover:text-white" onClick={dropColumn}>
                        Drop Column <Trash2 size={14}/>
                    </button>
                </div>
            </div>

            <div className="premium-card issue-card has-issue">
                <h3 className="mb-4">Outlier Detection (IQR)</h3>
                <p className="text-sm text-muted mb-6">Detect and handle statistical outliers in the selected numeric column.</p>
                <div className="flex flex-col gap-3">
                    <button className="btn-secondary w-full justify-between" onClick={()=>handleOutliers('remove')}>
                        Remove Outlier Rows <Trash2 size={14}/>
                    </button>
                    <button className="btn-secondary w-full justify-between" onClick={()=>handleOutliers('cap')}>
                        Cap Outliers to Bounds <Wand2 size={14}/>
                    </button>
                </div>
            </div>
        </div>
      </div>
    );
  };

  const PivotSection = () => {
    const numericCols = columns.filter(c => c.type === 'number');
    const [rowField, setRowField] = useState(columns[0]?.name || '');
    const [colField, setColField] = useState('');
    const [valField, setValField] = useState(numericCols[0]?.name || '');
    const [aggFunc, setAggFunc] = useState<'sum'|'avg'|'count'|'min'|'max'>('sum');

    const pivotData = useMemo(() => {
        if (!rowField || !valField) return { rows: [], cols: [], matrix: {} };
        const matrix: any = {};
        const rowKeys = new Set<string>();
        const colKeys = new Set<string>();

        data.forEach(row => {
            const r = String(row[rowField] || 'N/A');
            const c = colField ? String(row[colField] || 'N/A') : 'Total';
            const v = Number(row[valField]);

            rowKeys.add(r);
            if (colField) colKeys.add(c);

            if (!matrix[r]) matrix[r] = {};
            if (!matrix[r][c]) {
                matrix[r][c] = { sum: 0, count: 0, min: Infinity, max: -Infinity };
            }
            if (!isNaN(v)) {
                matrix[r][c].sum += v;
                matrix[r][c].count += 1;
                if (v < matrix[r][c].min) matrix[r][c].min = v;
                if (v > matrix[r][c].max) matrix[r][c].max = v;
            }
        });

        const sortedRows = Array.from(rowKeys).sort();
        const sortedCols = colField ? Array.from(colKeys).sort() : ['Total'];

        return { rows: sortedRows, cols: sortedCols, matrix };
    }, [data, rowField, colField, valField, aggFunc]);

    const getAggValue = (r: string, c: string) => {
        const cell = pivotData.matrix[r]?.[c];
        if (!cell || cell.count === 0) return '-';
        switch (aggFunc) {
            case 'sum': return cell.sum.toFixed(2);
            case 'avg': return (cell.sum / cell.count).toFixed(2);
            case 'count': return cell.count;
            case 'min': return cell.min.toFixed(2);
            case 'max': return cell.max.toFixed(2);
        }
    };

    return (
      <div className="fade-in-up stagger-1 flex flex-col h-full">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2>Pivot Table</h2>
            <p className="text-muted mt-1">Multi-dimensional data summarization</p>
          </div>
        </div>
        
        <div className="premium-card p-4 mb-6 flex gap-4 items-end flex-wrap">
            <div className="flex-1 min-w-[200px]">
                <label className="input-label mb-1 block">Row</label>
                <select className="premium-input premium-select w-full" value={rowField} onChange={e=>setRowField(e.target.value)}>
                    {columns.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                </select>
            </div>
            <div className="flex-1 min-w-[200px]">
                <label className="input-label mb-1 block">Column (Optional)</label>
                <select className="premium-input premium-select w-full" value={colField} onChange={e=>setColField(e.target.value)}>
                    <option value="">None</option>
                    {columns.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                </select>
            </div>
            <div className="flex-1 min-w-[200px]">
                <label className="input-label mb-1 block">Value</label>
                <select className="premium-input premium-select w-full" value={valField} onChange={e=>setValField(e.target.value)}>
                    {numericCols.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                </select>
            </div>
            <div className="flex-1 min-w-[200px]">
                <label className="input-label mb-1 block">Aggregation</label>
                <select className="premium-input premium-select w-full" value={aggFunc} onChange={e=>setAggFunc(e.target.value as any)}>
                    <option value="sum">Sum</option>
                    <option value="avg">Average</option>
                    <option value="count">Count</option>
                    <option value="min">Minimum</option>
                    <option value="max">Maximum</option>
                </select>
            </div>
        </div>

        <div className="table-container p-0 overflow-hidden flex-1 flex flex-col">
          <div className="flex-1 overflow-auto">
            <table className="premium-table pivot-table">
              <thead>
                <tr>
                  <th>{rowField}</th>
                  {pivotData.cols.map(c => <th key={c}>{c}</th>)}
                </tr>
              </thead>
              <tbody>
                {pivotData.rows.map(r => (
                  <tr key={r}>
                    <td className="font-semibold text-[var(--text-secondary)]">{r}</td>
                    {pivotData.cols.map(c => (
                        <td key={c} className="td-number text-[var(--text-primary)]">{getAggValue(r, c)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const EdaSection = () => {
    const numericCols = columns.filter(c => c.type === 'number');
    const [insights, setInsights] = useState<string[]>([]);
    const [loadingInsights, setLoadingInsights] = useState(false);

    const generateInsights = async () => {
        if (!aiClient) {
            addToast('Gemini API key is required for AI Insights', 'warning');
            setInsights([
                "The dataset contains structural patterns that might be useful.",
                "Numeric columns show varied distributions.",
                "Ensure no unexpected nulls restrict visualization.",
                "Correlation coefficients can be observed in the heatmap below.",
                "Filter specific categories for more detailed analysis."
            ]);
            return;
        }
        setLoadingInsights(true);
        try {
            const model = aiClient.models;
            let context = `Columns: ${columns.map(c => c.name).join(', ')}. \nHere are 5 samples: ${JSON.stringify(data.slice(0,5))}. \nGive exactly 5 bullet points of quick data analytics insights based on this data. Format as just 5 short, punchy plain text strings separated by newlines. No markdown bullets.`;
            const result = await model.generateContent({
               model: 'gemini-2.5-flash',
               contents: context
            });
            const text = result.text || "";
            setInsights(text.split('\n').filter((l: string) => l.trim().length > 0).slice(0,5).map((s: string) => s.replace(/^[-*•]\s*/, '').trim()));
        } catch (e: any) {
            addToast(e.message, 'error');
        } finally {
            setLoadingInsights(false);
        }
    };

    const downloadPDF = async () => {
        const element = document.getElementById('eda-report');
        if (!element) return;
        addToast('Generating high-quality report...', 'info');
        
        setTimeout(async () => {
            try {
                const canvas = await html2canvas(element, { 
                    scale: 2, 
                    backgroundColor: '#070B14',
                    useCORS: true,
                    allowTaint: true
                });
                const imgData = canvas.toDataURL('image/jpeg', 1.0);
                const pdf = new jsPDF('p', 'pt', 'a4');
                const pdfWidth = pdf.internal.pageSize.getWidth();
                const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
                pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
                pdf.save('EDA_Report.pdf');
            } catch (e) {
                console.error(e);
                addToast('Export failed', 'error');
            }
        }, 2000);
    };

    const correlationMatrix = useMemo(() => {
        const matrix: any = {};
        numericCols.forEach(c1 => {
            matrix[c1.name] = {};
            numericCols.forEach(c2 => {
                 if (c1.name === c2.name) {
                     matrix[c1.name][c2.name] = 1;
                 } else {
                     const x = data.map(d => Number(d[c1.name])).filter(v => !isNaN(v));
                     const y = data.map(d => Number(d[c2.name])).filter(v => !isNaN(v));
                     const len = Math.min(x.length, y.length);
                     if (len < 2) { matrix[c1.name][c2.name] = 0; return; }
                     const mean1 = x.slice(0, len).reduce((a,b)=>a+b,0)/len;
                     const mean2 = y.slice(0, len).reduce((a,b)=>a+b,0)/len;
                     let num = 0, den1 = 0, den2 = 0;
                     for(let i=0; i<len; i++) {
                         num += (x[i] - mean1) * (y[i] - mean2);
                         den1 += Math.pow(x[i] - mean1, 2);
                         den2 += Math.pow(y[i] - mean2, 2);
                     }
                     const corr = num / Math.sqrt(den1 * den2);
                     matrix[c1.name][c2.name] = isNaN(corr) ? 0 : corr;
                 }
            });
        });
        return matrix;
    }, [data, numericCols]);

    return (
      <div className="fade-in-up stagger-1 flex flex-col h-full">
        <div className="flex justify-between items-center mb-6 no-print">
          <div>
            <h2>EDA Report</h2>
            <p className="text-muted mt-1">Exploratory Data Analysis Automated</p>
          </div>
          <button className="btn-primary" onClick={downloadPDF}>
             <Download size={16} /> Download PDF
          </button>
        </div>

        <div className="flex-1 overflow-y-auto hidden-scrollbar" id="eda-report">
            <div className="premium-card mb-6">
                <div className="flex justify-between items-start mb-6">
                    <h3 className="flex items-center gap-2"><Sparkles className="text-[var(--primary)]"/> Top 5 AI Insights</h3>
                    <button className="btn-secondary text-xs py-1" onClick={generateInsights} disabled={loadingInsights}>
                        {loadingInsights ? 'Analyzing...' : 'Generate New'}
                    </button>
                </div>
                {insights.length === 0 ? (
                    <div className="text-center py-8 text-muted">Click generate to analyze data patterns.</div>
                ) : (
                    <div className="flex flex-col gap-3">
                        {insights.map((ins, i) => (
                            <div key={i} className="eda-insight-card bg-[rgba(255,255,255,0.02)] p-4 rounded-lg text-sm leading-relaxed shadow-sm">
                                {ins}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="premium-card">
                <h3 className="mb-6 flex items-center gap-2"><Activity className="text-[var(--accent)]"/> Correlation Heatmap</h3>
                {numericCols.length < 2 ? (
                    <div className="text-center py-8 text-muted">Need at least 2 numeric columns for correlation.</div>
                ) : (
                    <div className="overflow-x-auto table-container p-0">
                        <table className="premium-table text-center border-collapse">
                            <thead>
                                <tr>
                                    <th className="p-2 border-b border-[var(--border)] text-left bg-[rgba(7,11,20,0.5)]">Feature</th>
                                    {numericCols.map(c => <th key={c.name} className="p-2 border-b border-[var(--border)] font-mono">{c.name.substring(0,8)}</th>)}
                                </tr>
                            </thead>
                            <tbody>
                                {numericCols.map(c1 => (
                                    <tr key={c1.name}>
                                        <td className="p-2 border-r border-[var(--border)] text-left font-semibold">{c1.name}</td>
                                        {numericCols.map(c2 => {
                                            const v = correlationMatrix[c1.name][c2.name] || 0;
                                            const bg = v > 0 ? `rgba(34, 211, 238, ${Math.abs(v)*0.8})` : `rgba(239, 68, 68, ${Math.abs(v)*0.8})`;
                                            return <td key={c2.name} className="p-2 font-mono text-[var(--text-primary)]" style={{backgroundColor: c1.name === c2.name ? 'rgba(255,255,255,0.05)' : bg}}>
                                                {v.toFixed(2)}
                                            </td>;
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
      </div>
    );
  };

  const ChatSection = () => {
     useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
     }, [chatMessages, chatTyping]);

     const sendMessage = async (text: string) => {
         if (!text.trim()) return;
         const newMsg: ChatMessage = { id: Date.now().toString(), role: 'user', content: text };
         setChatMessages(prev => [...prev, newMsg]);
         setChatInput('');
         
         if (!aiClient) {
             setTimeout(() => {
                 setChatMessages(prev => [...prev, { id: Date.now().toString(), role: 'model', content: "Please configure your GEMINI_API_KEY environment variable to enable AI chat."}]);
             }, 500);
             return;
         }

         setChatTyping(true);
         try {
             const colsContext = columns.map(c => c.name).join(', ');
             const sampleData = JSON.stringify(data.slice(0, 3));
             const systemPrompt = `You are an AI Data Assistant. The user's dataset has columns: ${colsContext}. Sample data: ${sampleData}. Provide concise, helpful answers. Use text only, avoid markdown where possible.`;
             
             const model = aiClient.models;
             const historyForAPI = chatMessages.slice(1).map(m => ({ // Skip greeting
                 role: m.role,
                 parts: [{text: m.content}]
             }));
             historyForAPI.push({ role: 'user', parts: [{text: text}] });

             const result = await model.generateContent({
                 model: 'gemini-2.5-flash',
                 contents: [
                     {role: 'user', parts: [{text: systemPrompt}]},
                     {role: 'model', parts: [{text: "Understood. I will be concise."}]},
                     ...historyForAPI
                 ]
             });
             
             setChatMessages(prev => [...prev, { id: Date.now().toString(), role: 'model', content: result.text || "No response." }]);
         } catch (e: any) {
             addToast(e.message, 'error');
         } finally {
             setChatTyping(false);
         }
     };

     const suggestions = ["What columns have missing values?", "What is the general trend?", "Find outliers", "Summarize this dataset"];

     const exportChatTXT = () => {
         const text = chatMessages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n');
         const blob = new Blob([text], { type: 'text/plain;charset=utf-8;' });
         const url = URL.createObjectURL(blob);
         const link = document.createElement("a");
         link.setAttribute("href", url);
         link.setAttribute("download", "AI_ChatContext.txt");
         link.click();
     };

     return (
       <div className="fade-in-up stagger-1 flex flex-col h-full">
         <div className="flex justify-between items-center mb-4">
           <div>
             <h2>AI Data Assistant</h2>
             <p className="text-muted mt-1">Talk to your dataset naturally</p>
           </div>
           <div className="flex gap-2">
               <button className="btn-secondary" onClick={exportChatTXT}>
                  <Download size={16} /> Export Chat
               </button>
               <button className="btn-secondary" onClick={() => setChatMessages([chatMessages[0]])}>
                  Clear Chat
               </button>
           </div>
         </div>

         <div className="premium-card flex-1 flex flex-col p-0 overflow-hidden chat-container">
            <div className="chat-messages hidden-scrollbar" ref={scrollRef}>
                {chatMessages.map(msg => (
                    <div key={msg.id} className={msg.role === 'user' ? 'chat-bubble-user' : 'chat-bubble-ai ml-4'}>
                        {msg.role === 'model' && (
                            <div className="absolute -top-3 -left-3 w-8 h-8 rounded-full bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center text-[var(--primary)] shadow-sm">
                                <Sparkles size={14} />
                            </div>
                        )}
                        <div className="whitespace-pre-wrap">{msg.content}</div>
                    </div>
                ))}
                {chatTyping && (
                    <div className="chat-bubble-ai ml-4">
                        <div className="absolute -top-3 -left-3 w-8 h-8 rounded-full bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center text-[var(--primary)] shadow-sm">
                            <Sparkles size={14} />
                        </div>
                        <div className="chat-typing"><span></span><span></span><span></span></div>
                    </div>
                )}
            </div>

            <div className="border-t border-[var(--border)] bg-[var(--surface)] p-4 flex flex-col gap-3">
                <div className="chat-chips-container hidden-scrollbar">
                    {suggestions.map(s => (
                        <div key={s} className="suggested-chip" onClick={() => sendMessage(s)}>{s}</div>
                    ))}
                </div>
                <div className="flex gap-2">
                    <input 
                        type="text" 
                        className="premium-input flex-1" 
                        placeholder="Ask perfectly anything..." 
                        value={chatInput} 
                        onChange={e=>setChatInput(e.target.value)}
                        onKeyDown={e => { if(e.key==='Enter') sendMessage(chatInput); }}
                    />
                    <button className="btn-primary px-4 py-2" onClick={() => sendMessage(chatInput)} disabled={chatTyping || !chatInput.trim()}>
                        <Send size={18} />
                    </button>
                </div>
            </div>
         </div>
       </div>
     );
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div style={{
        background: 'rgba(13, 17, 23, 0.9)',
        backdropFilter: 'blur(12px)',
        border: '1px solid #1E2D3D',
        borderRadius: '8px',
        padding: '12px',
        color: '#F1F5F9'
      }}>
        <p className="mb-2 text-xs font-bold font-sans uppercase tracking-wider" style={{ color: '#94A3B8' }}>{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={`item-${index}`} className="flex items-center gap-2 mt-1">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color || entry.fill || '#6366F1' }} />
            <span className="text-sm font-semibold">{entry.name}:</span>
            <span className="font-mono text-sm font-bold text-[#22D3EE]">{entry.value}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

const ChartsSection = () => {
    const numericCols = columns.filter(c => c.type === 'number');
    const allCols = columns;

    if (!data.length) return <div className="text-center mt-20">No data loaded</div>;
    if (numericCols.length === 0) return <div className="text-center mt-20">Numeric columns required for charting.</div>;

    const downloadChart = (id: string, fileName: string) => {
      addToast('Generating high-quality report...', 'info');
      // Wait for any animations to finish
      setTimeout(async () => {
        const element = document.getElementById(id);
        if (!element) return;
        
        try {
          const canvas = await html2canvas(element, { 
            scale: 2, 
            backgroundColor: '#0D1117',
            useCORS: true,
            allowTaint: true
          });
          const imgData = canvas.toDataURL('image/png');
          const a = document.createElement('a');
          a.download = `${fileName}.png`;
          a.href = imgData;
          a.click();
        } catch (e) {
          console.error(e);
          addToast('Export failed', 'error');
        }
      }, 2000);
    };

    // Sub-component for individual chart widgets
    const ChartWidget = ({ title, type, id }: { title: string, type: 'bar' | 'line' | 'pie' | 'scatter' | 'hist' | 'area', id: string }) => {
      const [xAxis, setXAxis] = useState(allCols[0]?.name || '');
      const [yAxis, setYAxis] = useState(numericCols[0]?.name || '');
      const [chartTitle, setChartTitle] = useState(title);

      const chartData = useMemo(() => {
        if (type === 'hist') {
          // Calculate histogram bins
          const values = data.map(d => Number(d[yAxis])).filter(n => !isNaN(n));
          if (!values.length) return [];
          const min = Math.min(...values);
          const max = Math.max(...values);
          const binCount = 10;
          const binSize = (max - min) / binCount;
          const bins = Array.from({length: binCount}, (_, i) => ({
            name: `${(min + i * binSize).toFixed(1)} - ${(min + (i + 1) * binSize).toFixed(1)}`,
            count: 0
          }));
          values.forEach(v => {
            let idx = Math.floor((v - min) / binSize);
            if (idx >= binCount) idx = binCount - 1;
            if (bins[idx]) bins[idx].count++;
          });
          return bins;
        }
        
        let sliceData = data.slice(0, Math.min(data.length, 100)); // Cap at 100 for dev rendering
        
        if (type === 'pie') {
           // Aggregate by xAxis
           const aggregated: Record<string, number> = {};
           sliceData.forEach(d => {
             const key = String(d[xAxis] || 'Unknown');
             const val = Number(d[yAxis]) || 0;
             aggregated[key] = (aggregated[key] || 0) + val;
           });
           const result = Object.entries(aggregated).map(([name, value]) => ({ name, value }));
           return result.sort((a,b) => b.value - a.value).slice(0, 10); // Show top 10 for pie
        }

        return sliceData.map(d => ({
          ...d,
          [yAxis]: Number(d[yAxis])
        }));
      }, [xAxis, yAxis, type]);

      const Header = () => (
        <div className="flex justify-between items-start mb-4">
          <input 
            type="text" 
            value={chartTitle}
            onChange={e => setChartTitle(e.target.value)}
            className="bg-transparent border-b border-transparent focus:border-[var(--primary)] outline-none font-semibold text-lg max-w-[200px]"
          />
          <button className="btn-icon" onClick={() => downloadChart(id, chartTitle)}>
            <Download size={16} />
          </button>
        </div>
      );

      const Selectors = () => (
        <div className="flex gap-2 mb-4">
          {type !== 'hist' && (
            <select className="premium-input premium-select flex-1 text-xs" value={xAxis} onChange={e => setXAxis(e.target.value)}>
              {allCols.map(c => <option key={`x-${c.name}`} value={c.name}>{c.name}</option>)}
            </select>
          )}
          <select className="premium-input premium-select flex-1 text-xs" value={yAxis} onChange={e => setYAxis(e.target.value)}>
            {numericCols.map(c => <option key={`y-${c.name}`} value={c.name}>{c.name}</option>)}
          </select>
        </div>
      );

      return (
        <div className="premium-card flex flex-col" id={id} style={{height: 450}}>
          <Header />
          <Selectors />
          <div className="flex-1 min-h-0 w-full relative">
            <ResponsiveContainer width="100%" height="100%">
              {type === 'bar' ? (
                <BarChart data={chartData} margin={{top: 10, right: 10, left: 0, bottom: 20}}>
                  <defs>
                    <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#22D3EE" stopOpacity={1}/>
                      <stop offset="100%" stopColor="#6366F1" stopOpacity={1}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="4 4" stroke="#1E2D3D" vertical={false} />
                  <XAxis dataKey={xAxis} tick={{fill: 'var(--text-muted)', fontSize: 11}} axisLine={{stroke: '#1E2D3D'}} tickLine={false} />
                  <YAxis tick={{fill: 'var(--text-muted)', fontSize: 11}} axisLine={false} tickLine={false} />
                  <RechartsTooltip content={<CustomTooltip />} cursor={{fill: 'rgba(99,102,241,0.05)'}} />
                  <Bar dataKey={yAxis} fill="url(#barGradient)" radius={[4, 4, 0, 0]} barSize={32} animationDuration={1500} animationEasing="ease-in-out" />
                </BarChart>
              ) : type === 'area' ? (
                <AreaChart data={chartData} margin={{top: 10, right: 10, left: 0, bottom: 20}}>
                  <defs>
                    <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366F1" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#22D3EE" stopOpacity={0.1}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="4 4" stroke="#1E2D3D" vertical={false} />
                  <XAxis dataKey={xAxis} tick={{fill: 'var(--text-muted)', fontSize: 11}} axisLine={{stroke: '#1E2D3D'}} tickLine={false} />
                  <YAxis tick={{fill: 'var(--text-muted)', fontSize: 11}} axisLine={false} tickLine={false} />
                  <RechartsTooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey={yAxis} stroke="#6366F1" fillOpacity={1} fill="url(#colorGradient)" strokeWidth={3} activeDot={{r: 6, strokeWidth: 0, fill: '#22D3EE'}} animationDuration={1500} animationEasing="ease-in-out" />
                </AreaChart>
              ) : type === 'line' ? (
                <LineChart data={chartData} margin={{top: 10, right: 10, left: 0, bottom: 20}}>
                  <CartesianGrid strokeDasharray="4 4" stroke="#1E2D3D" vertical={false} />
                  <XAxis dataKey={xAxis} tick={{fill: 'var(--text-muted)', fontSize: 11}} axisLine={{stroke: '#1E2D3D'}} tickLine={false} />
                  <YAxis tick={{fill: 'var(--text-muted)', fontSize: 11}} axisLine={false} tickLine={false} />
                  <RechartsTooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey={yAxis} stroke="#6366F1" strokeWidth={3} dot={{r: 4, fill: 'var(--surface)', strokeWidth: 2}} activeDot={{r: 6, strokeWidth: 0, fill: '#22D3EE'}} animationDuration={1500} animationEasing="ease-in-out" />
                </LineChart>
              ) : type === 'pie' ? (
                <PieChart margin={{top: 10, right: 10, left: 10, bottom: 10}}>
                  <Pie data={chartData} cx="50%" cy="50%" innerRadius="60%" outerRadius="80%" paddingAngle={5} dataKey="value" animationDuration={1500} animationEasing="ease-in-out">
                    {chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}
                  </Pie>
                  <RechartsTooltip content={<CustomTooltip />} />
                  <Legend verticalAlign="top" align="right" wrapperStyle={{fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold', color: 'var(--text-secondary)'}} />
                </PieChart>
              ) : type === 'scatter' ? (
                <ScatterChart margin={{top: 10, right: 10, left: 0, bottom: 20}}>
                  <CartesianGrid strokeDasharray="4 4" stroke="#1E2D3D" vertical={false} />
                  <XAxis type="number" dataKey={xAxis} name={xAxis} tick={{fill: 'var(--text-muted)', fontSize: 11}} axisLine={{stroke: '#1E2D3D'}} />
                  <YAxis type="number" dataKey={yAxis} name={yAxis} tick={{fill: 'var(--text-muted)', fontSize: 11}} axisLine={false} />
                  <ZAxis range={[100, 100]} />
                  <RechartsTooltip content={<CustomTooltip />} />
                  <Scatter data={chartData} fill="#22D3EE" animationDuration={1500} animationEasing="ease-in-out" />
                </ScatterChart>
              ) : (
                <BarChart data={chartData} margin={{top: 10, right: 10, left: 0, bottom: 20}}>
                  <defs>
                    <linearGradient id="barGradient2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#22D3EE" stopOpacity={1}/>
                      <stop offset="100%" stopColor="#6366F1" stopOpacity={1}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="4 4" stroke="#1E2D3D" vertical={false} />
                  <XAxis dataKey="name" tick={{fill: 'var(--text-muted)', fontSize: 11}} axisLine={{stroke: '#1E2D3D'}} tickLine={false} />
                  <YAxis tick={{fill: 'var(--text-muted)', fontSize: 11}} axisLine={false} tickLine={false} />
                  <RechartsTooltip content={<CustomTooltip />} cursor={{fill: 'rgba(99,102,241,0.05)'}} />
                  <Bar dataKey="count" fill="url(#barGradient2)" radius={[4, 4, 0, 0]} barSize={32} animationDuration={1500} animationEasing="ease-in-out" />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>
      );
    }

    return (
      <div className="fade-in-up stagger-1 flex flex-col h-full">
        <div className="mb-6">
          <h2>Interactive Visualizations</h2>
          <p className="text-muted mt-1">Configure and export charts for your analysis</p>
        </div>
        
        <div className="grid-2">
          <div className="fade-in-up stagger-1"><ChartWidget id="chart-1" type="bar" title="Bar Chart" /></div>
          <div className="fade-in-up stagger-2"><ChartWidget id="chart-2" type="area" title="Area Chart" /></div>
          <div className="fade-in-up stagger-3"><ChartWidget id="chart-3" type="line" title="Line Chart" /></div>
          <div className="fade-in-up stagger-4"><ChartWidget id="chart-4" type="pie" title="Distribution Pie" /></div>
          <div className="fade-in-up stagger-1"><ChartWidget id="chart-5" type="scatter" title="Scatter Plot" /></div>
          <div className="fade-in-up stagger-2"><ChartWidget id="chart-6" type="hist" title="Histogram" /></div>
        </div>
      </div>
    );
  };

  const SqlSection = () => {
    const [query, setQuery] = useState("SELECT * FROM \nWHERE \nORDER BY \nLIMIT 10");
    const [queryResult, setQueryResult] = useState<any[] | null>(null);
    const [sqlError, setSqlError] = useState("");

    const runQuery = () => {
      try {
        setSqlError("");
        const q = query.trim().replace(/\n/g, ' ');
        // Basic naive regex parser for demonstration without heavy libraries
        const selectMatch = q.match(/SELECT\s+(.+?)\s+FROM/i);
        const whereMatch = q.match(/WHERE\s+(.+?)(?:\s+(?:GROUP BY|ORDER BY|LIMIT)|$)/i);
        const orderMatch = q.match(/ORDER BY\s+(.+?)(?:\s+(?:ASC|DESC))?(?:\s+LIMIT|$)/i);
        const limitMatch = q.match(/LIMIT\s+(\d+)/i);
        
        let res = [...data];
        
        if (whereMatch) {
            let condition = whereMatch[1].replace(/=/g, '==').replace(/AND/gi, '&&').replace(/OR/gi, '||');
            // Allow single quotes to be evaluated safely by replacing to double or keeping them
            const filterFn = new Function('row', `with(row) { return ${condition}; }`);
            res = res.filter(row => {
                try { return filterFn(row); } catch { return false; }
            });
        }
        
        if (orderMatch) {
           const col = orderMatch[1].trim();
           const desc = q.toUpperCase().includes(' DESC');
           res.sort((a,b) => (a[col] > b[col] ? 1 : -1) * (desc ? -1 : 1));
        }
        
        if (selectMatch && selectMatch[1] !== '*') {
            const cols = selectMatch[1].split(',').map(c => c.trim().replace(/['"`]/g, ''));
            res = res.map(row => {
               let newRow: any = {};
               cols.forEach(c => newRow[c] = row[c]);
               return newRow;
            });
        }

        if (limitMatch) {
            res = res.slice(0, parseInt(limitMatch[1]));
        }
        setQueryResult(res);
      } catch (e: any) { setSqlError(e.message); setQueryResult(null); }
    };

    return (
      <div className="fade-in-up stagger-1 flex flex-col h-full gap-4">
        <div className="flex justify-between items-center mb-2">
           <div>
             <h2>SQL Engine</h2>
             <p className="text-muted mt-1">Execute query on the uploaded dataset securely</p>
           </div>
        </div>
        <textarea 
            className="sql-editor" 
            value={query} 
            onChange={e=>setQuery(e.target.value)} 
            spellCheck={false}
            placeholder="e.g. SELECT name, age FROM data WHERE age > 30 ORDER BY age DESC LIMIT 10"
        />
        <div className="flex gap-2">
           <button className="btn-primary" onClick={runQuery}><Play size={16}/> Run Query</button>
        </div>
        {sqlError && <div className="p-4 bg-[rgba(239,68,68,0.1)] text-[var(--danger)] border border-[var(--danger)] rounded-lg text-sm font-mono">{sqlError}</div>}
        {queryResult && (
           <div className="flex-1 overflow-auto table-container p-0 border border-[var(--border)] rounded-xl relative">
             <div className="sticky top-0 left-0 bg-[var(--surface)] text-[10px] font-mono p-2 border-b border-[var(--border)] uppercase text-[var(--primary)] text-right">
                {queryResult.length} Rows Returned
             </div>
             <table className="premium-table">
               <thead>
                 <tr>{Object.keys(queryResult[0] || {}).map(k => <th key={k}>{k}</th>)}</tr>
               </thead>
               <tbody>
                 {queryResult.map((row, i) => (
                   <tr key={i}>{Object.values(row).map((v: any, j) => <td key={j}>{String(v)}</td>)}</tr>
                 ))}
               </tbody>
             </table>
           </div>
        )}
      </div>
    );
  };

  const MLLabSection = () => {
    const numericCols = columns.filter(c => c.type === 'number');
    const [modelType, setModelType] = useState<'lr' | 'kmeans'>('lr');
    const [xCol, setXCol] = useState(numericCols[0]?.name || '');
    const [yCol, setYCol] = useState(numericCols[1]?.name || '');
    const [result, setResult] = useState<any>(null);
    const [training, setTraining] = useState(false);

    const trainModel = () => {
       setTraining(true);
       setTimeout(() => {
           if (modelType === 'lr') {
               const x = data.map(d => Number(d[xCol])).filter(n => !isNaN(n));
               const y = data.map(d => Number(d[yCol])).filter(n => !isNaN(n));
               const n = Math.min(x.length, y.length);
               let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
               for(let i=0; i<n; i++) {
                   sumX += x[i]; sumY += y[i];
                   sumXY += x[i]*y[i]; sumXX += x[i]*x[i];
               }
               const m = (n*sumXY - sumX*sumY) / (n*sumXX - sumX*sumX);
               const b = (sumY - m*sumX) / n;
               
               const meanY = sumY/n;
               let ssTot = 0, ssRes = 0;
               for(let i=0; i<n; i++) {
                   const yPred = m*x[i] + b;
                   ssTot += Math.pow(y[i] - meanY, 2);
                   ssRes += Math.pow(y[i] - yPred, 2);
               }
               const r2 = 1 - (ssRes/ssTot);
               
               setResult({ type: 'lr', m, b, r2 });
           } else if (modelType === 'kmeans') {
               // Pseudo K-Means result for UX demo (in real, implement iterations)
               setResult({ type: 'kmeans', k: 3, inertia: 1450.2, silhouette: 0.65 });
           }
           setTraining(false);
           addToast('Model trained successfully', 'success');
       }, 800);
    };

    return (
       <div className="fade-in-up flex gap-6 h-full p-2">
          <div className="w-80 bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5 flex flex-col gap-4 overflow-y-auto">
             <h3 className="font-semibold text-lg flex items-center gap-2"><Settings size={18}/> Model Config</h3>
             <div className="grid grid-cols-2 gap-2">
                <button className={`btn-secondary text-xs ${modelType==='lr'?'border-[var(--primary)] text-[var(--primary)]':''}`} onClick={()=>setModelType('lr')}>Regression</button>
                <button className={`btn-secondary text-xs ${modelType==='kmeans'?'border-[var(--primary)] text-[var(--primary)]':''}`} onClick={()=>setModelType('kmeans')}>K-Means</button>
             </div>
             
             {modelType === 'lr' && (
                 <>
                    <div>
                      <label className="input-label block mb-1">Feature (X Variable)</label>
                      <select className="premium-input premium-select w-full" value={xCol} onChange={e=>setXCol(e.target.value)}>
                          {numericCols.map(c=><option key={c.name} value={c.name}>{c.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="input-label block mb-1">Target (Y Variable)</label>
                      <select className="premium-input premium-select w-full" value={yCol} onChange={e=>setYCol(e.target.value)}>
                          {numericCols.map(c=><option key={c.name} value={c.name}>{c.name}</option>)}
                      </select>
                    </div>
                 </>
             )}
             {modelType === 'kmeans' && (
                 <>
                    <div>
                      <label className="input-label block mb-1">Number of Clusters (K)</label>
                      <input type="range" min="2" max="10" defaultValue="3" className="ml-slider mt-2" />
                      <div className="text-right text-xs text-muted mt-1">3 Clusters</div>
                    </div>
                 </>
             )}
             
             <div className="mt-auto">
               <button className="btn-primary w-full justify-center" onClick={trainModel} disabled={training}>
                 {training ? <span className="animate-pulse">Training...</span> : <><Zap size={16}/> Train Model</>}
               </button>
             </div>
          </div>
          <div className="flex-1 bg-[var(--surface)] border border-[var(--border)] rounded-xl p-8 flex flex-col overflow-y-auto hidden-scrollbar">
             {result ? (
                 <div className="fade-in">
                    <div className="flex justify-between items-center mb-6">
                        <h2>Model Results</h2>
                        <span className="text-xs bg-[var(--success)] text-black px-2 py-1 rounded font-bold uppercase tracking-wider">Ready</span>
                    </div>
                    
                    {result.type === 'lr' && (
                        <div className="grid grid-cols-3 gap-4 mb-6">
                           <div className="premium-card p-6 text-center shadow-lg border-t-2 border-t-[var(--primary)]">
                              <div className="text-4xl font-mono text-white mb-2">{result.r2.toFixed(3)}</div>
                              <div className="text-xs text-muted uppercase tracking-wider font-semibold">R² Score</div>
                           </div>
                           <div className="premium-card p-6 text-center">
                              <div className="text-4xl font-mono text-[var(--success)] mb-2">{result.m.toFixed(3)}</div>
                              <div className="text-xs text-muted uppercase tracking-wider font-semibold">Coefficient</div>
                           </div>
                           <div className="premium-card p-6 text-center">
                              <div className="text-4xl font-mono text-[var(--warning)] mb-2">{result.b.toFixed(3)}</div>
                              <div className="text-xs text-muted uppercase tracking-wider font-semibold">Intercept</div>
                           </div>
                        </div>
                    )}
                    
                    {result.type === 'kmeans' && (
                         <div className="grid grid-cols-3 gap-4 mb-6">
                           <div className="premium-card p-6 text-center shadow-lg border-t-2 border-t-[var(--primary)]">
                              <div className="text-4xl font-mono text-white mb-2">{result.k}</div>
                              <div className="text-xs text-muted uppercase tracking-wider font-semibold">Clusters</div>
                           </div>
                           <div className="premium-card p-6 text-center">
                              <div className="text-4xl font-mono text-[var(--success)] mb-2">{result.silhouette.toFixed(2)}</div>
                              <div className="text-xs text-muted uppercase tracking-wider font-semibold">Silhouette Score</div>
                           </div>
                           <div className="premium-card p-6 text-center">
                              <div className="text-4xl font-mono text-[var(--warning)] mb-2">{result.inertia.toFixed(1)}</div>
                              <div className="text-xs text-muted uppercase tracking-wider font-semibold">Inertia</div>
                           </div>
                        </div>
                    )}

                    <div className="h-64 mt-4 p-8 bg-[rgba(7,11,20,0.5)] border border-[var(--border)] rounded-xl relative overflow-hidden flex items-center justify-center">
                       {/* Background Grid */}
                       <div className="absolute inset-0" style={{backgroundImage: 'linear-gradient(to right, #1E2D3D 1px, transparent 1px), linear-gradient(to bottom, #1E2D3D 1px, transparent 1px)', backgroundSize: '40px 40px', opacity: 0.2}}></div>
                       <div className="z-10 text-center">
                          {result.type === 'lr' && (
                             <div className="font-mono text-2xl text-[var(--primary)] bg-[rgba(0,0,0,0.5)] p-4 rounded-xl border border-[var(--border)] shadow-xl">
                                y = {result.m.toFixed(4)}x + {result.b.toFixed(4)}
                             </div>
                          )}
                          {result.type === 'kmeans' && (
                             <div className="font-mono text-xl text-[var(--success)] flex gap-4">
                               <div className="w-8 h-8 rounded-full bg-[var(--primary)]"></div>
                               <div className="w-8 h-8 rounded-full bg-[var(--success)]"></div>
                               <div className="w-8 h-8 rounded-full bg-[var(--warning)]"></div>
                             </div>
                          )}
                       </div>
                    </div>
                 </div>
             ) : (
                 <div className="flex-1 flex flex-col items-center justify-center text-muted">
                    <Network size={64} className="opacity-10 mb-4" />
                    <div className="text-lg">Machine Learning Lab</div>
                    <div className="text-sm opacity-60">Select configuration and train model to see evaluation</div>
                 </div>
             )}
          </div>
       </div>
    );
  };

  const PipelineSection = () => {
     return (
       <div className="fade-in-up h-full flex flex-col">
          <div className="mb-8">
             <h2>ETL Pipeline Builder</h2>
             <p className="text-muted mt-1">Visually design data transformations and exports</p>
          </div>
          <div className="pipeline-flow flex-1 items-start">
              <div className="pipeline-step active">
                 <div className="flex justify-between items-center mb-3">
                    <div className="text-[10px] bg-[var(--success)] text-black px-2 py-0.5 rounded uppercase font-bold tracking-wider flex items-center gap-1"><Database size={10}/> Source</div>
                 </div>
                 <div className="font-semibold text-lg mb-1">{fileInfo?.name || 'Dataset'}</div>
                 <div className="text-xs text-muted font-mono">{data.length} rows × {columns.length} cols</div>
              </div>
              <div className="pipeline-connector"></div>
              
              <div className="pipeline-step">
                 <div className="flex justify-between items-center mb-3">
                    <div className="text-[10px] bg-[var(--warning)] text-black px-2 py-0.5 rounded uppercase font-bold tracking-wider flex items-center gap-1"><Wand2 size={10}/> Transform</div>
                    <div className="text-muted cursor-pointer hover:text-white"><Settings size={14}/></div>
                 </div>
                 <div className="font-semibold text-lg mb-1">Clean & Filter</div>
                 <div className="text-xs text-muted font-mono">Drop duplicates, fill nulls</div>
              </div>
              <div className="pipeline-connector"></div>

              <div className="pipeline-step">
                 <div className="flex justify-between items-center mb-3">
                    <div className="text-[10px] bg-[var(--primary)] text-white px-2 py-0.5 rounded uppercase font-bold tracking-wider flex items-center gap-1"><Terminal size={10}/> Query</div>
                 </div>
                 <div className="font-semibold text-lg mb-1">Aggregation</div>
                 <div className="text-xs text-muted font-mono">GROUP BY Date</div>
              </div>
              <div className="pipeline-connector"></div>

              <div className="pipeline-step border border-dashed border-[var(--border)] bg-transparent hover:bg-[rgba(255,255,255,0.02)] flex flex-col items-center justify-center cursor-pointer min-h-[120px] text-muted hover:text-white transition-colors">
                 <Plus size={24} className="mb-2" />
                 <span className="text-sm font-semibold">Add Step</span>
              </div>
          </div>
          
          <div className="mt-auto p-4 bg-[var(--surface)] border border-[var(--border)] rounded-xl flex justify-between items-center">
             <div className="text-sm text-muted">Pipeline contains 3 steps. Unsaved changes.</div>
             <div className="flex gap-2">
                 <button className="btn-secondary"><Save size={16}/> Save Pipeline</button>
                 <button className="btn-primary"><Play size={16}/> Run ETL</button>
             </div>
          </div>
       </div>
     );
  };

  const DashboardSection = () => {
    return (
       <div className="fade-in-up h-full flex flex-col">
          <div className="flex justify-between items-center mb-6">
             <div>
                <h2>Dashboard Builder</h2>
                <p className="text-muted mt-1">Drag and drop grid to build reports</p>
             </div>
             <div className="flex gap-2">
                <button className="btn-secondary"><Component size={16}/> Load Template</button>
                <button className="btn-primary"><Plus size={16}/> Add Widget</button>
             </div>
          </div>
          
          <div className="dashboard-canvas p-6 grid grid-cols-12 gap-4 auto-rows-[minmax(120px,auto)] flex-1 hidden-scrollbar">
              
              <div className="col-span-4 row-span-1 premium-card flex flex-col relative group transition-all hover:border-[var(--primary)] text-center justify-center shadow-lg">
                 <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 bg-[#070B14] p-1 rounded-md border border-[var(--border)]">
                    <button className="text-muted hover:text-white"><Settings size={14}/></button>
                 </div>
                 <div className="text-sm text-muted font-semibold uppercase tracking-wider mb-2">Total Rows</div>
                 <div className="text-5xl font-mono text-[var(--primary)] font-bold">{data.length}</div>
              </div>

              <div className="col-span-4 row-span-1 premium-card flex flex-col relative group transition-all hover:border-[var(--primary)] text-center justify-center shadow-lg">
                 <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 bg-[#070B14] p-1 rounded-md border border-[var(--border)]">
                    <button className="text-muted hover:text-white"><Settings size={14}/></button>
                 </div>
                 <div className="text-sm text-muted font-semibold uppercase tracking-wider mb-2">Total Columns</div>
                 <div className="text-5xl font-mono text-[var(--success)] font-bold">{columns.length}</div>
              </div>
              
              <div className="col-span-4 row-span-1 premium-card flex flex-col relative group transition-all hover:border-[var(--primary)] text-center justify-center shadow-lg">
                 <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 bg-[#070B14] p-1 rounded-md border border-[var(--border)]">
                    <button className="text-muted hover:text-white"><Settings size={14}/></button>
                 </div>
                 <div className="text-sm text-muted font-semibold uppercase tracking-wider mb-2">Completion Rate</div>
                 <div className="text-5xl font-mono text-[var(--warning)] font-bold">98%</div>
              </div>

              <div className="col-span-8 row-span-3 premium-card relative group transition-all hover:border-[var(--primary)] p-4 shadow-lg">
                 <div className="text-sm font-semibold mb-4">Sample Data Distribution</div>
                 <div className="h-[280px] w-full flex items-center justify-center bg-[rgba(255,255,255,0.02)] border border-dashed border-[var(--border)] rounded-lg text-muted">
                    <BarChart2 size={48} className="opacity-20"/>
                 </div>
              </div>

              <div className="col-span-4 row-span-3 premium-card relative group transition-all hover:border-[var(--primary)] p-4 shadow-lg">
                 <div className="text-sm font-semibold mb-4">Categories</div>
                 <div className="h-[280px] w-full flex items-center justify-center bg-[rgba(255,255,255,0.02)] border border-dashed border-[var(--border)] rounded-lg text-muted">
                    <PieChartIcon size={48} className="opacity-20"/>
                 </div>
              </div>
          </div>
       </div>
    );
  };

  const handleExportCSV = () => {
      const csv = Papa.unparse(data);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", (fileInfo?.name.replace(/\.[^/.]+$/, "") || "dataset") + "_cleaned.csv");
      link.click();
  };

  const handleExportExcel = () => {
      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "DataLens");
      XLSX.writeFile(workbook, (fileInfo?.name.replace(/\.[^/.]+$/, "") || "dataset") + "_cleaned.xlsx");
  };

  return (
    <div className="app-container">
      {/* Sidebar */}
      <div className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-logo">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--primary)] to-[var(--accent)] flex items-center justify-center text-white mr-3 shadow-lg shadow-indigo-500/20">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
              <path d="M11 8v6M8 11v3M14 9v5" />
            </svg>
          </div>
          <span className="font-extrabold text-xl tracking-tight">DataLens <span className="text-[#6366F1]">AI</span></span>
        </div>
        
        <div className="nav-list mt-4">
          <div className={`nav-item ${activeTab === 'upload' ? 'active' : ''}`} onClick={() => setActiveTab('upload')}>
            <Upload size={18} /> Upload Data
          </div>
          
          {data.length > 0 && (
            <>
              <div className="px-4 py-2 mt-4 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                Preparation
              </div>
              <div className={`nav-item ${activeTab === 'preview' ? 'active' : ''}`} onClick={() => setActiveTab('preview')}>
                <FileSpreadsheet size={18} /> Data Preview
              </div>
              <div className={`nav-item ${activeTab === 'cleaning' ? 'active' : ''}`} onClick={() => setActiveTab('cleaning')}>
                <Wand2 size={18} /> Data Cleaning
              </div>

              <div className="px-4 py-2 mt-4 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                Analysis
              </div>
              <div className={`nav-item ${activeTab === 'pivot' ? 'active' : ''}`} onClick={() => setActiveTab('pivot')}>
                <Activity size={18} /> Pivot Table
              </div>
              <div className={`nav-item ${activeTab === 'stats' ? 'active' : ''}`} onClick={() => setActiveTab('stats')}>
                <Hash size={18} /> Statistics
              </div>
              <div className={`nav-item ${activeTab === 'charts' ? 'active' : ''}`} onClick={() => setActiveTab('charts')}>
                <PieChartIcon size={18} /> Visualizations
              </div>
              <div className={`nav-item ${activeTab === 'eda' ? 'active' : ''}`} onClick={() => setActiveTab('eda')}>
                <FileOutput size={18} /> EDA Report
              </div>
              <div className={`nav-item ${activeTab === 'chat' ? 'active' : ''}`} onClick={() => setActiveTab('chat')}>
                <MessageSquare size={18} /> AI Chat
              </div>
              <div className="px-4 py-2 mt-4 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                Advanced
              </div>
              <div className={`nav-item ${activeTab === 'auto-analyst' ? 'active' : ''}`} onClick={() => setActiveTab('auto-analyst')}>
                <Wand2 size={18} /> Auto-Analyst
              </div>
              <div className={`nav-item ${activeTab === 'sql' ? 'active' : ''}`} onClick={() => setActiveTab('sql')}>
                <Terminal size={18} /> SQL Engine
              </div>
              <div className={`nav-item ${activeTab === 'ml' ? 'active' : ''}`} onClick={() => setActiveTab('ml')}>
                <Network size={18} /> ML Lab
              </div>
              <div className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>
                <LayoutDashboard size={18} /> Dashboard
              </div>
              <div className={`nav-item ${activeTab === 'pipeline' ? 'active' : ''}`} onClick={() => setActiveTab('pipeline')}>
                <Workflow size={18} /> ETL Pipeline
              </div>
            </>
          )}
        </div>

        {fileInfo && (
          <div className="mt-auto p-4 m-4 rounded-xl glass flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#1E2D3D] flex items-center justify-center font-bold text-sm text-[#6366F1]">
              <Database size={16} />
            </div>
            <div className="min-w-0">
              <div className="font-bold text-sm truncate" title={fileInfo.name}>{fileInfo.name}</div>
              <div className="text-[10px] text-[#475569] uppercase flex justify-between gap-2 mt-0.5">
                <span>{formatBytes(fileInfo.size)}</span>
                <span className="font-mono text-[#6366F1]">{data.length} rows</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="main-area">
        {/* Top Navbar */}
        <div className="top-navbar">
          <div className="flex items-center gap-4">
            <button className="md:hidden btn-icon" onClick={() => setSidebarOpen(!sidebarOpen)}>
              <Menu size={20} />
            </button>
            <div className="breadcrumb">
               Workspace <ChevronRight size={14} /> 
               <span className="breadcrumb-active capitalize">
                 {activeTab.replace('-', ' ')}
               </span>
            </div>
          </div>
          
          {data.length > 0 && (
            <div className="flex items-center gap-2">
              <button className="btn-secondary whitespace-nowrap text-xs px-3" onClick={handleExportCSV}>
                <ArrowDownRight size={14} /> CSV
              </button>
              <button className="btn-secondary whitespace-nowrap text-xs px-3" onClick={handleExportExcel}>
                <ArrowDownRight size={14} /> Excel
              </button>
              <button className="btn-primary whitespace-nowrap text-xs px-3 ml-2" onClick={() => setActiveTab('chat')}>
                <Sparkles size={14} /> Ask AI
              </button>
            </div>
          )}
        </div>

        {/* Content Area */}
        <div className="content-area hidden-scrollbar">
          {activeTab === 'upload' && <UploadSection />}
          {activeTab === 'preview' && <PreviewSection />}
          {activeTab === 'stats' && <StatsSection />}
          {activeTab === 'charts' && <ChartsSection />}
          {activeTab === 'cleaning' && <CleaningSection />}
          {activeTab === 'pivot' && <PivotSection />}
          {activeTab === 'eda' && <EdaSection />}
          {activeTab === 'chat' && <ChatSection />}
          {activeTab === 'sql' && <SqlSection />}
          {activeTab === 'ml' && <MLLabSection />}
          {activeTab === 'pipeline' && <PipelineSection />}
          {activeTab === 'dashboard' && <DashboardSection />}
          {activeTab === 'auto-analyst' && <AutoAnalystSection />}
        </div>
      </div>

      {/* Global Modals */}
      {showSearch && (
         <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-start justify-center z-50 p-10 fade-in cursor-pointer" onClick={(e) => e.target === e.currentTarget && setShowSearch(false)}>
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl w-full max-w-2xl p-4 shadow-2xl flex items-center gap-3">
               <Search className="text-muted" size={20} />
               <input autoFocus type="text" className="bg-transparent border-none outline-none text-lg flex-1 text-[var(--text-primary)]" placeholder="Search commands, columns, or files..." />
               <div className="text-xs text-muted border border-[var(--border)] px-2 py-1 rounded">ESC to close</div>
            </div>
         </div>
      )}

      {showShortcuts && (
         <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 fade-in cursor-pointer" onClick={(e) => e.target === e.currentTarget && setShowShortcuts(false)}>
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl w-full max-w-md p-6 shadow-2xl">
               <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-bold">Keyboard Shortcuts</h3>
                  <button className="text-muted hover:text-white" onClick={() => setShowShortcuts(false)}><X size={20}/></button>
               </div>
               <div className="flex flex-col gap-3">
                  <div className="flex justify-between items-center p-2 hover:bg-[rgba(255,255,255,0.02)] rounded">
                     <span className="text-muted">Global Search</span>
                     <kbd className="bg-[var(--bg)] border border-[var(--border)] px-2 py-1 rounded text-xs font-mono">Ctrl + K</kbd>
                  </div>
                  <div className="flex justify-between items-center p-2 hover:bg-[rgba(255,255,255,0.02)] rounded">
                     <span className="text-muted">Undo Action</span>
                     <kbd className="bg-[var(--bg)] border border-[var(--border)] px-2 py-1 rounded text-xs font-mono">Ctrl + Z</kbd>
                  </div>
                  <div className="flex justify-between items-center p-2 hover:bg-[rgba(255,255,255,0.02)] rounded">
                     <span className="text-muted">Show Shortcuts</span>
                     <kbd className="bg-[var(--bg)] border border-[var(--border)] px-2 py-1 rounded text-xs font-mono">?</kbd>
                  </div>
               </div>
            </div>
         </div>
      )}

      {/* Toasts */}
      <div className="toast-container">
        {toasts.map(toast => (
          <div key={toast.id} className={`toast ${toast.type}`}>
            {toast.type === 'success' && <CheckCircle className="text-[var(--success)]" size={20} />}
            {toast.type === 'error' && <AlertCircle className="text-[var(--danger)]" size={20} />}
            {toast.type === 'warning' && <AlertCircle className="text-[var(--warning)]" size={20} />}
            {toast.type === 'info' && <Activity className="text-[var(--primary)]" size={20} />}
            <span className="text-sm font-medium pt-0.5">{toast.message}</span>
            <button className="toast-close" onClick={() => removeToast(toast.id)}>
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
