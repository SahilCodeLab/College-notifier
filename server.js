// server.js

// ====================================================================
// SETUP INSTRUCTIONS (Kaise Setup Karein)
// ====================================================================
// 1. Node.js Install Karein: Agar aapke computer mein Node.js nahi hai, to nodejs.org se install karein.
//
// 2. Naya Folder Banayein: Ek naya folder banayein (e.g., "my-website-backend") aur uske andar is file ko 'server.js' naam se save karein.
//
// 3. Terminal Open Karein: Ussi folder mein terminal ya command prompt open karein.
//
// 4. Packages Install Karein: Terminal mein yeh commands ek-ek karke chalayein:
//    npm install express cors dotenv @google/generative-ai
//
// 5. .env File Banayein: Ussi folder mein '.env' naam ki ek nayi file banayein.
//
// 6. API Key Add Karein: .env file ke andar, apni Gemini API key aise likhein:
//    GEMINI_API_KEY=Aapki_API_Key_Yahan_Daalein
//
// 7. Server Start Karein: Terminal mein yeh command chalayein:
//    node server.js
//
// Ab aapka backend server http://localhost:3000 par chal raha hai!
// ====================================================================


// Step 1: Dependencies Import Karein
const express = require('express');
const cors = require('cors');
require('dotenv').config(); // .env file se variables load karne ke liye
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Step 2: Express App Initialize Karein
const app = express();
const port = 3000; // Aap koi bhi port use kar sakte hain

app.use(cors()); // Cross-Origin Resource Sharing enable karein
app.use(express.json()); // JSON requests ko samajhne ke liye

// Step 3: Google Generative AI Initialize Karein
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
    throw new Error("GEMINI_API_KEY .env file mein nahi hai. Please add karein.");
}
const genAI = new GoogleGenerativeAI(apiKey);

// Helper function to call Gemini API (Yeh function API call ko aasan banata hai)
async function callGemini(prompt, modelName = "gemini-1.5-flash-latest") { // Using gemini-1.5-flash-latest
    try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text();
    } catch (error) {
        console.error(`Error calling Gemini API for model ${modelName}:`, error);
        throw new Error('AI model se response nahi mil paya.');
    }
}

// ====================================================================
// API ENDPOINTS (Yahan se aapka frontend connect hoga)
// ====================================================================

// Endpoint 1: Assignment Helper
app.post('/generate-assignment', async (req, res) => {
    try {
        const { prompt: topic } = req.body;
        if (!topic) return res.status(400).json({ error: 'Topic zaroori hai.' });

        const detailedPrompt = `
            Write a detailed, well-structured academic assignment on the following topic: "${topic}".
            The assignment should be suitable for a college student.
            It must include the following sections:
            1.  **Introduction:** Briefly introduce the topic and state the main points.
            2.  **Body Paragraphs:** Several paragraphs, each discussing a specific aspect of the topic with supporting details and examples.
            3.  **Conclusion:** Summarize the main points and provide a concluding thought.
            The tone should be formal and academic.
        `;
        const text = await callGemini(detailedPrompt);
        res.json({ text });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Endpoint 2: Short Answer Generator
app.post('/generate-short-answer', async (req, res) => {
    try {
        const { prompt: question } = req.body;
        if (!question) return res.status(400).json({ error: 'Question zaroori hai.' });

        const detailedPrompt = `
            Provide a short, concise, and direct answer to the following question.
            The answer should be no more than 2-3 sentences.
            Question: "${question}"
        `;
        const text = await callGemini(detailedPrompt);
        res.json({ text });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Endpoint 3: Long Answer Generator
app.post('/generate-long-answer', async (req, res) => {
    try {
        const { prompt: question } = req.body;
        if (!question) return res.status(400).json({ error: 'Question zaroori hai.' });

        const detailedPrompt = `
            Provide a detailed, comprehensive, and well-explained long answer to the following question.
            The answer should be structured in multiple paragraphs, easy to understand for a student.
            Use examples where necessary to clarify the points.
            Question: "${question}"
        `;
        const text = await callGemini(detailedPrompt);
        res.json({ text });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Step 4: Server Start Karein
app.listen(port, () => {
    console.log(`Backend server http://localhost:${port} par chal raha hai`);
    console.log("Sunishchit karein ki aapki .env file mein GEMINI_API_KEY hai.");
});

         
