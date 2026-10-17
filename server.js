
require("dotenv").config();

const express = require("express");
const path = require("node:path");
const { GoogleGenAI } = require("@google/genai");

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const geminiApiKey = process.env.GEMINI_API_KEY?.trim();

if (!geminiApiKey) {
  throw new Error("GEMINI_API_KEY is missing. Add it to the .env file and restart the server.");
}

app.use(express.json({ limit: "100kb" }));

const ai = new GoogleGenAI({
  apiKey: geminiApiKey
});

function isValidQuiz(data) {
  return (
    data !== null &&
    typeof data === "object" &&
    Array.isArray(data.questions) &&
    data.questions.length === 5 &&
    data.questions.every(
      (question) =>
        question !== null &&
        typeof question === "object" &&
        typeof question.question === "string" &&
        question.question.trim().length > 0 &&
        Array.isArray(question.options) &&
        question.options.length === 4 &&
        question.options.every(
          (option) => typeof option === "string" && option.trim().length > 0
        ) &&
        Number.isInteger(question.answerIndex) &&
        question.answerIndex >= 0 &&
        question.answerIndex < question.options.length &&
        typeof question.explanation === "string" &&
        question.explanation.trim().length > 0
    )
  );
}

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/app.js", (req, res) => {
  res.sendFile(path.join(__dirname, "app.js"));
});

app.get("/style.css", (req, res) => {
  res.sendFile(path.join(__dirname, "style.css"));
});

app.post("/api/quiz", async (req, res) => {
  try {
    const { notes, subject } = req.body ?? {};
    if (
      typeof notes !== "string" ||
      typeof subject !== "string" ||
      !notes.trim() ||
      !subject.trim()
    ) {
      return res.status(400).json({
        error: "Enter your subject and study notes."
      });
    }

    if (notes.length > 20000 || subject.length > 120) {
      return res.status(400).json({
        error: "Study notes must be 20,000 characters or fewer and the subject 120 characters or fewer."
      });
    }

    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || "gemma-4-26b-a4b-it",
      contents: `Create exactly 5 multiple-choice questions using ONLY these study notes for the subject ${subject}.

Return valid JSON only in this format:
{
  "questions": [
    {
      "question": "Question",
      "options": ["A", "B", "C", "D"],
      "answerIndex": 0,
      "explanation": "Brief explanation"
    }
  ]
}

Notes:
${notes}`
    });

    if (typeof response.text !== "string") {
      throw new Error("The AI returned an empty response.");
    }

    const cleaned = response.text
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "")
      .trim();
    const quiz = JSON.parse(cleaned);

    if (!isValidQuiz(quiz)) {
      throw new Error("The AI returned a quiz with an invalid structure.");
    }

    res.json(quiz);
  } catch (error) {
    console.error("Quiz error:", error.message);
    res.status(500).json({
      error: "Quiz generation failed. Check the VS Code terminal."
    });
  }
});

app.use((error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  if (error.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Request body must be valid JSON." });
  }

  if (error.type === "entity.too.large") {
    return res.status(413).json({ error: "Request body is too large." });
  }

  console.error("Request error:", error.message);
  return res.status(500).json({ error: "An unexpected server error occurred." });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`StudyBridge is running at http://localhost:${PORT}`);
  });
}

module.exports = { app, isValidQuiz };
