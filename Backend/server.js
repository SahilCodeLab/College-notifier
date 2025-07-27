require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const { OpenAI } = require('openai');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ENV Keys
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

// Gemini API URL
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

// OpenRouter Client
const openai = new OpenAI({
  apiKey: OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1',
});

// ✨ Unified AI Response Generator
async function generateAIResponse(prompt, context) {
  const fullPrompt = `${context}\n\n${prompt}`.trim();

  // Try OpenRouter First
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

  // Fallback to Gemini
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
    });

    const result = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    return { text: result || 'No result from Gemini.', source: 'gemini' };
  } catch (error) {
    console.error('❌ Gemini API Error:', error.message);
    throw new Error('Both AI services failed.');
  }
}

// 🚀 Assignment Endpoint
app.post('/generate-assignment', async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: "Prompt is required" });

    const context = `
You are an expert academic content generator.

Generate a complete, original assignment based on the topic provided, suitable for high school or college students.

Assignment Structure:

## Title
- Start with a suitable and formal assignment title based on the topic.

## Table of Contents
- List of sections with titles (like a mini index).

## Introduction (100-150 words)
- Brief overview of the topic.
- Why this topic is important or relevant.
- Objective or what this assignment will cover.

## Main Body (400-600 words)
- 3 to 5 major points or subtopics.
- Each point should have:
  - A clear heading
  - Explanation in simple academic language
  - Real-life examples or case studies
  - Facts or data (if applicable)
- Use bullet points or numbering where needed.

## Diagrams/Equations (Optional)
- If topic requires, include labeled diagrams or simple formulas (describe them if image not possible).

## Applications (if applicable)
- Where or how this topic is used in real life or in academic/career fields.

## Conclusion (100-120 words)
- Summarize key points covered.
- Add a thoughtful ending or personal insight related to the topic.

## References
- Add 2-3 imaginary or common references like books, journals, or websites (no actual links required).

Guidelines:
- Format with Markdown headings (##).
- Keep content original, plagiarism-free, and academic.
- Suitable for school/college assignment submission.
- Maintain clarity, grammar, and formal tone.
`.trim();

    const result = await generateAIResponse(prompt, context);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 🧠 Short Answer Endpoint
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

// 📚 Long Answer Endpoint
app.post('/generate-long-answer', async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: "Prompt is required" });

    const context = `Provide a detailed 300-500 word explanation with:
- Clear section headings (##)
- Key concepts explained simply
- 2-3 relevant examples
- Practical applications if applicable`;

    const result = await generateAIResponse(prompt, context);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 🧾 PDF Download with Watermark
app.post('/download-pdf', async (req, res) => {
  try {
    const { content, filename = 'assignment' } = req.body;
    if (!content) return res.status(400).json({ error: "Content is required" });

    const htmlContent = `
      <html>
        <head>
          <style>
            @page {
              margin: 40px;
            }
            body {
              font-family: 'Arial';
              padding: 30px;
              color: #333;
              line-height: 1.6;
              position: relative;
            }
            .watermark {
              position: fixed;
              top: 40%;
              left: 30%;
              opacity: 0.1;
              font-size: 40px;
              transform: rotate(-30deg);
              z-index: 0;
              pointer-events: none;
              color: #000;
            }
            .content {
              z-index: 1;
              position: relative;
            }
          </style>
        </head>
        <body>
          <div class="watermark">Generated by SahilCodeLab</div>
          <div class="content">
            ${content.replace(/\n/g, "<br>")}
          </div>
        </body>
      </html>
    `;

    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
    await browser.close();

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=${filename}.pdf`,
      'Content-Length': pdfBuffer.length
    });

    res.send(pdfBuffer);
  } catch (error) {
    console.error("❌ PDF Generation Error:", error.message);
    res.status(500).json({ error: 'Failed to generate PDF.' });
  }
});

// 🔍 Health Check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', fallback: 'openrouter -> gemini' });
});

// 🌐 Start Server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`🔌 Fallback AI ready: OpenRouter > Gemini`);
});