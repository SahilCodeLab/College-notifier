// ✅ server.js — Final Version (Fast, Clean, Error-Free) require('dotenv').config(); const express = require('express'); const cors = require('cors'); const axios = require('axios'); const { OpenAI } = require('openai'); const PDFDocument = require('pdfkit');

const app = express(); const PORT = process.env.PORT || 3000;

// Middleware app.use(cors()); app.use(express.json());

// ENV Keys const GEMINI_API_KEY = process.env.GEMINI_API_KEY; const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

// ✅ Gemini API URL (corrected) const GEMINI_API_URL = https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY};

// OpenRouter Client const openai = new OpenAI({ apiKey: OPENROUTER_API_KEY, baseURL: 'https://openrouter.ai/api/v1' });

// ✨ Unified AI Function async function generateAIResponse(prompt, context) { const fullPrompt = ${context}\n\n${prompt}; try { const completion = await openai.chat.completions.create({ model: 'deepseek/deepseek-r1-0528-qwen3-8b:free', messages: [ { role: 'system', content: context }, { role: 'user', content: prompt } ], extra_headers: { 'HTTP-Referer': 'https://your-frontend.site', 'X-Title': 'SahilAssignmentAI' } });

return { text: completion.choices[0].message.content, source: 'openrouter' };

} catch (err) { console.warn('Fallback to Gemini:', err.message); }

// Gemini fallback try { const geminiRes = await axios.post(GEMINI_API_URL, { contents: [{ parts: [{ text: fullPrompt }] }], generationConfig: { temperature: 0.7, topP: 0.9, maxOutputTokens: 3000 } }); const result = geminiRes.data?.candidates?.[0]?.content?.parts?.[0]?.text; return { text: result || 'No response from Gemini.', source: 'gemini' }; } catch (error) { throw new Error('Both AI services failed.'); } }

// 📄 PDF Generator function generatePDF(content, res, filename = 'output.pdf') { const doc = new PDFDocument(); res.setHeader('Content-Type', 'application/pdf'); res.setHeader('Content-Disposition', attachment; filename=${filename}); doc.pipe(res); doc.font('Times-Roman').fontSize(14).text(content); doc.end(); }

// 📝 Assignment (8–10 pages) app.post('/generate-assignment', async (req, res) => { try { let { subject, topic, level, prompt } = req.body;

if (!prompt) {
  if (!subject || !topic || !level) {
    return res.status(400).json({ error: "Provide prompt or subject, topic, and level." });
  }
  prompt = `

Write a plagiarism-free academic assignment on: "${topic}"\nSubject: ${subject}\nLevel: ${level} Structure:

1. Introduction (300 words)


2. Literature Review (500 words)


3. Main Body (1800+ words)


4. Conclusion (400 words)


5. References (APA 8–10) Use formal tone, real examples, ${subject.includes('Science') ? 'data/diagrams' : ''}${subject.includes('Arts') ? 'theoretical frameworks' : ''}${subject.includes('Commerce') ? 'market analysis/case studies' : ''} `.trim();

context = You are a ${subject} professor with 15+ years of experience. Generate 2500–3000 word, in-depth, structured content for ${level} students with 100% academic integrity.; }

const result = await generateAIResponse(prompt, context); const filename = assignment-${subject.replace(/\s+/g, '')}-${Date.now()}.pdf;

if (req.query.download === 'pdf') return generatePDF(result.text, res, filename); res.json({ ...result, subject, topic }); } catch (err) { res.status(500).json({ error: err.message }); } });



// 📚 Long Answer app.post('/generate-long-answer', async (req, res) => { try { const { prompt } = req.body; if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

const context = `You are an academic expert. Write a 300–500 word explanation using clear structure, real examples, and formal language.`;
const result = await generateAIResponse(prompt, context);
if (req.query.download === 'pdf') return generatePDF(result.text, res, `long-answer-${Date.now()}.pdf`);

res.json(result);

} catch (err) { res.status(500).json({ error: err.message }); } });

// 🧠 Short Answer app.post('/generate-short-answer', async (req, res) => { try { const { prompt } = req.body; if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

const context = `Answer the question in 2–3 sentences using simple, clear, formal language.`;
const result = await generateAIResponse(prompt, context);
res.json(result);

} catch (err) { res.status(500).json({ error: err.message }); } });

// 🩺 Health Check app.get('/health', (req, res) => { res.status(200).json({ status: 'healthy', ai: 'openrouter → gemini fallback' }); });

// 🚀 Start Server app.listen(PORT, () => { console.log(✅ Server running at http://localhost:${PORT}); });

