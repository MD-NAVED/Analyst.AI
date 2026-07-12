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
    const { prompt, contents, model } = req.body || {};
    const textPrompt = prompt || (contents && typeof contents === 'string' ? contents : JSON.stringify(contents));

    if (!textPrompt) {
      return res.status(400).json({ error: 'Missing prompt or contents' });
    }

    // ─── 1. OMNIROUTE LOCAL ROUTING FLOW (TOP PRIORITY) ───
    const omniRouteKey = process.env.OMNIROUTE_API_KEY || process.env.OMNIROUTE_DASHBOARD_KEY;
    if (omniRouteKey) {
      const omniRouteUrl = process.env.OMNIROUTE_URL || 'http://127.0.0.1:20128/v1/chat/completions';
      const selectedModel = model || 'auto';
      console.log(`Processing with OmniRoute local router at ${omniRouteUrl} with model: ${selectedModel}`);
      
      const response = await fetch(omniRouteUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${omniRouteKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: selectedModel,
          messages: [
            { role: "user", content: textPrompt }
          ]
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OmniRoute Error (${response.status}): ${errorText}`);
      }

      const responseData = await response.json();
      const textResult = responseData.choices?.[0]?.message?.content || '';
      return res.json({ text: textResult });
    }

    // ─── 2. OPENROUTER FREE OPEN-SOURCE MODELS FLOW ───
    const openRouterKey = process.env.OPENROUTER_API_KEY || process.env.OMNIROUTER_API_KEY;
    if (openRouterKey) {
      const selectedModel = model || 'openrouter/free';
      console.log(`Processing with OpenRouter open-source model: ${selectedModel}`);
      
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
          messages: [
            { role: "user", content: textPrompt }
          ],
          response_format: { type: "json_object" }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenRouter Error (${response.status}): ${errorText}`);
      }

      const responseData = await response.json();
      const textResult = responseData.choices?.[0]?.message?.content || '';
      return res.json({ text: textResult });
    }

    // ─── 3. GEMINI FALLBACK FLOW ───
    if (process.env.GEMINI_API_KEY) {
      const selectedModel = model || 'gemini-2.5-flash';
      console.log(`Processing with Gemini fallback model: ${selectedModel}`);
      
      const aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await aiClient.models.generateContent({
        model: selectedModel,
        contents: textPrompt,
      });

      return res.json({ text: response.text });
    }

    // ─── 4. NO API KEYS CONFIGURED (FORCE LOCAL FALLBACK) ───
    return res.status(400).json({ 
      error: 'No AI API keys configured (OMNIROUTE_API_KEY, OPENROUTER_API_KEY, or GEMINI_API_KEY). Triggering local statistical fallback engine.' 
    });

  } catch (error) {
    console.error('Vercel AI Endpoint Error:', error);
    return res.status(500).json({
      error: error.message || 'An error occurred during AI processing'
    });
  }
};

export default allowCors(handler);
