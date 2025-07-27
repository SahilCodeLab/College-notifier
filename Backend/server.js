require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Validate API Key
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  console.error('❌ Error: Missing GEMINI_API_KEY in .env file');
  process.exit(1);
}

// Gemini 2.0 Flash API Config
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

// Enhanced AI Response Generator
async function generateAIResponse(prompt, context) {
  try {
    const response = await axios.post(GEMINI_API_URL, {
      contents: [{
        parts: [{ text: `${context}\n\n${prompt}`.trim() }]
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

    return response.data?.candidates?.[0]?.content?.parts?.[0]?.text || 
           "Sorry, I couldn't generate a response. Please try again.";
  } catch (error) {
    console.error('Gemini API Error:', error.response?.data || error.message);
    throw new Error(error.response?.data?.error?.message || 'AI service unavailable');
  }
}

// API Endpoints
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
    res.json({ text: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/generate-short-answer', async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: "Prompt is required" });

    const context = `Provide a concise 2-3 sentence answer to the question. 
    Be accurate and avoid unnecessary details.`;
    
    const result = await generateAIResponse(prompt, context);
    res.json({ text: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

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
    res.json({ text: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Health Check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', gemini: '2.0-flash' });
});

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`🔌 Gemini 2.0 Flash API Ready`);
});