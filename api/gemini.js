import { GoogleGenAI } from '@google/genai';

// Helper to handle CORS on Vercel Serverless Functions
const allowCors = (fn) => async (req, res) => {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*'); 
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  return await fn(req, res);
};

const handler = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { prompt, contents, model = 'gemini-2.5-flash' } = req.body || {};

    if (!prompt && !contents) {
      return res.status(400).json({ error: 'Missing prompt or contents' });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is not configured in Vercel Environment Variables.' });
    }

    const aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await aiClient.models.generateContent({
      model,
      contents: contents || prompt,
    });

    return res.json({ text: response.text });
  } catch (error) {
    console.error('Vercel API Error:', error);
    return res.status(500).json({
      error: error.message || 'An error occurred during AI processing'
    });
  }
};

export default allowCors(handler);
