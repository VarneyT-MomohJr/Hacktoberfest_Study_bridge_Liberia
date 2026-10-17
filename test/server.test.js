const { after, before, describe, it } = require("node:test");
const assert = require("node:assert/strict");

process.env.GEMINI_API_KEY = "test-api-key";
const { app, isValidQuiz } = require("../server");

describe("StudyBridge server", () => {
  let server;
  let baseUrl;

  before(async () => {
    server = app.listen(0);
    await new Promise((resolve) => server.once("listening", resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it("serves the app and its browser assets without exposing server files", async () => {
    const home = await fetch(baseUrl);
    assert.equal(home.status, 200);
    assert.match(await home.text(), /StudyBridge Liberia/);

    const script = await fetch(`${baseUrl}/app.js`);
    assert.equal(script.status, 200);
    assert.match(await script.text(), /generateButton/);

    const serverSource = await fetch(`${baseUrl}/server.js`);
    assert.equal(serverSource.status, 404);

    const environmentFile = await fetch(`${baseUrl}/.env`);
    assert.equal(environmentFile.status, 404);
  });

  it("returns a JSON validation error for missing quiz inputs", async () => {
    const response = await fetch(`${baseUrl}/api/quiz`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: "Study notes" })
    });

    assert.equal(response.status, 400);
    assert.equal((await response.json()).error, "Enter your subject and study notes.");
  });

  it("rejects inputs that exceed the supported limits", async () => {
    const response = await fetch(`${baseUrl}/api/quiz`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: "n".repeat(20001), subject: "Biology" })
    });

    assert.equal(response.status, 400);
    assert.match((await response.json()).error, /20,000 characters/);
  });

  it("returns a JSON validation error for malformed request bodies", async () => {
    const response = await fetch(`${baseUrl}/api/quiz`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{"
    });

    assert.equal(response.status, 400);
    assert.equal((await response.json()).error, "Request body must be valid JSON.");
  });
});

describe("quiz response validation", () => {
  const validQuiz = {
    questions: Array.from({ length: 5 }, (_, index) => ({
      question: `Question ${index + 1}`,
      options: ["A", "B", "C", "D"],
      answerIndex: 0,
      explanation: "The notes support this answer."
    }))
  };

  it("accepts exactly five complete multiple-choice questions", () => {
    assert.equal(isValidQuiz(validQuiz), true);
  });

  it("rejects malformed AI responses", () => {
    assert.equal(isValidQuiz({ questions: [] }), false);
    assert.equal(
      isValidQuiz({
        questions: validQuiz.questions.map((question, index) =>
          index === 0 ? { ...question, answerIndex: 4 } : question
        )
      }),
      false
    );
  });
});
