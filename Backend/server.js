require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// AI Endpoints
app.post('/generate-assignment', async (req, res) => {
    try {
        const { prompt } = req.body;
        if (!prompt) {
            return res.status(400).json({ error: 'Prompt is required' });
        }

        const model = genAI.getGenerativeModel({ model: "gemini-pro" });
        const fullPrompt = `Create a comprehensive assignment on the topic: ${prompt}. 
        Include an introduction, main content with 3-5 key points, and a conclusion. 
        Format it with proper headings and paragraphs.`;
        
        const result = await model.generateContent(fullPrompt);
        const response = await result.response;
        const text = response.text();

        res.json({ text });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Failed to generate assignment' });
    }
});

app.post('/generate-short-answer', async (req, res) => {
    try {
        const { prompt } = req.body;
        if (!prompt) {
            return res.status(400).json({ error: 'Prompt is required' });
        }

        const model = genAI.getGenerativeModel({ model: "gemini-pro" });
        const fullPrompt = `Provide a concise answer (2-3 sentences) to the following question: ${prompt}. 
        Be direct and to the point.`;
        
        const result = await model.generateContent(fullPrompt);
        const response = await result.response;
        const text = response.text();

        res.json({ text });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Failed to generate short answer' });
    }
});

app.post('/generate-long-answer', async (req, res) => {
    try {
        const { prompt } = req.body;
        if (!prompt) {
            return res.status(400).json({ error: 'Prompt is required' });
        }

        const model = genAI.getGenerativeModel({ model: "gemini-pro" });
        const fullPrompt = `Provide a detailed explanation (at least 5 paragraphs) about: ${prompt}. 
        Include relevant examples and break down complex concepts. Use markdown formatting with headings and bullet points when appropriate.`;
        
        const result = await model.generateContent(fullPrompt);
        const response = await result.response;
        const text = response.text();

        res.json({ text });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Failed to generate long answer' });
    }
});

// Start server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});