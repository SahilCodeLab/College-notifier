require('dotenv').config();
const express = require('express');
const cors = require('cors');
const PDFDocument = require('pdfkit');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Simple storage for generated content
const assignments = {};

// Generate Assignment Endpoint
app.post('/generate-assignment', (req, res) => {
  try {
    const { prompt, content } = req.body;
    if (!prompt) return res.status(400).json({ error: "Prompt is required" });

    // Store the generated content with a unique ID
    const assignmentId = Date.now().toString();
    assignments[assignmentId] = content || `Generated assignment for: ${prompt}`;
    
    res.json({ 
      success: true,
      assignmentId,
      content: assignments[assignmentId]
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PDF Download Endpoint (100% reliable)
app.get('/download-pdf/:assignmentId', (req, res) => {
  try {
    const { assignmentId } = req.params;
    const content = assignments[assignmentId];
    
    if (!content) {
      return res.status(404).json({ error: "Content not found" });
    }

    // Create PDF
    const doc = new PDFDocument();
    
    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=assignment.pdf');
    
    // Add watermark
    doc.opacity(0.1)
       .fontSize(72)
       .text('AcademicAI', 50, 300, { rotate: 30 })
       .opacity(1.0);
    
    // Add content
    doc.font('Helvetica')
       .fontSize(12)
       .text(content.toString(), {
         align: 'left',
         indent: 30,
         lineGap: 5
       });
    
    // Pipe to response
    doc.pipe(res);
    doc.end();

  } catch (error) {
    console.error("PDF Error:", error);
    res.status(500).json({ 
      error: "PDF generation failed",
      solution: "Please try again or contact support"
    });
  }
});

// Health Check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'running',
    pdfService: 'active',
    timestamp: new Date().toISOString()
  });
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`PDF endpoint: http://localhost:${PORT}/download-pdf/:assignmentId`);
});