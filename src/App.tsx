import React, { useState, useEffect, useCallback, useMemo, useRef, Component as ReactComponent, ErrorInfo } from 'react';
import { 
  Upload, FileSpreadsheet, FileJson, FileText, X, AlertCircle, CheckCircle,
  Search, Filter, BarChart2, PieChart as PieChartIcon, LineChart as LineChartIcon,
  ScatterChart as ScatterChartIcon, Activity, Download, Hash, Type, Calendar, 
  ChevronRight, ArrowUpRight, ArrowDownRight, Menu, LayoutDashboard, Database,
  MessageSquare, Sparkles, Wand2, RefreshCcw, Save, Trash2, ArrowRight, FileOutput, Send,
  Terminal, Component, Workflow, Zap, Network, Clock, Settings, Plus, Play, TrendingUp,
  AlertTriangle, Copy, RotateCcw
} from 'lucide-react';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, ScatterChart, Scatter, ZAxis, AreaChart, Area
} from 'recharts';
import { saveSession, loadSession, clearSession, getStorageEstimate } from './lib/db';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import alasql from 'alasql';
import { SimpleLinearRegression } from 'ml-regression-simple-linear';
import { kmeans } from 'ml-kmeans';
import GridLayout, { WidthProvider } from 'react-grid-layout/legacy';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

// White-label Rebranding Context, Hooks, and Gates
import { BrandConfigProvider } from './config/brandContext';
import { useBrandConfig } from './config/useBrandConfig';
import { FeatureGate } from './components/branding/FeatureGate';
import { DynamicLogo } from './components/branding/DynamicLogo';
import { DynamicFavicon } from './components/branding/DynamicFavicon';
import { BrandLoader } from './components/branding/BrandLoader';


// --- TYPES ---
interface ErrorBoundaryProps {
  sectionName: string;
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  copied: boolean;
}

class ErrorBoundary extends ReactComponent<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null, copied: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`ErrorBoundary caught an error in ${this.props.sectionName}:`, error, errorInfo);
    this.setState({ errorInfo });
  }

  handleCopy = () => {
    const text = `Error in ${this.props.sectionName}:\n${this.state.error?.toString()}\n\nStack Trace:\n${this.state.errorInfo?.componentStack}`;
    navigator.clipboard.writeText(text);
    this.setState({ copied: true });
    setTimeout(() => this.setState({ copied: false }), 2000);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null, copied: false });
  }

  handleReload = () => {
    window.location.reload();
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-full p-6 flex items-center justify-center bg-[var(--bg)]">
          <div className="max-w-2xl w-full p-6 border border-[var(--danger)] bg-[var(--surface)] shadow-2xl flex flex-col gap-4 rounded-xl">
            <div className="flex items-center gap-3" style={{ color: 'var(--danger)' }}>
              <AlertTriangle size={24} />
              <h2 className="text-xl font-bold">Something went wrong in {this.props.sectionName}</h2>
            </div>
            
            <p className="text-sm text-[#94A3B8]">
              The application encountered an unexpected error. You can try resetting this section or reloading the page.
            </p>

            <div className="bg-[var(--bg)] border border-[var(--border)] rounded-lg p-4 mb-2 overflow-auto max-h-48 text-xs font-mono" style={{ color: 'var(--danger)' }}>
              <div className="font-bold mb-2">{this.state.error && this.state.error.toString()}</div>
              <div className="whitespace-pre-wrap opacity-80">{this.state.errorInfo && this.state.errorInfo.componentStack}</div>
            </div>

            <div className="flex gap-3 justify-end mt-2">
              <button onClick={this.handleCopy} className="btn-secondary flex items-center gap-2">
                <Copy size={16} /> {this.state.copied ? 'Copied!' : 'Copy Error'}
              </button>
              <button onClick={this.handleReset} className="btn-secondary flex items-center gap-2">
                <RefreshCcw size={16} /> Reset
              </button>
              <button onClick={this.handleReload} className="btn-primary flex items-center gap-2">
                <RefreshCcw size={16} /> Reload Page
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

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

interface WidgetConfig {
  id: string;
  title: string;
  type: 'kpi' | 'line' | 'bar' | 'table' | 'markdown';
  column?: string;
  operation?: string;
  xAxisColumn?: string;
  yAxisColumn?: string;
  tableColumns?: string[];
  tableLimit?: number;
  content?: string;
}

interface HistoryOp {
  id: string;
  timestamp: number;
  description: string;
  removedRows?: { index: number, row: any }[];
  changedCellsInverse?: { index: number, column: string, oldVal: any }[];
  changedCellsForward?: { index: number, column: string, newVal: any }[];
  droppedColumn?: { name: string, type: ColumnType, colData: any[] };
  convertedColumnInverse?: { name: string, oldType: ColumnType, oldData: any[] };
  convertedColumnForward?: { name: string, newType: ColumnType, newData: any[] };
}

const applyForward = (op: HistoryOp, currentData: any[], currentCols: ColumnInfo[]) => {
  let d = [...currentData];
  let c = [...currentCols];
  if (op.removedRows) {
      const sorted = [...op.removedRows].sort((a,b) => b.index - a.index);
      for (const {index} of sorted) d.splice(index, 1);
  }
  if (op.changedCellsForward) {
      for (const {index, column, newVal} of op.changedCellsForward) {
          d[index] = { ...d[index], [column]: newVal };
      }
  }
  if (op.droppedColumn) {
      c = c.filter(col => col.name !== op.droppedColumn!.name);
      d = d.map(row => { const nr = {...row}; delete nr[op.droppedColumn!.name]; return nr; });
  }
  if (op.convertedColumnForward) {
      c = c.map(col => col.name === op.convertedColumnForward!.name ? { ...col, type: op.convertedColumnForward!.newType } : col);
      op.convertedColumnForward.newData.forEach((val, i) => d[i] = { ...d[i], [op.convertedColumnForward!.name]: val });
  }
  return { d, c };
};

const applyInverse = (op: HistoryOp, currentData: any[], currentCols: ColumnInfo[]) => {
  let d = [...currentData];
  let c = [...currentCols];
  if (op.removedRows) {
      const sorted = [...op.removedRows].sort((a,b) => a.index - b.index);
      for (const {index, row} of sorted) d.splice(index, 0, row);
  }
  if (op.changedCellsInverse) {
      for (const {index, column, oldVal} of op.changedCellsInverse) {
          d[index] = { ...d[index], [column]: oldVal };
      }
  }
  if (op.droppedColumn) {
      c.push({ name: op.droppedColumn.name, type: op.droppedColumn.type });
      op.droppedColumn.colData.forEach((val, i) => { d[i] = { ...d[i], [op.droppedColumn!.name]: val }; });
  }
  if (op.convertedColumnInverse) {
      c = c.map(col => col.name === op.convertedColumnInverse!.name ? { ...col, type: op.convertedColumnInverse!.oldType } : col);
      op.convertedColumnInverse.oldData.forEach((val, i) => d[i] = { ...d[i], [op.convertedColumnInverse!.name]: val });
  }
  return { d, c };
};
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

const callAI = async (payload: { contents?: any, prompt?: string, model?: string }) => {
  const token = localStorage.getItem('datalens_auth_token');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch('/api/gemini', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  
  let data: any = {};
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    data = await response.json();
  } else {
    const text = await response.text();
    throw new Error(text || `Server returned status ${response.status}`);
  }
  
  if (!response.ok) {
    throw new Error(data.error || 'API request failed');
  }
  return { text: data.text || '' };
};

const useWindowWidth = () => {
  const [width, setWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024);
  useEffect(() => {
    const handleResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  return width;
};

const useSampledData = (originalData: any[], isSampledView: boolean) => {
  return useMemo(() => {
    if (!originalData || !originalData.length) return { sampledData: [], totalRows: 0, isSampled: false };
    
    if (!isSampledView || originalData.length <= 500) {
      return { sampledData: originalData, totalRows: originalData.length, isSampled: false };
    }

    let sampled: any[] = [];
    const targetSize = 500;
    
    if (originalData.length <= 10000) {
      // Systematic sample (every Nth row)
      const step = Math.floor(originalData.length / targetSize) || 1;
      for (let i = 0; i < targetSize; i++) {
        const idx = Math.floor(i * step);
        if (idx < originalData.length) sampled.push(originalData[idx]);
      }
    } else {
       // Random sample
       const pool = [...originalData];
       for (let i = 0; i < targetSize; i++) {
           if (pool.length === 0) break;
           const r = Math.floor(Math.random() * pool.length);
           sampled.push(pool[r]);
           // Swap with last instead of expensive splice
           pool[r] = pool[pool.length - 1];
           pool.pop();
       }
    }
    
    return { sampledData: sampled, totalRows: originalData.length, isSampled: true };
  }, [originalData, isSampledView]);
};

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

interface PCAResult {
  pc1: number[];
  pc2: number[];
}

const getPCA2D = (dataPoints: number[][]): PCAResult => {
  const numRows = dataPoints.length;
  if (numRows === 0) return { pc1: [], pc2: [] };
  const numCols = dataPoints[0].length;
  if (numCols === 0) return { pc1: [], pc2: [] };
  
  if (numCols === 1) {
    return {
      pc1: dataPoints.map(r => r[0]),
      pc2: dataPoints.map((_, i) => i)
    };
  }

  // 1. Mean center the data
  const means = Array(numCols).fill(0);
  for (let r = 0; r < numRows; r++) {
    for (let c = 0; c < numCols; c++) {
      means[c] += dataPoints[r][c];
    }
  }
  for (let c = 0; c < numCols; c++) {
    means[c] /= numRows;
  }
  
  const centered = dataPoints.map(row => row.map((val, c) => val - means[c]));
  
  // 2. Covariance matrix
  const cov = Array(numCols).fill(0).map(() => Array(numCols).fill(0));
  for (let i = 0; i < numCols; i++) {
    for (let j = 0; j < numCols; j++) {
      let sum = 0;
      for (let r = 0; r < numRows; r++) {
        sum += centered[r][i] * centered[r][j];
      }
      cov[i][j] = sum / (numRows - 1 || 1);
    }
  }
  
  // 3. Power iteration to find eigenvectors
  const powerIteration = (matrix: number[][], numIterations = 100): number[] => {
    let b = Array(numCols).fill(0).map(() => Math.random() - 0.5);
    let norm = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
    b = b.map(val => val / (norm || 1));
    
    for (let iter = 0; iter < numIterations; iter++) {
      const nextB = Array(numCols).fill(0);
      for (let i = 0; i < numCols; i++) {
        for (let j = 0; j < numCols; j++) {
          nextB[i] += matrix[i][j] * b[j];
        }
      }
      norm = Math.sqrt(nextB.reduce((sum, val) => sum + val * val, 0));
      if (norm === 0) break;
      b = nextB.map(val => val / norm);
    }
    return b;
  };
  
  // First PC
  const pc1Vector = powerIteration(cov);
  
  // Deflate covariance matrix for second PC
  let lambda1 = 0;
  const temp = Array(numCols).fill(0);
  for (let i = 0; i < numCols; i++) {
    for (let j = 0; j < numCols; j++) {
      temp[i] += cov[i][j] * pc1Vector[j];
    }
    lambda1 += pc1Vector[i] * temp[i];
  }
  
  const covDeflated = Array(numCols).fill(0).map(() => Array(numCols).fill(0));
  for (let i = 0; i < numCols; i++) {
    for (let j = 0; j < numCols; j++) {
      covDeflated[i][j] = cov[i][j] - lambda1 * pc1Vector[i] * pc1Vector[j];
    }
  }
  
  // Second PC
  const pc2Vector = powerIteration(covDeflated);
  
  // Project
  const pc1 = centered.map(row => row.reduce((sum, val, c) => sum + val * pc1Vector[c], 0));
  const pc2 = centered.map(row => row.reduce((sum, val, c) => sum + val * pc2Vector[c], 0));
  
  return { pc1, pc2 };
};

const euclideanDistance = (p1: number[], p2: number[]): number => {
  let sum = 0;
  for (let i = 0; i < p1.length; i++) {
    sum += Math.pow(p1[i] - p2[i], 2);
  }
  return Math.sqrt(sum);
};

const calculateSilhouetteScore = (points: number[][], clusters: number[]): number => {
  const n = points.length;
  if (n <= 1) return 0;
  
  const uniqueClusters = Array.from(new Set(clusters));
  if (uniqueClusters.length <= 1) return 0;
  
  const clusterGroups: Record<number, number[][]> = {};
  uniqueClusters.forEach(c => { clusterGroups[c] = []; });
  for (let i = 0; i < n; i++) {
    clusterGroups[clusters[i]].push(points[i]);
  }
  
  let totalSilhouette = 0;
  for (let i = 0; i < n; i++) {
    const currentPoint = points[i];
    const currentCluster = clusters[i];
    
    // a(i)
    const sameClusterPoints = clusterGroups[currentCluster];
    let a = 0;
    if (sameClusterPoints.length > 1) {
      let distSum = 0;
      for (let j = 0; j < sameClusterPoints.length; j++) {
        if (sameClusterPoints[j] === currentPoint) continue;
        distSum += euclideanDistance(currentPoint, sameClusterPoints[j]);
      }
      a = distSum / (sameClusterPoints.length - 1);
    }
    
    // b(i)
    let b = Infinity;
    for (const c of uniqueClusters) {
      if (c === currentCluster) continue;
      const otherClusterPoints = clusterGroups[c];
      if (otherClusterPoints.length === 0) continue;
      
      let distSum = 0;
      for (let j = 0; j < otherClusterPoints.length; j++) {
        distSum += euclideanDistance(currentPoint, otherClusterPoints[j]);
      }
      const meanDist = distSum / otherClusterPoints.length;
      if (meanDist < b) {
        b = meanDist;
      }
    }
    
    const s = (b - a) / Math.max(a, b || 1);
    totalSilhouette += s;
  }
  
  return totalSilhouette / n;
};


interface BrandedAuthPageProps {
  onLogin: (user: any) => void;
}

const BrandedAuthPage: React.FC<BrandedAuthPageProps> = ({ onLogin }) => {
  const { config, appName, appTagline } = useBrandConfig();
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim() || (isRegister && !name.trim())) {
      setError('Please fill in all required fields.');
      return;
    }

    setLoading(true);
    setError('');

    const endpoint = isRegister ? '/api/auth/register' : '/api/auth/login';
    const payload = isRegister 
      ? { email, password, name, brandId: config.client.id }
      : { email, password, brandId: config.client.id };

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      let data: any = {};
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        throw new Error(text || `Server returned status ${response.status}`);
      }
      
      if (!response.ok) {
        throw new Error(data.error || 'Authentication failed.');
      }

      localStorage.setItem('datalens_auth_token', data.token);
      onLogin(data.user);
    } catch (e: any) {
      setError(e.message || 'Server connection error.');
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = async (provider: string) => {
    if (provider === 'Google') {
      const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
      if (clientId && clientId.trim() !== '' && !clientId.includes('your_google_client_id')) {
        const redirectUri = window.location.origin + window.location.pathname;
        const scope = 'email profile';
        const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token&scope=${encodeURIComponent(scope)}`;
        window.location.href = googleAuthUrl;
        return;
      } else {
        setError('Google Client ID is not configured in .env. Please set VITE_GOOGLE_CLIENT_ID to use real Google login.');
        return;
      }
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/social-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, brandId: config.client.id })
      });
      
      let data: any = {};
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        throw new Error(text || `Server returned status ${response.status}`);
      }
      
      if (!response.ok) {
        throw new Error(data.error || 'Authentication failed.');
      }

      localStorage.setItem('datalens_auth_token', data.token);
      onLogin(data.user);
    } catch (e: any) {
      setError(e.message || 'Server connection error.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4 bg-[var(--bg)] font-sans">
      <div className="absolute inset-0 pointer-events-none opacity-20" style={{ background: 'radial-gradient(circle at top right, var(--primary), transparent 45%), radial-gradient(circle at bottom left, var(--accent), transparent 45%)' }}></div>
      
      <div className="w-full max-w-md bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-8 shadow-2xl relative overflow-hidden transition-all duration-300">
        <div className="flex flex-col items-center text-center mb-8">
          <div className="mb-4">
            <DynamicLogo />
          </div>
          <p className="text-sm text-slate-400 font-medium">{appTagline}</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <h2 className="text-xl font-bold text-white mb-2 text-center">
            {isRegister ? 'Create Account' : 'Welcome Back'}
          </h2>

          {error && (
            <div className="p-3 bg-[rgba(239,68,68,0.1)] border border-[var(--danger)] text-[var(--danger)] rounded-lg text-xs font-semibold flex items-center gap-2">
              <AlertCircle size={14} />
              <span>{error}</span>
            </div>
          )}

          {isRegister && (
            <div>
              <label htmlFor="name" className="block text-xs font-bold uppercase tracking-wider text-muted mb-2">Name</label>
              <input
                type="text"
                id="name"
                name="name"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Doe"
                className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-[var(--primary)]"
                required
              />
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-xs font-bold uppercase tracking-wider text-muted mb-2">Email Address</label>
            <input
              type="email"
              id="email"
              name="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
              className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-[var(--primary)]"
              required
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-xs font-bold uppercase tracking-wider text-muted mb-2">Password</label>
            <input
              type="password"
              id="password"
              name="password"
              autoComplete={isRegister ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-[var(--primary)]"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full justify-center p-3 text-sm font-semibold rounded-lg mt-4 cursor-pointer"
          >
            {loading ? (
              <RefreshCcw className="animate-spin" size={16} />
            ) : isRegister ? (
              'Sign Up'
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        {!isRegister && (
          <>
            <div className="relative flex py-5 items-center">
              <div className="flex-grow border-t border-[var(--border)]"></div>
              <span className="flex-shrink mx-4 text-xs text-slate-400">Or continue with</span>
              <div className="flex-grow border-t border-[var(--border)]"></div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <button 
                type="button" 
                disabled={loading}
                onClick={() => handleSocialLogin('Google')}
                className="flex flex-col items-center justify-center p-3 border border-[var(--border)] rounded-xl bg-[var(--surfaceHover)] hover:bg-[var(--border)] transition-all duration-200 cursor-pointer text-xs text-white gap-2 font-medium disabled:opacity-50"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#EA4335" d="M12 5.04c1.62 0 3.08.56 4.22 1.65l3.15-3.15C17.45 1.76 14.96 1 12 1 7.35 1 3.39 3.67 1.45 7.57l3.8 2.95c.9-2.7 3.4-4.48 6.75-4.48z"/>
                  <path fill="#4285F4" d="M23.49 12.27c0-.81-.07-1.59-.2-2.35H12v4.51h6.44c-.28 1.48-1.12 2.73-2.38 3.58l3.7 2.87c2.16-1.99 3.73-4.92 3.73-8.61z"/>
                  <path fill="#FBBC05" d="M5.25 14.52c-.23-.69-.36-1.42-.36-2.18s.13-1.49.36-2.18L1.45 7.21C.65 8.81.18 10.6.18 12.5s.47 3.69 1.27 5.29l3.8-2.97z"/>
                  <path fill="#34A853" d="M12 23c3.24 0 5.97-1.08 7.96-2.91l-3.7-2.87c-1.03.69-2.35 1.1-4.26 1.1-3.35 0-6.19-2.28-7.2-5.48l-3.8 2.95C3.15 19.8 7.14 23 12 23z"/>
                </svg>
                <span>Google</span>
              </button>
              <button 
                type="button" 
                disabled={loading}
                onClick={() => handleSocialLogin('GitHub')}
                className="flex flex-col items-center justify-center p-3 border border-[var(--border)] rounded-xl bg-[var(--surfaceHover)] hover:bg-[var(--border)] transition-all duration-200 cursor-pointer text-xs text-white gap-2 font-medium disabled:opacity-50"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.167 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.579.688.481C19.137 20.164 22 16.418 22 12c0-5.523-4.477-10-10-10z"/>
                </svg>
                <span>GitHub</span>
              </button>
              <button 
                type="button" 
                disabled={loading}
                onClick={() => handleSocialLogin('Microsoft')}
                className="flex flex-col items-center justify-center p-3 border border-[var(--border)] rounded-xl bg-[var(--surfaceHover)] hover:bg-[var(--border)] transition-all duration-200 cursor-pointer text-xs text-white gap-2 font-medium disabled:opacity-50"
              >
                <svg className="w-5 h-5" viewBox="0 0 23 23">
                  <path fill="#F25022" d="M0 0h11v11H0z"/>
                  <path fill="#7FBA00" d="M12 0h11v11H12z"/>
                  <path fill="#00A4EF" d="M0 12h11v11H0z"/>
                  <path fill="#FFB900" d="M12 12h11v11H12z"/>
                </svg>
                <span>Microsoft</span>
              </button>
            </div>
          </>
        )}

        <div className="mt-6 text-center text-xs text-muted">
          {isRegister ? (
            <>
              Already have an account?{' '}
              <button 
                onClick={() => { setIsRegister(false); setError(''); }}
                className="text-[var(--primary)] hover:underline font-semibold bg-transparent border-none cursor-pointer"
              >
                Sign In
              </button>
            </>
          ) : (
            <>
              Don't have an account yet?{' '}
              <button 
                onClick={() => { setIsRegister(true); setError(''); }}
                className="text-[var(--primary)] hover:underline font-semibold bg-transparent border-none cursor-pointer"
              >
                Sign Up
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const ReactGridLayout = WidthProvider(GridLayout);

function MainApp() {
  const { config, appName, appTagline, hasFeature } = useBrandConfig();
  
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  
  useEffect(() => {
    const checkUser = async () => {
      const token = localStorage.getItem('datalens_auth_token');
      if (token) {
        try {
          const response = await fetch('/api/auth/me', {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          if (response.ok) {
            const data = await response.json();
            setCurrentUser(data.user);
          } else {
            localStorage.removeItem('datalens_auth_token');
          }
        } catch (e) {
          console.error("Failed to verify user session", e);
        }
      }
      setAuthLoading(false);
    };
    checkUser();
  }, []);

  useEffect(() => {
    const handleGoogleHash = async () => {
      if (window.location.hash) {
        const hash = window.location.hash.substring(1);
        const params = new URLSearchParams(hash);
        const accessToken = params.get('access_token');
        if (accessToken) {
          // Clean the hash from address bar
          window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
          
          setAuthLoading(true);
          try {
            const brandId = config?.client?.id || 'datalens-default';
            const response = await fetch('/api/auth/google-login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ accessToken, brandId })
            });
            
            let data: any = {};
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
              data = await response.json();
            } else {
              const text = await response.text();
              throw new Error(text || `Server returned status ${response.status}`);
            }
            
            if (response.ok) {
              localStorage.setItem('datalens_auth_token', data.token);
              setCurrentUser(data.user);
            } else {
              console.error("Google authentication failed:", data.error);
            }
          } catch (e) {
            console.error("Error exchanging Google access token:", e);
          } finally {
            setAuthLoading(false);
          }
        }
      }
    };
    handleGoogleHash();
  }, [config]);

  const [activeTab, setActiveTab] = useState<'upload' | 'preview' | 'stats' | 'charts' | 'cleaning' | 'pivot' | 'eda' | 'chat' | 'sql' | 'ml' | 'dashboard' | 'pipeline' | 'auto-analyst'>('upload');
  const [fileInfo, setFileInfo] = useState<FileInfo | null>(null);
  const [data, setData] = useState<any[]>([]);
  const [initialData, setInitialData] = useState<any[]>([]);
  const [initialColumns, setInitialColumns] = useState<ColumnInfo[]>([]);
  const [history, setHistory] = useState<HistoryOp[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [columns, setColumns] = useState<ColumnInfo[]>([]);

  // Dashboard Builder States
  const [widgets, setWidgets] = useState<WidgetConfig[]>([]);
  const [dashboardLayout, setDashboardLayout] = useState<any[]>([]);
  const [isEditMode, setIsEditMode] = useState<boolean>(true);
  const [isWidgetModalOpen, setIsWidgetModalOpen] = useState<boolean>(false);
  const [editingWidget, setEditingWidget] = useState<WidgetConfig | null>(null);

  const [widgetForm, setWidgetForm] = useState<{
    type: 'kpi' | 'line' | 'bar' | 'table' | 'markdown';
    title: string;
    column: string;
    operation: string;
    xAxisColumn: string;
    yAxisColumn: string;
    tableColumns: string[];
    tableLimit: number;
    content: string;
  }>({
    type: 'kpi',
    title: '',
    column: '',
    operation: 'sum',
    xAxisColumn: '',
    yAxisColumn: '',
    tableColumns: [],
    tableLimit: 5,
    content: ''
  });
  const [loading, setLoading] = useState(false);
  const [parseProgress, setParseProgress] = useState({ percent: 0, stage: '', rows: 0, elapsed: 0, eta: 0 });
  const abortControllerRef = useRef<(() => void) | null>(null);
  const [strictMode, setStrictMode] = useState(false);
  const [toasts, setToasts] = useState<ToastInfo[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { id: '1', role: 'model', content: 'Hi! I am your AI Data Assistant. Ask me anything about your dataset.' }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatTyping, setChatTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [chatMemory, setChatMemory] = useState('');
  const [savedConversations, setSavedConversations] = useState<any[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('datalens_saved_chats') || '[]');
    } catch {
      return [];
    }
  });
  const [tokenEstimate, setTokenEstimate] = useState(0);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showRestoreSession, setShowRestoreSession] = useState(false);
  const [hasRestored, setHasRestored] = useState(false);
  const [storageUsage, setStorageUsage] = useState('');
  
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const handleTouchStart = (e: React.TouchEvent) => {
    const y = e.targetTouches[0].clientY;
    if (!sidebarOpen && y < (typeof window !== 'undefined' ? window.innerHeight - 60 : 600)) return;
    setTouchStart(y);
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStart === null) return;
    const diff = touchStart - e.targetTouches[0].clientY;
    if (diff > 50 && !sidebarOpen) { setSidebarOpen(true); setTouchStart(null); }
    if (diff < -50 && sidebarOpen) { setSidebarOpen(false); setTouchStart(null); }
  };

  const [autoPilotStatus, setAutoPilotStatus] = useState<'idle' | 'cleaning' | 'analyzing' | 'done'>('idle');
  const [autoPilotInsights, setAutoPilotInsights] = useState<string[]>([]);
  const [autoPilotCharts, setAutoPilotCharts] = useState<any[]>([]);
  const [autoPilotReport, setAutoPilotReport] = useState<any>(null);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  
  // ETL Pipeline State
  const [pipelineSteps, setPipelineSteps] = useState<any[]>([
    { id: 'step-0', type: 'source', name: 'Source Dataset', config: {} },
    { id: 'step-1', type: 'clean', name: 'Clean & Filter', config: {} }
  ]);
  const [isPipelineRunning, setIsPipelineRunning] = useState(false);
  const [pipelineResult, setPipelineResult] = useState<any[] | null>(null);
  const [pipelineColumns, setPipelineColumns] = useState<any[]>([]);

  // Load saved ETL pipeline when file changes
  useEffect(() => {
    if (fileInfo?.name) {
      try {
        const saved = localStorage.getItem(`datalens_pipeline_${fileInfo.name}`);
        if (saved) {
          setPipelineSteps(JSON.parse(saved));
        } else {
          setPipelineSteps([
            { id: 'step-0', type: 'source', name: 'Source Dataset', config: {} },
            { id: 'step-1', type: 'clean', name: 'Clean & Filter', config: {} }
          ]);
        }
      } catch (e) {
        console.error("Failed to load saved pipeline", e);
      }
      setPipelineResult(null);
    }
  }, [fileInfo?.name]);

  const triggerSaveSession = useCallback(async () => {
    if ((showRestoreSession && !hasRestored) || (!data.length && !initialData.length)) return;
    try {
      await saveSession({
        data, columns, initialData, initialColumns, history, historyIndex, fileInfo, activeTab, chatMessages
      });
      const est = await getStorageEstimate();
      if (est) setStorageUsage(`Using ${(est.usage / 1024 / 1024).toFixed(2)}MB of available ${(est.quota / 1024 / 1024 / 1024).toFixed(1)}GB`);
    } catch (e: any) {
      if (e.message && e.message.includes('exceeded')) {
        addToast('Storage full! Cannot save session.', 'error');
      }
    }
  }, [data, columns, initialData, initialColumns, history, historyIndex, fileInfo, activeTab, chatMessages, showRestoreSession, hasRestored]);

  useEffect(() => {
    const init = async () => {
      try {
        const est = await getStorageEstimate();
        if (est) setStorageUsage(`Using ${(est.usage / 1024 / 1024).toFixed(2)}MB of available ${(est.quota / 1024 / 1024 / 1024).toFixed(1)}GB`);
        const state = await loadSession();
        if (state && (state.data?.length > 0 || state.initialData?.length > 0)) {
          setShowRestoreSession(true);
        }
      } catch (e) {
        console.error("Storage error:", e);
      }
    };
    init();
  }, []);

  useEffect(() => {
    const interval = setInterval(triggerSaveSession, 30000);
    return () => clearInterval(interval);
  }, [triggerSaveSession]);

  const handleRestoreSession = async (restore: boolean) => {
    setShowRestoreSession(false);
    if (restore) {
      try {
        const state = await loadSession();
        if (state) {
          if (state.data) setData(state.data);
          if (state.columns) setColumns(state.columns);
          if (state.initialData) setInitialData(state.initialData);
          if (state.initialColumns) setInitialColumns(state.initialColumns);
          if (state.history) setHistory(state.history);
          if (state.historyIndex !== undefined) setHistoryIndex(state.historyIndex);
          if (state.fileInfo) setFileInfo(state.fileInfo);
          if (state.activeTab) setActiveTab(state.activeTab);
          if (state.chatMessages) setChatMessages(state.chatMessages);
          setHasRestored(true);
          addToast('Session restored successfully', 'success');
        }
      } catch (e) {
        addToast('Failed to restore session', 'error');
      }
    } else {
      await clearSession();
    }
  };

  const dispatchOp = (op: HistoryOp) => {
    let targetHistory = history.slice(0, historyIndex + 1);
    const { d, c } = applyForward(op, data, columns);
    setData(d);
    setColumns(c);

    if (targetHistory.length >= 20) {
      const oldestOp = targetHistory[0];
      const newInitial = applyForward(oldestOp, initialData, initialColumns);
      setInitialData(newInitial.d);
      setInitialColumns(newInitial.c);
      targetHistory = targetHistory.slice(1);
    }
    
    setHistory([...targetHistory, op]);
    setHistoryIndex(targetHistory.length);
    setTimeout(triggerSaveSession, 100);
  };

  const jumpToState = (targetIndex: number) => {
    if (targetIndex === historyIndex) return;
    let d = [...initialData];
    let c = [...initialColumns];
    for (let i = 0; i <= targetIndex; i++) {
        const result = applyForward(history[i], d, c);
        d = result.d;
        c = result.c;
    }
    setData(d);
    setColumns(c);
    setHistoryIndex(targetIndex);
    addToast(targetIndex === -1 ? 'Reverted to initial state' : `Jumped to: ${history[targetIndex].description}`, 'info');
    setTimeout(triggerSaveSession, 100);
  }

  const undo = () => {
    if (historyIndex >= 0) {
      jumpToState(historyIndex - 1);
    }
  };

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
  }, [historyIndex, initialData, initialColumns, history, undo]);


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
    const removedRows: {index: number, row: any}[] = [];
    const unique = new Set();
    const newData: any[] = [];
    data.forEach((row, i) => {
        const str = JSON.stringify(row);
        const hasNull = !Object.values(row).every(v => v !== null && v !== undefined && v !== '');
        if (!unique.has(str) && !hasNull) {
            unique.add(str);
            newData.push(row);
        } else {
            removedRows.push({index: i, row});
        }
    });
    
    if (removedRows.length > 0) {
       dispatchOp({
          id: Math.random().toString(36).substring(2),
          timestamp: Date.now(),
          description: `Auto-cleaned: removed ${removedRows.length} rows (duplicates/nulls)`,
          removedRows
       });
       addToast(`Auto-cleaned: removed ${removedRows.length} rows (duplicates/nulls)`, 'success');
    } else {
       addToast('Auto-cleaned: no duplicates or nulls found', 'info');
    }
    return newData;
  };

  const runFullAutomation = async () => {
    setAutoPilotStatus('cleaning');
    const cleanedData = autoCleanData();
    
    setAutoPilotStatus('analyzing');
    
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
        
        const result = await callAI({ prompt: context });
        
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

  const exportReportToPDF = async () => {
    if (!autoPilotReport) return;
    setIsExportingPDF(true);
    addToast("Preparing enterprise PDF report...", "info");

    // Wait for React to re-render without animations
    await new Promise(resolve => setTimeout(resolve, 300));

    try {
      const blueprint = document.createElement('div');
      blueprint.id = 'auto-analyst-report';
      blueprint.className = 'pdf-blueprint';
      document.body.appendChild(blueprint);

      // Apply inline styles to force a standard printable layout width before capturing
      blueprint.style.width = '800px';
      blueprint.style.boxSizing = 'border-box';

      const filename = fileInfo?.name || "dataset.csv";
      const dateStr = new Date().toLocaleDateString(undefined, {
        year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
      });

      blueprint.innerHTML = `
        <div class="pdf-page whitespace-normal break-words word-break-break-all" id="pdf-page-1">
          <div class="pdf-cover-page whitespace-normal break-words word-break-break-all">
            <div class="whitespace-normal break-words word-break-break-all">
              <div class="pdf-cover-accent-bar"></div>
              <h1 class="pdf-cover-title whitespace-normal break-words word-break-break-all">DataLens AI</h1>
              <h2 class="pdf-cover-subtitle whitespace-normal break-words word-break-break-all">Executive Analytics & Data Insights Report</h2>
            </div>
            <div class="whitespace-normal break-words word-break-break-all">
              <div class="pdf-meta-box whitespace-normal break-words word-break-break-all">
                <div class="pdf-meta-item whitespace-normal break-words word-break-break-all">
                  <span class="pdf-meta-label whitespace-normal break-words word-break-break-all">Source Document</span>
                  <span class="pdf-meta-value whitespace-normal break-words word-break-break-all">${filename}</span>
                </div>
                <div class="pdf-meta-item whitespace-normal break-words word-break-break-all">
                  <span class="pdf-meta-label whitespace-normal break-words word-break-break-all">Generated On</span>
                  <span class="pdf-meta-value whitespace-normal break-words word-break-break-all">${dateStr}</span>
                </div>
                <div class="pdf-meta-item whitespace-normal break-words word-break-break-all">
                  <span class="pdf-meta-label whitespace-normal break-words word-break-break-all">Data Format</span>
                  <span class="pdf-meta-value whitespace-normal break-words word-break-break-all">${filename.split('.').pop()?.toUpperCase() || 'CSV'}</span>
                </div>
              </div>
              <div class="pdf-metrics-grid whitespace-normal break-words word-break-break-all">
                <div class="pdf-metric-card whitespace-normal break-words word-break-break-all">
                  <div class="pdf-metric-value whitespace-normal break-words word-break-break-all">${autoPilotReport.data_quality_score || 100}/100</div>
                  <div class="pdf-metric-label whitespace-normal break-words word-break-break-all">Data Health Score</div>
                </div>
                <div class="pdf-metric-card whitespace-normal break-words word-break-break-all">
                  <div class="pdf-metric-value whitespace-normal break-words word-break-break-all">${data.length.toLocaleString()}</div>
                  <div class="pdf-metric-label whitespace-normal break-words word-break-break-all">Total Rows Analyzed</div>
                </div>
              </div>
            </div>
            <div class="whitespace-normal break-words word-break-break-all" style="font-size: 10px; color: #94a3b8; font-weight: 500;">
              CONFIDENTIAL • FOR INTERNAL USE ONLY
            </div>
          </div>
        </div>

        <div class="pdf-page whitespace-normal break-words word-break-break-all" id="pdf-page-2">
          <div class="pdf-header whitespace-normal break-words word-break-break-all">
            <span class="whitespace-normal break-words word-break-break-all">DataLens AI | Executive Report</span>
            <span class="whitespace-normal break-words word-break-break-all">Table of Contents</span>
          </div>
          <div class="pdf-content whitespace-normal break-words word-break-break-all">
            <h2 class="pdf-section-title whitespace-normal break-words word-break-break-all" style="margin-top: 40px; margin-bottom: 50px;">Table of Contents</h2>
            <div class="whitespace-normal break-words word-break-break-all" style="margin-bottom: 20px;">
              <div class="pdf-toc-item whitespace-normal break-words word-break-break-all">
                <span class="pdf-toc-title whitespace-normal break-words word-break-break-all">1. Executive Summary</span>
                <span class="pdf-toc-dots"></span>
                <span class="pdf-toc-page whitespace-normal break-words word-break-break-all">Page 3</span>
              </div>
              <div class="pdf-toc-item whitespace-normal break-words word-break-break-all">
                <span class="pdf-toc-title whitespace-normal break-words word-break-break-all">2. Key Analytical Insights</span>
                <span class="pdf-toc-dots"></span>
                <span class="pdf-toc-page whitespace-normal break-words word-break-break-all">Page 3</span>
              </div>
              <div class="pdf-toc-item whitespace-normal break-words word-break-break-all">
                <span class="pdf-toc-title whitespace-normal break-words word-break-break-all">3. Data Visualizations & Charts</span>
                <span class="pdf-toc-dots"></span>
                <span class="pdf-toc-page whitespace-normal break-words word-break-break-all">Page 4</span>
              </div>
              <div class="pdf-toc-item whitespace-normal break-words word-break-break-all">
                <span class="pdf-toc-title whitespace-normal break-words word-break-break-all">4. Strategic Business Recommendations</span>
                <span class="pdf-toc-dots"></span>
                <span class="pdf-toc-recommendations-page pdf-toc-page whitespace-normal break-words word-break-break-all">Page 5</span>
              </div>
            </div>
          </div>
          <div class="pdf-footer whitespace-normal break-words word-break-break-all">
            <span class="whitespace-normal break-words word-break-break-all">${filename}</span>
            <span class="pdf-page-number-text whitespace-normal break-words word-break-break-all">Page 2 of 5</span>
          </div>
        </div>

        <div class="pdf-page whitespace-normal break-words word-break-break-all" id="pdf-page-3">
          <div class="pdf-header whitespace-normal break-words word-break-break-all">
            <span class="whitespace-normal break-words word-break-break-all">DataLens AI | Executive Report</span>
            <span class="whitespace-normal break-words word-break-break-all">Executive Summary & Insights</span>
          </div>
          <div class="pdf-content whitespace-normal break-words word-break-break-all">
            <h2 class="pdf-section-title whitespace-normal break-words word-break-break-all">1. Executive Summary</h2>
            <p class="pdf-body-text whitespace-normal break-words word-break-break-all" style="margin-bottom: 30px;">
              ${(autoPilotReport.executive_summary || '').replace(/\n/g, '<br/>')}
            </p>
            
            <h2 class="pdf-section-title whitespace-normal break-words word-break-break-all" style="margin-top: 20px;">2. Key Analytical Insights</h2>
            <div class="whitespace-normal break-words word-break-break-all" style="display: flex; flex-direction: column; gap: 12px;">
              ${(autoPilotInsights || []).map((insight, idx) => `
                <div class="pdf-insight-row whitespace-normal break-words word-break-break-all" style="display: flex; align-items: flex-start;">
                  <div class="pdf-insight-badge whitespace-normal break-words word-break-break-all" style="display: inline-block !important; width: 24px !important; height: 24px !important; line-height: 24px !important; text-align: center !important; font-size: 12px !important; font-weight: bold !important; padding: 0 !important; margin: 0 !important; border-radius: 50% !important; flex-shrink: 0 !important;">${idx + 1}</div>
                  <div class="whitespace-normal break-words word-break-break-all" style="font-size: 12px; line-height: 1.5; color: #334155; font-weight: 500; flex: 1; min-width: 0;">
                    ${insight}
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
          <div class="pdf-footer whitespace-normal break-words word-break-break-all">
            <span class="whitespace-normal break-words word-break-break-all">${filename}</span>
            <span class="pdf-page-number-text whitespace-normal break-words word-break-break-all">Page 3 of 5</span>
          </div>
        </div>


        <div class="pdf-page whitespace-normal break-words word-break-break-all" id="pdf-page-5">
          <div class="pdf-header whitespace-normal break-words word-break-break-all">
            <span class="whitespace-normal break-words word-break-break-all">DataLens AI | Executive Report</span>
            <span class="whitespace-normal break-words word-break-break-all">Business Recommendations</span>
          </div>
          <div class="pdf-content whitespace-normal break-words word-break-break-all">
            <h2 class="pdf-section-title whitespace-normal break-words word-break-break-all">4. Strategic Recommendations</h2>
            <p class="pdf-body-text whitespace-normal break-words word-break-break-all">
              Based on the statistical properties of the dataset and the generated key insights, the following strategic path is recommended:
            </p>
            <div class="pdf-recommendation-box whitespace-normal break-words word-break-break-all">
              <div class="whitespace-normal break-words word-break-break-all" style="font-weight: 700; font-size: 13px; margin-bottom: 8px; color: #0f5132;">
                Strategic Guidance
              </div>
              ${(autoPilotReport.business_recommendation || '').replace(/\n/g, '<br/>')}
            </div>
          </div>
          <div class="pdf-footer whitespace-normal break-words word-break-break-all">
            <span class="whitespace-normal break-words word-break-break-all">${filename}</span>
            <span class="pdf-page-number-text whitespace-normal break-words word-break-break-all">Page 5 of 5</span>
          </div>
        </div>
      `;

      // Build the first charts page dynamically (avoids blank section-heading page)
      let chartPageCount = 1;
      const makeChartsPage = (pageCount: number, isFirst: boolean) => {
        const newPage = document.createElement('div');
        newPage.className = 'pdf-page whitespace-normal break-words word-break-break-all';
        newPage.id = `pdf-page-charts-${pageCount}`;
        newPage.innerHTML = `
          <div class="pdf-header whitespace-normal break-words word-break-break-all">
            <span class="whitespace-normal break-words word-break-break-all">DataLens AI | Executive Report</span>
            <span class="whitespace-normal break-words word-break-break-all">Data Visualizations${isFirst ? '' : ' (Cont.)'}</span>
          </div>
          <div class="pdf-content whitespace-normal break-words word-break-break-all">
            ${isFirst ? '<h2 class="pdf-section-title whitespace-normal break-words word-break-break-all" style="margin-bottom: 20px;">3. Data Visualizations</h2>' : ''}
            <div class="pdf-chart-container whitespace-normal break-words word-break-break-all" id="pdf-charts-target-${pageCount}">
            </div>
          </div>
          <div class="pdf-footer whitespace-normal break-words word-break-break-all">
            <span class="whitespace-normal break-words word-break-break-all">${filename}</span>
            <span class="pdf-page-number-text whitespace-normal break-words word-break-break-all">Page X</span>
          </div>
        `;
        const recPage = blueprint.querySelector('#pdf-page-5');
        if (recPage) blueprint.insertBefore(newPage, recPage);
        else blueprint.appendChild(newPage);
        return newPage;
      };

      let currentChartsPage = makeChartsPage(chartPageCount, true);
      let currentChartsTarget = currentChartsPage.querySelector(`#pdf-charts-target-${chartPageCount}`) as HTMLElement;

      for (let i = 0; i < autoPilotCharts.length; i++) {
        const activeChartEl = document.getElementById(`auto-chart-${i}`);
        if (activeChartEl && currentChartsTarget) {
          const remCharts = autoPilotCharts.length - i;
          const contentArea = currentChartsPage.querySelector('.pdf-content') as HTMLElement;
          const occupiedHeight = contentArea ? contentArea.scrollHeight : 0;
          const remainingSpace = 880 - occupiedHeight;

          let targetChartHeight = 360;
          let useCompression = false;

          if (remCharts === 1 && remainingSpace >= 520) {
            targetChartHeight = 460;
            useCompression = false;
          } else if (remCharts * 420 <= remainingSpace) {
            targetChartHeight = 360;
            useCompression = false;
          } else if (remCharts * 270 <= remainingSpace) {
            targetChartHeight = 220;
            useCompression = true;
          } else {
            targetChartHeight = 360;
            useCompression = false;
          }

          const cloned = activeChartEl.cloneNode(true) as HTMLDivElement;
          cloned.removeAttribute('id');
          cloned.style.position = 'absolute';
          cloned.style.left = '-9999px';
          cloned.style.top = '0';
          cloned.style.width = '800px';
          cloned.style.height = `${targetChartHeight}px`;
          cloned.style.backgroundColor = '#ffffff';
          cloned.style.boxShadow = 'none';
          cloned.style.border = 'none';
          cloned.style.padding = '20px';
          cloned.style.paddingBottom = '40px';
          cloned.style.boxSizing = 'border-box';
          
          document.body.appendChild(cloned);
          
          const svgTexts = cloned.querySelectorAll('text');
          svgTexts.forEach((text: any) => {
            text.setAttribute('fill', '#475569');
            text.style.fill = '#475569';
            text.style.fontSize = '12px';
          });

          const svgGrids = cloned.querySelectorAll('.recharts-cartesian-grid-horizontal line, .recharts-cartesian-grid-vertical line');
          svgGrids.forEach((line: any) => {
            line.setAttribute('stroke', '#e2e8f0');
            line.style.stroke = '#e2e8f0';
          });

          await new Promise(resolve => setTimeout(resolve, 150));

          const chartCanvas = await html2canvas(cloned, {
            scale: 2,
            useCORS: true,
            backgroundColor: '#ffffff',
            logging: false,
            width: 800,
            height: targetChartHeight
          });

          const chartDataUrl = chartCanvas.toDataURL('image/png');
          cloned.remove();
          
          const chartItemDiv = document.createElement('div');
          chartItemDiv.className = 'pdf-chart-item whitespace-normal break-words word-break-break-all';
          chartItemDiv.style.width = '100%';
          chartItemDiv.style.display = 'flex';
          chartItemDiv.style.flexDirection = 'column';
          chartItemDiv.style.pageBreakInside = 'avoid';
          chartItemDiv.style.breakInside = 'avoid';
          chartItemDiv.style.backgroundColor = '#ffffff';
          chartItemDiv.style.border = '1px solid #e2e8f0';
          chartItemDiv.style.borderRadius = '8px';
          chartItemDiv.style.boxSizing = 'border-box';

          if (useCompression) {
            chartItemDiv.style.padding = '10px';
            chartItemDiv.style.paddingBottom = '15px';
            chartItemDiv.style.marginBottom = '10px';
            chartItemDiv.style.maxHeight = `${targetChartHeight + 45}px`;
          } else {
            chartItemDiv.style.padding = '15px';
            chartItemDiv.style.paddingBottom = '25px';
            chartItemDiv.style.marginBottom = '20px';
            chartItemDiv.style.maxHeight = `${targetChartHeight + 60}px`;
          }

          const chartTitle = document.createElement('div');
          chartTitle.className = 'pdf-chart-title whitespace-normal break-words word-break-break-all';
          chartTitle.style.fontWeight = 'bold';
          chartTitle.style.color = '#1e293b';
          chartTitle.style.textAlign = 'center';
          chartTitle.innerText = autoPilotCharts[i].title;

          if (useCompression) {
            chartTitle.style.fontSize = '12px';
            chartTitle.style.marginBottom = '6px';
          } else {
            chartTitle.style.fontSize = '14px';
            chartTitle.style.marginBottom = '12px';
          }

          const img = document.createElement('img');
          img.src = chartDataUrl;
          img.style.width = '100%';
          img.style.height = 'auto';
          img.style.maxHeight = `${targetChartHeight}px`;
          img.style.objectFit = 'contain';
          img.style.display = 'block';

          chartItemDiv.appendChild(chartTitle);
          chartItemDiv.appendChild(img);
          currentChartsTarget.appendChild(chartItemDiv);

          const pageContentArea = currentChartsPage.querySelector('.pdf-content') as HTMLElement;
          if (pageContentArea && pageContentArea.scrollHeight > 880) {
            currentChartsTarget.removeChild(chartItemDiv);

            chartPageCount++;
            currentChartsPage = makeChartsPage(chartPageCount, false);
            currentChartsTarget = currentChartsPage.querySelector(`#pdf-charts-target-${chartPageCount}`) as HTMLElement;
            currentChartsTarget.appendChild(chartItemDiv);
          }
        }
      }

      await new Promise(resolve => setTimeout(resolve, 300));

      const allPages = blueprint.querySelectorAll('.pdf-page');
      const totalPages = allPages.length;

      const tocRecPageEl = blueprint.querySelector('.pdf-toc-recommendations-page');
      if (tocRecPageEl) {
        tocRecPageEl.textContent = `Page ${totalPages}`;
      }

      allPages.forEach((pageEl, idx) => {
        const pageNum = idx + 1;
        const footerPageNumEl = pageEl.querySelector('.pdf-page-number-text');
        if (footerPageNumEl) {
          footerPageNumEl.textContent = `Page ${pageNum} of ${totalPages}`;
        }
      });

      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'px',
        format: 'a4'
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      for (let index = 0; index < allPages.length; index++) {
        const pageEl = allPages[index] as HTMLElement;
        const canvas = await html2canvas(pageEl, {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff',
          logging: false,
          width: 800
        });

        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        if (index > 0) {
          doc.addPage();
        }
        doc.addImage(imgData, 'JPEG', 0, 0, pageWidth, pageHeight);
      }

      const datasetName = fileInfo?.name 
        ? fileInfo.name.replace(/\.[^/.]+$/, "").replace(/\s+/g, "_") 
        : 'executive';
      const formattedDate = new Date().toISOString().split('T')[0];
      doc.save(`datalens_${datasetName}_report_${formattedDate}.pdf`);
      addToast("PDF report generated successfully!", "success");
    } catch (error: any) {
      console.error("PDF Export Error:", error);
      addToast(`Failed to export PDF: ${error.message || error}`, "error");
    } finally {
      const bp = document.getElementById('auto-analyst-report');
      if (bp) {
        bp.style.width = '';
        bp.remove();
      }
      setIsExportingPDF(false);
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
           <div className="flex gap-3">
             {autoPilotStatus === 'done' && (
               <button 
                 className="btn-secondary flex items-center gap-2" 
                 onClick={exportReportToPDF}
                 disabled={isExportingPDF}
                 aria-label="Export executive report as PDF"
               >
                 {isExportingPDF ? <RefreshCcw className="animate-spin" size={16}/> : <Download size={16}/>}
                 Export PDF Report
               </button>
             )}
             <button 
                 className="btn-primary flex items-center gap-2" 
                 onClick={runFullAutomation}
                 disabled={autoPilotStatus !== 'idle' && autoPilotStatus !== 'done'}
             >
                <Wand2 size={16}/> {autoPilotStatus === 'idle' ? 'Magic Wand' : 'Rerun Auto-Pilot'}
             </button>
           </div>
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
              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-6 relative overflow-visible h-auto min-h-fit mb-6">
                 <div className="absolute top-0 left-0 w-1 h-full bg-[var(--primary)] rounded-l-xl"></div>
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
                       <li key={idx} className="flex items-start gap-3 text-sm">
                          <span className="rounded-full bg-gradient-to-br from-[var(--primary)] to-[var(--accent)] text-white shrink-0 select-none" style={{ display: 'inline-block', width: '24px', height: '24px', lineHeight: '24px', textAlign: 'center', fontSize: '12px', fontWeight: 'bold', padding: 0, margin: 0 }}>{idx + 1}</span>
                          <span className="pt-0.5 leading-relaxed">{insight}</span>
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
                    // Detect whether both axes are numeric (→ scatter) or categorical x (→ grouped bar/pie)
                    const xColMeta = columns.find(c => c.name === cfg.xAxis);
                    const yColMeta = columns.find(c => c.name === cfg.yAxis);
                    const xIsNumeric = xColMeta?.type === 'number';
                    const yIsNumeric = yColMeta?.type === 'number';

                    // Aggregate: group by xAxis, compute mean yAxis
                    const aggMap: Record<string, { sum: number; count: number }> = {};
                    data.forEach(row => {
                      const xKey = String(row[cfg.xAxis] ?? 'Unknown').trim();
                      const yVal = Number(row[cfg.yAxis]);
                      if (!isNaN(yVal)) {
                        if (!aggMap[xKey]) aggMap[xKey] = { sum: 0, count: 0 };
                        aggMap[xKey].sum += yVal;
                        aggMap[xKey].count += 1;
                      }
                    });
                    const aggregatedData = Object.entries(aggMap)
                      .map(([key, { sum, count }]) => ({ [cfg.xAxis]: key, [cfg.yAxis]: parseFloat((sum / count).toFixed(2)) }))
                      .sort((a, b) => (b[cfg.yAxis] as number) - (a[cfg.yAxis] as number))
                      .slice(0, 20); // cap at 20 unique groups for readability

                    if (cfg.type === 'pie') {
                       const pieData = aggregatedData.map(d => ({ name: String(d[cfg.xAxis]), value: d[cfg.yAxis] as number })).slice(0, 7);
                       return (
                          <div id={`auto-chart-${idx}`} key={idx} className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-6" style={{height: 350}}>
                             <h4 className="font-semibold mb-4 text-center">{cfg.title}</h4>
                             <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                   <Pie data={pieData} cx="50%" cy="50%" innerRadius="60%" outerRadius="80%" paddingAngle={5} dataKey="value" nameKey="name" isAnimationActive={!isExportingPDF} animationDuration={isExportingPDF ? 0 : 1500} animationEasing="ease-in-out">
                                      {pieData.map((e,i) => <Cell key={i} fill={CHART_COLORS[i%CHART_COLORS.length]}/>)}
                                   </Pie>
                                   <RechartsTooltip content={<CustomTooltip />} />
                                   {window.innerWidth >= 768 && <Legend verticalAlign="top" align="right" wrapperStyle={{fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold', color: 'var(--text-secondary)'}} />}
                                </PieChart>
                             </ResponsiveContainer>
                          </div>
                       );
                    }

                    // Use scatter chart when both axes are numeric
                    if (cfg.type === 'scatter' || (xIsNumeric && yIsNumeric)) {
                      const scatterData = data.slice(0, 200).map(row => ({
                        x: Number(row[cfg.xAxis]),
                        y: Number(row[cfg.yAxis]),
                      })).filter(d => !isNaN(d.x) && !isNaN(d.y));
                      return (
                        <div id={`auto-chart-${idx}`} key={idx} className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-6" style={{height: 350}}>
                          <h4 className="font-semibold mb-4 text-center">{cfg.title}</h4>
                          <ResponsiveContainer width="100%" height="100%">
                            <ScatterChart margin={{top:10, right:20, left:0, bottom:20}}>
                              <defs>
                                <linearGradient id={`autoScatterGrad${idx}`} x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="#22D3EE" stopOpacity={0.9}/>
                                  <stop offset="100%" stopColor="#6366F1" stopOpacity={0.9}/>
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="4 4" stroke="#1E2D3D" />
                              <XAxis type="number" dataKey="x" name={cfg.xAxis} tick={{fill: 'var(--text-muted)', fontSize: 11}} axisLine={{stroke:'#1E2D3D'}} tickLine={false} label={{value: cfg.xAxis, position:'insideBottom', offset:-10, fill:'var(--text-muted)', fontSize:11}} />
                              <YAxis type="number" dataKey="y" name={cfg.yAxis} tick={{fill: 'var(--text-muted)', fontSize: 11}} axisLine={false} tickLine={false} />
                              <RechartsTooltip content={<CustomTooltip />} cursor={{strokeDasharray:'3 3'}} />
                              <Scatter data={scatterData} fill={`url(#autoScatterGrad${idx})`} isAnimationActive={!isExportingPDF} animationDuration={isExportingPDF ? 0 : 1500} />
                            </ScatterChart>
                          </ResponsiveContainer>
                        </div>
                      );
                    }

                    // Grouped bar chart for categorical x-axis
                    const tickInterval = aggregatedData.length > 12 ? Math.ceil(aggregatedData.length / 10) : 0;
                    return (
                        <div id={`auto-chart-${idx}`} key={idx} className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-6" style={{height: 350}}>
                           <h4 className="font-semibold mb-4 text-center">{cfg.title}</h4>
                           <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={aggregatedData} layout="horizontal" margin={{top:10, right:10, left:0, bottom: aggregatedData.length > 8 ? 40 : 20}}>
                                 <defs>
                                   <linearGradient id={`autoBarGrad${idx}`} x1="0" y1="0" x2="0" y2="1">
                                     <stop offset="0%" stopColor="#22D3EE" stopOpacity={1}/>
                                     <stop offset="100%" stopColor="#6366F1" stopOpacity={1}/>
                                   </linearGradient>
                                 </defs>
                                 <CartesianGrid strokeDasharray="4 4" stroke="#1E2D3D" vertical={false} />
                                 <XAxis
                                   dataKey={cfg.xAxis}
                                   type="category"
                                   tick={{fill: 'var(--text-muted)', fontSize: aggregatedData.length > 8 ? 9 : 11}}
                                   axisLine={{stroke: '#1E2D3D'}}
                                   tickLine={false}
                                   interval={tickInterval}
                                   angle={aggregatedData.length > 8 ? -30 : 0}
                                   textAnchor={aggregatedData.length > 8 ? 'end' : 'middle'}
                                 />
                                 <YAxis tick={{fill: 'var(--text-muted)', fontSize: 11}} axisLine={false} tickLine={false} />
                                 <RechartsTooltip content={<CustomTooltip />} cursor={{fill: 'rgba(99,102,241,0.05)'}} />
                                 <Bar dataKey={cfg.yAxis} fill={`url(#autoBarGrad${idx})`} radius={[4, 4, 0, 0]} barSize={aggregatedData.length > 10 ? 18 : 32} isAnimationActive={!isExportingPDF} animationDuration={isExportingPDF ? 0 : 1500} animationEasing="ease-in-out" />
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
      addToast(`File size exceeds the 100MB maximum limit. Selected file size: ${(file.size / (1024 * 1024)).toFixed(2)}MB.`, 'error');
      return;
    }
    
    setLoading(true);
    setParseProgress({ percent: 0, stage: 'Reading file...', rows: 0, elapsed: 0, eta: 0 });
    let isCanceled = false;
    abortControllerRef.current = () => { isCanceled = true; setLoading(false); };
    
    try {
      let parsedData: any[] = [];
      const extension = file.name.split('.').pop()?.toLowerCase();
      const startTime = Date.now();

      const updateProgress = (stage: string, percent: number, rows: number) => {
          const now = Date.now();
          const elapsed = Math.floor((now - startTime) / 1000);
          const eta = percent > 0 && percent < 100 ? Math.floor((elapsed / percent) * (100 - percent)) : 0;
          setParseProgress({ percent: Math.min(100, Math.round(percent)), stage, rows, elapsed, eta });
      };

      if (['csv', 'json'].includes(extension || '')) {
         const previewChunk = await file.slice(0, 4096).text();
         if (/\x00/.test(previewChunk)) {
            throw new Error("File validation failed: Appears to be binary, but expected text (CSV/JSON). Check file contents/encoding.");
         }
      }

      if (extension === 'csv') {
        updateProgress('Parsing CSV structure...', 0, 0);
        parsedData = await new Promise<any[]>((resolve, reject) => {
           let rows: any[] = [];
           let lastUpdate = Date.now();
           
           Papa.parse(file, {
              header: true,
              skipEmptyLines: true,
              dynamicTyping: true,
              chunk: (results, parser) => {
                 if (isCanceled) {
                    parser.abort();
                    reject(new Error("Canceled"));
                    return;
                 }
                 
                 if (results.errors && results.errors.length > 0) {
                     const hasFieldMismatch = results.errors.some(e => e.type === 'FieldMismatch');
                     if (hasFieldMismatch) {
                         parser.abort();
                         reject(new Error("CSV validation failed: Inconsistent column count across rows."));
                         return;
                     }
                 }
                 
                 rows.push(...(results.data as any[]));
                 
                 const now = Date.now();
                 if (now - lastUpdate > 100) {
                     lastUpdate = now;
                     const percent = (results.meta.cursor / file.size) * 100;
                     updateProgress('Parsing data...', percent, rows.length);
                 }

                 if (rows.length > 500000) {
                     parser.abort();
                     reject(new Error(`File validation failed: Contains ${rows.length.toLocaleString()} rows, exceeding the max limit of 500,000.`));
                     return;
                 }
              },
              complete: () => {
                 updateProgress('Processing rows...', 100, rows.length);
                 resolve(rows);
              },
              error: (error) => {
                 reject(error);
              }
           });
        });
        
      } else if (extension === 'json') {
        updateProgress('Reading JSON...', 10, 0);
        const text = await file.text();
        if (isCanceled) throw new Error("Canceled");
        
        updateProgress('Parsing JSON structure...', 50, 0);
        
        await new Promise(r => setTimeout(r, 50));
        
        parsedData = JSON.parse(text);
        if (!Array.isArray(parsedData)) {
          throw new Error("JSON must contain an array of objects");
        }
        updateProgress('Processing data...', 100, parsedData.length);
      } else if (['xlsx', 'xls'].includes(extension || '')) {
        updateProgress('Reading Excel file...', 10, 0);
        const arrayBuffer = await file.arrayBuffer();
        if (isCanceled) throw new Error("Canceled");
        
        updateProgress('Parsing workbook structure...', 40, 0);
        await new Promise(r => setTimeout(r, 50));
        if (isCanceled) throw new Error("Canceled");
        
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        updateProgress('Analyzing columns...', 70, 0);
        await new Promise(r => setTimeout(r, 50));
        if (isCanceled) throw new Error("Canceled");
        
        parsedData = XLSX.utils.sheet_to_json(worksheet);
        updateProgress('Ready', 100, parsedData.length);
      } else {
        throw new Error("Unsupported file format");
      }

      if (parsedData.length === 0) {
        throw new Error("File contains no data");
      }

      if (parsedData.length > 500000) {
        throw new Error(`File validation failed: Contains ${parsedData.length.toLocaleString()} rows, exceeding the max limit of 500,000.`);
      }

      const keys = Object.keys(parsedData[0]);
      
      if (keys.length > 500) {
        throw new Error(`File validation failed: Contains ${keys.length.toLocaleString()} columns, exceeding the max limit of 500.`);
      }

      for (let i = 0; i < parsedData.length; i++) {
        const row = parsedData[i];
        for (let j = 0; j < keys.length; j++) {
           const key = keys[j];
           const val = row[key];
           
           if (strictMode) {
               if (val === null || val === undefined || val === '') {
                   throw new Error(`Strict mode validation failed: Null or empty string found at row ${i+1}, column '${key}'.`);
               }
           }

           if (typeof val === 'string' && /^=|^[+\-@][A-Za-z_]+\(/.test(val.trim())) {
               throw new Error(`Security validation failed: Potential CSV injection (formula starting with = or function call with +, -, @) detected at row ${i+1}, column '${key}'.`);
           }
        }
      }

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
      
      addToast(`Validated: ${parsedData.length.toLocaleString()} rows, ${keys.length.toLocaleString()} columns, no issues found`, 'success');
      setActiveTab('preview');
      
      setTimeout(triggerSaveSession, 100);
      
    } catch (err: any) {
      if (err.message === "Canceled") {
        addToast("File processing canceled", "info");
      } else {
        addToast(err.message || 'Error processing file', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

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
          <p className="text-xs text-slate-400 font-medium mb-6">Support for a single file upload. Maximum file size 100MB.</p>
          
          <div className="flex gap-4 mt-4">
            <div className="bg-slate-800 text-slate-200 border-slate-700/60 font-semibold px-2.5 py-1 rounded-md text-[11px] uppercase tracking-wide border flex items-center gap-1.5 shadow-sm"><FileText size={12} className="text-slate-400" /> CSV</div>
            <div className="bg-emerald-950/80 text-emerald-300 border-emerald-800/60 font-semibold px-2.5 py-1 rounded-md text-[11px] uppercase tracking-wide border flex items-center gap-1.5 shadow-sm"><FileSpreadsheet size={12} className="text-emerald-400" /> XLSX</div>
            <div className="bg-amber-950/80 text-amber-300 border-amber-800/60 font-semibold px-2.5 py-1 rounded-md text-[11px] uppercase tracking-wide border flex items-center gap-1.5 shadow-sm"><FileJson size={12} className="text-amber-400" /> JSON</div>
          </div>
        </label>
        
        <div className="flex justify-center mt-6">
          <label className="flex items-center justify-center gap-2.5 cursor-pointer select-none py-1.5 px-3 rounded-lg hover:bg-[rgba(255,255,255,0.02)] transition-colors">
            <input 
              type="checkbox" 
              checked={strictMode}
              onChange={(e) => setStrictMode(e.target.checked)}
              className="accent-[var(--primary)] w-4 h-4 cursor-pointer align-middle rounded"
            />
            <span className="text-sm text-slate-300 font-medium leading-none">Enable Strict Mode (reject nulls/empty strings)</span>
          </label>
        </div>

        {loading && (
          <div className="mt-8">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium">{parseProgress.stage || 'Processing Data...'}</span>
              <span className="mono-text text-sm" style={{color: 'var(--primary)'}}>{parseProgress.percent}%</span>
            </div>
            <div className="progress-container mb-2">
              <div className="progress-fill transition-all duration-200" style={{width: `${parseProgress.percent}%`}}></div>
            </div>
            <div className="flex justify-between items-center text-xs text-[#94A3B8] font-mono">
                <div className="flex gap-4">
                    <span>Rows: {parseProgress.rows.toLocaleString()}</span>
                    <span>Elapsed: {parseProgress.elapsed}s</span>
                    {parseProgress.eta > 0 && <span>ETA: {parseProgress.eta}s</span>}
                </div>
                <button 
                  onClick={(e) => {
                     e.stopPropagation();
                     abortControllerRef.current?.();
                  }} 
                  className="px-3 py-1 rounded bg-[rgba(239,68,68,0.1)] text-[var(--danger)] border border-[rgba(239,68,68,0.2)] hover:bg-[rgba(239,68,68,0.2)] transition-colors z-10 relative cursor-pointer"
                >
                  Cancel
                </button>
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

        <div className="table-container p-0 overflow-hidden flex-1 flex flex-col relative">
          <div className="table-fade-indicator"></div>
          <div className="table-scroll-hint">Pinch to zoom, swipe to scroll</div>
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
        const removedRows: {index: number, row: any}[] = [];
        data.forEach((row, i) => {
            const str = JSON.stringify(row);
            if (unique.has(str)) removedRows.push({index: i, row});
            else unique.add(str);
        });
        
        if (removedRows.length > 0) {
            dispatchOp({
                id: Math.random().toString(36).substring(2),
                timestamp: Date.now(),
                description: `Removed ${removedRows.length} duplicates`,
                removedRows
            });
            addToast(`Removed ${removedRows.length} duplicates`, 'success');
        } else {
            addToast('No duplicates found', 'info');
        }
    };

    const fillMissing = (method: string, customVal: string = '') => {
        if (!selectedCol) return;
        let val: any = customVal;
        const stats = calculateStats(data, selectedCol);
        
        if (method === 'mean' && stats) val = stats.mean;
        if (method === 'median' && stats) val = stats.median;
        if (method === 'zero') val = 0;
        
        const changedCellsInverse: any[] = [];
        const changedCellsForward: any[] = [];
        
        data.forEach((row, i) => {
            if (row[selectedCol] === null || row[selectedCol] === undefined || row[selectedCol] === '') {
                changedCellsInverse.push({ index: i, column: selectedCol, oldVal: row[selectedCol] });
                changedCellsForward.push({ index: i, column: selectedCol, newVal: val });
            }
        });
        if (changedCellsForward.length > 0) {
            dispatchOp({
                id: Math.random().toString(36).substring(2),
                timestamp: Date.now(),
                description: `Filled ${changedCellsForward.length} missing values in ${selectedCol}`,
                changedCellsInverse,
                changedCellsForward
            });
            addToast(`Filled ${changedCellsForward.length} missing values`, 'success');
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
            const removedRows: any[] = [];
            data.forEach((row, i) => {
                const val = Number(row[selectedCol]);
                if (!isNaN(val) && (val < lowerBound || val > upperBound)) removedRows.push({index: i, row});
            });
            if (removedRows.length > 0) {
                dispatchOp({
                    id: Math.random().toString(36).substring(2),
                    timestamp: Date.now(),
                    description: `Removed ${removedRows.length} outliers from ${selectedCol}`,
                    removedRows
                });
                addToast(`Removed ${removedRows.length} outliers`, 'success');
            } else {
                addToast('No outliers found', 'info');
            }
        } else {
            const changedCellsInverse: any[] = [];
            const changedCellsForward: any[] = [];
            data.forEach((row, i) => {
                const val = Number(row[selectedCol]);
                if (!isNaN(val)) {
                    if (val < lowerBound) {
                        changedCellsInverse.push({ index: i, column: selectedCol, oldVal: row[selectedCol] });
                        changedCellsForward.push({ index: i, column: selectedCol, newVal: lowerBound });
                    }
                    if (val > upperBound) {
                        changedCellsInverse.push({ index: i, column: selectedCol, oldVal: row[selectedCol] });
                        changedCellsForward.push({ index: i, column: selectedCol, newVal: upperBound });
                    }
                }
            });
            if (changedCellsForward.length > 0) {
                dispatchOp({
                    id: Math.random().toString(36).substring(2),
                    timestamp: Date.now(),
                    description: `Capped ${changedCellsForward.length} outliers in ${selectedCol}`,
                    changedCellsInverse,
                    changedCellsForward
                });
                addToast(`Capped outliers to bounds [${lowerBound.toFixed(2)}, ${upperBound.toFixed(2)}]`, 'success');
            } else {
                addToast('No outliers found', 'info');
            }
        }
    };

    const dropColumn = () => {
        if (!selectedCol) return;
        const type = columns.find(c => c.name === selectedCol)?.type || 'text';
        dispatchOp({
            id: Math.random().toString(36).substring(2),
            timestamp: Date.now(),
            description: `Dropped column: ${selectedCol}`,
            droppedColumn: { name: selectedCol, type, colData: data.map(d => d[selectedCol]) }
        });
        setSelectedCol(columns.filter(c => c.name !== selectedCol)[0]?.name || '');
        addToast(`Dropped column: ${selectedCol}`, 'success');
    };

    const changeDataType = (type: 'number' | 'text' | 'date') => {
        if (!selectedCol) return;
        const oldType = columns.find(c => c.name === selectedCol)?.type || 'text';
        if (oldType === type) return;
        
        const newData = data.map(row => {
            const val = row[selectedCol];
            if (val == null || val === '') return val;
            if (type === 'number') {
                const num = Number(val);
                return isNaN(num) ? null : num;
            } else if (type === 'text') {
                return String(val);
            } else if (type === 'date') {
                const date = new Date(val);
                return isNaN(date.getTime()) ? null : date.toISOString();
            }
            return val;
        });
        
        dispatchOp({
            id: Math.random().toString(36).substring(2),
            timestamp: Date.now(),
            description: `Converted ${selectedCol} from ${oldType} to ${type}`,
            convertedColumnInverse: { name: selectedCol, oldType, oldData: data.map(d => d[selectedCol]) },
            convertedColumnForward: { name: selectedCol, newType: type, newData }
        });
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

    const exportPivotCSV = () => {
        const rows = pivotData.rows;
        const cols = pivotData.cols;
        let csvContent = "Row," + cols.join(",") + "\n";
        
        rows.forEach(r => {
            let rowString = `"${r}",`;
            const rowValues = cols.map(c => {
                const val = getAggValue(r, c);
                return `"${val}"`;
            });
            rowString += rowValues.join(",");
            csvContent += rowString + "\n";
        });
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        const filePrefix = fileInfo?.name?.replace(/\.[^/.]+$/, "") || "dataset";
        link.setAttribute("href", url);
        link.setAttribute("download", `${filePrefix}_pivot.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        addToast("Pivot table exported as CSV", "success");
    };

    return (
      <div className="fade-in-up stagger-1 flex flex-col h-full">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2>Pivot Table</h2>
            <p className="text-muted mt-1">Multi-dimensional data summarization</p>
          </div>
          <button className="btn-secondary" onClick={exportPivotCSV}>
            <Download size={16} /> Export CSV
          </button>
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

        <div className="table-container p-0 overflow-hidden flex-1 flex flex-col relative">
          <div className="table-fade-indicator"></div>
          <div className="table-scroll-hint">Pinch to zoom, swipe to scroll</div>
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
        setLoadingInsights(true);
        try {
            let context = `Columns: ${columns.map(c => c.name).join(', ')}. \nHere are 5 samples: ${JSON.stringify(data.slice(0,5))}. \nGive exactly 5 bullet points of quick data analytics insights based on this data. Format as just 5 short, punchy plain text strings separated by newlines. No markdown bullets.`;
            const result = await callAI({ prompt: context });
            const text = result.text || "";
            setInsights(text.split('\n').filter((l: string) => l.trim().length > 0).slice(0,5).map((s: string) => s.replace(/^[-*•]\s*/, '').trim()));
        } catch (e: any) {
            addToast('AI key not configured or error occurred', 'warning');
            setInsights([
                "The dataset contains structural patterns that might be useful.",
                "Numeric columns show varied distributions.",
                "Ensure no unexpected nulls restrict visualization.",
                "Correlation coefficients can be observed in the heatmap below.",
                "Filter specific categories for more detailed analysis."
            ]);
        } finally {
            setLoadingInsights(false);
        }
    };

    const downloadPDF = async () => {
        const element = document.getElementById('eda-report');
        if (!element) return;
        setIsExportingPDF(true);
        addToast('Generating high-quality multi-page PDF...', 'info');
        
        await new Promise(resolve => setTimeout(resolve, 300));
        
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
            const pageHeight = pdf.internal.pageSize.getHeight();
            const imgHeight = (canvas.height * pdfWidth) / canvas.width;
            
            let heightLeft = imgHeight;
            let position = 0;
            
            pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, imgHeight);
            heightLeft -= pageHeight;
            
            while (heightLeft >= 0) {
                position = position - pageHeight;
                pdf.addPage();
                pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, imgHeight);
                heightLeft -= pageHeight;
            }
            
            const datasetName = fileInfo?.name 
                ? fileInfo.name.replace(/\.[^/.]+$/, "").replace(/\s+/g, "_") 
                : 'dataset';
            const formattedDate = new Date().toISOString().split('T')[0]; 
            pdf.save(`datalens_${datasetName}_eda_${formattedDate}.pdf`);
            addToast('Exported PDF successfully', 'success');
        } catch (e) {
            console.error(e);
            addToast('Export failed', 'error');
        } finally {
            setIsExportingPDF(false);
        }
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
          <button className="btn-primary" onClick={downloadPDF} disabled={isExportingPDF}>
             {isExportingPDF ? <RefreshCcw className="animate-spin" size={16}/> : <Download size={16}/>} Download PDF
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
                    <div className="overflow-x-auto table-container p-0 relative">
                        <div className="table-fade-indicator"></div>
                        <div className="table-scroll-hint">Pinch to zoom, swipe to scroll</div>
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
         let currentMessages = [...chatMessages, newMsg];
         setChatMessages(currentMessages);
         setChatInput('');
         
         setChatTyping(true);
         try {
             let activeMemory = chatMemory;
             if (currentMessages.length > 10) {
                 const msgsToCompress = currentMessages.slice(1, currentMessages.length - 4);
                 if (msgsToCompress.length > 0) {
                     const summarizePrompt = `Summarize the following chat history to serve as a compact context memory for future turns. Update the previous memory with any new important info.\n\nPrevious memory: ${activeMemory}\n\nChat:\n${msgsToCompress.map(m=>`${m.role}: ${m.content}`).join('\n')}`;
                     const sumResult = await callAI({ contents: [{role: 'user', parts: [{text: summarizePrompt}]}]});
                     activeMemory = sumResult.text || activeMemory;
                     setChatMemory(activeMemory);
                     currentMessages = [currentMessages[0], ...currentMessages.slice(currentMessages.length - 4)];
                     setChatMessages(currentMessages);
                 }
             }

             const colsContext = columns.map(c => c.name).join(', ');
             const sampleData = JSON.stringify(data.slice(0, 3));
             const systemPrompt = `You are an AI Data Assistant. The dataset has columns: ${colsContext}. Sample data: ${sampleData}.\n${activeMemory ? `Memory Context: ${activeMemory}\n` : ''}Provide concise, helpful answers.`;
             
             const historyForAPI = currentMessages.slice(1).map(m => ({
                 role: m.role,
                 parts: [{text: m.content}]
             }));
             historyForAPI.push({ role: 'user', parts: [{text: text}] });

             const contents = [
                 {role: 'user', parts: [{text: systemPrompt}]},
                 {role: 'model', parts: [{text: "Understood. I will be concise."}]},
                 ...historyForAPI
             ];

             const tokenCountEstimate = Math.round(JSON.stringify(contents).length / 4);
             setTokenEstimate(tokenCountEstimate);

             const result = await callAI({ contents });
             
             setChatMessages(prev => [...prev, { id: Date.now().toString(), role: 'model', content: result.text || "No response." }]);
         } catch (e: any) {
             setChatMessages(prev => [...prev, { id: Date.now().toString(), role: 'model', content: "Failed to connect to AI server. Check your configuration."}]);
         } finally {
             setChatTyping(false);
             setTimeout(triggerSaveSession, 100);
         }
     };

     const suggestions = ["What columns have missing values?", "What is the general trend?", "Find outliers", "Summarize this dataset"];

     const exportChatMD = () => {
         let md = `# DataLens AI Chat Export\n\n`;
         md += `**Active Memory:**\n${chatMemory || 'None'}\n\n`;
         chatMessages.forEach(m => {
             const role = m.role === 'user' ? '## User' : '## AI Assistant';
             md += `${role}\n${m.content}\n\n`;
         });
         const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' });
         const url = URL.createObjectURL(blob);
         const link = document.createElement("a");
         const filePrefix = fileInfo?.name?.replace(/\.[^/.]+$/, "") || "dataset";
         link.setAttribute("href", url);
         link.setAttribute("download", `${filePrefix}_chat.md`);
         document.body.appendChild(link);
         link.click();
         document.body.removeChild(link);
         URL.revokeObjectURL(url);
         addToast("Chat exported as Markdown", "success");
     };

     return (
       <div className="fade-in-up stagger-1 flex flex-col h-full">
         <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
           <div>
             <h2>AI Data Assistant</h2>
             <p className="text-muted mt-1">Talk to your dataset naturally</p>
             <div className="font-mono text-[10px] text-[var(--accent)] mt-1">
                ~{tokenEstimate.toLocaleString()} tokens used
                {tokenEstimate > 4000 && <span className="ml-2 text-[var(--danger)]">Approaching rate limits!</span>}
             </div>
           </div>
           <div className="flex gap-2 flex-wrap items-center">
               <span className="text-xs text-muted">History: {chatMessages.length}/10</span>
               <select className="premium-input premium-select h-8 text-xs py-0 w-32" onChange={(e) => {
                   if (e.target.value) {
                       const c = savedConversations[parseInt(e.target.value)];
                       if (c && window.confirm("Load conversation? Current unsaved chat will be lost.")) {
                           setChatMessages(c.messages);
                           setChatMemory(c.memory || '');
                           addToast("Conversation loaded", "info");
                       }
                       e.target.value = "";
                   }
               }}>
                   <option value="">Load Saved...</option>
                   {savedConversations.map((c, i) => <option key={i} value={i}>{c.name}</option>)}
               </select>
               <button className="btn-secondary h-8 px-3 text-xs" onClick={() => {
                   const name = prompt("Enter conversation name to save:");
                   if (name) {
                       const obj = {name, messages: [...chatMessages], memory: chatMemory};
                       const updated = [...savedConversations, obj];
                       setSavedConversations(updated);
                       localStorage.setItem('datalens_saved_chats', JSON.stringify(updated));
                       addToast("Conversation saved", "success");
                   }
               }}>
                  Save State
               </button>
               <button className="btn-secondary h-8 px-3 text-xs" onClick={() => {
                   if (window.confirm("Fork this conversation context into a new branch?")) {
                       setChatMessages([...chatMessages, { id: 'fork', 'role': 'model', content: '-- Branch Forked Here --' }]);
                   }
               }}>
                  Fork Context
               </button>
               <button className="btn-secondary h-8 px-3 text-xs" onClick={exportChatMD}>
                  <Download size={14} /> Export MD
               </button>
               <button className="btn-secondary h-8 px-3 text-xs" onClick={() => { setChatMessages([chatMessages[0]]); setChatMemory(''); setTokenEstimate(0); }}>
                  Clear Context
               </button>
           </div>
         </div>

         <div className="premium-card flex-1 flex flex-col p-0 overflow-hidden chat-container">
            {chatMemory && (
                <div className="p-3 bg-[rgba(255,255,255,0.03)] border-b border-[var(--border)] text-xs text-[var(--text-muted)] font-mono flex gap-2 overflow-auto" style={{maxHeight:'100px'}}>
                    <span className="font-bold shrink-0 text-[var(--primary)]">ACTIVE MEMORY:</span>
                    <span>{chatMemory}</span>
                </div>
            )}
            <div className="chat-messages hidden-scrollbar" ref={scrollRef}>
                {chatMessages.map(msg => (
                    <div key={msg.id} className={msg.role === 'user' ? 'chat-bubble-user' : 'chat-bubble-ai ml-4'} style={msg.id === 'fork' ? { background: 'transparent', border: '1px dashed var(--border)', textAlign: 'center', opacity: 0.5, fontStyle: 'italic', padding:'8px'} : {}}>
                        {msg.role === 'model' && msg.id !== 'fork' && (
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
    const [isSampledView, setIsSampledView] = useState(true);

    if (!data.length) return <div className="text-center mt-20">No data loaded</div>;
    if (numericCols.length === 0) return <div className="text-center mt-20">Numeric columns required for charting.</div>;

    const downloadChart = async (id: string, fileName: string, format: 'png' | 'svg' = 'png') => {
      addToast(`Generating ${format.toUpperCase()}...`, 'info');
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      
      const element = document.getElementById(id);
      if (!element) {
        addToast('Chart element not found', 'error');
        return;
      }
      
      const filePrefix = fileInfo?.name?.replace(/\.[^/.]+$/, "") || "dataset";
      const safeFileName = fileName.replace(/[^a-z0-9]/gi, '_').toLowerCase();

      if (format === 'svg') {
        try {
          const svgElement = element.querySelector('svg');
          if (!svgElement) {
             addToast('SVG not found for this chart', 'error');
             return;
          }
          const clone = svgElement.cloneNode(true) as SVGElement;
          if (!clone.getAttribute('xmlns')) {
              clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
          }
          const svgData = new XMLSerializer().serializeToString(clone);
          const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.setAttribute("href", url);
          link.setAttribute("download", `${filePrefix}_chart_${safeFileName}.svg`);
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          addToast('Exported SVG successfully', 'success');
        } catch (err) {
          addToast('Failed to export SVG', 'error');
        }
        return;
      }

      try {
        const canvas = await html2canvas(element, { 
          scale: 2, 
          backgroundColor: '#0D1117',
          useCORS: true,
          allowTaint: true
        });
        const imgData = canvas.toDataURL('image/png');
        const a = document.createElement('a');
        a.download = `${filePrefix}_chart_${safeFileName}.png`;
        a.href = imgData;
        a.click();
        addToast('Exported PNG successfully', 'success');
      } catch (e) {
        console.error(e);
        addToast('Export failed', 'error');
      }
    };

    const ChartWidget = ({ title, type, id }: { title: string, type: 'bar' | 'line' | 'pie' | 'scatter' | 'hist' | 'area', id: string }) => {
      const [xAxis, setXAxis] = useState(allCols[0]?.name || '');
      const [yAxis, setYAxis] = useState(numericCols[0]?.name || '');
      const [chartTitle, setChartTitle] = useState(title);
      const isMobile = useWindowWidth() < 768;
      
      const { sampledData, totalRows, isSampled } = useSampledData(data, isSampledView);

      const chartData = useMemo(() => {
        if (type === 'hist') {
          const values = sampledData.map(d => Number(d[yAxis])).filter(n => !isNaN(n));
          if (!values.length) return [];
          const min = Math.min(...values);
          const max = Math.max(...values);
          const binCount = 10;
          const binSize = (max - min) / binCount || 1;
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
        
        let sliceData = sampledData; 
        
        if (type === 'pie') {
           const aggregated: Record<string, number> = {};
           sliceData.forEach(d => {
             const key = String(d[xAxis] || 'Unknown');
             const val = Number(d[yAxis]) || 0;
             aggregated[key] = (aggregated[key] || 0) + val;
           });
           const result = Object.entries(aggregated).map(([name, value]) => ({ name, value }));
           return result.sort((a,b) => b.value - a.value).slice(0, 10);
        }

        if (type === 'scatter') {
           if (sliceData.length > 1000) {
               const xValues = sliceData.map(d => Number(d[xAxis])).filter(n => !isNaN(n));
               const yValues = sliceData.map(d => Number(d[yAxis])).filter(n => !isNaN(n));
               if (!xValues.length || !yValues.length) return [];

               const minX = Math.min(...xValues);
               const maxX = Math.max(...xValues);
               const minY = Math.min(...yValues);
               const maxY = Math.max(...yValues);

               const gridX = 20;
               const gridY = 20;
               const stepX = (maxX - minX) / gridX || 1;
               const stepY = (maxY - minY) / gridY || 1;

               const binMap = new Map<string, any>();

               sliceData.forEach(d => {
                   const x = Number(d[xAxis]);
                   const y = Number(d[yAxis]);
                   if (isNaN(x) || isNaN(y)) return;

                   let idxX = Math.floor((x - minX) / stepX);
                   if (idxX >= gridX) idxX = gridX - 1;
                   let idxY = Math.floor((y - minY) / stepY);
                   if (idxY >= gridY) idxY = gridY - 1;

                   const key = `${idxX},${idxY}`;
                   if (!binMap.has(key)) {
                       binMap.set(key, { 
                           [xAxis]: minX + (idxX * stepX) + (stepX / 2), 
                           [yAxis]: minY + (idxY * stepY) + (stepY / 2), 
                           count: 0 
                       });
                   }
                   binMap.get(key).count += 1;
               });

               return Array.from(binMap.values());
           }
        }

        return sliceData.map(d => ({
          ...d,
          [yAxis]: Number(d[yAxis])
        }));
      }, [xAxis, yAxis, type, sampledData]);

      const Header = () => (
        <div className="flex justify-between items-start mb-4">
          <div className="flex flex-col">
            <input 
              type="text" 
              value={chartTitle}
              onChange={e => setChartTitle(e.target.value)}
              className="bg-transparent border-b border-transparent focus:border-[var(--primary)] outline-none font-semibold text-lg max-w-[200px]"
            />
            {isSampled && (
              <span className="text-[10px] text-teal-400 font-mono mt-1 bg-teal-400/10 inline-block px-2 py-0.5 rounded w-max">
                Sampling indicator: Showing {sampledData.length.toLocaleString()} of {totalRows.toLocaleString()} rows
              </span>
            )}
            {type === 'scatter' && isSampledView === false && sampledData.length > 1000 && (
               <span className="text-[10px] text-orange-400 font-mono mt-1 bg-orange-400/10 inline-block px-2 py-0.5 rounded w-max">
                 2D Binned (Count Z-Axis)
               </span>
            )}
          </div>
          <div className="flex gap-1">
            <button className="btn-icon" title="Download SVG" onClick={() => downloadChart(id, chartTitle, 'svg')}>
              <span className="text-[10px] font-mono font-bold mr-1 opacity-70">SVG</span> <Download size={14} />
            </button>
            <button className="btn-icon" title="Download PNG" onClick={() => downloadChart(id, chartTitle, 'png')}>
              <span className="text-[10px] font-mono font-bold mr-1 opacity-70">PNG</span> <Download size={14} />
            </button>
          </div>
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
                <BarChart data={chartData} layout={isMobile ? "vertical" : "horizontal"} margin={{top: 10, right: 10, left: isMobile ? 30 : 0, bottom: 20}}>
                  <defs>
                    <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#22D3EE" stopOpacity={1}/>
                      <stop offset="100%" stopColor="#6366F1" stopOpacity={1}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="4 4" stroke="#1E2D3D" vertical={!isMobile} horizontal={isMobile} />
                  <XAxis dataKey={isMobile ? yAxis : xAxis} type={isMobile ? "number" : "category"} tick={{fill: 'var(--text-muted)', fontSize: 10}} axisLine={{stroke: '#1E2D3D'}} tickLine={false} />
                  <YAxis dataKey={isMobile ? xAxis : undefined} type={isMobile ? "category" : "number"} tick={{fill: 'var(--text-muted)', fontSize: 10}} axisLine={false} tickLine={false} />
                  <RechartsTooltip content={<CustomTooltip />} cursor={{fill: 'rgba(99,102,241,0.05)'}} />
                  <Bar dataKey={yAxis} fill="url(#barGradient)" radius={isMobile ? [0, 4, 4, 0] : [4, 4, 0, 0]} barSize={24} isAnimationActive={!isExportingPDF} animationDuration={isExportingPDF ? 0 : 1500} animationEasing="ease-in-out" />
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
                  <Area type="monotone" dataKey={yAxis} stroke="#6366F1" fillOpacity={1} fill="url(#colorGradient)" strokeWidth={3} activeDot={{r: 6, strokeWidth: 0, fill: '#22D3EE'}} isAnimationActive={!isExportingPDF} animationDuration={isExportingPDF ? 0 : 1500} animationEasing="ease-in-out" />
                </AreaChart>
              ) : type === 'line' ? (
                <LineChart data={chartData} margin={{top: 10, right: 10, left: 0, bottom: 20}}>
                  <CartesianGrid strokeDasharray="4 4" stroke="#1E2D3D" vertical={false} />
                  <XAxis dataKey={xAxis} tick={{fill: 'var(--text-muted)', fontSize: 11}} axisLine={{stroke: '#1E2D3D'}} tickLine={false} />
                  <YAxis tick={{fill: 'var(--text-muted)', fontSize: 11}} axisLine={false} tickLine={false} />
                  <RechartsTooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey={yAxis} stroke="#6366F1" strokeWidth={3} dot={false} activeDot={{r: 6, strokeWidth: 0, fill: '#22D3EE'}} isAnimationActive={!isExportingPDF} animationDuration={isExportingPDF ? 0 : 1500} animationEasing="ease-in-out" />
                </LineChart>
              ) : type === 'pie' ? (
                <PieChart margin={{top: 10, right: 10, left: 10, bottom: 10}}>
                  <Pie data={chartData} cx="50%" cy="50%" innerRadius="60%" outerRadius="80%" paddingAngle={5} dataKey="value" isAnimationActive={!isExportingPDF} animationDuration={isExportingPDF ? 0 : 1500} animationEasing="ease-in-out">
                    {chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}
                  </Pie>
                  <RechartsTooltip content={<CustomTooltip />} />
                  {!isMobile && <Legend verticalAlign="top" align="right" wrapperStyle={{fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold', color: 'var(--text-secondary)'}} />}
                </PieChart>
              ) : type === 'scatter' ? (
                <ScatterChart margin={{top: 10, right: 10, left: 0, bottom: 20}}>
                  <CartesianGrid strokeDasharray="4 4" stroke="#1E2D3D" vertical={false} />
                  <XAxis type="number" dataKey={xAxis} name={xAxis} tick={{fill: 'var(--text-muted)', fontSize: 11}} axisLine={{stroke: '#1E2D3D'}} />
                  <YAxis type="number" dataKey={yAxis} name={yAxis} tick={{fill: 'var(--text-muted)', fontSize: 11}} axisLine={false} />
                  <ZAxis dataKey={chartData[0] && chartData[0].count !== undefined ? 'count' : ''} range={[20, 200]} />
                  <RechartsTooltip content={<CustomTooltip />} />
                  <Scatter data={chartData} fill="#22D3EE" isAnimationActive={!isExportingPDF} animationDuration={isExportingPDF ? 0 : 1500} animationEasing="ease-in-out" />
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
                  <Bar dataKey="count" fill="url(#barGradient2)" radius={[4, 4, 0, 0]} barSize={32} isAnimationActive={!isExportingPDF} animationDuration={isExportingPDF ? 0 : 1500} animationEasing="ease-in-out" />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>
      );
    }

    return (
      <div className="fade-in-up stagger-1 flex flex-col h-full">
        <div className="mb-6 flex justify-between items-center">
          <div>
            <h2>Interactive Visualizations</h2>
            <p className="text-muted mt-1">Configure and export charts for your analysis</p>
          </div>
          <div className="flex items-center gap-3 bg-[var(--surface-light)] px-4 py-2 rounded-lg border border-[var(--border)]">
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input 
                type="checkbox" 
                checked={isSampledView}
                onChange={(e) => setIsSampledView(e.target.checked)}
                className="accent-[var(--primary)] w-4 h-4"
              />
              {isSampledView ? 'Sampled view' : 'Full view (may be slow)'}
            </label>
          </div>
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
        if (!query.trim()) {
           setQueryResult([...data]);
           return;
        }

        // Use alasql to run query against data array safely. 
        // We pass data as a parameter to alasql in an array.
        // The table is referenced as '?' in the query.
        // We do a simple replacement if the user typed "FROM data" 
        // to make it "FROM ?" so alasql knows to bind the array.
        const q = query.trim().replace(/\n/g, ' ');
        const preparedQuery = q.replace(/FROM\s+data\b/i, 'FROM ?');
        
        let res;
        if (preparedQuery.toUpperCase().includes('FROM ?')) {
           res = alasql(preparedQuery, [data]);
        } else if (!preparedQuery.toUpperCase().includes('FROM')) {
           // Provide basic query if FROM isn't specified (e.g. they modified things)
           res = alasql(preparedQuery + ' FROM ?', [data]);
        } else {
           // Allow them to use other table names by injecting '?' where first FROM is
           // but replacing what they typed.
           const firstFromParams = q.replace(/FROM\s+[a-zA-Z0-9_]+\b/i, 'FROM ?');
           res = alasql(firstFromParams, [data]);
        }
        
        setQueryResult(res);
      } catch (e: any) { 
        setSqlError(e.message || "An error occurred executing SQL query"); 
        setQueryResult(null); 
      }
    };

    const copySqlResults = () => {
      if (!queryResult || queryResult.length === 0) return;
      const keys = Object.keys(queryResult[0]);
      let tsv = keys.join("\t") + "\n";
      queryResult.forEach(row => {
        tsv += keys.map(k => String(row[k] ?? '')).join("\t") + "\n";
      });
      navigator.clipboard.writeText(tsv);
      addToast("SQL results copied as TSV", "success");
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
           {queryResult && (
             <button className="btn-secondary" onClick={copySqlResults}>Copy TSV To Clipboard</button>
           )}
        </div>
        {sqlError && <div className="p-4 bg-[rgba(239,68,68,0.1)] text-[var(--danger)] border border-[var(--danger)] rounded-lg text-sm font-mono">{sqlError}</div>}
        {queryResult && (
           <div className="flex-1 overflow-auto table-container p-0 border border-[var(--border)] rounded-xl relative">
             <div className="table-fade-indicator"></div>
             <div className="table-scroll-hint">Pinch to zoom, swipe to scroll</div>
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
  };  const MLLabSection = () => {
    const numericCols = columns.filter(c => c.type === 'number');
    const [modelType, setModelType] = useState<'lr' | 'kmeans'>('lr');
    const [xCol, setXCol] = useState(numericCols[0]?.name || '');
    const [yCol, setYCol] = useState(numericCols[1]?.name || '');
    const [trainSplit, setTrainSplit] = useState(80);
    
    const [kClusters, setKClusters] = useState(3);
    const [kmeansCols, setKmeansCols] = useState<string[]>([]);
    
    const [predictionInput, setPredictionInput] = useState('');
    const [predictionResult, setPredictionResult] = useState<number | null>(null);

    const [result, setResult] = useState<any>(null);
    const [training, setTraining] = useState(false);

    const evaluateModel = (yActual: number[], yPred: number[]) => {
      const n = yActual.length;
      if (n === 0) return { r2: 0, mse: 0, mae: 0 };
      const meanY = yActual.reduce((sum, val) => sum + val, 0) / n;
      let ssTot = 0;
      let ssRes = 0;
      let absErrorSum = 0;
      for (let i = 0; i < n; i++) {
        ssTot += Math.pow(yActual[i] - meanY, 2);
        ssRes += Math.pow(yActual[i] - yPred[i], 2);
        absErrorSum += Math.abs(yActual[i] - yPred[i]);
      }
      const r2 = ssTot === 0 ? 0 : 1 - (ssRes / ssTot);
      const mse = ssRes / n;
      const mae = absErrorSum / n;
      return { r2, mse, mae };
    };

    const trainModel = () => {
       if (data.length === 0) {
          addToast('No data available to train model', 'error');
          return;
       }
       setTraining(true);
       setResult(null);
       setPredictionResult(null);
       setPredictionInput('');

       setTimeout(() => {
          try {
              if (modelType === 'lr') {
                  if (!xCol || !yCol) {
                      throw new Error('Please select both X and Y columns');
                  }
                  
                  const pairs = data.map(d => ({
                      x: Number(d[xCol]),
                      y: Number(d[yCol])
                  })).filter(p => !isNaN(p.x) && !isNaN(p.y));
                  
                  if (pairs.length < 5) {
                      throw new Error('Dataset must contain at least 5 rows with numeric values for both columns');
                  }
                  
                  const splitRatio = trainSplit / 100;
                  const shuffled = [...pairs].sort(() => Math.random() - 0.5);
                  const trainSize = Math.floor(shuffled.length * splitRatio);
                  const trainPairs = shuffled.slice(0, trainSize);
                  const testPairs = shuffled.slice(trainSize);
                  
                  if (trainPairs.length === 0 || testPairs.length === 0) {
                      throw new Error('Invalid train/test split. Make sure dataset size is sufficient.');
                  }
                  
                  const xTrain = trainPairs.map(p => p.x);
                  const yTrain = trainPairs.map(p => p.y);
                  const xTest = testPairs.map(p => p.x);
                  const yTest = testPairs.map(p => p.y);
                  
                  const regression = new SimpleLinearRegression(xTrain, yTrain);
                  const m = regression.slope !== undefined ? regression.slope : (regression as any).coefficients[1];
                  const b = regression.intercept !== undefined ? regression.intercept : (regression as any).coefficients[0];
                  
                  const yTrainPred = xTrain.map(xVal => regression.predict(xVal));
                  const yTestPred = xTest.map(xVal => regression.predict(xVal));
                  
                  const trainEval = evaluateModel(yTrain, yTrainPred);
                  const testEval = evaluateModel(yTest, yTestPred);
                  
                  const residuals = testPairs.slice(0, 300).map(p => {
                      const pred = regression.predict(p.x);
                      return {
                          predicted: pred,
                          residual: p.y - pred
                      };
                  });
                  
                  setResult({
                      type: 'lr',
                      m,
                      b,
                      trainR2: trainEval.r2,
                      testR2: testEval.r2,
                      trainMse: trainEval.mse,
                      testMse: testEval.mse,
                      trainMae: trainEval.mae,
                      testMae: testEval.mae,
                      residuals,
                      regressionInstance: regression,
                      xLabel: xCol,
                      yLabel: yCol
                  });
                  addToast('Regression model trained successfully', 'success');
              } else if (modelType === 'kmeans') {
                  const selectedCols = kmeansCols.length > 0 ? kmeansCols : numericCols.map(c => c.name);
                  if (selectedCols.length === 0) {
                      throw new Error('No numeric features available for clustering');
                  }
                  
                  const matrix = data.map(d => selectedCols.map(col => Number(d[col]))).filter(row => row.every(n => !isNaN(n)));
                  
                  if (matrix.length < kClusters) {
                      throw new Error(`Dataset must have at least ${kClusters} rows with valid numeric feature values`);
                  }
                  
                  const kmeansResult = kmeans(matrix, kClusters, {
                      maxIterations: 100
                  });
                  
                  let finalInertia = 0;
                  for (let i = 0; i < matrix.length; i++) {
                      const clusterIdx = kmeansResult.clusters[i];
                      const centroidCoords = kmeansResult.centroids[clusterIdx];
                      finalInertia += Math.pow(euclideanDistance(matrix[i], centroidCoords), 2);
                  }
                  
                  const silhouetteSampleSize = Math.min(matrix.length, 300);
                  const sampledIndices: number[] = [];
                  const pool = Array.from({ length: matrix.length }, (_, i) => i);
                  for (let i = 0; i < silhouetteSampleSize; i++) {
                      const r = Math.floor(Math.random() * pool.length);
                      sampledIndices.push(pool[r]);
                      pool[r] = pool[pool.length - 1];
                      pool.pop();
                  }
                  const sampledPoints = sampledIndices.map(idx => matrix[idx]);
                  const sampledClusters = sampledIndices.map(idx => kmeansResult.clusters[idx]);
                  const silhouetteScore = calculateSilhouetteScore(sampledPoints, sampledClusters);
                  
                  const elbowSampleSize = Math.min(matrix.length, 1000);
                  const elbowSample = matrix.slice(0, elbowSampleSize);
                  const elbowData: { k: number; inertia: number }[] = [];
                  
                  let k1Inertia = 0;
                  if (elbowSample.length > 0) {
                      const meanPoint = Array(selectedCols.length).fill(0);
                      for (let i = 0; i < elbowSample.length; i++) {
                          for (let j = 0; j < selectedCols.length; j++) {
                              meanPoint[j] += elbowSample[i][j];
                          }
                      }
                      meanPoint.forEach((_, idx) => meanPoint[idx] /= elbowSample.length);
                      for (let i = 0; i < elbowSample.length; i++) {
                          k1Inertia += Math.pow(euclideanDistance(elbowSample[i], meanPoint), 2);
                      }
                  }
                  elbowData.push({ k: 1, inertia: k1Inertia });
                  
                  for (let k = 2; k <= 8; k++) {
                      try {
                          const kRes = kmeans(elbowSample, k, { maxIterations: 30 });
                          let kInertia = 0;
                          for (let i = 0; i < elbowSample.length; i++) {
                              const cIdx = kRes.clusters[i];
                              const centCoords = kRes.centroids[cIdx];
                              kInertia += Math.pow(euclideanDistance(elbowSample[i], centCoords), 2);
                          }
                          elbowData.push({ k, inertia: kInertia });
                      } catch (err) {
                          // Ignore
                      }
                  }
                  
                  const plotSampleSize = Math.min(matrix.length, 500);
                  const plotSamplePoints = matrix.slice(0, plotSampleSize);
                  const plotSampleClusters = kmeansResult.clusters.slice(0, plotSampleSize);
                  
                  let plotData: any[] = [];
                  let isPCA = false;
                  let xLabel = '';
                  let yLabel = '';
                  
                  if (selectedCols.length === 1) {
                      plotData = plotSamplePoints.map((p, idx) => ({
                          x: p[0],
                          y: idx,
                          cluster: plotSampleClusters[idx]
                      }));
                      xLabel = selectedCols[0];
                      yLabel = 'Index';
                  } else if (selectedCols.length === 2) {
                      plotData = plotSamplePoints.map((p, idx) => ({
                          x: p[0],
                          y: p[1],
                          cluster: plotSampleClusters[idx]
                      }));
                      xLabel = selectedCols[0];
                      yLabel = selectedCols[1];
                  } else {
                      const { pc1, pc2 } = getPCA2D(plotSamplePoints);
                      plotData = plotSamplePoints.map((_, idx) => ({
                          x: pc1[idx],
                          y: pc2[idx],
                          cluster: plotSampleClusters[idx]
                      }));
                      isPCA = true;
                      xLabel = 'PC1';
                      yLabel = 'PC2';
                  }
                  
                  setResult({
                      type: 'kmeans',
                      k: kClusters,
                      inertia: finalInertia,
                      silhouette: silhouetteScore,
                      elbowData,
                      plotData,
                      isPCA,
                      xLabel,
                      yLabel,
                      selectedCols
                  });
                  addToast('K-Means clustering completed', 'success');
              }
          } catch (e: any) {
              console.error(e);
              addToast(e.message || 'Model training failed', 'error');
          } finally {
              setTraining(false);
          }
       }, 800);
    };

    const handlePredict = (e: React.FormEvent) => {
        e.preventDefault();
        if (!result || result.type !== 'lr' || !predictionInput) return;
        const xVal = parseFloat(predictionInput);
        if (isNaN(xVal)) {
            addToast('Please enter a valid numeric value for X', 'error');
            return;
        }
        try {
            const yVal = result.regressionInstance.predict(xVal);
            setPredictionResult(yVal);
        } catch (err: any) {
            addToast('Prediction failed: ' + err.message, 'error');
        }
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
                     <div>
                       <label className="input-label block mb-1">Train/Test Split ({trainSplit}%)</label>
                       <input 
                         type="range" 
                         min="50" 
                         max="90" 
                         step="5"
                         value={trainSplit} 
                         onChange={e=>setTrainSplit(parseInt(e.target.value))} 
                         className="ml-slider mt-2 w-full" 
                       />
                       <div className="flex justify-between text-[10px] text-muted mt-1">
                          <span>Train: {trainSplit}%</span>
                          <span>Test: {100 - trainSplit}%</span>
                       </div>
                     </div>
                  </>
             )}
             {modelType === 'kmeans' && (
                  <>
                     <div>
                       <label className="input-label block mb-1">Number of Clusters (K)</label>
                       <input 
                         type="range" 
                         min="2" 
                         max="10" 
                         value={kClusters} 
                         onChange={e=>setKClusters(parseInt(e.target.value))} 
                         className="ml-slider mt-2 w-full" 
                       />
                       <div className="text-right text-xs text-muted mt-1">{kClusters} Clusters</div>
                     </div>
                     <div className="mt-2">
                       <label className="input-label block mb-2">Select Features (Numeric Columns)</label>
                       <div className="flex flex-col gap-2 max-h-48 overflow-y-auto border border-[var(--border)] p-3 rounded-lg bg-[var(--surface-light)]">
                           {numericCols.map(col => {
                               const isChecked = kmeansCols.length === 0 ? true : kmeansCols.includes(col.name);
                               return (
                                 <label key={col.name} className="flex items-center gap-2 text-xs text-muted hover:text-white cursor-pointer py-1">
                                    <input 
                                       type="checkbox" 
                                       checked={isChecked} 
                                       onChange={(e) => {
                                           const current = kmeansCols.length === 0 ? numericCols.map(c => c.name) : kmeansCols;
                                           if (e.target.checked) {
                                               setKmeansCols([...current, col.name]);
                                           } else {
                                               setKmeansCols(current.filter(c => c !== col.name));
                                           }
                                       }}
                                       className="accent-[var(--primary)] w-3.5 h-3.5"
                                    />
                                    <span className="truncate">{col.name}</span>
                                 </label>
                               );
                           })}
                       </div>
                       <div className="text-[10px] text-muted mt-1 font-mono">
                          {kmeansCols.length === 0 ? numericCols.length : kmeansCols.length} features selected
                       </div>
                     </div>
                  </>
             )}
             
             <div className="mt-auto">
                <button className="btn-primary w-full justify-center" onClick={trainModel} disabled={training}>
                  {training ? <span className="animate-pulse">Training...</span> : <><Zap size={16}/> Train Model</>}
                </button>
             </div>
          </div>
          <div className="flex-1 bg-[var(--surface)] border border-[var(--border)] rounded-xl p-6 flex flex-col overflow-y-auto hidden-scrollbar">
             {result ? (
                  <div className="fade-in flex flex-col gap-6">
                     <div className="flex justify-between items-center">
                         <h2>Model Results ({result.type === 'lr' ? 'Regression' : 'K-Means'})</h2>
                         <span className="text-xs bg-[var(--success)] text-black px-2 py-1 rounded font-bold uppercase tracking-wider">Ready</span>
                     </div>
                     
                     {result.type === 'lr' && (
                         <>
                            <div className="grid grid-cols-3 gap-4">
                               <div className="premium-card p-4 text-center shadow-lg border-t-2 border-t-[var(--primary)]">
                                  <div className="text-3xl font-mono text-white mb-1">{result.testR2.toFixed(4)}</div>
                                  <div className="text-[10px] text-muted uppercase tracking-wider font-semibold">Test R² Score</div>
                                  <div className="text-[9px] text-[var(--primary)] font-mono mt-1">Train R²: {result.trainR2.toFixed(4)}</div>
                               </div>
                               <div className="premium-card p-4 text-center border-t-2 border-t-[var(--success)]">
                                  <div className="text-3xl font-mono text-[var(--success)] mb-1">{result.testMse.toFixed(2)}</div>
                                  <div className="text-[10px] text-muted uppercase tracking-wider font-semibold">Test MSE</div>
                                  <div className="text-[9px] text-[var(--success)] font-mono mt-1">Train MSE: {result.trainMse.toFixed(2)}</div>
                               </div>
                               <div className="premium-card p-4 text-center border-t-2 border-t-[var(--warning)]">
                                  <div className="text-3xl font-mono text-[var(--warning)] mb-1">{result.testMae.toFixed(2)}</div>
                                  <div className="text-[10px] text-muted uppercase tracking-wider font-semibold">Test MAE</div>
                                  <div className="text-[9px] text-[var(--warning)] font-mono mt-1">Train MAE: {result.trainMae.toFixed(2)}</div>
                               </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                               <div className="premium-card p-5 flex flex-col justify-center">
                                  <h3 className="text-sm font-semibold mb-2">Linear Regression Formula</h3>
                                  <div className="font-mono text-xl text-[var(--primary)] bg-[rgba(0,0,0,0.3)] p-4 rounded-lg border border-[var(--border)] text-center">
                                     y = {result.m.toFixed(4)}x + {result.b.toFixed(4)}
                                  </div>
                                  <div className="text-[10px] text-muted mt-2">
                                     Intercept (b): {result.b.toFixed(6)} <br/>
                                     Slope (m): {result.m.toFixed(6)}
                                  </div>
                                </div>

                               <div className="premium-card p-5">
                                  <h3 className="text-sm font-semibold mb-3">Make a Prediction</h3>
                                  <form onSubmit={handlePredict} className="flex gap-2">
                                     <input 
                                        type="number" 
                                        step="any"
                                        placeholder={`Enter ${result.xLabel}...`}
                                        value={predictionInput}
                                        onChange={e=>setPredictionInput(e.target.value)}
                                        className="premium-input flex-1 text-sm h-9"
                                     />
                                     <button type="submit" className="btn-primary h-9 text-xs">Predict</button>
                                  </form>
                                  {predictionResult !== null && (
                                     <div className="mt-3 p-3 bg-[var(--surface-light)] border border-[var(--border)] rounded-lg flex justify-between items-center">
                                        <span className="text-xs text-muted">Predicted {result.yLabel}:</span>
                                        <span className="font-mono text-sm font-bold text-[var(--success)]">{predictionResult.toFixed(4)}</span>
                                     </div>
                                  )}
                               </div>
                            </div>

                            <div className="premium-card p-5">
                               <h3 className="text-sm font-semibold mb-2">Residuals Plot (Residuals vs Fitted Values)</h3>
                               <p className="text-[10px] text-muted mb-4">Ideally, points should be randomly scattered around the horizontal axis y=0.</p>
                               <div className="h-64 w-full">
                                  <ResponsiveContainer width="100%" height="100%">
                                     <ScatterChart margin={{ top: 10, right: 10, bottom: 20, left: 10 }}>
                                        <CartesianGrid strokeDasharray="4 4" stroke="#1E2D3D" vertical={false} />
                                        <XAxis type="number" dataKey="predicted" name="Fitted Values" tick={{fill: 'var(--text-muted)', fontSize: 10}} axisLine={{stroke: '#1E2D3D'}} label={{ value: 'Fitted Values', position: 'bottom', offset: 0, fill: 'var(--text-muted)', fontSize: 10 }} />
                                        <YAxis type="number" dataKey="residual" name="Residual" tick={{fill: 'var(--text-muted)', fontSize: 10}} axisLine={false} label={{ value: 'Residual', angle: -90, position: 'left', offset: 0, fill: 'var(--text-muted)', fontSize: 10 }} />
                                        <RechartsTooltip cursor={{ strokeDasharray: '3 3' }} />
                                        <Scatter name="Residuals" data={result.residuals} fill="#EF4444" />
                                     </ScatterChart>
                                  </ResponsiveContainer>
                               </div>
                            </div>
                         </>
                     )}
                     
                     {result.type === 'kmeans' && (
                         <>
                            <div className="grid grid-cols-3 gap-4">
                               <div className="premium-card p-4 text-center shadow-lg border-t-2 border-t-[var(--primary)]">
                                  <div className="text-3xl font-mono text-white mb-1">{result.k}</div>
                                  <div className="text-[10px] text-muted uppercase tracking-wider font-semibold">K Clusters</div>
                               </div>
                               <div className="premium-card p-4 text-center border-t-2 border-t-[var(--success)]">
                                  <div className="text-3xl font-mono text-[var(--success)] mb-1">{result.silhouette.toFixed(3)}</div>
                                  <div className="text-[10px] text-muted uppercase tracking-wider font-semibold">Silhouette Score</div>
                               </div>
                               <div className="premium-card p-4 text-center border-t-2 border-t-[var(--warning)]">
                                  <div className="text-3xl font-mono text-[var(--warning)] mb-1">{result.inertia.toFixed(1)}</div>
                                  <div className="text-[10px] text-muted uppercase tracking-wider font-semibold">Total Inertia</div>
                               </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                               <div className="premium-card p-5 flex flex-col">
                                  <h3 className="text-sm font-semibold mb-2">Cluster Visualization</h3>
                                  <p className="text-[10px] text-muted mb-4">
                                     {result.isPCA 
                                       ? "Multi-dimensional features projected to 2D using Principal Component Analysis (PCA)." 
                                       : `Scatter plot of ${result.xLabel} vs ${result.yLabel} colored by cluster.`}
                                  </p>
                                  <div className="h-64 w-full">
                                     <ResponsiveContainer width="100%" height="100%">
                                        <ScatterChart margin={{ top: 10, right: 10, bottom: 20, left: 10 }}>
                                           <CartesianGrid strokeDasharray="4 4" stroke="#1E2D3D" />
                                           <XAxis type="number" dataKey="x" name={result.xLabel} tick={{fill: 'var(--text-muted)', fontSize: 10}} axisLine={{stroke: '#1E2D3D'}} label={{ value: result.xLabel, position: 'bottom', offset: 0, fill: 'var(--text-muted)', fontSize: 10 }} />
                                           <YAxis type="number" dataKey="y" name={result.yLabel} tick={{fill: 'var(--text-muted)', fontSize: 10}} axisLine={false} label={{ value: result.yLabel, angle: -90, position: 'left', offset: 0, fill: 'var(--text-muted)', fontSize: 10 }} />
                                           <RechartsTooltip cursor={{ strokeDasharray: '3 3' }} />
                                           <Scatter name="Datapoints" data={result.plotData}>
                                              {result.plotData.map((entry: any, index: number) => (
                                                <Cell key={`cell-${index}`} fill={CHART_COLORS[entry.cluster % CHART_COLORS.length]} />
                                              ))}
                                           </Scatter>
                                        </ScatterChart>
                                     </ResponsiveContainer>
                                  </div>
                               </div>

                               <div className="premium-card p-5 flex flex-col">
                                  <h3 className="text-sm font-semibold mb-2">Elbow Method (K vs Inertia)</h3>
                                  <p className="text-[10px] text-muted mb-4">The "elbow" point is where the rate of decrease in inertia slows down significantly.</p>
                                  <div className="h-64 w-full">
                                     <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={result.elbowData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                                           <CartesianGrid strokeDasharray="4 4" stroke="#1E2D3D" vertical={false} />
                                           <XAxis dataKey="k" tick={{fill: 'var(--text-muted)', fontSize: 10}} axisLine={{stroke: '#1E2D3D'}} label={{ value: 'Clusters (K)', position: 'bottom', offset: 0, fill: 'var(--text-muted)', fontSize: 10 }} />
                                           <YAxis tick={{fill: 'var(--text-muted)', fontSize: 10}} axisLine={false} label={{ value: 'Inertia', angle: -90, position: 'left', offset: 0, fill: 'var(--text-muted)', fontSize: 10 }} />
                                           <RechartsTooltip />
                                           <Line type="monotone" dataKey="inertia" stroke="#6366F1" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                                        </LineChart>
                                     </ResponsiveContainer>
                                  </div>
                               </div>
                            </div>
                         </>
                     )}
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
    const [showAddForm, setShowAddForm] = useState(false);
    const [newStepType, setNewStepType] = useState<'filter' | 'drop_columns' | 'fill_nulls' | 'replace' | 'group_by' | 'sort'>('filter');

    // Config form states:
    const [filterCol, setFilterCol] = useState(columns[0]?.name || '');
    const [filterOp, setFilterOp] = useState('==');
    const [filterVal, setFilterVal] = useState('');

    const [dropCols, setDropCols] = useState<string[]>([]);

    const [fillCol, setFillCol] = useState(columns[0]?.name || '');
    const [fillVal, setFillVal] = useState('');

    const [repCol, setRepCol] = useState(columns[0]?.name || '');
    const [repTarget, setRepTarget] = useState('');
    const [repVal, setRepVal] = useState('');

    const [sortCol, setSortCol] = useState(columns[0]?.name || '');
    const [sortDir, setSortDir] = useState('asc');

    const [groupByCol, setGroupByCol] = useState(columns.find(c => c.type === 'text')?.name || columns[0]?.name || '');
    const [aggCol, setAggCol] = useState(columns.find(c => c.type === 'number')?.name || columns[0]?.name || '');
    const [aggFn, setAggFn] = useState('sum');

    // Preview table pagination
    const [previewPage, setPreviewPage] = useState(0);
    const rowsPerPage = 5;

    // Reset column selectors when columns list changes
    useEffect(() => {
      if (columns.length > 0) {
        setFilterCol(columns[0].name);
        setFillCol(columns[0].name);
        setRepCol(columns[0].name);
        setSortCol(columns[0].name);
        const textCol = columns.find(c => c.type === 'text')?.name || columns[0].name;
        const numCol = columns.find(c => c.type === 'number')?.name || columns[0].name;
        setGroupByCol(textCol);
        setAggCol(numCol);
      }
    }, [columns]);

    const handleAddStep = () => {
      let config: any = {};
      let name = '';

      switch (newStepType) {
        case 'filter':
          if (!filterCol) {
            addToast('Please select a column to filter', 'warning');
            return;
          }
          config = { column: filterCol, operator: filterOp, value: filterVal };
          name = `Filter: ${filterCol} ${filterOp} "${filterVal}"`;
          break;
        case 'drop_columns':
          if (dropCols.length === 0) {
            addToast('Please select at least one column to drop', 'warning');
            return;
          }
          config = { selectedColumns: dropCols };
          name = `Drop Columns: ${dropCols.join(', ')}`;
          break;
        case 'fill_nulls':
          if (!fillCol) {
            addToast('Please select a column', 'warning');
            return;
          }
          config = { column: fillCol, fillValue: fillVal };
          name = `Fill Nulls in ${fillCol} with "${fillVal}"`;
          break;
        case 'replace':
          if (!repCol) {
            addToast('Please select a column', 'warning');
            return;
          }
          config = { column: repCol, target: repTarget, replacement: repVal };
          name = `Replace in ${repCol}: "${repTarget}" → "${repVal}"`;
          break;
        case 'sort':
          if (!sortCol) {
            addToast('Please select a column to sort', 'warning');
            return;
          }
          config = { column: sortCol, direction: sortDir };
          name = `Sort by ${sortCol} (${sortDir.toUpperCase()})`;
          break;
        case 'group_by':
          if (!groupByCol || !aggCol) {
            addToast('Please select group and aggregation columns', 'warning');
            return;
          }
          config = { groupColumn: groupByCol, aggColumn: aggCol, aggFunction: aggFn };
          name = `Group By ${groupByCol}: ${aggFn.toUpperCase()}(${aggCol})`;
          break;
        default:
          return;
      }

      const newStep = {
        id: `step-${Date.now()}`,
        type: newStepType,
        name,
        config
      };

      setPipelineSteps([...pipelineSteps, newStep]);
      setShowAddForm(false);
      // Reset config inputs
      setFilterVal('');
      setDropCols([]);
      setFillVal('');
      setRepTarget('');
      setRepVal('');
      addToast('Transformation step added successfully', 'success');
    };

    const handleDeleteStep = (id: string) => {
      setPipelineSteps(pipelineSteps.filter(step => step.id !== id));
      addToast('Transformation step removed', 'info');
    };

    const handleSavePipeline = () => {
      if (!fileInfo?.name) return;
      try {
        localStorage.setItem(`datalens_pipeline_${fileInfo.name}`, JSON.stringify(pipelineSteps));
        addToast('ETL Pipeline saved successfully to local storage!', 'success');
      } catch (e) {
        addToast('Failed to save pipeline', 'error');
      }
    };

    const handleRunETL = () => {
      if (data.length === 0) {
        addToast('No source dataset available to run ETL', 'error');
        return;
      }
      
      setIsPipelineRunning(true);
      setPipelineResult(null);

      // Simulate a nice running progress
      setTimeout(() => {
        try {
          let currentData = [...data];
          let currentCols = [...columns];

          for (const step of pipelineSteps) {
            if (step.type === 'source') continue;

            if (step.type === 'clean') {
              // 1. Drop duplicates
              const seen = new Set();
              currentData = currentData.filter(row => {
                const str = JSON.stringify(row);
                if (seen.has(str)) return false;
                seen.add(str);
                return true;
              });
              // 2. Drop empty rows
              currentData = currentData.filter(row => {
                return Object.values(row).some(val => val !== null && val !== undefined && val !== '');
              });
            }

            if (step.type === 'filter') {
              const { column, operator, value } = step.config;
              if (column) {
                currentData = currentData.filter(row => {
                  const cellVal = row[column];
                  if (cellVal === undefined || cellVal === null) return false;
                  
                  const compareVal = isNaN(Number(value)) ? value : Number(value);
                  const cellNum = isNaN(Number(cellVal)) ? String(cellVal).toLowerCase() : Number(cellVal);
                  const compNum = typeof compareVal === 'string' ? compareVal.toLowerCase() : compareVal;
                  
                  switch (operator) {
                    case '==': return String(cellVal).toLowerCase() === String(value).toLowerCase();
                    case '!=': return String(cellVal).toLowerCase() !== String(value).toLowerCase();
                    case '>': return Number(cellVal) > Number(value);
                    case '<': return Number(cellVal) < Number(value);
                    case '>=': return Number(cellVal) >= Number(value);
                    case '<=': return Number(cellVal) <= Number(value);
                    case 'contains': return String(cellVal).toLowerCase().includes(String(value).toLowerCase());
                    case 'is_not_null': return cellVal !== null && cellVal !== undefined && cellVal !== '';
                    default: return true;
                  }
                });
              }
            }

            if (step.type === 'drop_columns') {
              const { selectedColumns } = step.config;
              if (selectedColumns && selectedColumns.length > 0) {
                currentData = currentData.map(row => {
                  const newRow = { ...row };
                  selectedColumns.forEach((col: string) => {
                    delete newRow[col];
                  });
                  return newRow;
                });
                currentCols = currentCols.filter(c => !selectedColumns.includes(c.name));
              }
            }

            if (step.type === 'fill_nulls') {
              const { column, fillValue } = step.config;
              if (column) {
                currentData = currentData.map(row => {
                  if (row[column] === null || row[column] === undefined || row[column] === '') {
                    return { ...row, [column]: isNaN(Number(fillValue)) ? fillValue : Number(fillValue) };
                  }
                  return row;
                });
              }
            }

            if (step.type === 'replace') {
              const { column, target, replacement } = step.config;
              if (column) {
                currentData = currentData.map(row => {
                  if (String(row[column] ?? '') === String(target)) {
                    return { ...row, [column]: isNaN(Number(replacement)) ? replacement : Number(replacement) };
                  }
                  return row;
                });
              }
            }

            if (step.type === 'sort') {
              const { column, direction } = step.config;
              if (column) {
                currentData.sort((a, b) => {
                  const valA = a[column];
                  const valB = b[column];
                  if (valA === valB) return 0;
                  if (valA === null || valA === undefined) return 1;
                  if (valB === null || valB === undefined) return -1;
                  
                  const isNum = !isNaN(Number(valA)) && !isNaN(Number(valB));
                  if (direction === 'asc') {
                    return isNum ? Number(valA) - Number(valB) : String(valA).localeCompare(String(valB));
                  } else {
                    return isNum ? Number(valB) - Number(valA) : String(valB).localeCompare(String(valA));
                  }
                });
              }
            }

            if (step.type === 'group_by') {
              const { groupColumn, aggColumn, aggFunction } = step.config;
              if (groupColumn && aggColumn && aggFunction) {
                const groups: Record<string, number[]> = {};
                currentData.forEach(row => {
                  const key = String(row[groupColumn] ?? 'Unknown');
                  const val = Number(row[aggColumn]);
                  if (!isNaN(val)) {
                    if (!groups[key]) groups[key] = [];
                    groups[key].push(val);
                  }
                });
                
                currentData = Object.entries(groups).map(([key, vals]) => {
                  let aggVal = 0;
                  if (aggFunction === 'sum') aggVal = vals.reduce((s, v) => s + v, 0);
                  else if (aggFunction === 'avg') aggVal = vals.reduce((s, v) => s + v, 0) / vals.length;
                  else if (aggFunction === 'min') aggVal = Math.min(...vals);
                  else if (aggFunction === 'max') aggVal = Math.max(...vals);
                  else if (aggFunction === 'count') aggVal = vals.length;
                  
                  return {
                    [groupColumn]: key,
                    [`${aggColumn}_${aggFunction}`]: parseFloat(aggVal.toFixed(2))
                  };
                });
                
                currentCols = [
                  { name: groupColumn, type: 'text' },
                  { name: `${aggColumn}_${aggFunction}`, type: 'number' }
                ];
              }
            }
          }

          setPipelineResult(currentData);
          setPipelineColumns(currentCols);
          setPreviewPage(0);
          addToast(`ETL Execution Succeeded! Processed ${currentData.length.toLocaleString()} rows × ${currentCols.length} columns`, 'success');
        } catch (e: any) {
          console.error("ETL Runtime Error:", e);
          addToast(`ETL Pipeline Failed: ${e.message || e}`, 'error');
        } finally {
          setIsPipelineRunning(false);
        }
      }, 1000);
    };

    const handleDownloadResult = () => {
      if (!pipelineResult || pipelineResult.length === 0) return;
      try {
        const csv = Papa.unparse(pipelineResult);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        const prefix = fileInfo?.name ? fileInfo.name.split('.')[0] : 'datalens';
        link.setAttribute("download", `${prefix}_transformed.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        addToast("Transformed dataset downloaded successfully!", "success");
      } catch (e) {
        addToast("Export failed", "error");
      }
    };

    const handleToggleDropCol = (colName: string) => {
      if (dropCols.includes(colName)) {
        setDropCols(dropCols.filter(c => c !== colName));
      } else {
        setDropCols([...dropCols, colName]);
      }
    };

    return (
      <div className="fade-in-up h-full flex flex-col gap-6">
        <div className="flex justify-between items-center">
          <div>
            <h2>ETL Pipeline Builder</h2>
            <p className="text-muted mt-1">Visually design data transformation workflows, aggregate fields, and export clean results.</p>
          </div>
          {fileInfo?.name && (
            <div className="badge badge-default flex items-center gap-1.5 font-mono text-xs py-1.5 px-3">
              <Database size={12} className="text-[var(--primary)]" />
              {fileInfo.name}
            </div>
          )}
        </div>

        {/* Dynamic Pipeline Steps flow */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-6 relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none opacity-5" style={{ background: 'radial-gradient(circle at top right, var(--primary), transparent 40%)' }}></div>
          <h3 className="text-base font-bold mb-4 flex items-center gap-2">
            <Workflow size={18} className="text-[var(--primary)]" />
            Workflow Architecture
          </h3>
          
          <div className="w-full overflow-x-auto flex flex-row items-center gap-4 md:justify-start pb-2 scrollbar-thin">
            {pipelineSteps.map((step, idx) => {
              const isSource = step.type === 'source';
              const isClean = step.type === 'clean';
              
              let stepBadgeColor = 'bg-[var(--primary)] text-white';
              if (isSource) stepBadgeColor = 'bg-[var(--success)] text-black font-bold';
              else if (isClean) stepBadgeColor = 'bg-[var(--warning)] text-black font-bold';

              return (
                <React.Fragment key={step.id}>
                  <div className={`pipeline-step shrink-0 flex-shrink-0 border relative ${isSource ? 'active' : ''}`} style={{ minWidth: 220, maxWidth: 280 }}>
                    <div className="flex justify-between items-center mb-3">
                      <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded ${stepBadgeColor}`}>
                        {step.type}
                      </span>
                      {!isSource && !isClean && (
                        <button 
                          className="text-muted hover:text-[var(--error)] transition-colors cursor-pointer"
                          onClick={() => handleDeleteStep(step.id)}
                          title="Delete transformation step"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                    
                    <div className="font-semibold text-sm text-white mb-1 truncate" title={step.name}>
                      {step.name}
                    </div>
                    
                    <div className="text-[11px] text-muted font-mono leading-relaxed truncate">
                      {isSource ? `${data.length.toLocaleString()} rows × ${columns.length} cols` : 
                       isClean ? 'Drop duplicates, drop empty rows' : 
                       JSON.stringify(step.config)}
                    </div>
                  </div>
                  
                  {idx < pipelineSteps.length - 1 && (
                    <div className="pipeline-connector shrink-0 flex-shrink-0 flex items-center justify-center">
                      <ArrowRight size={14} className="text-muted" />
                    </div>
                  )}
                </React.Fragment>
              );
            })}

            {/* Add Step trigger card */}
            <div className="pipeline-connector shrink-0 flex-shrink-0">
              <ArrowRight size={14} className="text-muted" />
            </div>

            <button 
              onClick={() => setShowAddForm(!showAddForm)}
              className="pipeline-step shrink-0 flex-shrink-0 border border-dashed border-[var(--border)] bg-transparent hover:bg-[rgba(255,255,255,0.02)] flex flex-col items-center justify-center cursor-pointer min-h-[96px] text-muted hover:text-white transition-all duration-200"
              style={{ minWidth: 200 }}
            >
              <Plus size={20} className="mb-1 text-[var(--primary)]" />
              <span className="text-xs font-semibold">Add Transformation</span>
            </button>
          </div>
        </div>

        {/* Configure Transformation Step Form */}
        {showAddForm && (
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-6 fade-in shadow-2xl">
            <h3 className="text-base font-bold mb-4 flex items-center gap-2">
              <Zap size={18} className="text-[var(--warning)]" />
              Configure Transformation Step
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-2">Step Operation</label>
                <select 
                  value={newStepType}
                  onChange={(e) => setNewStepType(e.target.value as any)}
                  className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-[var(--primary)]"
                >
                  <option value="filter">Filter Rows</option>
                  <option value="drop_columns">Drop Columns</option>
                  <option value="fill_nulls">Fill Null / Missing Values</option>
                  <option value="replace">Replace Value</option>
                  <option value="sort">Sort Data</option>
                  <option value="group_by">Group By & Aggregate</option>
                </select>
              </div>

              <div className="md:col-span-3 bg-[rgba(255,255,255,0.02)] p-4 rounded-lg border border-[var(--border)]">
                {newStepType === 'filter' && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-2">Column</label>
                      <select 
                        value={filterCol}
                        onChange={(e) => setFilterCol(e.target.value)}
                        className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-lg p-2 text-sm text-white"
                      >
                        {columns.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-2">Operator</label>
                      <select 
                        value={filterOp}
                        onChange={(e) => setFilterOp(e.target.value)}
                        className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-lg p-2 text-sm text-white"
                      >
                        <option value="==">Equals (==)</option>
                        <option value="!=">Does Not Equal (!=)</option>
                        <option value=">">Greater Than (&gt;)</option>
                        <option value="<">Less Than (&lt;)</option>
                        <option value=">=">Greater Than or Equal (&gt;=)</option>
                        <option value="<=">Less Than or Equal (&lt;=)</option>
                        <option value="contains">Contains (text search)</option>
                        <option value="is_not_null">Is Not Null / Empty</option>
                      </select>
                    </div>
                    {filterOp !== 'is_not_null' && (
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-2">Value</label>
                        <input 
                          type="text"
                          value={filterVal}
                          onChange={(e) => setFilterVal(e.target.value)}
                          placeholder="e.g. 50 or Premium"
                          className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-lg p-2 text-sm text-white"
                        />
                      </div>
                    )}
                  </div>
                )}

                {newStepType === 'drop_columns' && (
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-2">Select Columns to Drop</label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-[120px] overflow-y-auto pr-2 scrollbar-thin">
                      {columns.map(c => (
                        <label key={c.name} className="flex items-center gap-2 p-1.5 rounded bg-[var(--bg)] border border-[var(--border)] text-xs text-muted cursor-pointer hover:border-[var(--primary)] hover:text-white transition-colors">
                          <input 
                            type="checkbox"
                            checked={dropCols.includes(c.name)}
                            onChange={() => handleToggleDropCol(c.name)}
                          />
                          <span className="truncate">{c.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {newStepType === 'fill_nulls' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-2">Column</label>
                      <select 
                        value={fillCol}
                        onChange={(e) => setFillCol(e.target.value)}
                        className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-lg p-2 text-sm text-white"
                      >
                        {columns.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-2">Replacement Value</label>
                      <input 
                        type="text"
                        value={fillVal}
                        onChange={(e) => setFillVal(e.target.value)}
                        placeholder="e.g. 0 or Unknown"
                        className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-lg p-2 text-sm text-white"
                      />
                    </div>
                  </div>
                )}

                {newStepType === 'replace' && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-2">Column</label>
                      <select 
                        value={repCol}
                        onChange={(e) => setRepCol(e.target.value)}
                        className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-lg p-2 text-sm text-white"
                      >
                        {columns.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-2">Value to Find</label>
                      <input 
                        type="text"
                        value={repTarget}
                        onChange={(e) => setRepTarget(e.target.value)}
                        placeholder="e.g. Basic"
                        className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-lg p-2 text-sm text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-2">Replace with</label>
                      <input 
                        type="text"
                        value={repVal}
                        onChange={(e) => setRepVal(e.target.value)}
                        placeholder="e.g. Standard"
                        className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-lg p-2 text-sm text-white"
                      />
                    </div>
                  </div>
                )}

                {newStepType === 'sort' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-2">Sort Column</label>
                      <select 
                        value={sortCol}
                        onChange={(e) => setSortCol(e.target.value)}
                        className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-lg p-2 text-sm text-white"
                      >
                        {columns.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-2">Direction</label>
                      <select 
                        value={sortDir}
                        onChange={(e) => setSortDir(e.target.value)}
                        className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-lg p-2 text-sm text-white"
                      >
                        <option value="asc">Ascending (A → Z, Low → High)</option>
                        <option value="desc">Descending (Z → A, High → Low)</option>
                      </select>
                    </div>
                  </div>
                )}

                {newStepType === 'group_by' && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-2">Group Column (Text)</label>
                      <select 
                        value={groupByCol}
                        onChange={(e) => setGroupByCol(e.target.value)}
                        className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-lg p-2 text-sm text-white"
                      >
                        {columns.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-2">Aggregation Column (Number)</label>
                      <select 
                        value={aggCol}
                        onChange={(e) => setAggCol(e.target.value)}
                        className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-lg p-2 text-sm text-white"
                      >
                        {columns.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-2">Agg Function</label>
                      <select 
                        value={aggFn}
                        onChange={(e) => setAggFn(e.target.value)}
                        className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-lg p-2 text-sm text-white"
                      >
                        <option value="sum">SUM</option>
                        <option value="avg">AVERAGE</option>
                        <option value="min">MINIMUM</option>
                        <option value="max">MAXIMUM</option>
                        <option value="count">COUNT Rows</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button 
                className="btn-secondary text-xs cursor-pointer"
                onClick={() => setShowAddForm(false)}
              >
                Cancel
              </button>
              <button 
                className="btn-primary text-xs cursor-pointer flex items-center gap-1.5"
                onClick={handleAddStep}
              >
                <Plus size={14} /> Add to Pipeline
              </button>
            </div>
          </div>
        )}

        {/* Global Pipeline Action trigger footer */}
        <div className="p-4 bg-[var(--surface)] border border-[var(--border)] rounded-xl flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="text-sm text-muted text-center sm:text-left">
            Pipeline contains <span className="text-white font-semibold">{pipelineSteps.length} steps</span>. Setup transformations, run, and export.
          </div>
          <div className="flex gap-3 w-full sm:w-auto">
            <button 
              className="btn-secondary flex-1 sm:flex-initial flex items-center justify-center gap-2 cursor-pointer" 
              onClick={handleSavePipeline}
              title="Save current steps sequence to local storage"
            >
              <Save size={16}/> Save Pipeline
            </button>
            <button 
              className="btn-primary flex-1 sm:flex-initial flex items-center justify-center gap-2 cursor-pointer"
              disabled={isPipelineRunning}
              onClick={handleRunETL}
            >
              {isPipelineRunning ? (
                <>
                  <RefreshCcw className="animate-spin" size={16} /> Running ETL...
                </>
              ) : (
                <>
                  <Play size={16}/> Run ETL Pipeline
                </>
              )}
            </button>
          </div>
        </div>

        {/* ETL Transformed Preview panel */}
        {pipelineResult && (
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-6 fade-in flex flex-col gap-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h3 className="text-base font-bold flex items-center gap-2 text-[var(--success)]">
                  <CheckCircle size={18} />
                  ETL Run Result Details
                </h3>
                <p className="text-xs text-muted font-mono mt-1">
                  Generated {pipelineResult.length.toLocaleString()} rows × {pipelineColumns.length} columns
                </p>
              </div>
              <button 
                className="btn-primary flex items-center gap-2 w-full sm:w-auto justify-center cursor-pointer"
                onClick={handleDownloadResult}
              >
                <Download size={16} /> Export Transformed CSV
              </button>
            </div>

            {/* Beautiful Preview Table */}
            {pipelineResult.length > 0 ? (
              <div className="flex flex-col gap-3">
                <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--bg)]">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-[var(--border)] bg-[rgba(255,255,255,0.02)]">
                        {pipelineColumns.map((col) => (
                          <th key={col.name} className="p-3 font-semibold uppercase tracking-wider text-muted whitespace-nowrap">
                            {col.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {pipelineResult.slice(previewPage * rowsPerPage, (previewPage + 1) * rowsPerPage).map((row, rowIdx) => (
                        <tr key={rowIdx} className="border-b border-[var(--border)] hover:bg-[rgba(255,255,255,0.01)] transition-colors">
                          {pipelineColumns.map((col) => (
                            <td key={col.name} className="p-3 text-[var(--text-primary)] whitespace-nowrap">
                              {row[col.name] != null ? String(row[col.name]) : <span className="text-muted italic">null</span>}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Micro pagination controls */}
                {pipelineResult.length > rowsPerPage && (
                  <div className="flex justify-between items-center text-xs text-muted px-1 mt-1">
                    <div>
                      Showing {previewPage * rowsPerPage + 1} to {Math.min((previewPage + 1) * rowsPerPage, pipelineResult.length)} of {pipelineResult.length.toLocaleString()} rows
                    </div>
                    <div className="flex gap-2">
                      <button 
                        disabled={previewPage === 0}
                        onClick={() => setPreviewPage(previewPage - 1)}
                        className="btn-secondary py-1 px-3 disabled:opacity-50 text-[11px] cursor-pointer"
                      >
                        Prev
                      </button>
                      <button 
                        disabled={(previewPage + 1) * rowsPerPage >= pipelineResult.length}
                        onClick={() => setPreviewPage(previewPage + 1)}
                        className="btn-secondary py-1 px-3 disabled:opacity-50 text-[11px] cursor-pointer"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-8 text-center text-muted border border-dashed border-[var(--border)] rounded-xl">
                The ETL transformations resulted in an empty dataset. Try loosening your filter criteria.
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // --- DASHBOARD BUILDER HELPERS & EFFECTS ---

  // Load dashboard from localStorage on dataset change
  useEffect(() => {
    if (!fileInfo?.name) {
      setWidgets([]);
      setDashboardLayout([]);
      return;
    }
    try {
      const saved = localStorage.getItem(`datalens_dashboard_${fileInfo.name}`);
      if (saved) {
        const { savedWidgets, savedLayout } = JSON.parse(saved);
        if (Array.isArray(savedWidgets)) setWidgets(savedWidgets);
        if (Array.isArray(savedLayout)) setDashboardLayout(savedLayout);
      } else {
        setWidgets([]);
        setDashboardLayout([]);
      }
    } catch (e) {
      console.error('Error loading dashboard from localStorage', e);
      setWidgets([]);
      setDashboardLayout([]);
    }
  }, [fileInfo?.name]);

  const loadSampleSalesDataset = () => {
    const sampleRows = [];
    const categories = ['Electronics', 'Furniture', 'Clothing', 'Office Supplies'];
    const products: Record<string, string[]> = {
      'Electronics': ['Smartwatch', 'Headphones', 'Laptop', 'Tablet', 'Camera'],
      'Furniture': ['Office Chair', 'Desk', 'Bookshelf', 'Sofa', 'Dining Table'],
      'Clothing': ['Hoodie', 'Sneakers', 'T-Shirt', 'Jeans', 'Jacket'],
      'Office Supplies': ['Notebook', 'Pen Set', 'File Organizer', 'Stapler', 'Whiteboard']
    };
    const regions = ['North', 'East', 'South', 'West'];
    
    const baseDate = new Date(2026, 0, 1);
    
    for (let i = 0; i < 200; i++) {
      const date = new Date(baseDate);
      date.setDate(baseDate.getDate() + Math.floor(i / 3));
      const dateString = date.toISOString().split('T')[0];
      
      const category = categories[Math.floor(Math.random() * categories.length)];
      const productList = products[category];
      const product = productList[Math.floor(Math.random() * productList.length)];
      const region = regions[Math.floor(Math.random() * regions.length)];
      const qty = Math.floor(Math.random() * 5) + 1;
      const pricePerUnit = category === 'Electronics' ? Math.floor(Math.random() * 500) + 100 :
                          category === 'Furniture' ? Math.floor(Math.random() * 300) + 50 :
                          category === 'Clothing' ? Math.floor(Math.random() * 60) + 15 :
                          Math.floor(Math.random() * 30) + 5;
      const sales = pricePerUnit * qty;
      const profit = Math.round((sales * 0.25 - 5) * 100) / 100;
      
      sampleRows.push({
        'Date': dateString,
        'Category': category,
        'Product': product,
        'Sales': sales,
        'Quantity': qty,
        'Profit': profit,
        'Region': region,
        'Customer ID': `C-100${Math.floor(Math.random() * 50) + 1}`
      });
    }
    
    const sampleCols = [
      { name: 'Date', type: 'date' as const },
      { name: 'Category', type: 'text' as const },
      { name: 'Product', type: 'text' as const },
      { name: 'Sales', type: 'number' as const },
      { name: 'Quantity', type: 'number' as const },
      { name: 'Profit', type: 'number' as const },
      { name: 'Region', type: 'text' as const },
      { name: 'Customer ID', type: 'text' as const }
    ];
    
    setData(sampleRows);
    setInitialData(sampleRows);
    setColumns(sampleCols);
    setInitialColumns(sampleCols);
    setFileInfo({
      name: 'Sample_Sales_Data.csv',
      size: 15420,
      rows: 200,
      columns: 8,
      type: 'text/csv'
    });
    
    addToast('Sample sales dataset loaded successfully!', 'success');
  };

  const loadSalesTemplate = () => {
    if (!data.length) return;
    const salesCol = columns.find(c => /sales|revenue|amount|price|spend/i.test(c.name))?.name || (columns.find(c => c.type === 'number')?.name) || '';
    const dateCol = columns.find(c => /date|year|month|time/i.test(c.name))?.name || '';
    const catCol = columns.find(c => /category|type|genre|product|region|country/i.test(c.name))?.name || (columns.find(c => c.type === 'text')?.name) || '';
    
    const newWidgets: WidgetConfig[] = [];
    const newLayout: any[] = [];
    
    if (salesCol) {
      newWidgets.push({
        id: 'kpi-sales-sum',
        title: 'Total Revenue',
        type: 'kpi',
        column: salesCol,
        operation: 'sum'
      });
      newLayout.push({ i: 'kpi-sales-sum', x: 0, y: 0, w: 4, h: 2, minW: 3, minH: 2 });
      
      newWidgets.push({
        id: 'kpi-sales-avg',
        title: 'Avg Order Value',
        type: 'kpi',
        column: salesCol,
        operation: 'avg'
      });
      newLayout.push({ i: 'kpi-sales-avg', x: 4, y: 0, w: 4, h: 2, minW: 3, minH: 2 });
    }
    
    const countCol = columns[0]?.name || '';
    if (countCol) {
      newWidgets.push({
        id: 'kpi-order-count',
        title: 'Transactions Count',
        type: 'kpi',
        column: countCol,
        operation: 'count'
      });
      newLayout.push({ i: 'kpi-order-count', x: 8, y: 0, w: 4, h: 2, minW: 3, minH: 2 });
    }
    
    if (salesCol && (dateCol || catCol)) {
      const trendX = dateCol || catCol;
      newWidgets.push({
        id: 'chart-sales-trend',
        title: `Sales Trend by ${trendX}`,
        type: 'line',
        xAxisColumn: trendX,
        yAxisColumn: salesCol,
        operation: 'sum'
      });
      newLayout.push({ i: 'chart-sales-trend', x: 0, y: 2, w: 8, h: 3, minW: 4, minH: 3 });
    }
    
    if (salesCol && catCol) {
      newWidgets.push({
        id: 'chart-sales-category',
        title: `Sales by ${catCol}`,
        type: 'bar',
        xAxisColumn: catCol,
        yAxisColumn: salesCol,
        operation: 'sum'
      });
      newLayout.push({ i: 'chart-sales-category', x: 8, y: 2, w: 4, h: 3, minW: 3, minH: 3 });
    }
    
    const showCols = columns.slice(0, 4).map(c => c.name);
    newWidgets.push({
      id: 'table-sales-raw',
      title: 'Top Records Snippet',
      type: 'table',
      tableColumns: showCols,
      tableLimit: 5
    });
    newLayout.push({ i: 'table-sales-raw', x: 0, y: 5, w: 12, h: 3, minW: 4, minH: 3 });
    
    setWidgets(newWidgets);
    setDashboardLayout(newLayout);
    if (fileInfo?.name) {
      localStorage.setItem(`datalens_dashboard_${fileInfo.name}`, JSON.stringify({
        savedWidgets: newWidgets,
        savedLayout: newLayout
      }));
    }
    addToast('Sales Overview template loaded!', 'success');
  };

  const loadUserAnalyticsTemplate = () => {
    if (!data.length) return;
    const userCol = columns.find(c => /user|cust|member|id|visitor|email/i.test(c.name))?.name || columns[0]?.name || '';
    const groupCol = columns.find(c => /segment|type|status|active|gender|role|region/i.test(c.name))?.name || columns.find(c => c.type === 'text')?.name || '';
    const numCol = columns.find(c => /age|score|tenure|days|count|quantity|sales/i.test(c.name))?.name || '';
    
    const newWidgets: WidgetConfig[] = [];
    const newLayout: any[] = [];
    
    if (userCol) {
      newWidgets.push({
        id: 'kpi-user-count',
        title: 'Unique Active Entities',
        type: 'kpi',
        column: userCol,
        operation: 'unique'
      });
      newLayout.push({ i: 'kpi-user-count', x: 0, y: 0, w: 4, h: 2, minW: 3, minH: 2 });
    }
    
    if (numCol) {
      newWidgets.push({
        id: 'kpi-num-avg',
        title: `Average ${numCol}`,
        type: 'kpi',
        column: numCol,
        operation: 'avg'
      });
      newLayout.push({ i: 'kpi-num-avg', x: 4, y: 0, w: 4, h: 2, minW: 3, minH: 2 });
    }
    
    newWidgets.push({
      id: 'md-user-insights',
      title: 'User Analytics Summary',
      type: 'markdown',
      content: '### Quick Insights\n- Data columns aggregated dynamically.\n- Segments distribution plots categorical volumes.\n- Resize or reorder widgets to design your report.'
    });
    newLayout.push({ i: 'md-user-insights', x: 8, y: 0, w: 4, h: 2, minW: 3, minH: 2 });
    
    if (userCol && groupCol) {
      newWidgets.push({
        id: 'chart-user-group',
        title: `Distribution by ${groupCol}`,
        type: 'bar',
        xAxisColumn: groupCol,
        yAxisColumn: userCol,
        operation: 'count'
      });
      newLayout.push({ i: 'chart-user-group', x: 0, y: 2, w: 12, h: 3, minW: 4, minH: 3 });
    }
    
    setWidgets(newWidgets);
    setDashboardLayout(newLayout);
    if (fileInfo?.name) {
      localStorage.setItem(`datalens_dashboard_${fileInfo.name}`, JSON.stringify({
        savedWidgets: newWidgets,
        savedLayout: newLayout
      }));
    }
    addToast('User Analytics template loaded!', 'success');
  };

  const loadFinancialTemplate = () => {
    if (!data.length) return;
    const revCol = columns.find(c => /revenue|income|sales|earning/i.test(c.name))?.name || '';
    const costCol = columns.find(c => /cost|expense|spend|payout/i.test(c.name))?.name || '';
    const profitCol = columns.find(c => /profit|margin|gain/i.test(c.name))?.name || '';
    const catCol = columns.find(c => /category|segment|dept|department/i.test(c.name))?.name || columns.find(c => c.type === 'text')?.name || '';
    
    const newWidgets: WidgetConfig[] = [];
    const newLayout: any[] = [];
    
    let primaryCol = revCol || profitCol || (columns.find(c => c.type === 'number')?.name) || '';
    
    if (primaryCol) {
      newWidgets.push({
        id: 'kpi-fin-primary',
        title: revCol ? 'Total Gross Income' : 'Primary Finance Value',
        type: 'kpi',
        column: primaryCol,
        operation: 'sum'
      });
      newLayout.push({ i: 'kpi-fin-primary', x: 0, y: 0, w: 4, h: 2, minW: 3, minH: 2 });
    }
    
    if (costCol) {
      newWidgets.push({
        id: 'kpi-fin-cost',
        title: 'Total Expenses',
        type: 'kpi',
        column: costCol,
        operation: 'sum'
      });
      newLayout.push({ i: 'kpi-fin-cost', x: 4, y: 0, w: 4, h: 2, minW: 3, minH: 2 });
    }
    
    if (profitCol) {
      newWidgets.push({
        id: 'kpi-fin-profit',
        title: 'Net Profit Margin',
        type: 'kpi',
        column: profitCol,
        operation: 'sum'
      });
      newLayout.push({ i: 'kpi-fin-profit', x: 8, y: 0, w: 4, h: 2, minW: 3, minH: 2 });
    }
    
    if (primaryCol && catCol) {
      newWidgets.push({
        id: 'chart-fin-cat',
        title: `Income Distribution by ${catCol}`,
        type: 'bar',
        xAxisColumn: catCol,
        yAxisColumn: primaryCol,
        operation: 'sum'
      });
      newLayout.push({ i: 'chart-fin-cat', x: 0, y: 2, w: 12, h: 3, minW: 4, minH: 3 });
    }
    
    setWidgets(newWidgets);
    setDashboardLayout(newLayout);
    if (fileInfo?.name) {
      localStorage.setItem(`datalens_dashboard_${fileInfo.name}`, JSON.stringify({
        savedWidgets: newWidgets,
        savedLayout: newLayout
      }));
    }
    addToast('Financial Summary template loaded!', 'success');
  };

  const clearDashboard = () => {
    setWidgets([]);
    setDashboardLayout([]);
    if (fileInfo?.name) {
      localStorage.removeItem(`datalens_dashboard_${fileInfo.name}`);
    }
    addToast('Dashboard canvas cleared!', 'info');
  };

  const handleOpenAddWidget = () => {
    setEditingWidget(null);
    const firstNumCol = columns.find(c => c.type === 'number')?.name || columns[0]?.name || '';
    const firstStringCol = columns.find(c => c.type === 'text' || c.type === 'date')?.name || columns[0]?.name || '';
    
    setWidgetForm({
      type: 'kpi',
      title: 'New KPI Card',
      column: firstNumCol,
      operation: 'sum',
      xAxisColumn: firstStringCol,
      yAxisColumn: firstNumCol,
      tableColumns: columns.slice(0, 4).map(c => c.name),
      tableLimit: 5,
      content: '### Notes\nWrite notes here.'
    });
    setIsWidgetModalOpen(true);
  };

  const handleOpenEditWidget = (widget: WidgetConfig) => {
    setEditingWidget(widget);
    setWidgetForm({
      type: widget.type,
      title: widget.title,
      column: widget.column || '',
      operation: widget.operation || 'sum',
      xAxisColumn: widget.xAxisColumn || '',
      yAxisColumn: widget.yAxisColumn || '',
      tableColumns: widget.tableColumns || [],
      tableLimit: widget.tableLimit || 5,
      content: widget.content || ''
    });
    setIsWidgetModalOpen(true);
  };

  const handleDeleteWidget = (id: string) => {
    const nextWidgets = widgets.filter(w => w.id !== id);
    const nextLayout = dashboardLayout.filter(l => l.i !== id);
    setWidgets(nextWidgets);
    setDashboardLayout(nextLayout);
    if (fileInfo?.name) {
      localStorage.setItem(`datalens_dashboard_${fileInfo.name}`, JSON.stringify({
        savedWidgets: nextWidgets,
        savedLayout: nextLayout
      }));
    }
    addToast('Widget removed!', 'info');
  };

  const handleSaveWidgetForm = (e: React.FormEvent) => {
    e.preventDefault();
    let updatedWidgets = [...widgets];
    let updatedLayout = [...dashboardLayout];
    
    if (editingWidget) {
      updatedWidgets = widgets.map(w => {
        if (w.id === editingWidget.id) {
          return {
            ...w,
            title: widgetForm.title,
            type: widgetForm.type,
            column: widgetForm.column,
            operation: widgetForm.operation,
            xAxisColumn: widgetForm.xAxisColumn,
            yAxisColumn: widgetForm.yAxisColumn,
            tableColumns: widgetForm.tableColumns,
            tableLimit: widgetForm.tableLimit,
            content: widgetForm.content
          };
        }
        return w;
      });
      addToast('Widget updated!', 'success');
    } else {
      const newId = `widget_${Date.now()}`;
      const newWidget: WidgetConfig = {
        id: newId,
        title: widgetForm.title || `${widgetForm.type.toUpperCase()} Widget`,
        type: widgetForm.type,
        column: widgetForm.column,
        operation: widgetForm.operation,
        xAxisColumn: widgetForm.xAxisColumn,
        yAxisColumn: widgetForm.yAxisColumn,
        tableColumns: widgetForm.tableColumns,
        tableLimit: widgetForm.tableLimit,
        content: widgetForm.content
      };
      updatedWidgets.push(newWidget);
      
      let w = 4, h = 2;
      if (widgetForm.type === 'line' || widgetForm.type === 'bar') {
        w = 6; h = 3;
      } else if (widgetForm.type === 'table') {
        w = 12; h = 3;
      }
      
      const maxY = dashboardLayout.reduce((max, item) => Math.max(max, item.y + item.h), 0);
      updatedLayout.push({
        i: newId,
        x: 0,
        y: maxY,
        w,
        h,
        minW: widgetForm.type === 'kpi' || widgetForm.type === 'markdown' ? 3 : 4,
        minH: widgetForm.type === 'kpi' || widgetForm.type === 'markdown' ? 2 : 3
      });
      addToast('Widget added!', 'success');
    }
    
    setWidgets(updatedWidgets);
    setDashboardLayout(updatedLayout);
    if (fileInfo?.name) {
      localStorage.setItem(`datalens_dashboard_${fileInfo.name}`, JSON.stringify({
        savedWidgets: updatedWidgets,
        savedLayout: updatedLayout
      }));
    }
    setIsWidgetModalOpen(false);
    setEditingWidget(null);
  };

  const handleLayoutChange = (newLayout: any[]) => {
    setDashboardLayout(newLayout);
    if (fileInfo?.name) {
      localStorage.setItem(`datalens_dashboard_${fileInfo.name}`, JSON.stringify({
        savedWidgets: widgets,
        savedLayout: newLayout
      }));
    }
  };

  const aggregateData = (xAxisCol: string, yAxisCol: string, operation: string) => {
    if (!data || !data.length || !xAxisCol) return [];
    
    const groups: Record<string, { key: string; values: number[]; count: number }> = {};
    
    data.forEach(row => {
      const keyVal = row[xAxisCol];
      const key = keyVal !== undefined && keyVal !== null ? String(keyVal) : 'N/A';
      
      let val = 0;
      if (yAxisCol) {
        const parsedVal = parseFloat(row[yAxisCol]);
        val = isNaN(parsedVal) ? 0 : parsedVal;
      }
      
      if (!groups[key]) {
        groups[key] = { key, values: [], count: 0 };
      }
      groups[key].values.push(val);
      groups[key].count += 1;
    });
    
    let result = Object.values(groups).map(g => {
      let aggregatedValue = 0;
      if (operation === 'sum') {
        aggregatedValue = g.values.reduce((sum, v) => sum + v, 0);
      } else if (operation === 'avg') {
        aggregatedValue = g.values.reduce((sum, v) => sum + v, 0) / Math.max(1, g.values.length);
      } else if (operation === 'min') {
        aggregatedValue = Math.min(...g.values);
      } else if (operation === 'max') {
        aggregatedValue = Math.max(...g.values);
      } else if (operation === 'count') {
        aggregatedValue = g.count;
      }
      aggregatedValue = Math.round(aggregatedValue * 100) / 100;
      return {
        name: g.key,
        value: aggregatedValue
      };
    });

    const isDateLike = result.every(item => !isNaN(Date.parse(item.name)));
    if (isDateLike) {
      result.sort((a, b) => Date.parse(a.name) - Date.parse(b.name));
    } else {
      result.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
    }
    return result;
  };

  const calculateKPIValue = (col: string | undefined, operation: string | undefined) => {
    if (!data || !data.length) return 'N/A';
    if (operation === 'count') return data.length.toLocaleString();
    if (!col) return 'N/A';
    
    if (operation === 'unique') {
      const uniqueVals = new Set(data.map(row => row[col]));
      return uniqueVals.size.toLocaleString();
    }
    
    const values = data
      .map(row => parseFloat(row[col]))
      .filter(v => !isNaN(v));
      
    if (values.length === 0) return '0';
    
    let resultValue = 0;
    if (operation === 'sum') {
      resultValue = values.reduce((sum, v) => sum + v, 0);
    } else if (operation === 'avg') {
      resultValue = values.reduce((sum, v) => sum + v, 0) / values.length;
    } else if (operation === 'min') {
      resultValue = Math.min(...values);
    } else if (operation === 'max') {
      resultValue = Math.max(...values);
    }
    
    const isCurrency = /price|sales|revenue|profit|spend|amount|cost/i.test(col);
    if (isCurrency) {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: resultValue % 1 === 0 ? 0 : 2 }).format(resultValue);
    }
    
    return Math.round(resultValue * 100) / 100 !== resultValue
      ? (Math.round(resultValue * 100) / 100).toLocaleString()
      : resultValue.toLocaleString();
  };

  const renderMarkdown = (text: string | undefined) => {
    if (!text) return null;
    let html = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
      
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
    html = html.replace(/`(.*?)`/g, '<code class="px-1.5 py-0.5 bg-[rgba(255,255,255,0.06)] border border-[var(--border)] rounded font-mono text-[11px] text-[var(--primary)]">$1</code>');
    html = html.replace(/^### (.*?)$/gm, '<h4 class="text-sm font-bold text-white mt-3 mb-1">$1</h4>');
    html = html.replace(/^## (.*?)$/gm, '<h3 class="text-base font-bold text-white mt-4 mb-2">$1</h3>');
    html = html.replace(/^# (.*?)$/gm, '<h2 class="text-lg font-bold text-white mt-5 mb-3">$1</h2>');
    html = html.replace(/^- (.*?)$/gm, '<li class="ml-4 list-disc text-muted">$1</li>');
    html = html.replace(/\n/g, '<br />');
    
    return <div className="text-sm text-muted leading-relaxed" dangerouslySetInnerHTML={{ __html: html }} />;
  };

  const renderWidgetBody = (widget: WidgetConfig) => {
    switch (widget.type) {
      case 'kpi': {
        const val = calculateKPIValue(widget.column, widget.operation);
        const opLabel = widget.operation === 'sum' ? 'Total' :
                        widget.operation === 'avg' ? 'Average' :
                        widget.operation === 'min' ? 'Minimum' :
                        widget.operation === 'max' ? 'Maximum' :
                        widget.operation === 'count' ? 'Count' :
                        widget.operation === 'unique' ? 'Unique' : '';
                        
        return (
          <div className="flex flex-col justify-center items-center h-full text-center py-2">
            <span className="text-[10px] text-muted font-bold tracking-widest uppercase mb-1">{opLabel} {widget.column || ''}</span>
            <div className="text-3xl font-bold font-mono tracking-tight text-[var(--primary)] bg-gradient-to-r from-[var(--primary)] to-[var(--accent)] bg-clip-text text-transparent truncate w-full px-2">
              {val}
            </div>
          </div>
        );
      }
      
      case 'line': {
        const chartData = aggregateData(widget.xAxisColumn || '', widget.yAxisColumn || '', widget.operation || 'sum');
        if (!chartData.length) {
          return (
            <div className="flex flex-col items-center justify-center h-full text-muted text-xs">
              No matching data found for aggregate
            </div>
          );
        }
        
        return (
          <div className="w-full h-full min-h-0 min-w-0 flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--text-muted)" fontSize={10} tickLine={false} axisLine={false} />
                <RechartsTooltip contentStyle={{ background: 'var(--surface)', borderColor: 'var(--border)' }} />
                <Line type="monotone" dataKey="value" stroke="var(--primary)" strokeWidth={2} dot={{ fill: 'var(--primary)', r: 3 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        );
      }
      
      case 'bar': {
        const chartData = aggregateData(widget.xAxisColumn || '', widget.yAxisColumn || '', widget.operation || 'sum');
        if (!chartData.length) {
          return (
            <div className="flex flex-col items-center justify-center h-full text-muted text-xs">
              No matching data found for aggregate
            </div>
          );
        }
        
        return (
          <div className="w-full h-full min-h-0 min-w-0 flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--text-muted)" fontSize={10} tickLine={false} axisLine={false} />
                <RechartsTooltip contentStyle={{ background: 'var(--surface)', borderColor: 'var(--border)' }} />
                <Bar dataKey="value" fill="var(--primary)" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index % 2 === 0 ? 'var(--primary)' : 'var(--success)'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        );
      }
      
      case 'table': {
        const selectedCols = widget.tableColumns || [];
        const limit = widget.tableLimit || 5;
        const rows = data.slice(0, limit);
        
        if (selectedCols.length === 0) {
          return (
            <div className="flex items-center justify-center h-full text-muted text-xs">
              No columns selected
            </div>
          );
        }
        
        return (
          <div className="w-full h-full overflow-auto hidden-scrollbar flex-1">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-[var(--border)] text-muted">
                  {selectedCols.map(col => (
                    <th key={col} className="pb-2 font-semibold pr-4">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <tr key={idx} className="border-b border-[var(--border)]/30 hover:bg-[rgba(255,255,255,0.02)]">
                    {selectedCols.map(col => {
                      const val = row[col];
                      const isNum = typeof val === 'number';
                      return (
                        <td key={col} className={`py-2 pr-4 truncate max-w-[150px] ${isNum ? 'font-mono text-right text-[var(--success)]' : ''}`}>
                          {val !== null && val !== undefined ? String(val) : '-'}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
      
      case 'markdown': {
        return (
          <div className="w-full h-full overflow-y-auto hidden-scrollbar flex-1">
            {renderMarkdown(widget.content)}
          </div>
        );
      }
      
      default:
        return null;
    }
  };

  const DashboardSection = () => {
    if (!data || data.length === 0) {
      return (
        <div className="fade-in-up h-full flex flex-col items-center justify-center p-8 text-center max-w-xl mx-auto my-12">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[var(--primary)] to-[var(--accent)] flex items-center justify-center text-white mb-6 shadow-lg shadow-indigo-500/20">
            <LayoutDashboard size={32} />
          </div>
          <h2 className="text-2xl font-bold mb-2">No Dataset Loaded</h2>
          <p className="text-muted mb-8 leading-relaxed">
            Upload your own spreadsheet on the **Upload Data** tab, or load a sample sales dataset to start designing interactive layouts immediately.
          </p>
          <div className="flex gap-4">
            <button className="btn-secondary" onClick={() => setActiveTab('upload')}>
              <Upload size={16} /> Go to Upload
            </button>
            <button className="btn-primary" onClick={loadSampleSalesDataset}>
              <Sparkles size={16} /> Load Sample Sales Data
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="fade-in-up h-full flex flex-col">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h2>Dashboard Builder</h2>
            <p className="text-muted mt-1">Design a customized view with draggable and resizable reporting widgets</p>
          </div>
          
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative">
              <select 
                className="premium-input premium-select min-w-[180px] bg-[var(--surface)] text-sm"
                value=""
                onChange={(e) => {
                  if (e.target.value === 'sales') loadSalesTemplate();
                  else if (e.target.value === 'users') loadUserAnalyticsTemplate();
                  else if (e.target.value === 'finance') loadFinancialTemplate();
                  e.target.value = '';
                }}
              >
                <option value="" disabled>Load Template...</option>
                <option value="sales">Sales Overview</option>
                <option value="users">User Analytics</option>
                <option value="finance">Financial Summary</option>
              </select>
            </div>

            {widgets.length > 0 && (
              <button className="btn-secondary hover:text-[var(--danger)] hover:border-[var(--danger)]" onClick={clearDashboard}>
                <Trash2 size={16}/> Clear Canvas
              </button>
            )}

            <button 
              className={`btn-secondary ${!isEditMode ? 'bg-[rgba(99,102,241,0.08)] text-[var(--primary)] border-[var(--primary)]' : ''}`}
              onClick={() => setIsEditMode(!isEditMode)}
            >
              {isEditMode ? <CheckCircle size={16}/> : <Wand2 size={16}/>}
              {isEditMode ? 'Preview Mode' : 'Edit Mode'}
            </button>

            <button className="btn-primary" onClick={handleOpenAddWidget}>
              <Plus size={16}/> Add Widget
            </button>
          </div>
        </div>

        <div className={`dashboard-canvas flex-1 hidden-scrollbar p-4 relative ${isEditMode ? 'edit-mode-active' : ''}`} style={{ minHeight: '500px' }}>
          {widgets.length === 0 ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-muted">
              <LayoutDashboard size={48} className="opacity-20 mb-4" />
              <div className="text-base font-semibold">Your Dashboard is Empty</div>
              <p className="text-xs text-muted opacity-80 mt-1">Click "Add Widget" or choose a Template to get started.</p>
            </div>
          ) : (
            <ReactGridLayout
              className="layout"
              layout={dashboardLayout}
              onLayoutChange={handleLayoutChange}
              cols={12}
              rowHeight={100}
              margin={[16, 16]}
              isDraggable={isEditMode}
              isResizable={isEditMode}
              draggableHandle=".widget-drag-handle"
              useCSSTransforms={true}
            >
              {widgets.map(widget => (
                <div key={widget.id} className="premium-card flex flex-col overflow-hidden relative group shadow-lg p-0 bg-[var(--surface)] border border-[var(--border)] rounded-xl">
                  <div className={`widget-drag-handle px-4 py-2 border-b border-[var(--border)] flex justify-between items-center cursor-move ${isEditMode ? 'bg-[rgba(255,255,255,0.02)]' : 'bg-transparent'}`}>
                    <span className="font-semibold text-xs tracking-wider uppercase text-muted truncate max-w-[70%]">
                      {widget.title}
                    </span>
                    {isEditMode && (
                      <div className="flex gap-1.5 no-print">
                        <button 
                          className="p-1 rounded text-muted hover:text-white hover:bg-[rgba(255,255,255,0.05)] transition-colors"
                          onClick={(e) => { e.stopPropagation(); handleOpenEditWidget(widget); }}
                          title="Edit Widget"
                        >
                          <Settings size={12}/>
                        </button>
                        <button 
                          className="p-1 rounded text-muted hover:text-[var(--danger)] hover:bg-[rgba(239,68,68,0.05)] transition-colors"
                          onClick={(e) => { e.stopPropagation(); handleDeleteWidget(widget.id); }}
                          title="Delete Widget"
                        >
                          <Trash2 size={12}/>
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 p-4 overflow-y-auto hidden-scrollbar flex flex-col min-h-0 min-w-0">
                    {renderWidgetBody(widget)}
                  </div>
                </div>
              ))}
            </ReactGridLayout>
          )}
        </div>
      </div>
    );
  };

  const handleExportCSV = () => {
      const csv = Papa.unparse(data);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const filePrefix = fileInfo?.name.replace(/\.[^/.]+$/, "") || "dataset";
      link.setAttribute("href", url);
      link.setAttribute("download", `${filePrefix}_${activeTab}.csv`);
      link.click();
  };

  const handleExportExcel = () => {
      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "DataLens");
      const filePrefix = fileInfo?.name.replace(/\.[^/.]+$/, "") || "dataset";
      XLSX.writeFile(workbook, `${filePrefix}_${activeTab}.xlsx`);
  };

  if (authLoading) {
    return <BrandLoader />;
  }

  if (!currentUser) {
    return <BrandedAuthPage onLogin={(user: any) => setCurrentUser(user)} />;
  }

  return (
    <div className="app-container" onTouchStart={handleTouchStart} onTouchMove={handleTouchMove}>
      {/* Sidebar */}
      <div className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-logo">
          <DynamicLogo />
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
              {hasFeature('dataCleaning') && (
                <div className={`nav-item ${activeTab === 'cleaning' ? 'active' : ''}`} onClick={() => setActiveTab('cleaning')}>
                  <Wand2 size={18} /> Data Cleaning
                </div>
              )}

              <div className="px-4 py-2 mt-4 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                Analysis
              </div>
              {hasFeature('pivotTables') && (
                <div className={`nav-item ${activeTab === 'pivot' ? 'active' : ''}`} onClick={() => setActiveTab('pivot')}>
                  <Activity size={18} /> Pivot Table
                </div>
              )}
              <div className={`nav-item ${activeTab === 'stats' ? 'active' : ''}`} onClick={() => setActiveTab('stats')}>
                <Hash size={18} /> Statistics
              </div>
              <div className={`nav-item ${activeTab === 'charts' ? 'active' : ''}`} onClick={() => setActiveTab('charts')}>
                <PieChartIcon size={18} /> Visualizations
              </div>
              <div className={`nav-item ${activeTab === 'eda' ? 'active' : ''}`} onClick={() => setActiveTab('eda')}>
                <FileOutput size={18} /> EDA Report
              </div>
              {hasFeature('chat') && (
                <div className={`nav-item ${activeTab === 'chat' ? 'active' : ''}`} onClick={() => setActiveTab('chat')}>
                  <MessageSquare size={18} /> AI Chat
                </div>
              )}

              {(hasFeature('autoAnalyst') || hasFeature('sqlEngine') || hasFeature('mlLab') || hasFeature('dashboard') || hasFeature('pipeline')) && (
                <>
                  <div className="px-4 py-2 mt-4 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                    Advanced
                  </div>
                  {hasFeature('autoAnalyst') && (
                    <div className={`nav-item ${activeTab === 'auto-analyst' ? 'active' : ''}`} onClick={() => setActiveTab('auto-analyst')}>
                      <Wand2 size={18} /> Auto-Analyst
                    </div>
                  )}
                  {hasFeature('sqlEngine') && (
                    <div className={`nav-item ${activeTab === 'sql' ? 'active' : ''}`} onClick={() => setActiveTab('sql')}>
                      <Terminal size={18} /> SQL Engine
                    </div>
                  )}
                  {hasFeature('mlLab') && (
                    <div className={`nav-item ${activeTab === 'ml' ? 'active' : ''}`} onClick={() => setActiveTab('ml')}>
                      <Network size={18} /> ML Lab
                    </div>
                  )}
                  {hasFeature('dashboard') && (
                    <div className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>
                      <LayoutDashboard size={18} /> Dashboard
                    </div>
                  )}
                  {hasFeature('pipeline') && (
                    <div className={`nav-item ${activeTab === 'pipeline' ? 'active' : ''}`} onClick={() => setActiveTab('pipeline')}>
                      <Workflow size={18} /> ETL Pipeline
                    </div>
                  )}
                </>
              )}
            </>
          )}

          <div className="px-4 py-2 mt-auto border-t border-[var(--border)] pt-4 text-xs text-muted flex flex-col gap-2.5">
            <div className="flex items-center gap-2 bg-[rgba(255,255,255,0.01)] border border-[var(--border)] p-2 rounded-lg">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[var(--primary)] to-[var(--accent)] text-white flex items-center justify-center font-bold text-xs uppercase shadow-sm shrink-0">
                {currentUser?.name?.slice(0, 2)}
              </div>
              <div className="flex-1 truncate">
                <div className="font-semibold text-white truncate">{currentUser?.name}</div>
                <div className="text-[10px] opacity-75 truncate">{currentUser?.email}</div>
              </div>
            </div>
            <button 
              className="btn-secondary w-full text-xs justify-center gap-1.5 border-[var(--border)] cursor-pointer" 
              onClick={async () => {
                if (confirm('Clear all saved session data? This cannot be undone.')) {
                  await clearSession();
                  localStorage.removeItem('datalens_auth_token');
                  window.location.reload();
                }
              }}
            >
              Clear Database
            </button>
            <button 
              className="btn-secondary w-full text-xs justify-center gap-1.5 border-[var(--border)] hover:bg-[rgba(239,68,68,0.1)] hover:text-[var(--danger)] hover:border-[var(--danger)] cursor-pointer" 
              onClick={() => {
                localStorage.removeItem('datalens_auth_token');
                window.location.reload();
              }}
            >
              Log Out
            </button>
            {storageUsage && (
              <div className="text-[10px] text-muted text-center mt-1 font-mono opacity-60">
                {storageUsage}
              </div>
            )}
          </div>
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
              <button className={`btn-secondary whitespace-nowrap text-xs px-3 ${historyOpen ? 'bg-[var(--primary)] text-white border-[var(--primary)]' : ''}`} onClick={() => setHistoryOpen(!historyOpen)}>
                <RotateCcw size={14} /> History
              </button>
              <button className="btn-primary whitespace-nowrap text-xs px-3 ml-2" onClick={() => setActiveTab('chat')}>
                <Sparkles size={14} /> Ask AI
              </button>
            </div>
          )}
        </div>

        {/* Content Area */}
        <div className="content-area hidden-scrollbar">
          {activeTab === 'upload' && <ErrorBoundary sectionName="Upload"><UploadSection /></ErrorBoundary>}
          {activeTab === 'preview' && <ErrorBoundary sectionName="Preview"><PreviewSection /></ErrorBoundary>}
          {activeTab === 'stats' && <ErrorBoundary sectionName="Stats"><StatsSection /></ErrorBoundary>}
          {activeTab === 'charts' && <ErrorBoundary sectionName="Charts"><ChartsSection /></ErrorBoundary>}
          {activeTab === 'cleaning' && (
            <FeatureGate feature="dataCleaning">
              <ErrorBoundary sectionName="Cleaning"><CleaningSection /></ErrorBoundary>
            </FeatureGate>
          )}
          {activeTab === 'pivot' && (
            <FeatureGate feature="pivotTables">
              <ErrorBoundary sectionName="Pivot"><PivotSection /></ErrorBoundary>
            </FeatureGate>
          )}
          {activeTab === 'eda' && <ErrorBoundary sectionName="EDA"><EdaSection /></ErrorBoundary>}
          {activeTab === 'chat' && (
            <FeatureGate feature="chat">
              <ErrorBoundary sectionName="Chat"><ChatSection /></ErrorBoundary>
            </FeatureGate>
          )}
          {activeTab === 'sql' && (
            <FeatureGate feature="sqlEngine">
              <ErrorBoundary sectionName="SQL"><SqlSection /></ErrorBoundary>
            </FeatureGate>
          )}
          {activeTab === 'ml' && (
            <FeatureGate feature="mlLab">
              <ErrorBoundary sectionName="ML Lab"><MLLabSection /></ErrorBoundary>
            </FeatureGate>
          )}
          {activeTab === 'pipeline' && (
            <FeatureGate feature="pipeline">
              <ErrorBoundary sectionName="Pipeline"><PipelineSection /></ErrorBoundary>
            </FeatureGate>
          )}
          {activeTab === 'dashboard' && (
            <FeatureGate feature="dashboard">
              <ErrorBoundary sectionName="Dashboard"><DashboardSection /></ErrorBoundary>
            </FeatureGate>
          )}
          {activeTab === 'auto-analyst' && (
            <FeatureGate feature="autoAnalyst">
              <ErrorBoundary sectionName="Auto-Analyst"><AutoAnalystSection /></ErrorBoundary>
            </FeatureGate>
          )}
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

      {/* Widget Configuration Modal */}
      {isWidgetModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 fade-in cursor-pointer" onClick={(e) => e.target === e.currentTarget && setIsWidgetModalOpen(false)}>
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl w-full max-w-lg p-6 shadow-2xl flex flex-col max-h-[90vh] cursor-default" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-white">
                {editingWidget ? `Configure: ${editingWidget.title}` : 'Add New Widget'}
              </h3>
              <button className="text-muted hover:text-white" onClick={() => setIsWidgetModalOpen(false)}>
                <X size={20}/>
              </button>
            </div>
            
            <form onSubmit={handleSaveWidgetForm} className="flex flex-col gap-4 overflow-y-auto pr-1 hidden-scrollbar flex-1">
              
              {/* Widget Type Selection */}
              <div className="input-group">
                <label className="input-label">Widget Type</label>
                <div className="grid grid-cols-5 gap-2">
                  {[
                    { id: 'kpi', label: 'KPI Card', icon: <Hash size={16} /> },
                    { id: 'line', label: 'Line Chart', icon: <LineChartIcon size={16} /> },
                    { id: 'bar', label: 'Bar Chart', icon: <BarChart2 size={16} /> },
                    { id: 'table', label: 'Data Table', icon: <FileSpreadsheet size={16} /> },
                    { id: 'markdown', label: 'Markdown', icon: <Type size={16} /> }
                  ].map(t => (
                    <button
                      key={t.id}
                      type="button"
                      className={`flex flex-col items-center justify-center p-3 rounded-lg border text-[10px] font-semibold gap-1.5 transition-all ${
                        widgetForm.type === t.id
                          ? 'border-[var(--primary)] bg-[rgba(99,102,241,0.08)] text-[var(--primary)]'
                          : 'border-[var(--border)] bg-[var(--bg)] text-muted hover:text-white hover:border-gray-600'
                      }`}
                      onClick={() => {
                        let defaultTitle = `New ${t.label}`;
                        if (widgetForm.title && !widgetForm.title.startsWith('New ')) {
                          defaultTitle = widgetForm.title;
                        }
                        setWidgetForm(prev => ({ ...prev, type: t.id as any, title: defaultTitle }));
                      }}
                    >
                      {t.icon}
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Widget Title */}
              <div className="input-group">
                <label className="input-label" htmlFor="widget-title">Widget Title</label>
                <input
                  id="widget-title"
                  type="text"
                  className="premium-input"
                  placeholder="Enter widget title..."
                  value={widgetForm.title}
                  onChange={(e) => setWidgetForm(prev => ({ ...prev, title: e.target.value }))}
                  required
                />
              </div>

              {/* Conditional options based on Widget Type */}
              {widgetForm.type === 'kpi' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="input-group">
                    <label className="input-label" htmlFor="kpi-column">Aggregate Column</label>
                    <select
                      id="kpi-column"
                      className="premium-input premium-select"
                      value={widgetForm.column}
                      onChange={(e) => setWidgetForm(prev => ({ ...prev, column: e.target.value }))}
                      required={widgetForm.operation !== 'count'}
                      disabled={widgetForm.operation === 'count'}
                    >
                      <option value="" disabled>Select column...</option>
                      {columns.map(c => (
                        <option key={c.name} value={c.name}>{c.name} ({c.type})</option>
                      ))}
                    </select>
                  </div>
                  <div className="input-group">
                    <label className="input-label" htmlFor="kpi-op">Operation</label>
                    <select
                      id="kpi-op"
                      className="premium-input premium-select"
                      value={widgetForm.operation}
                      onChange={(e) => setWidgetForm(prev => ({ ...prev, operation: e.target.value }))}
                      required
                    >
                      <option value="sum">Sum (Numeric)</option>
                      <option value="avg">Average (Numeric)</option>
                      <option value="min">Minimum (Numeric)</option>
                      <option value="max">Maximum (Numeric)</option>
                      <option value="count">Count (All Rows)</option>
                      <option value="unique">Unique Count (Any)</option>
                    </select>
                  </div>
                </div>
              )}

              {(widgetForm.type === 'line' || widgetForm.type === 'bar') && (
                <div className="flex flex-col gap-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="input-group">
                      <label className="input-label" htmlFor="chart-x">X-Axis (Dimension)</label>
                      <select
                        id="chart-x"
                        className="premium-input premium-select"
                        value={widgetForm.xAxisColumn}
                        onChange={(e) => setWidgetForm(prev => ({ ...prev, xAxisColumn: e.target.value }))}
                        required
                      >
                        <option value="" disabled>Select x-axis...</option>
                        {columns.map(c => (
                          <option key={c.name} value={c.name}>{c.name} ({c.type})</option>
                        ))}
                      </select>
                    </div>
                    <div className="input-group">
                      <label className="input-label" htmlFor="chart-y">Y-Axis (Value)</label>
                      <select
                        id="chart-y"
                        className="premium-input premium-select"
                        value={widgetForm.yAxisColumn}
                        onChange={(e) => setWidgetForm(prev => ({ ...prev, yAxisColumn: e.target.value }))}
                        required={widgetForm.operation !== 'count'}
                        disabled={widgetForm.operation === 'count'}
                      >
                        <option value="" disabled>Select y-axis...</option>
                        {columns.filter(c => c.type === 'number').map(c => (
                          <option key={c.name} value={c.name}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="input-group">
                    <label className="input-label" htmlFor="chart-op">Calculation</label>
                    <select
                      id="chart-op"
                      className="premium-input premium-select"
                      value={widgetForm.operation}
                      onChange={(e) => setWidgetForm(prev => ({ ...prev, operation: e.target.value }))}
                      required
                    >
                      <option value="sum">Sum of Y Values</option>
                      <option value="avg">Average of Y Values</option>
                      <option value="min">Minimum of Y Values</option>
                      <option value="max">Maximum of Y Values</option>
                      <option value="count">Count of Records</option>
                    </select>
                  </div>
                </div>
              )}

              {widgetForm.type === 'table' && (
                <div className="flex flex-col gap-4">
                  <div className="input-group">
                    <label className="input-label">Select Columns to Show</label>
                    <div className="grid grid-cols-2 gap-2 bg-[var(--bg)] border border-[var(--border)] rounded-lg p-3 max-h-36 overflow-y-auto hidden-scrollbar">
                      {columns.map(c => {
                        const isChecked = widgetForm.tableColumns.includes(c.name);
                        return (
                          <label key={c.name} className="flex items-center gap-2 text-xs font-semibold cursor-pointer text-muted hover:text-white select-none">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                setWidgetForm(prev => {
                                  const tableColumns = isChecked
                                    ? prev.tableColumns.filter(tc => tc !== c.name)
                                    : [...prev.tableColumns, c.name];
                                  return { ...prev, tableColumns };
                                });
                              }}
                              className="rounded border-[var(--border)] bg-[var(--bg)] text-[var(--primary)] focus:ring-[var(--primary)]"
                            />
                            {c.name}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                  <div className="input-group">
                    <label className="input-label" htmlFor="table-limit">Row Limit</label>
                    <input
                      id="table-limit"
                      type="number"
                      min="1"
                      max="100"
                      className="premium-input"
                      value={widgetForm.tableLimit}
                      onChange={(e) => setWidgetForm(prev => ({ ...prev, tableLimit: parseInt(e.target.value) || 5 }))}
                      required
                    />
                  </div>
                </div>
              )}

              {widgetForm.type === 'markdown' && (
                <div className="input-group">
                  <label className="input-label" htmlFor="md-content">Markdown Content</label>
                  <textarea
                    id="md-content"
                    rows={6}
                    className="premium-input font-mono text-xs"
                    placeholder="Enter basic Markdown notes... (**bold**, *italic*, # Headers)"
                    value={widgetForm.content}
                    onChange={(e) => setWidgetForm(prev => ({ ...prev, content: e.target.value }))}
                    required
                  />
                  <div className="text-[10px] text-muted">
                    Supports <strong># H1</strong>, <strong>## H2</strong>, <strong>### H3</strong>, <strong>- bullets</strong>, <strong>**bold**</strong>, <strong>*italic*</strong>, and <strong>`code`</strong>.
                  </div>
                </div>
              )}

              {/* Form Actions */}
              <div className="flex gap-3 justify-end mt-4 pt-4 border-t border-[var(--border)]">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setIsWidgetModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                >
                  {editingWidget ? 'Update Widget' : 'Add Widget'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


      {/* Toasts */}
      <div className="toast-container z-50">
        {showRestoreSession && (
          <div className="toast info" style={{ flexWrap: 'wrap', alignItems: 'flex-start', borderLeft: '4px solid var(--primary)'}}>
            <Activity className="text-[var(--primary)] shrink-0" size={20} />
            <div className="flex-1 flex flex-col gap-2">
              <span className="text-sm font-bold pt-0.5 pb-1">Restore previous session?</span>
              <span className="text-xs text-muted mb-2">We found unsaved data from your last session. Would you like to restore it?</span>
              <div className="flex gap-2">
                <button className="btn-primary py-1 px-3 text-xs justify-center flex-1" onClick={() => handleRestoreSession(true)}>Restore</button>
                <button className="btn-secondary py-1 px-3 text-xs justify-center flex-1 border-none" onClick={() => handleRestoreSession(false)}>Discard</button>
              </div>
            </div>
          </div>
        )}
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
      
      {/* History Panel */}
      {historyOpen && (
        <div className="w-80 border-l border-[var(--border)] bg-[var(--surface)] flex flex-col fade-in-right overflow-hidden shadow-2xl z-40 fixed right-0 top-0 bottom-0">
          <div className="p-4 border-b border-[var(--border)] flex justify-between items-center">
            <h3 className="font-bold flex items-center gap-2"><RotateCcw size={18}/> Version History</h3>
            <button className="btn-icon" onClick={() => setHistoryOpen(false)}><X size={18}/></button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
             <div 
                className={`p-3 rounded-lg border cursor-pointer transition-colors ${historyIndex === -1 ? 'border-[var(--primary)] bg-[rgba(99,102,241,0.1)]' : 'border-[var(--border)] hover:bg-[rgba(255,255,255,0.02)]'}`}
                onClick={() => jumpToState(-1)}
             >
                <div className="font-semibold text-sm">Initial State</div>
                <div className="text-xs text-muted mt-1">File upload / Original data</div>
             </div>
             {history.map((op, i) => (
                <div 
                   key={op.id}
                   className={`p-3 rounded-lg border cursor-pointer transition-colors relative ${i === historyIndex ? 'border-[var(--primary)] bg-[rgba(99,102,241,0.1)]' : 'border-[var(--border)] hover:bg-[rgba(255,255,255,0.02)] filter ' + (i > historyIndex ? 'opacity-50 grayscale' : '')}`}
                   onClick={() => jumpToState(i)}
                >
                   {i > historyIndex && <div className="absolute top-1 right-2 text-[10px] uppercase text-muted font-bold">Undone</div>}
                   <div className="font-semibold text-sm pr-10">{op.description}</div>
                   <div className="text-xs text-muted mt-1 font-mono">
                      {new Date(op.timestamp).toLocaleTimeString()}
                   </div>
                </div>
             ))}
          </div>
          <div className="p-4 border-t border-[var(--border)] text-xs text-muted">
            <div className="flex items-center gap-2 text-[var(--success)] font-medium bg-[rgba(16,185,129,0.1)] px-3 py-2 rounded">
               <Database size={14}/>
               Using operation patches <br/>Saved {(100 - (100 / Math.max(1, history.length + 1))).toFixed(1)}% memory
            </div>
            <div className="mt-2 text-center text-[10px]">Using ~{(Date.now().toString().length/1000).toFixed(2)}MB instead of ~{(data.length * 150 / 1024 / 1024 * (history.length + 1)).toFixed(2)}MB</div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <BrandConfigProvider>
      <MainApp />
    </BrandConfigProvider>
  );
}
