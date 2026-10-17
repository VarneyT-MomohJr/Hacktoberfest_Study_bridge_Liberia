
const notesInput = document.querySelector("#notes");
const subjectInput = document.querySelector("#subject");
const generateButton = document.querySelector("#generate");
const status = document.querySelector("#status");
const quiz = document.querySelector("#quiz");
const questionsContainer = document.querySelector("#questions");
const result = document.querySelector("#result");

let currentQuestions = [];

generateButton.addEventListener("click", async () => {
  const notes = notesInput.value.trim();
  const subject = subjectInput.value.trim();

  if (!notes || !subject) {
    status.textContent = "Enter your subject and paste your notes first.";
    return;
  }

  if (notes.length > 20000 || subject.length > 120) {
    status.textContent =
      "Study notes must be 20,000 characters or fewer and the subject 120 characters or fewer.";
    return;
  }

  status.textContent = "Creating your quiz...";
  generateButton.disabled = true;
  quiz.hidden = true;
  currentQuestions = [];
  questionsContainer.replaceChildren();
  result.textContent = "";

  try {
    const response = await fetch("/api/quiz", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes, subject })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Could not generate the quiz.");
    }

    if (!Array.isArray(data.questions) || data.questions.length !== 5) {
      throw new Error("The quiz response was incomplete. Please try again.");
    }

    currentQuestions = data.questions;
    renderQuiz();
    quiz.hidden = false;
    status.textContent = "Your quiz is ready!";
  } catch (error) {
    status.textContent = error instanceof Error
      ? error.message
      : "Could not generate the quiz. Please try again.";
  } finally {
    generateButton.disabled = false;
  }
});

function renderQuiz() {
  questionsContainer.innerHTML = "";

  currentQuestions.forEach((question, index) => {
    const card = document.createElement("div");
    const title = document.createElement("h3");
    title.textContent = `${index + 1}. ${question.question}`;
    card.appendChild(title);

    question.options.forEach((option, optionIndex) => {
      const label = document.createElement("label");
      label.className = "option";

      const radio = document.createElement("input");
      radio.type = "radio";
      radio.name = `question-${index}`;
      radio.value = optionIndex;

      label.append(radio, document.createTextNode(" " + option));
      card.appendChild(label);
    });

    questionsContainer.appendChild(card);
  });
}

document.querySelector("#check").addEventListener("click", () => {
  let score = 0;
  const unanswered = currentQuestions.some(
    (_, index) =>
      !document.querySelector(`input[name="question-${index}"]:checked`)
  );

  if (unanswered) {
    result.textContent = "Please answer every question before checking your score.";
    return;
  }

  currentQuestions.forEach((question, index) => {
    const selected = document.querySelector(
      `input[name="question-${index}"]:checked`
    );

    if (selected && Number(selected.value) === question.answerIndex) {
      score++;
    }
  });

  result.textContent =
    `You scored ${score} out of ${currentQuestions.length}.`;

  currentQuestions.forEach((question, index) => {
    const explanation = document.createElement("p");
    explanation.textContent =
      `Question ${index + 1}: ${question.explanation}`;
    result.appendChild(explanation);
  });
});
