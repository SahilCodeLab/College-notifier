require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { OpenAI } = require('openai');
const { PDFDocument, rgb, degrees } = require('pdf-lib');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// API Keys
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

// Gemini URL
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

// OpenRouter Client
const openai = new OpenAI({
  apiKey: OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1',
});

// 🔁 Unified Response Generator
async function generateAIResponse(prompt, context) {
  const fullPrompt = `${context}\n\n${prompt}`.trim();

  // OpenRouter First
  try {
    const completion = await openai.chat.completions.create({
      model: 'deepseek/deepseek-r1-0528-qwen3-8b:free',
      messages: [
        { role: 'system', content: context },
        { role: 'user', content: prompt }
      ],
      extra_headers: {
        'HTTP-Referer': 'https://your-frontend.site',
        'X-Title': 'SahilAssignmentAI'
      }
    });

    const result = completion.choices[0].message.content;
    return { text: result, source: 'openrouter' };
  } catch (error) {
    console.warn('⚠️ OpenRouter failed. Trying Gemini...', error.message);
  }

  // Gemini Fallback
  try {
    const response = await axios.post(GEMINI_API_URL, {
      contents: [{ parts: [{ text: fullPrompt }] }],
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
    });

    const result = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    return { text: result || 'No result from Gemini.', source: 'gemini' };
  } catch (error) {
    console.error('❌ Gemini Error:', error.message);
    throw new Error('Both AI services failed.');
  }
}

// 📄 PDF Generator
async function generatePDF(content) {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]); // A4 size

  const fontSize = 12;
  const margin = 40;
  const textWidth = 595 - margin * 2;

  const lines = content.match(/.{1,100}/g); // Simple line break
  let y = 800;

  lines.forEach(line => {
    if (y < 60) {
      doc.addPage();
      y = 800;
    }
    page.drawText(line, { x: margin, y, size: fontSize });
    y -= fontSize + 4;
  });

  // 🧊 Add Watermark
  page.drawText("SahilCodeLab", {
    x: 150,
    y: 400,
    size: 50,
    opacity: 0.1,
    color: rgb(0.6, 0.6, 0.6),
    rotate: degrees(45)
  });

  const pdfBytes = await doc.save();
  return pdfBytes;
}

// 📚 Assignment + PDF Endpoint
app.post('/generate-assignment', async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: "Prompt is required" });

    const context = `
You are an expert academic content generator.

Generate a complete, original assignment based on the topic provided, suitable for high school or college students.

## Title
## Table of Contents
## Introduction (100-150 words)
## Main Body (400-600 words)
## Diagrams/Equations
## Applications
## Conclusion (100-120 words)
## References
`.trim();

    const { text } = await generateAIResponse(prompt, context);
    const pdfBytes = await generatePDF(text);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=assignment.pdf');
    res.send(pdfBytes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 🔍 Short Answer
app.post('/generate-short-answer', async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: "Prompt is required" });

    const context = `Provide a concise 2-3 sentence answer to the question. Be accurate and avoid unnecessary details.`;
    const result = await generateAIResponse(prompt, context);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 📖 Long Answer
app.post('/generate-long-answer', async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: "Prompt is required" });

    const context = `Provide a detailed 300-500 word explanation with headings and real-life examples.`;
    const result = await generateAIResponse(prompt, context);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ✅ Health Check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', fallback: 'openrouter > gemini' });
});

// 🌐 Server Start
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});