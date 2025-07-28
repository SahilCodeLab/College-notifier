require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const chromium = require('chrome-aws-lambda');
const puppeteer = require('puppeteer-core');
const { OpenAI } = require('openai');

const app = express();
const PORT = process.env.PORT || 3000;

// Enhanced middleware configuration
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Environment variables with validation
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const NODE_ENV = process.env.NODE_ENV || 'development';

if (!OPENROUTER_API_KEY) {
  console.error('❌ OPENROUTER_API_KEY is missing in environment variables');
  process.exit(1);
}

const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

const openai = new OpenAI({
  apiKey: OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1',
});

// Enhanced AI response generator with retries
async function generateAIResponse(prompt, context, retries = 2) {
  const fullPrompt = `${context}\n\n${prompt}`.trim();

  // Try OpenRouter first
  try {
    const completion = await openai.chat.completions.create({
      model: 'deepseek/deepseek-r1-0528-qwen3-8b:free',
      messages: [
        { role: 'system', content: context },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 2000,
      extra_headers: {
        'HTTP-Referer': 'https://academic-ai-assistant.com',
        'X-Title': 'AcademicAI'
      }
    });

    const result = completion.choices[0]?.message?.content;
    if (result) return { text: result, source: 'openrouter' };
  } catch (error) {
    console.warn('⚠️ OpenRouter attempt failed:', error.message);
    if (retries > 0) {
      console.log(`Retrying... (${retries} attempts left)`);
      return generateAIResponse(prompt, context, retries - 1);
    }
  }

  // Fallback to Gemini if available
  if (GEMINI_API_KEY) {
    try {
      const response = await axios.post(GEMINI_API_URL, {
        contents: [{
          parts: [{ text: fullPrompt }]
        }],
        generationConfig: {
          temperature: 0.7,
          topP: 0.95,
          topK: 40,
          maxOutputTokens: 2048
        },
        safetySettings: [
          { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
          { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" }
        ]
      }, { timeout: 15000 });

      const result = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
      return { text: result || 'No result from Gemini.', source: 'gemini' };
    } catch (error) {
      console.error('❌ Gemini API Error:', error.message);
    }
  }

  throw new Error('All AI services failed. Please try again later.');
}

// Cache setup for frequent requests
const cache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// 🚀 Assignment Endpoint with caching
app.post('/generate-assignment', async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: "Prompt is required" });

    const cacheKey = `assignment:${prompt}`;
    if (cache.has(cacheKey)) {
      const cached = cache.get(cacheKey);
      if (Date.now() - cached.timestamp < CACHE_DURATION) {
        return res.json(cached.data);
      }
    }

    const context = `
You are an expert academic content generator. Follow these guidelines:

## Assignment Structure
1. Title: Formal and topic-specific
2. Table of Contents: List all sections
3. Introduction (100-150 words)
4. Main Body (400-600 words with 3-5 points)
5. Diagrams/Equations (if applicable)
6. Applications (real-world uses)
7. Conclusion (100-120 words)
8. References (2-3 credible sources)

## Formatting Rules
- Use Markdown headings (##, ###)
- Include bullet points for lists
- Bold important terms
- Add examples for each concept
- Maintain academic tone
`.trim();

    const result = await generateAIResponse(prompt, context);
    
    // Cache the result
    cache.set(cacheKey, {
      data: result,
      timestamp: Date.now()
    });

    res.json(result);
  } catch (error) {
    console.error('Assignment Error:', error);
    res.status(500).json({ 
      error: error.message,
      suggestion: 'Please try a different prompt or try again later'
    });
  }
});

// ✏️ Short Answer Endpoint
app.post('/generate-short-answer', async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: "Prompt is required" });

    const context = `Provide a concise 2-3 sentence answer to the question. Be accurate, specific, and avoid fluff.`;
    const result = await generateAIResponse(prompt, context);
    res.json(result);
  } catch (error) {
    res.status(500).json({ 
      error: error.message,
      details: 'Short answer generation failed'
    });
  }
});

// 📚 Long Answer Endpoint
app.post('/generate-long-answer', async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: "Prompt is required" });

    const context = `Provide a detailed 300-500 word explanation with:
- Clear section headings (##)
- Key concepts explained simply
- 2-3 relevant examples
- Practical applications
- Concise conclusion`;
    
    const result = await generateAIResponse(prompt, context);
    res.json(result);
  } catch (error) {
    res.status(500).json({ 
      error: error.message,
      details: 'Long answer generation failed'
    });
  }
});

// 🧾 PDF Generator with Watermark (Fixed for Render.com)
app.post('/download-pdf', async (req, res) => {
  let browser;
  try {
    const { content, filename = 'document' } = req.body;
    if (!content) return res.status(400).json({ error: "Content is required" });

    // Get the executable path dynamically
    const executablePath = process.env.NODE_ENV === 'production'
      ? await chromium.executablePath
      : process.env.PUPPETEER_EXECUTABLE_PATH || await chromium.executablePath;

    console.log('Using Chromium executable at:', executablePath);

    // Launch browser with Render.com compatible settings
    browser = await puppeteer.launch({
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--single-process'
      ],
      executablePath,
      headless: "new",
      ignoreHTTPSErrors: true
    });

    const page = await browser.newPage();
    await page.setContent(`
      <html>
        <head>
          <style>
            body { font-family: Arial; padding: 20px; line-height: 1.6 }
            .watermark {
              position: fixed;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%) rotate(-30deg);
              opacity: 0.1;
              font-size: 72px;
              color: #000;
              z-index: -1;
            }
          </style>
        </head>
        <body>
          <div class="watermark">Generated by AcademicAI</div>
          <div>${content.replace(/\n/g, "<br>")}</div>
        </body>
      </html>
    `, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '40px', right: '40px', bottom: '40px', left: '40px' }
    });

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=${filename}.pdf`
    });

    res.send(pdfBuffer);

  } catch (error) {
    console.error("PDF Generation Error:", error);
    res.status(500).json({ 
      error: 'Failed to generate PDF',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      solution: 'This feature might not work in free hosting plans'
    });
  } finally {
    if (browser) await browser.close();
  }
});

    // More reliable browser launch
    browser = await puppeteer.launch({
      args: [
        ...chromium.args,
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--single-process'
      ],
      executablePath: process.env.CHROME_PATH || await chromium.executablePath,
      headless: "new",
      ignoreHTTPSErrors: true
    });

    const page = await browser.newPage();
    await page.setContent(htmlContent, {
      waitUntil: ['domcontentloaded', 'networkidle0'],
      timeout: 30000
    });

    // PDF generation with better settings
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '1.5cm',
        right: '1.5cm',
        bottom: '1.5cm',
        left: '1.5cm'
      },
      timeout: 30000
    });

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=${filename.replace(/[^a-z0-9]/gi, '_')}.pdf`,
      'Content-Length': pdfBuffer.length
    });

    res.send(pdfBuffer);

  } catch (error) {
    console.error('PDF Generation Error:', error);
    res.status(500).json({ 
      error: 'Failed to generate PDF',
      details: NODE_ENV === 'development' ? error.message : undefined,
      solution: 'Try reducing the content length or try again later'
    });
  } finally {
    if (browser) await browser.close();
  }
});

// 🩹 Health Check Endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    services: {
      openrouter: OPENROUTER_API_KEY ? 'configured' : 'missing',
      gemini: GEMINI_API_KEY ? 'configured' : 'missing',
      pdf: 'available'
    },
    memory: process.memoryUsage(),
    uptime: process.uptime()
  });
});

// 🛑 Error Handling Middleware
app.use((err, req, res, next) => {
  console.error('🚨 Server Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    requestId: req.id,
    timestamp: new Date().toISOString()
  });
});

// 🌐 Start Server with Graceful Shutdown
const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`🔌 AI Providers: ${OPENROUTER_API_KEY ? 'OpenRouter' : ''} ${GEMINI_API_KEY ? '+ Gemini' : ''}`);
});

process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('💤 Server terminated');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received. Shutting down gracefully...');
  server.close(() => {
    console.log('💤 Server terminated');
    process.exit(0);
  });
});