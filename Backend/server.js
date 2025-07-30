require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { OpenAI } = require('openai');
const PDFDocument = require('pdfkit');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS Setup
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type'],
    exposedHeaders: ['Content-Disposition']
}));
app.use(express.json({ limit: '10mb' }));

// API Keys & URLs
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
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
                'HTTP-Referer': 'https://your-frontend.site',
                'X-Title': 'SahilAssignmentAI'
            }
        });
        return { text: completion.choices[0].message.content, source: 'openrouter' };
    } catch (error) {
        console.warn('OpenRouter failed. Trying Gemini...', error.message);
    }

    try {
        const response = await axios.post(GEMINI_API_URL, {
            contents: [{ parts: [{ text: fullPrompt }] }],
            generationConfig: {
                temperature: 0.7,
                topP: 0.95,
                topK: 40,
                maxOutputTokens: 8192
            },
            safetySettings: [
                { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
                { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" }
            ]
        });

        const result = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
        return { text: result || 'No result from Gemini.', source: 'gemini' };
    } catch (error) {
        console.error('Gemini API Error:', error.message);
        throw new Error('Both AI services failed.');
    }
}

// PDF Generator (Fixed Version)
async function generatePDF(content, res) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({
                size: 'A4',
                margins: { top: 50, bottom: 50, left: 72, right: 72 }
            });

            // Set response headers
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'attachment; filename=Assignment-SahilCodeLab.pdf');

            // Validate content
            if (!content || typeof content !== 'string') {
                throw new Error('Invalid content for PDF generation');
            }

            // Pipe the PDF directly to response
            doc.pipe(res);

            // Color theme
            const palette = {
                primary: '#0D47A1',
                text: '#333333',
                watermark: '#AAAAAA'
            };

            let pageNumber = 1;

            // Simple watermark implementation
            const addWatermark = () => {
                doc.save();
                doc.fontSize(60)
                   .fillColor(palette.watermark)
                   .opacity(0.1)
                   .text('SahilCodeLab', 50, 300, {
                       rotate: 45,
                       align: 'center'
                   });
                doc.restore();
            };

            // Footer implementation
            const addFooter = () => {
                const bottom = doc.page.height - 40;
                doc.fontSize(10)
                   .fillColor('#666666')
                   .text(`Page ${pageNumber}`, 50, bottom, {
                       align: 'center',
                       width: doc.page.width - 100
                   });
            };

            doc.on('pageAdded', () => {
                pageNumber++;
                addWatermark();
                addFooter();
            });

            // First page elements
            addWatermark();
            addFooter();

            // Process content line by line
            const lines = content.split('\n');
            let isFirstPage = true;

            for (const line of lines) {
                const trimmedLine = line.trim();
                if (!trimmedLine) continue;

                try {
                    if (isFirstPage && trimmedLine.startsWith('# ')) {
                        doc.font('Helvetica-Bold')
                           .fontSize(24)
                           .fillColor(palette.primary)
                           .text(trimmedLine.substring(2), { align: 'center' });
                        doc.moveDown();
                    } else if (isFirstPage && trimmedLine.includes('Student Name:')) {
                        doc.fontSize(12)
                           .fillColor(palette.text)
                           .text(trimmedLine, { align: 'center' });
                    } else if (trimmedLine.startsWith('## ')) {
                        if (isFirstPage) {
                            isFirstPage = false;
                        }
                        doc.addPage()
                           .font('Helvetica-Bold')
                           .fontSize(18)
                           .fillColor(palette.primary)
                           .text(trimmedLine.substring(3));
                    } else if (trimmedLine.startsWith('### ')) {
                        doc.font('Helvetica-Bold')
                           .fontSize(14)
                           .fillColor(palette.text)
                           .text(trimmedLine.substring(4));
                    } else if (trimmedLine.startsWith('* ')) {
                        doc.font('Helvetica')
                           .fontSize(11)
                           .fillColor(palette.text)
                           .text(`• ${trimmedLine.substring(2)}`, { indent: 20 });
                    } else {
                        doc.font('Helvetica')
                           .fontSize(11)
                           .fillColor(palette.text)
                           .text(trimmedLine, { align: 'left', lineGap: 4 });
                    }
                } catch (lineError) {
                    console.error('Error processing line:', lineError);
                }
            }

            doc.on('end', () => resolve());
            doc.end();
        } catch (error) {
            console.error('PDF generation error:', error);
            reject(error);
        }
    });
}

// Assignment Route
app.post('/generate-assignment', async (req, res) => {
    try {
        const { prompt } = req.body;
        if (!prompt) {
            return res.status(400).json({ error: "Prompt is required" });
        }

        const context = `
You are a professional academic writer. Your output MUST be in English.

🎯 Your task: Write a complete, clear, well-structured assignment of 9–10 pages (minimum 4000 words) on the following topic: "${prompt}"

📘 Structure:
# [Main Title]
Student Name: [Placeholder]
Subject Name: [Placeholder]
Submission Date: [Placeholder]

## Table of Contents
...

## Introduction
...

## Main Sections (6+)
...

## Conclusion
...

## References
- *Reference 1*
- *Reference 2*
`.trim();

        const result = await generateAIResponse(prompt, context);
        
        if (!result.text || result.text.trim().length < 100) {
            return res.status(500).json({ error: "AI returned insufficient content" });
        }

        if (req.query.download === 'pdf') {
            res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
            try {
                await generatePDF(result.text, res);
            } catch (pdfError) {
                console.error('PDF generation failed:', pdfError);
                return res.status(500).json({ error: "Failed to generate PDF" });
            }
            return;
        }

        res.json(result);
    } catch (error) {
        console.error('Assignment generation error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Health Check
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'healthy',
        services: {
            openrouter: 'active',
            gemini: 'fallback'
        }
    });
});

// Start Server
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`✅ Ready to generate assignments with PDF support`);
});

// Error handling
process.on('unhandledRejection', (err) => {
    console.error('Unhandled rejection:', err);
});

process.on('uncaughtException', (err) => {
    console.error('Uncaught exception:', err);
});