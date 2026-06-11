const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");

let GoogleGenerativeAI;
try {
  GoogleGenerativeAI = require("@google/generative-ai").GoogleGenerativeAI;
} catch (e) {
  console.log("@google/generative-ai package not found. Fallback mode will be used.");
}

const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
let genAI = null;

if (GoogleGenerativeAI && apiKey) {
  try {
    genAI = new GoogleGenerativeAI(apiKey);
    console.log("Gemini AI successfully initialized in StudyBin backend!");
  } catch (error) {
    console.error("Error initializing GoogleGenerativeAI:", error);
  }
} else {
  console.log("StudyBin running AI features in Smart Local Simulation mode (No API Key found).");
}

// 1. POST CHATBOT QUERY
router.post("/chat", auth, async (req, res) => {
  const { message, history } = req.body;
  if (!message) {
    return res.status(400).json({ error: "Message is required" });
  }

  // If Gemini is active
  if (genAI) {
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const prompt = `You are StudyBin's helpful AI Study Assistant. Answer questions about university notes, study topics, and exam preparation in a concise, friendly, and academic tone. Keep responses within 2-3 paragraphs max.\n\nUser Question: ${message}`;
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      return res.json({ reply: text, source: "gemini" });
    } catch (err) {
      console.error("Gemini Chat Error, falling back to local chat:", err.message);
    }
  }

  // Smart Simulation Mode fallback
  const lowercaseMsg = message.toLowerCase();
  let reply = "";

  if (lowercaseMsg.includes("hello") || lowercaseMsg.includes("hi")) {
    reply = "Hello! I'm your StudyBin AI Assistant. How can I help you with your college studies or note summaries today?";
  } else if (lowercaseMsg.includes("dbms") || lowercaseMsg.includes("database")) {
    reply = "Database Management Systems (DBMS) are crucial! When preparing for DBMS exams, make sure to review Entity-Relationship (ER) diagrams, SQL Joins, Indexing, and ACID properties. Would you like me to summarize any of your DBMS notes?";
  } else if (lowercaseMsg.includes("exam") || lowercaseMsg.includes("prepare")) {
    reply = "To prepare for exams, I recommend active recall and spaced repetition. Upload your syllabus notes to StudyBin, and I can generate short summaries and key tags to help you review faster!";
  } else if (lowercaseMsg.includes("delete") || lowercaseMsg.includes("remove")) {
    reply = "On StudyBin, files uploaded by students can only be deleted by the College Administrator or Platform Admin to ensure security and prevent data loss.";
  } else if (lowercaseMsg.includes("download") || lowercaseMsg.includes("pdf")) {
    reply = "Downloading materials is simple! Just click the '📄 Download PDF' badge on any note card. If no file is attached, the card will display the subject and description text.";
  } else {
    reply = `Interesting query about "${message}"! As your StudyBin AI Assistant, I suggest checking if other students from your college have uploaded notes about this. You can search for subjects in the search bar above or upload a PDF to study together!`;
  }

  res.json({ reply, source: "simulation" });
});

// 2. POST SUMMARIZE NOTE (Used during note upload / preview)
router.post("/summarize", auth, async (req, res) => {
  const { title, subject, description } = req.body;
  if (!title) {
    return res.status(400).json({ error: "Title is required" });
  }

  // If Gemini is active
  if (genAI) {
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const prompt = `Analyze this college note material.
      Title: "${title}"
      Subject: "${subject || "General"}"
      Description: "${description || "None"}"
      
      Generate a concise summary (max 3 sentences) and 3 to 4 relevant tags.
      Format your response exactly as a JSON object:
      {
        "summary": "your generated summary here",
        "tags": ["tag1", "tag2", "tag3"]
      }
      Do not include markdown headers like \`\`\`json. Return only the raw JSON.`;

      const result = await model.generateContent(prompt);
      const text = result.response.text().trim();
      
      // Clean up text if LLM returns markdown wrappers
      const cleanJson = text.replace(/^```json/, "").replace(/```$/, "").trim();
      const aiData = JSON.parse(cleanJson);
      return res.json({
        summary: aiData.summary,
        tags: aiData.tags,
        source: "gemini"
      });
    } catch (err) {
      console.error("Gemini Summarizer Error, falling back to local summarizer:", err.message);
    }
  }

  // Simulation mode
  const summary = `Study resource focusing on "${title}" for ${subject || "General study"}. Key concepts explained include details about ${description || "this subject matter"}. Good for quick reference.`;
  
  const tags = [];
  if (subject) tags.push(subject.toUpperCase());
  tags.push("STUDY");
  tags.push(title.toUpperCase().split(" ")[0]);
  if (tags.length < 3) tags.push("NOTES");

  res.json({
    summary,
    tags: tags.slice(0, 4),
    source: "simulation"
  });
});

module.exports = router;
