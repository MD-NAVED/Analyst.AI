import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config({ path: '.env.local' });
dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(cors());

const apiKey = process.env.GEMINI_API_KEY;
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

app.post('/api/analyze', async (req, res) => {
  try {
    if (!ai) {
      return res.status(400).json({ 
        error: 'Gemini API Key is missing. Please create a .env file in the project root containing GEMINI_API_KEY="your_actual_api_key" and restart the server.' 
      });
    }

    const { prompt, contents } = req.body;
    let finalPrompt = prompt || '';
    if (contents) {
        finalPrompt = `${finalPrompt}\n\nData Context:\n${JSON.stringify(contents)}`;
    }
    
    const modelsToTry = [
      'gemini-2.5-flash',
      'gemini-2.5-flash-lite',
      'gemini-2.0-flash',
      'gemini-flash-latest',
      'gemini-2.0-flash-lite'
    ];
    let response;
    let lastError: any = null;

    for (const modelName of modelsToTry) {
      try {
        console.log(`Attempting analysis with model: ${modelName}...`);
        response = await ai.models.generateContent({
            model: modelName,
            contents: finalPrompt,
        });
        console.log(`Analysis successfully completed using model: ${modelName}`);
        break;
      } catch (apiError: any) {
        lastError = apiError;
        const errorMsg = apiError.message || '';
        console.warn(`Model ${modelName} failed. Error: ${errorMsg.slice(0, 150)}...`);
      }
    }

    if (!response) {
      throw lastError || new Error('All candidate Gemini models failed to generate content.');
    }
    
    res.json({ text: response.text });
  } catch (error: any) {
    console.error('Gemini API Error:', error);
    res.status(500).json({ error: error.message || 'Failed to analyze data' });
  }
});

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';
  
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, '.')));
    app.get('*', (req, res) => {
        res.sendFile(path.resolve(__dirname, 'index.html'));
    });
  }

  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`Server started at http://localhost:${port}`);
  });
}

startServer();
