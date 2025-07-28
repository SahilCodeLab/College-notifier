require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const chromium = require('chrome-aws-lambda');
const puppeteer = require('puppeteer-core');
const { OpenAI } = require('openai');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Environment variables validation
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!OPENROUTER_API_KEY) {
  console.error('❌ OPENROUTER_API_KEY is missing');
  process.exit(1);
}

const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

const openai = new OpenAI({
  apiKey: OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1',
});

// AI Response Generator
async function generateAIResponse(prompt, context) {
  const fullPrompt = `${context}\n\n${prompt}`.trim();

  try {
    const completion = await openai.chat.completions.create({
      model: 'deepseek/deepseek-r1-0528-qwen3-8b:free',
      messages: [
        { role: 'system', content: context },
        { role: 'user', content: prompt }
      ],
      extra_headers: {
        'HTTP-Referer': 'https://academiapro.app',
        'X-Title': 'AcademiaPro'
      }
    });
    return { text: completion.choices[0].message.content, source: 'openrouter' };
  } catch (error) {
    console.warn('OpenRouter failed, trying Gemini...');
    
    if (GEMINI_API_KEY) {
      try {
        const response = await axios.post(GEMINI_API_URL, {
          contents: [{ parts: [{ text: fullPrompt }] }],
          generationConfig: {
            temperature: 0.7,
            topP: 0.95,
            topK: 40,
            maxOutputTokens: 2048
          }
        });
        const result = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
        return { text: result || 'No result from Gemini', source: 'gemini' };
      } catch (error) {
        console.error('Gemini failed too:', error.message);
      }
    }
    throw new Error('All AI services failed. Please try again later.');
  }
}

// Assignment Endpoint with Detailed Structure
app.post('/generate-assignment', async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: "Prompt is required" });

    const context = `
You are an expert academic content generator. Generate a complete, original assignment based on the topic provided.

**Assignment Structure:**

1. Title
   - Clear and descriptive title reflecting the topic

2. Introduction (150-200 words)
   - Background information
   - Importance of the topic
   - Objectives of the assignment

3. Main Content (500-800 words)
   - 3-5 main sections with headings
   - Each section should include:
     * Key concepts explained
     * Relevant examples
     * Supporting evidence/data
     * Clear transitions between sections

4. Case Studies/Examples (if applicable)
   - 1-2 real-world applications
   - Detailed analysis

5. Conclusion (150-200 words)
   - Summary of key points
   - Final thoughts/recommendations

6. References
   - 3-5 credible academic sources
   - Proper citation format

**Formatting Guidelines:**
- Use Markdown formatting (## for main headings, ### for subheadings)
- Include bullet points for lists
- Bold important terms
- Maintain formal academic tone
- Ensure logical flow between sections
- Use paragraph breaks for readability
`.trim();
    
    const result = await generateAIResponse(prompt, context);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Short Answer Endpoint
app.post('/generate-short-answer', async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: "Prompt is required" });

    const context = `Provide a concise 2-3 sentence answer to the question. Be accurate and to the point.`;
    const result = await generateAIResponse(prompt, context);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Long Answer Endpoint
app.post('/generate-long-answer', async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: "Prompt is required" });

    const context = `Provide a detailed 300-500 word explanation with:
- Clear section headings
- Key concepts explained
- 2-3 relevant examples
- Practical applications
- Concise conclusion`;
    
    const result = await generateAIResponse(prompt, context);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PDF Generation Endpoint
app.post('/download-pdf', async (req, res) => {
  let browser;
  try {
    const { content, filename = 'document' } = req.body;
    if (!content) return res.status(400).json({ error: "Content is required" });

    const executablePath = await chromium.executablePath;
    browser = await puppeteer.launch({
      args: chromium.args,
      executablePath,
      headless: 'new'
    });

    const page = await browser.newPage();
    await page.setContent(`
      <html>
        <head>
          <style>
            body { 
              font-family: Arial; 
              padding: 40px;
              line-height: 1.6;
              color: #333;
            }
            h1 { color: #2c3e50; border-bottom: 1px solid #eee; padding-bottom: 10px; }
            h2 { color: #34495e; margin-top: 25px; }
            p { margin-bottom: 15px; }
            ul, ol { margin-bottom: 20px; padding-left: 20px; }
            .watermark {
              position: fixed;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%) rotate(-30deg);
              opacity: 0.1;
              font-size: 72px;
              color: #000;
              z-index: -1;
              pointer-events: none;
            }
          </style>
        </head>
        <body>
          <div class="watermark">AcademicAI</div>
          ${content.replace(/\n/g, "<br>")}
        </body>
      </html>
    `);

    const pdfBuffer = await page.pdf({ 
      format: 'A4',
      printBackground: true,
      margin: {
        top: '40px',
        right: '40px',
        bottom: '40px',
        left: '40px'
      }
    });
    
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=${filename}.pdf`
    });
    res.send(pdfBuffer);

  } catch (error) {
    console.error("PDF Error:", error);
    res.status(500).json({ 
      error: "Failed to generate PDF",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    if (browser) await browser.close();
  }
});

// Health Check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    services: {
      openrouter: !!OPENROUTER_API_KEY,
      gemini: !!GEMINI_API_KEY,
      pdf: true
    },
    timestamp: new Date().toISOString()
  });
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`OpenRouter: ${OPENROUTER_API_KEY ? 'Configured' : 'Not configured'}`);
  console.log(`Gemini: ${GEMINI_API_KEY ? 'Configured' : 'Not configured'}`);
});