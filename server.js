
const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: "20kb" }));

let geminiClientPromise;

function getGeminiClient() {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is missing in backend/.env");
  }

  if (!geminiClientPromise) {
    geminiClientPromise = import("@google/genai").then(
      ({ GoogleGenAI }) =>
        new GoogleGenAI({
          apiKey: process.env.GEMINI_API_KEY,
        })
    );
  }

  return geminiClientPromise;
}

// Only accept moods supported by the WellMind mood tracker.
const ALLOWED_MOODS = [
  "Happy",
  "Calm",
  "Okay",
  "Sad",
  "Anxious",
  "Not specified",
];

function cleanText(value, maxLength = 150) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function cleanMood(value) {
  const mood = cleanText(value, 30);
  return ALLOWED_MOODS.includes(mood) ? mood : "Not specified";
}

function cleanMoodHistory(history) {
  if (!Array.isArray(history)) return [];

  return history
    .slice(-5)
    .map((entry) => ({
      mood: cleanMood(entry?.mood),
      date: cleanText(entry?.date, 40),
    }))
    .filter((entry) => entry.mood !== "Not specified");
}

app.get("/", (req, res) => {
  res.json({ message: "WellMind backend is running!" });
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    app: "WellMind",
    aiConfigured: Boolean(process.env.GEMINI_API_KEY),
  });
});

app.post("/api/chat", async (req, res) => {
  try {
    const {
      message,
      mood,
      moodHistory,
      communicationStyle,
      wellnessGoal,
    } = req.body;

    if (typeof message !== "string" || !message.trim()) {
      return res.status(400).json({
        error: "Please enter a message.",
      });
    }

    if (message.length > 4000) {
      return res.status(400).json({
        error: "Message is too long. Keep it under 4000 characters.",
      });
    }

    // Read the user's current mood and recent mood check-ins.
    const currentMood = cleanMood(mood);
    const recentMoodHistory = cleanMoodHistory(moodHistory);

    const preferredCommunicationStyle = cleanText(
      communicationStyle,
      120
    );

    const user'sWellnessGoal = cleanText(wellnessGoal, 120)';

    // Give Gemini the emotional context for this conversation.
    const moodContext = `
      USER'S EMOTIONAL CONTEXT:

      Current mood selected at the start of this conversation:
      ${currentMood}

      Recent mood tracking history:
      ${
        recentMoodHistory.length > 0
          ? JSON.stringify(recentMoodHistory, null, 2)
          : "No recent mood history available."
      }

      Preferred communication style:
      ${preferredCommunicationStyle || "Friendly and supportive"}

      User's wellness goal:
      ${user'sWellnessGoal || "General emotional wellness"}
    `;

    const ai = await getGeminiClient();

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",

      contents: `
        ${moodContext}

        USER'S MESSAGE:
        ${message.trim()}
      ,

      config: {
        systemInstruction: `
          You are WellMind, a supportive emotional wellness assistant.

          YOUR MAIN RESPONSIBILITY:
          Respond to the user's message while considering their
          selected mood, recent mood tracking history, and
          communication preferences.

          MOOD-AWARE RESPONSE RULES:

          1. If the current mood is Happy:
             Be positive, encouraging and engaging.
             Help the user maintain their positive state.

          2. If the current mood is Calm:
             Maintain a peaceful, thoughtful and relaxed tone.
             Encourage reflection and mindfulness when relevant.

          3. If the current mood is Okay:
             Use a friendly, balanced and natural tone.
             Do not assume the user is experiencing a problem.

          4. If the current mood is Sad:
             Be gentle, patient and empathetic.
             Acknowledge the user's feelings.
             Do not force positivity or say things like
             "just be happy".
             Offer small, manageable steps when appropriate.

          5. If the current mood is Anxious:
             Use reassuring and simple language.
             Avoid overwhelming the user with too much information.
             Suggest practical grounding or breathing exercises
             when relevant.

          6. If the mood is Not specified:
             Do not assume the user's emotional state.
             Respond naturally and ask how they are feeling
             only when it is relevant.

          MOOD HISTORY:
          - Use recent mood history to understand possible patterns.
          - Consider it supporting context, not a diagnosis.
          - Never assume that previous moods describe the user's
            current emotional state.
          - The user's current message and expressed feelings
            are more important than older mood records.
          - If the user says they feel differently now, respect
            what they are saying.

          CONVERSATION STYLE:
          - Be empathetic, calm, respectful and non-judgmental.
          - Follow the user's preferred communication style.
          - Keep responses natural, clear and conversational.
          - Avoid unnecessary long explanations.
          - Ask thoughtful follow-up questions when useful.
          - Do not repeatedly mention the user's selected mood
            in every response.
          - Never make the user feel judged or monitored.

          WELLNESS AND SAFETY:
          - Help users reflect on feelings and suggest simple,
            safe relaxation and grounding exercises.
          - Do not diagnose mental health conditions.
          - Do not claim to replace a qualified professional.
          - Never pretend to know a user's emotions with certainty.
          - If someone may be in immediate danger, encourage them
            to contact local emergency services and a trusted person.
          - In India, Tele-MANAS is available at 14416.

          LANGUAGE:
          Reply naturally in the language the user uses.
          If the user writes in Hinglish, reply in Hinglish.
          If the user writes in English, reply in English.

          Your goal is to make every conversation feel emotionally
          aware, personal, supportive and safe.
        ,
      },
    });

    const reply = response.text;

    if (!reply) {
      return res.status(502).json({
        error: "The AI returned an empty response. Please try again.",
      });
    }

    res.json({ reply });
  } catch (error) {
    console.error("Gemini request failed:", error.message);

    res.status(500).json({
      error: "Gemini could not respond. Check your API key, model access, and server terminal.",
    });
  }
});

app.listen(PORT, () => {
  console.log(`WellMind backend running on http://localhost:${PORT}`);
});
