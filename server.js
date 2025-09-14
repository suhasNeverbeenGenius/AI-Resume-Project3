// 1. IMPORT NECESSARY PACKAGES
// =================================================
// Express: The framework for building our web server and API routes.
const express = require('express');
// CORS: Middleware to allow our frontend (on a different URL) to communicate with this backend.
const cors = require('cors');
// Multer: Middleware specifically for handling file uploads (like our resume PDF).
const multer = require('multer');
// pdf-parse: A library to read the text content from a PDF file buffer.
const pdf = require('pdf-parse');
// dotenv: Allows us to use environment variables from a .env file to keep secrets like API keys safe.
require('dotenv').config();

// Import the Google AI SDK
const { GoogleGenerativeAI } = require('@google/generative-ai');


// 2. INITIAL SETUP & CONFIGURATION
// =================================================
// Create an instance of our Express application.
const app = express();
// Define the port the server will run on. Use the environment variable or default to 5001.
const PORT = process.env.PORT || 5001;

// Configure the Google AI SDK with your API key from the .env file.
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// Configure Multer for file uploads. We'll use 'memoryStorage' to handle the file
// in memory as a buffer, rather than saving it to the disk.
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });


// 3. MIDDLEWARE
// =================================================
// Use the CORS middleware to enable cross-origin requests.
app.use(cors());
// Use Express's built-in JSON middleware to automatically parse incoming JSON request bodies.
app.use(express.json());


// 4. API ROUTES
// =================================================

// --- API Route 1: Generate Professional Summary ---
app.post('/api/generate-summary', async (req, res) => {
    try {
        const { experience, skills } = req.body;
        const prompt = `
            Based on the following work experience and skills, generate a compelling and professional resume summary.
            The summary should be a single paragraph, 3-4 sentences long.
            Highlight the key qualifications and align them with a professional tone.

            Work Experience: ${JSON.stringify(experience)}
            Skills: ${skills}
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const summaryText = response.text();
        res.json({ summary: summaryText });

    } catch (error) {
        console.error("Error generating summary:", error);
        res.status(500).send("An error occurred while generating the summary.");
    }
});

// --- NEW API Route 2: Generate Experience Description ---
app.post('/api/generate-experience', async (req, res) => {
    try {
        const { role, company } = req.body;
        const prompt = `Generate 3 concise, action-oriented bullet points for a resume describing the role of "${role}" at "${company}". Start each bullet point on a new line and begin with '• '. Do not use any other formatting.`;
        
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const descriptionText = response.text();
        res.json({ description: descriptionText });

    } catch (error) {
        console.error("Error generating experience description:", error);
        res.status(500).send("An error occurred while generating the experience description.");
    }
});

// --- NEW API Route 3: Generate Project Description ---
app.post('/api/generate-project', async (req, res) => {
    try {
        const { name } = req.body;
        const prompt = `Generate 2-3 concise, results-oriented bullet points for a resume project named "${name}". Start each bullet point on a new line and begin with '• '. Do not use any other formatting.`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const descriptionText = response.text();
        res.json({ description: descriptionText });

    } catch (error) {
        console.error("Error generating project description:", error);
        res.status(500).send("An error occurred while generating the project description.");
    }
});


// --- API Route 4: Calculate ATS Score ---
app.post('/api/calculate-ats', upload.single('resume'), async (req, res) => {
    try {
        if (!req.file || !req.body.jobDescription) {
            return res.status(400).send("Resume file and job description are required.");
        }

        const resumeBuffer = req.file.buffer;
        const resumeData = await pdf(resumeBuffer);
        const resumeText = resumeData.text;
        const jobDescription = req.body.jobDescription;

        const keywordsPrompt = `
            From the following job description, extract the top 15 most important technical skills,
            soft skills, and qualifications. Return them as a simple comma-separated list.
            Do not add any extra explanation or formatting.

            Job Description: "${jobDescription}"
        `;

        const result = await model.generateContent(keywordsPrompt);
        const response = await result.response;
        const keywordsText = response.text();
        const keywords = keywordsText.split(',').map(kw => kw.trim().toLowerCase());

        let matchCount = 0;
        const resumeTextLower = resumeText.toLowerCase();

        keywords.forEach(keyword => {
            if (resumeTextLower.includes(keyword)) {
                matchCount++;
            }
        });

        const score = Math.round((matchCount / keywords.length) * 100);
        res.json({ score: score });

    } catch (error) {
        console.error("Error calculating ATS score:", error);
        res.status(500).send("An error occurred while calculating the ATS score.");
    }
});


// 5. START THE SERVER
// =================================================
app.listen(PORT, () => {
    console.log(`Backend server is running successfully on http://localhost:${PORT}`);
});

