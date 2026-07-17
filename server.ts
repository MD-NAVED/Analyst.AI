import express from 'express';
import { GoogleGenAI } from '@google/genai';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import rateLimit from 'express-rate-limit';
import fs from 'fs';
import crypto from 'crypto';

dotenv.config({ path: '.env.local' });
dotenv.config();

const _dirname = typeof __filename !== 'undefined'
  ? path.dirname(__filename)
  : path.dirname(fileURLToPath(import.meta.url));

const app = express();

// 1. Security Headers (Helmet replacement to avoid extra external dependencies)
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self' https://generativelanguage.googleapis.com https://*.supabase.co ws: wss:;");
  next();
});

// 2. Request Body Limit (Max 100KB body parser size to prevent memory attacks)
app.use(express.json({ limit: '100kb' }));

const allowedOrigin = process.env.FRONTEND_URL;
const corsOptionsDelegate = (req: any, callback: any) => {
  const origin = req.header('Origin');
  const host = req.header('Host');
  let corsOptions;
  
  let isSameOrigin = false;
  if (origin && host) {
    try {
      const originUrl = new URL(origin);
      isSameOrigin = originUrl.host === host;
    } catch (e) {}
  }
  
  const isLocalhost = origin && (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:'));
  const isVercel = origin && origin.endsWith('.vercel.app');
  const isAllowedEnv = origin && allowedOrigin && origin === allowedOrigin;

  if (!origin || isSameOrigin || isLocalhost || isVercel || isAllowedEnv) {
    corsOptions = { 
      origin: true, 
      credentials: true,
      methods: ['GET', 'POST'],
      allowedHeaders: ['Content-Type', 'Authorization']
    };
  } else {
    corsOptions = { origin: false };
  }
  callback(null, corsOptions);
};
app.use(cors(corsOptionsDelegate));

// 4. Rate Limiting (30 requests per minute per IP or configurable by env)
const limitWindowMs = Number(process.env.RATE_LIMIT_WINDOW_MS) || 60000;
const limitMaxRequests = Number(process.env.RATE_LIMIT_MAX_REQUESTS) || 30;

const apiLimiter = rateLimit({
  windowMs: limitWindowMs,
  max: limitMaxRequests,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
  statusCode: 429
});

app.use('/api/', apiLimiter);

// 5. Input Sanitizer (Recursive string scanner that strips HTML tags to prevent XSS/Injection)
function sanitize(input: any): any {
  if (typeof input === 'string') {
    return input.replace(/<[^>]*>/g, '').trim();
  }
  if (Array.isArray(input)) {
    return input.map(item => sanitize(item));
  }
  if (typeof input === 'object' && input !== null) {
    const sanitized: any = {};
    for (const key in input) {
      if (Object.prototype.hasOwnProperty.call(input, key)) {
        sanitized[key] = sanitize(input[key]);
      }
    }
    return sanitized;
  }
  return input;
}

// --- AUTHENTICATION ENGINE (Option A) ---
const USERS_FILE = path.join(process.cwd(), 'users.json');
let inMemoryUsers: any[] = [];

function readUsers(): any[] {
  try {
    if (fs.existsSync(USERS_FILE)) {
      return JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
    }
  } catch (e) {
    console.warn("Could not read users.json, falling back to memory store.", e);
  }
  return inMemoryUsers;
}

function writeUsers(users: any[]) {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
  } catch (e) {
    console.warn("Could not write users.json, keeping in memory only.", e);
  }
  inMemoryUsers = users;
}

// Initialize in-memory store on start if users.json exists
try {
  if (fs.existsSync(USERS_FILE)) {
    inMemoryUsers = JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
  }
} catch (e) {}

// Native crypto helpers
function hashPassword(password: string): string {
  const salt = 'datalens_secure_salt_123';
  return crypto.createHmac('sha256', salt).update(password).digest('hex');
}

const JWT_SECRET = process.env.JWT_SECRET || 'datalens_default_jwt_secret_xyz_789';

function generateToken(payload: any): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + 24 * 60 * 60 * 1000 })).toString('base64url');
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}

function verifyToken(token: string): any | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, body, signature] = parts;
    
    const expectedSig = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
    if (signature !== expectedSig) return null;
    
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf-8'));
    if (parsed.exp < Date.now()) return null;
    
    return parsed;
  } catch (e) {
    return null;
  }
}

// Auth token verification middleware
function authenticateToken(req: any, res: any, next: any) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access Denied: Missing authentication token.' });
  }

  const user = verifyToken(token);
  if (!user) {
    return res.status(401).json({ error: 'Access Denied: Invalid or expired authentication token.' });
  }

  req.user = user;
  next();
}

// Auth Routes
app.post('/api/auth/register', (req, res) => {
  try {
    const body = sanitize(req.body);
    const { email, password, name, brandId } = body;

    if (!email || !password || !name || !brandId) {
      return res.status(400).json({ error: 'Missing required registration parameters.' });
    }

    const users = readUsers();
    const existingUser = users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.brandId === brandId);

    if (existingUser) {
      return res.status(400).json({ error: 'User is already registered for this workspace brand.' });
    }

    const newUser = {
      id: `user-${Date.now()}`,
      email: email.toLowerCase(),
      passwordHash: hashPassword(password),
      name,
      brandId,
      createdAt: new Date().toISOString()
    };

    users.push(newUser);
    writeUsers(users);

    const token = generateToken({ id: newUser.id, email: newUser.email, name: newUser.name, brandId: newUser.brandId });
    res.status(201).json({
      token,
      user: { id: newUser.id, email: newUser.email, name: newUser.name, brandId: newUser.brandId }
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Error occurred during registration.' });
  }
});

app.post('/api/auth/login', (req, res) => {
  try {
    const body = sanitize(req.body);
    const { email, password, brandId } = body;

    if (!email || !password || !brandId) {
      return res.status(400).json({ error: 'Missing required login parameters.' });
    }

    const users = readUsers();
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.brandId === brandId);

    if (!user || user.passwordHash !== hashPassword(password)) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = generateToken({ id: user.id, email: user.email, name: user.name, brandId: user.brandId });
    res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name, brandId: user.brandId }
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Error occurred during login.' });
  }
});

app.post('/api/auth/social-login', (req, res) => {
  try {
    const body = sanitize(req.body);
    const { provider, brandId } = body;

    if (!provider || !brandId) {
      return res.status(400).json({ error: 'Missing provider or brandId.' });
    }

    const email = `${provider.toLowerCase()}.demo@datalens.ai`;
    const name = `Naved (via ${provider})`;
    const id = `user-${provider.toLowerCase()}-${Date.now()}`;

    const users = readUsers();
    let user = users.find(u => u.email === email && u.brandId === brandId);
    if (!user) {
      user = {
        id,
        email,
        passwordHash: 'social-auth-password-hash',
        name,
        brandId,
        createdAt: new Date().toISOString()
      };
      users.push(user);
      writeUsers(users);
    }

    const token = generateToken({ id: user.id, email: user.email, name: user.name, brandId: user.brandId });
    res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name, brandId: user.brandId }
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Error occurred during social authentication.' });
  }
});

app.post('/api/auth/google-login', async (req, res) => {
  try {
    const body = sanitize(req.body);
    const { accessToken, brandId } = body;

    if (!accessToken || !brandId) {
      return res.status(400).json({ error: 'Missing accessToken or brandId.' });
    }

    const googleRes = await fetch(`https://www.googleapis.com/oauth2/v3/userinfo?access_token=${accessToken}`);
    if (!googleRes.ok) {
      return res.status(401).json({ error: 'Failed to verify Google access token.' });
    }

    const googleUser = await googleRes.json();
    const { email, name, sub } = googleUser;

    if (!email) {
      return res.status(400).json({ error: 'Google account does not provide an email address.' });
    }

    const users = readUsers();
    let user = users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.brandId === brandId);
    
    if (!user) {
      user = {
        id: `user-google-${sub}`,
        email: email.toLowerCase(),
        passwordHash: 'google-oauth-managed',
        name: name || 'Google User',
        brandId,
        createdAt: new Date().toISOString()
      };
      users.push(user);
      writeUsers(users);
    }

    const token = generateToken({ id: user.id, email: user.email, name: user.name, brandId: user.brandId });
    res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name, brandId: user.brandId }
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Error occurred during Google authentication.' });
  }
});

app.get('/api/auth/me', (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access Denied: Missing authentication token.' });
  }

  const user = verifyToken(token);
  if (!user) {
    return res.status(401).json({ error: 'Access Denied: Invalid or expired authentication token.' });
  }

  res.json({ user });
});

const apiKey = process.env.GEMINI_API_KEY;
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

// Helper to convert Gemini payload structures to standard OpenAI-style messages array
function convertGeminiToOpenAI(contents: any, defaultPrompt?: string): any[] {
  if (!contents) {
    return [{ role: 'user', content: defaultPrompt || '' }];
  }
  if (typeof contents === 'string') {
    return [{ role: 'user', content: contents }];
  }
  if (Array.isArray(contents)) {
    return contents.map((c: any) => {
      const role = c.role === 'model' || c.role === 'assistant' ? 'assistant' : 'user';
      const content = Array.isArray(c.parts) 
        ? c.parts.map((p: any) => p.text || '').join('\n') 
        : (typeof c.parts === 'string' ? c.parts : '');
      return { role, content };
    });
  }
  if (typeof contents === 'object') {
    const role = contents.role === 'model' || contents.role === 'assistant' ? 'assistant' : 'user';
    const content = Array.isArray(contents.parts) 
      ? contents.parts.map((p: any) => p.text || '').join('\n') 
      : '';
    return [{ role, content }];
  }
  return [{ role: 'user', content: defaultPrompt || '' }];
}

// POST /api/gemini - Accepts single prompt or array of contents (Requires Bearer Auth)
app.post('/api/gemini', authenticateToken, async (req, res) => {
  try {
    const body = sanitize(req.body);
    const { prompt, contents, model, temperature } = body;

    if (!prompt && !contents) {
      return res.status(400).json({ error: 'Bad Request: Missing prompt or contents in payload.' });
    }

    // ─── 1. OMNIROUTE LOCAL ROUTING FLOW (TOP PRIORITY) ───
    const omniRouteKey = process.env.OMNIROUTE_API_KEY || process.env.OMNIROUTE_DASHBOARD_KEY;
    if (omniRouteKey) {
      const omniRouteUrl = process.env.OMNIROUTE_URL || 'http://127.0.0.1:20128/v1/chat/completions';
      const selectedModel = model || 'gemini-3.1-flash-lite';
      console.log(`[LocalServer] Routing /api/gemini to OmniRoute at ${omniRouteUrl} using model: ${selectedModel}`);
      
      try {
        const response = await fetch(omniRouteUrl, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${omniRouteKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: selectedModel,
            messages: convertGeminiToOpenAI(contents, prompt)
          })
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`OmniRoute Error (${response.status}): ${errorText}`);
        }

        const responseData = await response.json();
        const textResult = responseData.choices?.[0]?.message?.content || '';
        return res.json({ text: textResult });
      } catch (err: any) {
        console.warn(`[LocalServer] OmniRoute call failed, attempting cloud backup. Error:`, err.message);
      }
    }

    // ─── 2. OPENROUTER CLOUD OS FLOW ───
    const openRouterKey = process.env.OPENROUTER_API_KEY || process.env.OMNIROUTER_API_KEY;
    if (openRouterKey) {
      const selectedModel = model || 'openrouter/free';
      console.log(`[LocalServer] Routing /api/gemini to OpenRouter using model: ${selectedModel}`);
      
      try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${openRouterKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://datalens-ai.vercel.app",
            "X-Title": "DataLens AI"
          },
          body: JSON.stringify({
            model: selectedModel,
            messages: convertGeminiToOpenAI(contents, prompt)
          })
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`OpenRouter Error (${response.status}): ${errorText}`);
        }

        const responseData = await response.json();
        const textResult = responseData.choices?.[0]?.message?.content || '';
        return res.json({ text: textResult });
      } catch (err: any) {
        console.warn(`[LocalServer] OpenRouter call failed, attempting Gemini backup. Error:`, err.message);
      }
    }

    // ─── 3. GEMINI DIRECT FALLBACK ───
    if (ai) {
      const modelName = model || 'gemini-2.5-flash';
      console.log(`[LocalServer] Routing /api/gemini to Gemini using model: ${modelName}`);
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: contents || prompt,
          config: {
            temperature: temperature !== undefined ? Number(temperature) : 1.0
          }
        });
        
        if (response && response.text) {
          return res.json({ text: response.text });
        }
      } catch (apiError: any) {
        console.error(`[LocalServer] Gemini generateContent error using ${modelName}:`, apiError);
      }
    }

    // ─── 4. NO ENGINES WORKED OR CONFIGURED (TRIGGER LOCAL CLIENT-SIDE FALLBACK) ───
    return res.status(502).json({ 
      error: 'All AI engines (OmniRoute, OpenRouter, Gemini) failed or are unconfigured. Triggering local statistical fallback engine.' 
    });

  } catch (error: any) {
    console.error('API Analyze internal error:', error);
    res.status(500).json({ error: error.message || 'Failed to analyze data.' });
  }
});

// POST /api/chat - Accepts messages array for multi-turn conversations (Requires Bearer Auth)
app.post('/api/chat', authenticateToken, async (req, res) => {
  try {
    const body = sanitize(req.body);
    const { messages, model, temperature } = body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Bad Request: Missing or invalid messages array.' });
    }

    // ─── 1. OMNIROUTE LOCAL ROUTING FLOW (TOP PRIORITY) ───
    const omniRouteKey = process.env.OMNIROUTE_API_KEY || process.env.OMNIROUTE_DASHBOARD_KEY;
    if (omniRouteKey) {
      const omniRouteUrl = process.env.OMNIROUTE_URL || 'http://127.0.0.1:20128/v1/chat/completions';
      const selectedModel = model || 'gemini-3.1-flash-lite';
      console.log(`[LocalServer] Routing /api/chat to OmniRoute at ${omniRouteUrl} using model: ${selectedModel}`);
      
      try {
        const response = await fetch(omniRouteUrl, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${omniRouteKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: selectedModel,
            messages: messages
          })
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`OmniRoute Error (${response.status}): ${errorText}`);
        }

        const responseData = await response.json();
        const textResult = responseData.choices?.[0]?.message?.content || '';
        return res.json({ text: textResult });
      } catch (err: any) {
        console.warn(`[LocalServer] OmniRoute call failed in chat, attempting cloud backup. Error:`, err.message);
      }
    }

    // ─── 2. OPENROUTER CLOUD OS FLOW ───
    const openRouterKey = process.env.OPENROUTER_API_KEY || process.env.OMNIROUTER_API_KEY;
    if (openRouterKey) {
      const selectedModel = model || 'openrouter/free';
      console.log(`[LocalServer] Routing /api/chat to OpenRouter using model: ${selectedModel}`);
      
      try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${openRouterKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://datalens-ai.vercel.app",
            "X-Title": "DataLens AI"
          },
          body: JSON.stringify({
            model: selectedModel,
            messages: messages
          })
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`OpenRouter Error (${response.status}): ${errorText}`);
        }

        const responseData = await response.json();
        const textResult = responseData.choices?.[0]?.message?.content || '';
        return res.json({ text: textResult });
      } catch (err: any) {
        console.warn(`[LocalServer] OpenRouter call failed in chat, attempting Gemini backup. Error:`, err.message);
      }
    }

    // ─── 3. GEMINI DIRECT FALLBACK ───
    if (ai) {
      const modelName = model || 'gemini-2.5-flash';
      console.log(`[LocalServer] Routing /api/chat to Gemini using model: ${modelName}`);
      
      try {
        // Map messages [{role, content}] to Gemini's native [{role, parts: [{text}]}]
        const contents = messages.map((m: any) => ({
          role: m.role === 'assistant' || m.role === 'model' ? 'model' : 'user',
          parts: [{ text: m.content || '' }]
        }));

        const response = await ai.models.generateContent({
          model: modelName,
          contents,
          config: {
            temperature: temperature !== undefined ? Number(temperature) : 1.0
          }
        });
        
        if (response && response.text) {
          return res.json({ text: response.text });
        }
      } catch (apiError: any) {
        console.error(`[LocalServer] Gemini generateContent error in chat using ${modelName}:`, apiError);
      }
    }

    // ─── 4. NO ENGINES WORKED OR CONFIGURED ───
    return res.status(502).json({ 
      error: 'All AI engines (OmniRoute, OpenRouter, Gemini) failed or are unconfigured. Triggering local statistical fallback engine.' 
    });

  } catch (error: any) {
    console.error('API Chat internal error:', error);
    res.status(500).json({ error: error.message || 'Failed to process chat conversation.' });
  }
});

// GET /api/health - Returns service health
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve frontend static assets or middleware
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';
  
  if (!isProd && !process.env.VERCEL) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve production static assets
    app.use(express.static(path.resolve(_dirname, '.')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(_dirname, 'index.html'));
    });
  }

  // Bind listener only if not deployed as a Serverless Vercel function
  if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
    const port = process.env.PORT || 3001;
    app.listen(port, () => {
      console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode at http://localhost:${port}`);
    });
  }
}

startServer();

export default app;
