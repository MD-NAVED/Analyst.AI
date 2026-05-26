import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import rateLimit from 'express-rate-limit';

dotenv.config({ path: '.env.local' });
dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

// 1. Security Headers (Helmet replacement to avoid extra external dependencies)
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' https://generativelanguage.googleapis.com;");
  next();
});

// 2. Request Body Limit (Max 100KB body parser size to prevent memory attacks)
app.use(express.json({ limit: '100kb' }));

// 3. Configurable CORS
const allowedOrigin = process.env.FRONTEND_URL || 'http://localhost:3000';
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl) or matching allowed origin
    if (!origin || origin === allowedOrigin || origin.startsWith('http://localhost:')) {
      callback(null, true);
    } else {
      callback(new Error('Blocked by CORS policy'));
    }
  },
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type'],
  credentials: true
}));

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

const apiKey = process.env.GEMINI_API_KEY;
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

// POST /api/analyze - Accepts single prompt or array of contents
app.post('/api/analyze', async (req, res) => {
  try {
    const body = sanitize(req.body);
    const { prompt, contents, model, temperature } = body;

    if (!prompt && !contents) {
      return res.status(400).json({ error: 'Bad Request: Missing prompt or contents in payload.' });
    }

    if (!ai) {
      return res.status(502).json({ error: 'AI Service Unavailable: Gemini API key is missing on the server.' });
    }

    const modelName = model || 'gemini-2.5-flash';
    let response;
    
    try {
      response = await ai.models.generateContent({
        model: modelName,
        contents: contents || prompt,
        config: {
          temperature: temperature !== undefined ? Number(temperature) : 1.0
        }
      });
    } catch (apiError: any) {
      console.error(`Gemini generateContent error using ${modelName}:`, apiError);
      return res.status(500).json({ error: apiError.message || 'AI service error during content generation.' });
    }

    if (!response || !response.text) {
      return res.status(500).json({ error: 'Failed to retrieve text response from Gemini API.' });
    }

    // Strip out the API key or metadata from the response (just return standard text)
    res.json({ text: response.text });
  } catch (error: any) {
    console.error('API Analyze internal error:', error);
    res.status(500).json({ error: error.message || 'Failed to analyze data.' });
  }
});

// POST /api/chat - Accepts messages array for multi-turn conversations
app.post('/api/chat', async (req, res) => {
  try {
    const body = sanitize(req.body);
    const { messages, model, temperature } = body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Bad Request: Missing or invalid messages array.' });
    }

    if (!ai) {
      return res.status(502).json({ error: 'AI Service Unavailable: Gemini API key is missing on the server.' });
    }

    // Map messages [{role, content}] to Gemini's native [{role, parts: [{text}]}]
    const contents = messages.map((m: any) => ({
      role: m.role === 'assistant' || m.role === 'model' ? 'model' : 'user',
      parts: [{ text: m.content || '' }]
    }));

    const modelName = model || 'gemini-2.5-flash';
    let response;

    try {
      response = await ai.models.generateContent({
        model: modelName,
        contents,
        config: {
          temperature: temperature !== undefined ? Number(temperature) : 1.0
        }
      });
    } catch (apiError: any) {
      console.error(`Gemini generateContent error in chat using ${modelName}:`, apiError);
      return res.status(500).json({ error: apiError.message || 'AI service error during chat content generation.' });
    }

    if (!response || !response.text) {
      return res.status(500).json({ error: 'Failed to retrieve text response from Gemini API.' });
    }

    res.json({ text: response.text });
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
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve production static assets
    app.use(express.static(path.resolve(__dirname, '.')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'index.html'));
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
