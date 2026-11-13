
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const { pool, testConnection } = require("./config/db");
const authenticateToken = require("./middleware/auth");

const app = express();
const PORT = process.env.PORT || 5000;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";

app.use(cors());
app.use(express.json({ limit: "20kb" }));

// --------------------------------------------------
// GEMINI CLIENT
// --------------------------------------------------

let geminiClientPromise;

function getGeminiClient() {
    if (!process.env.GEMINI_API_KEY) {
        throw new Error("GEMINI_API_KEY is missing.");
    }

    if (!geminiClientPromise) {
        geminiClientPromise = import("@google/genai").then(
            ({ GoogleGenAI }) =>
                new GoogleGenAI({
                    apiKey: process.env.GEMINI_API_KEY
                })
        );
    }

    return geminiClientPromise;
}

// --------------------------------------------------
// HELPERS
// --------------------------------------------------

const ALLOWED_MOODS = [
    "Happy",
    "Calm",
    "Okay",
    "Sad",
    "Anxious",
    "Not specified"
];

const ALLOWED_STYLES = [
    "friendly",
    "supportive",
    "direct",
    "calm"
];

function cleanText(value, maxLength = 150) {
    if (typeof value !== "string") return "";
    return value.trim().slice(0, maxLength);
}

function cleanMood(value) {
    const mood = cleanText(value, 30);
    return ALLOWED_MOODS.includes(mood)
        ? mood
        : "Not specified";
}

function createToken(user) {
    if (!process.env.JWT_SECRET ||
        process.env.JWT_SECRET.length < 32) {
        throw new Error("JWT_SECRET must be at least 32 characters.");
    }

    return jwt.sign(
        {
            id: user.id,
            email: user.email
        },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
    );
}

function handleGeminiError(error, res) {
    console.error("Gemini API Error:", {
        name: error.name,
        message: error.message,
        status: error.status
    });

    const status = Number(error.status);

    if (status === 503 || status === 502) {
        return res.status(503).json({
            error: "WellMind AI is temporarily busy. Please try again shortly.",
            code: "AI_UNAVAILABLE"
        });
    }

    if (status === 429) {
        return res.status(429).json({
            error: "AI request limit reached. Please try again later.",
            code: "AI_RATE_LIMIT"
        });
    }

    if (status === 401 || status === 403) {
        return res.status(502).json({
            error: "AI service configuration or permission issue.",
            code: "AI_CONFIGURATION"
        });
    }

    return res.status(502).json({
        error: "Unable to generate a response right now.",
        code: "AI_ERROR"
    });
}

// --------------------------------------------------
// BASIC ROUTES
// --------------------------------------------------

app.get("/", (req, res) => {
    res.json({
        message: "WellMind backend is running!"
    });
});

app.get("/api/health", (req, res) => {
    res.json({
        status: "OK",
        app: "WellMind",
        aiConfigured: Boolean(process.env.GEMINI_API_KEY),
        database: "Configured"
    });
});

// --------------------------------------------------
// SIGNUP
// POST /api/auth/signup
// --------------------------------------------------

app.post("/api/auth/signup", async (req, res) => {
    let connection;

    try {
        const name = cleanText(req.body.name, 100);
        const email = cleanText(req.body.email, 150).toLowerCase();
        const password = req.body.password;

        if (!name || !email || !password) {
            return res.status(400).json({
                error: "Name, email and password are required."
            });
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({
                error: "Please enter a valid email address."
            });
        }

        if (typeof password !== "string" ||
            password.length < 8 ||
            password.length > 72) {
            return res.status(400).json({
                error: "Password must contain 8 to 72 characters."
            });
        }

        const [existing] = await pool.execute(
            "SELECT id FROM users WHERE email = ?",
            [email]
        );

        if (existing.length > 0) {
            return res.status(409).json({
                error: "An account with this email already exists."
            });
        }

        const hashedPassword = await bcrypt.hash(password, 12);

        connection = await pool.getConnection();
        await connection.beginTransaction();

        const [result] = await connection.execute(
            "INSERT INTO users (name, email, password) VALUES (?, ?, ?)",
            [name, email, hashedPassword]
        );

        const userId = result.insertId;

        await connection.execute(
            `INSERT INTO user_preferences
            (user_id, communication_style, wellness_goal, preferred_language)
            VALUES (?, ?, ?, ?)`,
            [userId, "friendly", "General emotional wellness", "English"]
        );

        await connection.commit();

        const user = {
            id: userId,
            name,
            email
        };

        const token = createToken(user);

        return res.status(201).json({
            message: "Account created successfully!",
            token,
            user
        });

    } catch (error) {
        if (connection) await connection.rollback();

        console.error("Signup error:", error.message);

        return res.status(500).json({
            error: "Unable to create your account."
        });

    } finally {
        if (connection) connection.release();
    }
});

// --------------------------------------------------
// LOGIN
// POST /api/auth/login
// --------------------------------------------------

app.post("/api/auth/login", async (req, res) => {
    try {
        const email = cleanText(req.body.email, 150).toLowerCase();
        const password = req.body.password;

        if (!email || typeof password !== "string" || !password) {
            return res.status(400).json({
                error: "Email and password are required."
            });
        }

        const [rows] = await pool.execute(
            `SELECT id, name, email, password
             FROM users WHERE email = ?`,
            [email]
        );

        if (rows.length === 0) {
            return res.status(401).json({
                error: "Invalid email or password."
            });
        }

        const user = rows[0];

        const passwordMatches = await bcrypt.compare(
            password,
            user.password
        );

        if (!passwordMatches) {
            return res.status(401).json({
                error: "Invalid email or password."
            });
        }

        const token = createToken(user);

        return res.json({
            message: "Login successful!",
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email
            }
        });

    } catch (error) {
        console.error("Login error:", error.message);

        return res.status(500).json({
            error: "Unable to login right now."
        });
    }
});

// --------------------------------------------------
// USER PROFILE
// GET /api/profile
// --------------------------------------------------

app.get("/api/profile", authenticateToken, async (req, res) => {
    try {
        const [rows] = await pool.execute(
            `SELECT
                u.id, u.name, u.email, u.created_at,
                p.communication_style,
                p.wellness_goal,
                p.preferred_language
             FROM users u
             LEFT JOIN user_preferences p ON u.id = p.user_id
             WHERE u.id = ?`,
            [req.user.id]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                error: "User not found."
            });
        }

        return res.json({ user: rows[0] });

    } catch (error) {
        console.error("Profile error:", error.message);
        return res.status(500).json({
            error: "Unable to load profile."
        });
    }
});

// --------------------------------------------------
// UPDATE PERSONALIZATION
// PUT /api/preferences
// --------------------------------------------------

app.put("/api/preferences", authenticateToken, async (req, res) => {
    try {
        const style = cleanText(req.body.communicationStyle, 50);
        const goal = cleanText(req.body.wellnessGoal, 150);
        const language = cleanText(req.body.preferredLanguage, 30);

        if (style && !ALLOWED_STYLES.includes(style)) {
            return res.status(400).json({
                error: "Invalid communication style."
            });
        }

        await pool.execute(
            `INSERT INTO user_preferences
            (user_id, communication_style, wellness_goal, preferred_language)
            VALUES (?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
            communication_style = VALUES(communication_style),
            wellness_goal = VALUES(wellness_goal),
            preferred_language = VALUES(preferred_language)`,
            [
                req.user.id,
                style || "friendly",
                goal || "General emotional wellness",
                language || "English"
            ]
        );

        return res.json({
            message: "Personalization settings updated."
        });

    } catch (error) {
        console.error("Preferences error:", error.message);
        return res.status(500).json({
            error: "Unable to update preferences."
        });
    }
});

// --------------------------------------------------
// SAVE MOOD
// POST /api/moods
// --------------------------------------------------

app.post("/api/moods", authenticateToken, async (req, res) => {
    try {
        const mood = cleanMood(req.body.mood);
        const note = cleanText(req.body.note, 1000);

        if (mood === "Not specified") {
            return res.status(400).json({
                error: "Please select a valid mood."
            });
        }

        const [result] = await pool.execute(
            `INSERT INTO mood_history (user_id, mood, note)
             VALUES (?, ?, ?)`,
            [req.user.id, mood, note || null]
        );

        return res.status(201).json({
            message: "Mood saved successfully.",
            moodId: result.insertId
        });

    } catch (error) {
        console.error("Mood save error:", error.message);
        return res.status(500).json({
            error: "Unable to save mood."
        });
    }
});

// --------------------------------------------------
// GET MOOD HISTORY
// GET /api/moods
// --------------------------------------------------

app.get("/api/moods", authenticateToken, async (req, res) => {
    try {
        const [rows] = await pool.execute(
            `SELECT id, mood, note, recorded_at
             FROM mood_history
             WHERE user_id = ?
             ORDER BY recorded_at DESC
             LIMIT 30`,
            [req.user.id]
        );

        return res.json({ moods: rows });

    } catch (error) {
        console.error("Mood history error:", error.message);
        return res.status(500).json({
            error: "Unable to load mood history."
        });
    }
});

// --------------------------------------------------
// GET CONVERSATIONS
// GET /api/conversations
// --------------------------------------------------

app.get("/api/conversations", authenticateToken, async (req, res) => {
    try {
        const [rows] = await pool.execute(
            `SELECT id, title, created_at, updated_at
             FROM conversations
             WHERE user_id = ?
             ORDER BY updated_at DESC`,
            [req.user.id]
        );

        return res.json({ conversations: rows });

    } catch (error) {
        console.error("Conversations error:", error.message);
        return res.status(500).json({
            error: "Unable to load conversations."
        });
    }
});

// --------------------------------------------------
// GET MESSAGES FOR A CONVERSATION
// GET /api/conversations/:id/messages
// --------------------------------------------------

app.get(
    "/api/conversations/:id/messages",
    authenticateToken,
    async (req, res) => {
        try {
            const conversationId = Number(req.params.id);

            if (!Number.isSafeInteger(conversationId) ||
                conversationId < 1) {
                return res.status(400).json({
                    error: "Invalid conversation ID."
                });
            }

            const [rows] = await pool.execute(
                `SELECT m.id, m.role, m.message, m.created_at
                 FROM messages m
                 INNER JOIN conversations c
                 ON m.conversation_id = c.id
                 WHERE c.id = ? AND c.user_id = ?
                 ORDER BY m.id ASC`,
                [conversationId, req.user.id]
            );

            return res.json({ messages: rows });

        } catch (error) {
            console.error("Message history error:", error.message);
            return res.status(500).json({
                error: "Unable to load chat history."
            });
        }
    }
);

// --------------------------------------------------
// PERSONALIZED AI CHAT
// POST /api/chat
// --------------------------------------------------

app.post("/api/chat", authenticateToken, async (req, res) => {
    try {
        const message = cleanText(req.body.message, 4000);

        if (!message) {
            return res.status(400).json({
                error: "Please enter a message."
            });
        }

        const conversationId = req.body.conversationId
            ? Number(req.body.conversationId)
            : null;

        if (conversationId !== null &&
            (!Number.isSafeInteger(conversationId) ||
             conversationId < 1)) {
            return res.status(400).json({
                error: "Invalid conversation ID."
            });
        }

        // Load this user's profile and preferences.
        const [profileRows] = await pool.execute(
            `SELECT
                u.name,
                p.communication_style,
                p.wellness_goal,
                p.preferred_language
             FROM users u
             LEFT JOIN user_preferences p ON u.id = p.user_id
             WHERE u.id = ?`,
            [req.user.id]
        );

        if (profileRows.length === 0) {
            return res.status(404).json({
                error: "User profile not found."
            });
        }

        const profile = profileRows[0];

        // Load recent mood history belonging to this user.
        const [moodRows] = await pool.execute(
            `SELECT mood, recorded_at
             FROM mood_history
             WHERE user_id = ?
             ORDER BY recorded_at DESC
             LIMIT 5`,
            [req.user.id]
        );

        const currentMood = ALLOWED_MOODS.includes(req.body.mood)
            ? req.body.mood
            : (moodRows[0]?.mood || "Not specified");

        // Check conversation ownership and load context.
        let previousMessages = [];

        if (conversationId !== null) {
            const [conversationRows] = await pool.execute(
                `SELECT id FROM conversations
                 WHERE id = ? AND user_id = ?`,
                [conversationId, req.user.id]
            );

            if (conversationRows.length === 0) {
                return res.status(404).json({
                    error: "Conversation not found."
                });
            }

            const [historyRows] = await pool.execute(
                `SELECT role, message
                 FROM messages
                 WHERE conversation_id = ?
                 ORDER BY id DESC
                 LIMIT 12`,
                [conversationId]
            );

            previousMessages = historyRows.reverse();
        }

        const historyContext = previousMessages.map(item => {
            const speaker = item.role === "user"
                ? "USER"
                : "WELLMIND";

            return `${speaker}: ${item.message}`;
        }).join("\n\n");

        const moodContext = moodRows.length
            ? moodRows.map(item => ({
                mood: item.mood,
                date: item.recorded_at
            }))
            : [];

        const systemInstruction = `
You are WellMind, a supportive emotional wellness assistant.

USER PROFILE:
Name: ${profile.name}
Current mood: ${currentMood}
Recent mood history: ${JSON.stringify(moodContext)}
Communication style: ${profile.communication_style || "friendly"}
Wellness goal: ${profile.wellness_goal || "General emotional wellness"}
Preferred language: ${profile.preferred_language || "English"}

PERSONALIZATION:
- Address the user naturally by their name when appropriate.
- Consider their mood and wellness goals.
- Use previous conversation context when relevant.
- Never assume previous moods describe the current mood.
- Follow the user's language and communication preferences.
- Be empathetic, conversational and non-judgmental.
- Ask thoughtful follow-up questions when useful.
- Avoid generic or repetitive responses.

SAFETY:
- Do not diagnose mental health conditions.
- Do not claim to replace a qualified professional.
- Do not encourage harmful actions.
- If the user may be in immediate danger, encourage
  contacting emergency services and a trusted person.
- In India, Tele-MANAS is available at 14416.

Your purpose is to support emotional wellness, reflection
and resilience. You are not a medical professional.
`;

        const prompt = `
PREVIOUS CONVERSATION:
${historyContext || "This is the beginning of the conversation."}

CURRENT USER MESSAGE:
${message}
`;

        const ai = await getGeminiClient();

        const startTime = Date.now();

        const response = await ai.models.generateContent({
            model: GEMINI_MODEL,
            contents: prompt,
            config: {
                maxOutputTokens: 500,
                systemInstruction
            }
        });

        console.log(
            "Gemini response time:",
            Date.now() - startTime,
            "ms"
        );

        const reply = response.text?.trim();

        if (!reply) {
            return res.status(502).json({
                error: "The AI returned an empty response."
            });
        }

        // Save conversation and both messages.
        let activeConversationId = conversationId;

        const connection = await pool.getConnection();

        try {
            await connection.beginTransaction();

            if (!activeConversationId) {
                const title = message.slice(0, 70);

                const [conversationResult] = await connection.execute(
                    `INSERT INTO conversations (user_id, title)
                     VALUES (?, ?)`,
                    [req.user.id, title]
                );

                activeConversationId = conversationResult.insertId;
            }

            await connection.execute(
                `INSERT INTO messages
                 (conversation_id, role, message)
                 VALUES (?, 'user', ?)`,
                [activeConversationId, message]
            );

            await connection.execute(
                `INSERT INTO messages
                 (conversation_id, role, message)
                 VALUES (?, 'assistant', ?)`,
                [activeConversationId, reply]
            );

            await connection.commit();

        } catch (databaseError) {
            await connection.rollback();
            throw databaseError;

        } finally {
            connection.release();
        }

        return res.json({
            reply,
            conversationId: activeConversationId
        });

    } catch (error) {
        if (error.status) {
            return handleGeminiError(error, res);
        }

        console.error("Chat error:", error);

        return res.status(500).json({
            error: "Unable to process your message right now."
        });
    }
});

// --------------------------------------------------
// START SERVER
// --------------------------------------------------

async function startServer() {
    if (!process.env.JWT_SECRET ||
        process.env.JWT_SECRET.length < 32) {
        throw new Error(
            "Please configure a JWT_SECRET of at least 32 characters in backend/.env"
        );
    }

    await testConnection();

    app.listen(PORT, () => {
        console.log(`WellMind backend running on http://localhost:${PORT}`);
    });
}

startServer().catch(error => {
    console.error("Backend startup failed:", error.message);
    process.exit(1);
});
