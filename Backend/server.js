require('dotenv').config(); const express = require('express'); const cors = require('cors'); const axios = require('axios'); const { OpenAI } = require('openai'); const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');

const app = express(); const PORT = process.env.PORT || 3000;

// Middleware app.use(cors()); app.use(express.json());

// ENV Keys const GEMINI_API_KEY = process.env.GEMINI_API_KEY; const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

// Gemini API URL const GEMINI_API_URL = https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY};

// OpenRouter Client const openai = new OpenAI({ apiKey: OPENROUTER_API_KEY, baseURL: 'https://openrouter.ai/api/v1', });

// ✨ Unified AI Response Generator async function generateAIResponse(prompt, context) { const fullPrompt = ${context}\n\n${prompt}.trim();

// Try OpenRouter First try { const completion = await openai.chat.completions.create({ model: 'deepseek/deepseek-r1-0528-qwen3-8b:free', messages: [ { role: 'system', content: context }, { role: 'user', content: prompt } ], extra_headers: { 'HTTP-Referer': 'https://your-frontend.site', 'X-Title': 'SahilAssignmentAI' } });

const result = completion.choices[0].message.content;
return { text: result, source: 'openrouter' };

} catch (error) { console.warn('⚠️ OpenRouter failed. Trying Gemini...', error.message); }

// Fallback to Gemini try { const response = await axios.post(GEMINI_API_URL, { contents: [{ parts: [{ text: fullPrompt }] }], generationConfig: { temperature: 0.7, topP: 0.95, topK: 40, maxOutputTokens: 2048 }, safetySettings: [ { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" }, { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" } ] });

const result = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
return { text: result || 'No result from Gemini.', source: 'gemini' };

} catch (error) { console.error('❌ Gemini API Error:', error.message); throw new Error('Both AI services failed.'); } }

// 📄 Generate PDF async function generatePDF(text) { const pdfDoc = await PDFDocument.create(); const page = pdfDoc.addPage(); const { width, height } = page.getSize(); const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

const lines = text.split('\n'); let y = height - 50;

for (const line of lines) { page.drawText(line, { x: 50, y, size: 11, font, color: rgb(0, 0, 0), }); y -= 16; if (y < 50) break; // Prevent text overflow }

// Watermark page.drawText('SahilCodeLab', { x: width / 2 - 80, y: 40, size: 14, font, color: rgb(0.8, 0.8, 0.8), opacity: 0.5, });

const pdfBytes = await pdfDoc.save(); return pdfBytes; }

// 🚀 Assignment Endpoint app.post('/generate-assignment', async (req, res) => { try { const { prompt } = req.body; if (!prompt) return res.status(400).json({ error: "Prompt is required" });

const context = `

You are an expert academic content generator.

Generate a complete, original assignment based on the topic provided, suitable for high school or college students.

Assignment Structure:

Title

Start with a suitable and formal assignment title based on the topic.


Table of Contents

List of sections with titles (like a mini index).


Introduction (100-150 words)

Brief overview of the topic.

Why this topic is important or relevant.

Objective or what this assignment will cover.


Main Body (400-600 words)

3 to 5 major points or subtopics.

Each point should have:

A clear heading

Explanation in simple academic language

Real-life examples or case studies

Facts or data (if applicable)


Use bullet points or numbering where needed.


Diagrams/Equations (Optional)

If topic requires, include labeled diagrams or simple formulas (describe them if image not possible).


Applications (if applicable)

Where or how this topic is used in real life or in academic/career fields.


Conclusion (100-120 words)

Summarize key points covered.

Add a thoughtful ending or personal insight related to the topic.


References

Add 2-3 imaginary or common references like books, journals, or websites (no actual links required).


Guidelines:

Format with Markdown headings (##).

Keep content original, plagiarism-free, and academic.

Suitable for school/college assignment submission.

Maintain clarity, grammar, and formal tone. `.trim();

const result = await generateAIResponse(prompt, context); const pdf = await generatePDF(result.text); res.setHeader('Content-Type', 'application/pdf'); res.setHeader('Content-Disposition', 'attachment; filename=assignment.pdf'); res.send(pdf); } catch (error) { res.status(500).json({ error: error.message }); } });


// 🧠 Short Answer Endpoint app.post('/generate-short-answer', async (req, res) => { try { const { prompt } = req.body; if (!prompt) return res.status(400).json({ error: "Prompt is required" });

const context = `Provide a concise 2-3 sentence answer to the question. Be accurate and avoid unnecessary details.`;

const result = await generateAIResponse(prompt, context);
res.json(result);

} catch (error) { res.status(500).json({ error: error.message }); } });

// 📚 Long Answer Endpoint app.post('/generate-long-answer', async (req, res) => { try { const { prompt } = req.body; if (!prompt) return res.status(400).json({ error: "Prompt is required" });

const context = `Provide a detailed 300-500 word explanation with:

Clear section headings (##)

Key concepts explained simply

2-3 relevant examples

Practical applications if applicable`;

const result = await generateAIResponse(prompt, context); const pdf = await generatePDF(result.text); res.setHeader('Content-Type', 'application/pdf'); res.setHeader('Content-Disposition', 'attachment; filename=long-answer.pdf'); res.send(pdf); } catch (error) { res.status(500).json({ error: error.message }); } });


// 🔍 Health Check app.get('/health', (req, res) => { res.status(200).json({ status: 'healthy', fallback: 'openrouter -> gemini' }); });

// 🌐 Start Server app.listen(PORT, () => { console.log(🚀 Server running on http://localhost:${PORT}); console.log(🔌 Fallback AI ready: OpenRouter > Gemini); });

