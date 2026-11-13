import React, { useEffect, useState } from "react";
import smallLogo from "./favicon.ico";
import largeLogo from "./logo.png";
import {
  Leaf, Plus, Menu, X, Send, CloudSun, Heart, Wind,
  Sprout, Gamepad2, MessageCircle, Settings, ArrowLeft,
  Flower2, UserRound, Pencil, Save, ShieldCheck, Bell,
  LockKeyhole, HeartHandshake, LogOut,
} from "lucide-react";
import "./App.css";

const API_BASE = "http://localhost:5000";

const moodOptions = [
  { name: "Happy", emoji: "☀️" },
  { name: "Calm", emoji: "🍃" },
  { name: "Okay", emoji: "🌤️" },
  { name: "Sad", emoji: "🌧️" },
  { name: "Anxious", emoji: "🌊" },
];

const suggestions = [
  {
    title: "I'm feeling stressed",
    text: "I'm feeling stressed and want to talk about it.",
    icon: <CloudSun size={18} />,
  },
  {
    title: "Understand my mood",
    text: "Help me reflect on how I am feeling today.",
    icon: <Heart size={18} />,
  },
  {
    title: "Help me relax",
    text: "Guide me through a short calming exercise.",
    icon: <Wind size={18} />,
  },
  {
    title: "Build resilience",
    text: "Help me build healthier emotional habits.",
    icon: <Sprout size={18} />,
  },
];

function createBubbleSet() {
  return Array.from({ length: 18 }, (_, index) => ({
    id: `${Date.now()}-${index}-${Math.random()}`,
    size: 42 + Math.floor(Math.random() * 38),
    color: ["mint", "peach", "lavender", "yellow", "blue"][
      Math.floor(Math.random() * 5)
    ],
  }));
}

function App() {
  // Authentication and account state
  const [authToken, setAuthToken] = useState(() => localStorage.getItem("wellmindToken") || "");
  const [authReady, setAuthReady] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [authName, setAuthName] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

const [selectedMood, setSelectedMood] = useState(() => {
  return localStorage.getItem("wellmindSelectedMood") || "";
});

const [moodHistory, setMoodHistory] = useState(() => {
  try {
    return JSON.parse(
      localStorage.getItem("wellmindMoodHistory") || "[]"
    );
  } catch {
    return [];
  }
});

  const [page, setPage] = useState("chat");
  const [mobileMenu, setMobileMenu] = useState("");

  const [breathing, setBreathing] = useState(false);

  // Bubble Pop game
  const [bubbleGameOpen, setBubbleGameOpen] = useState(false);
  const [bubbleGameStarted, setBubbleGameStarted] = useState(false);
  const [bubbleSecondsLeft, setBubbleSecondsLeft] = useState(60);
  const [bubbleScore, setBubbleScore] = useState(0);
  const [bubbles, setBubbles] = useState(() => createBubbleSet());

  // Memory Match game
  const [memoryGameOpen, setMemoryGameOpen] = useState(false);
  const [memoryDeck, setMemoryDeck] = useState([]);
  const [selectedCards, setSelectedCards] = useState([]);
  const [memoryMoves, setMemoryMoves] = useState(0);

  // Zen Garden game
  const [zenGardenOpen, setZenGardenOpen] = useState(false);
  const [zenPlants, setZenPlants] = useState([]);

  // Color Therapy game
  const [colorTherapyOpen, setColorTherapyOpen] = useState(false);
  const [selectedTherapyColor, setSelectedTherapyColor] =
    useState("#d9ead3");
  const [colorMood, setColorMood] = useState("Calm");

  // Profile
  const defaultProfile = {
    name: "Your Name",
    email: "",
    language: "English",
    communication: "Friendly and supportive",
    wellnessGoal: "Manage stress",
    reminders: true,
    moodCheckIns: true,
    saveChatHistory: true,
  };

  const [profile, setProfile] = useState(() => {
    try {
      const saved = localStorage.getItem("wellmindProfile");
      return saved
        ? { ...defaultProfile, ...JSON.parse(saved) }
        : defaultProfile;
    } catch {
      return defaultProfile;
    }
  });

  const [profileEditing, setProfileEditing] = useState(false);
  const [profileNotice, setProfileNotice] = useState("");

  async function apiRequest(path, options = {}, tokenOverride = authToken) {
    const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
    if (tokenOverride) headers.Authorization = `Bearer ${tokenOverride}`;

    const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
    let data = {};
    try { data = await response.json(); } catch { data = {}; }

    if (!response.ok) {
      if (response.status === 401) {
        localStorage.removeItem("wellmindToken");
        setAuthToken("");
        setAuthReady(true);
        setAuthError("Your session has expired. Please log in again.");
      }
      const error = new Error(data.error || "Request failed. Please try again.");
      error.status = response.status;
      throw error;
    }
    return data;
  }

  async function loadWorkspace(token) {
    const [profileData, conversationData, moodData] = await Promise.all([
      apiRequest("/api/profile", {}, token),
      apiRequest("/api/conversations", {}, token),
      apiRequest("/api/moods", {}, token),
    ]);

    const user = profileData.user || {};
    const styleMap = { friendly: "Friendly and supportive", supportive: "Friendly and supportive", calm: "Calm and professional", direct: "Simple and direct" };
    setProfile((previous) => ({
      ...previous,
      name: user.name || "Your Name",
      email: user.email || "",
      language: user.preferred_language || "English",
      communication: styleMap[user.communication_style] || "Friendly and supportive",
      wellnessGoal: user.wellness_goal || "Manage stress",
    }));

    const loadedChats = (conversationData.conversations || []).map((item) => ({
      id: Number(item.id),
      serverId: Number(item.id),
      title: item.title || "Conversation",
      messages: [],
      moodAtStart: "Not specified",
      moodHistoryAtStart: [],
    }));
    setChats(loadedChats);

    const loadedMoods = (moodData.moods || []).map((item) => ({
      mood: item.mood,
      date: item.recorded_at || new Date().toISOString(),
    }));
    setMoodHistory(loadedMoods);
    if (loadedMoods.length) {
      setSelectedMood(loadedMoods[0].mood);
      localStorage.setItem("wellmindSelectedMood", loadedMoods[0].mood);
    }

    if (loadedChats.length) {
      const firstChat = loadedChats[0];
      setActiveChatId(firstChat.id);
      const messageData = await apiRequest(`/api/conversations/${firstChat.serverId}/messages`, {}, token);
      setChats((previous) => previous.map((chat) => chat.id === firstChat.id
        ? { ...chat, messages: (messageData.messages || []).map((item) => ({ role: item.role, text: item.message })) }
        : chat));
    } else {
      setActiveChatId(null);
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function initialize() {
      if (!authToken) { setAuthReady(true); return; }
      try {
        await loadWorkspace(authToken);
      } catch (error) {
        console.error("Workspace loading error:", error);
        if (error.status === 401) {
          localStorage.removeItem("wellmindToken");
          setAuthToken("");
        } else {
          setAuthError(error.message || "Unable to load your account data.");
        }
      } finally {
        if (!cancelled) setAuthReady(true);
      }
    }
    initialize();
    return () => { cancelled = true; };
    // Run once on initial app load. Login calls loadWorkspace explicitly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleAuthSubmit(event) {
    event.preventDefault();
    setAuthError("");
    setAuthLoading(true);
    try {
      const endpoint = authMode === "signup" ? "/api/auth/signup" : "/api/auth/login";
      const response = await fetch(`${API_BASE}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(authMode === "signup" ? { name: authName.trim() } : {}),
          email: authEmail.trim().toLowerCase(),
          password: authPassword,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Authentication failed.");
      if (!data.token) throw new Error("The server did not return a login token.");

      localStorage.setItem("wellmindToken", data.token);
      setAuthToken(data.token);
      setAuthPassword("");
      await loadWorkspace(data.token);
      setAuthReady(true);
    } catch (error) {
      setAuthError(error.message || "Unable to connect to the WellMind server.");
    } finally {
      setAuthLoading(false);
    }
  }

  async function openConversation(chat) {
    setActiveChatId(chat.id);
    setPage("chat");
    setMobileMenu("");
    if (chat.messages.length || !chat.serverId) return;
    try {
      const data = await apiRequest(`/api/conversations/${chat.serverId}/messages`);
      setChats((previous) => previous.map((item) => item.id === chat.id
        ? { ...item, messages: (data.messages || []).map((entry) => ({ role: entry.role, text: entry.message })) }
        : item));
    } catch (error) {
      console.error("Unable to open conversation:", error);
    }
  }

  function logout() {
    localStorage.removeItem("wellmindToken");
    setAuthToken("");
    setAuthReady(true);
    setChats([]);
    setActiveChatId(null);
    setMoodHistory([]);
    setSelectedMood("");
    setPage("chat");
    setAuthMode("login");
    setAuthPassword("");
    setAuthError("");
  }

  const activeChat = chats.find(
    (chat) => chat.id === activeChatId
  );

  const hasMessages = Boolean(activeChat?.messages.length);

  // Bubble Pop timer
  useEffect(() => {
    if (!bubbleGameStarted) return undefined;

    if (bubbleSecondsLeft <= 0) {
      setBubbleGameStarted(false);
      return undefined;
    }

    const timerId = window.setTimeout(() => {
      setBubbleSecondsLeft((seconds) => seconds - 1);
    }, 1000);

    return () => window.clearTimeout(timerId);
  }, [bubbleGameStarted, bubbleSecondsLeft]);

  // Bubble Pop functions
  function startBubbleGame() {
    setBubbleScore(0);
    setBubbleSecondsLeft(60);
    setBubbles(createBubbleSet());

    setMemoryGameOpen(false);
    setZenGardenOpen(false);
    setColorTherapyOpen(false);

    setBubbleGameOpen(true);
    setBubbleGameStarted(true);
  }

  function popBubble(bubbleId) {
    if (!bubbleGameStarted) return;

    setBubbleScore((score) => score + 1);

    setBubbles((current) =>
      current.map((bubble) =>
        bubble.id === bubbleId
          ? {
              ...bubble,
              id: `${Date.now()}-${Math.random()}`,
              size: 42 + Math.floor(Math.random() * 38),
              color: ["mint", "peach", "lavender", "yellow", "blue"][
                Math.floor(Math.random() * 5)
              ],
            }
          : bubble
      )
    );
  }

  // Memory Match functions
  function createMemoryDeck() {
    const symbols = [
      "🌸", "🌿", "🌈", "☀️",
      "🌻", "🍀", "🦋", "🌙",
    ];

    return [...symbols, ...symbols]
      .map((symbol, index) => ({
        id: `${Date.now()}-${index}-${Math.random()}`,
        symbol,
        matched: false,
      }))
      .sort(() => Math.random() - 0.5);
  }

  function startMemoryGame() {
    setMemoryDeck(createMemoryDeck());
    setSelectedCards([]);
    setMemoryMoves(0);

    setBubbleGameOpen(false);
    setBubbleGameStarted(false);
    setZenGardenOpen(false);
    setColorTherapyOpen(false);

    setMemoryGameOpen(true);
  }

  function handleMemoryCardClick(card) {
    if (
      card.matched ||
      selectedCards.includes(card.id) ||
      selectedCards.length === 2
    ) {
      return;
    }

    if (selectedCards.length === 0) {
      setSelectedCards([card.id]);
      return;
    }

    const firstCard = memoryDeck.find(
      (item) => item.id === selectedCards[0]
    );

    if (!firstCard) return;

    setMemoryMoves((moves) => moves + 1);

    if (firstCard.symbol === card.symbol) {
      setMemoryDeck((previous) =>
        previous.map((item) =>
          item.id === card.id || item.id === firstCard.id
            ? { ...item, matched: true }
            : item
        )
      );

      setSelectedCards([]);
    } else {
      const firstId = selectedCards[0];
      setSelectedCards([firstId, card.id]);

      window.setTimeout(() => {
        setSelectedCards([]);
      }, 900);
    }
  }

  // Zen Garden functions
  function startZenGarden() {
    setZenPlants([]);

    setBubbleGameOpen(false);
    setBubbleGameStarted(false);
    setMemoryGameOpen(false);
    setColorTherapyOpen(false);

    setZenGardenOpen(true);
  }

  function plantInGarden(plant) {
    setZenPlants((previous) => [
      ...previous,
      {
        id: `${Date.now()}-${Math.random()}`,
        emoji: plant,
      },
    ]);
  }

  // Color Therapy functions
  function startColorTherapy() {
    setSelectedTherapyColor("#d9ead3");
    setColorMood("Calm");

    setBubbleGameOpen(false);
    setBubbleGameStarted(false);
    setMemoryGameOpen(false);
    setZenGardenOpen(false);

    setColorTherapyOpen(true);
  }

  // Close all games
  function closeAllGames() {
    setBubbleGameOpen(false);
    setBubbleGameStarted(false);
    setMemoryGameOpen(false);
    setZenGardenOpen(false);
    setColorTherapyOpen(false);
  }

  // Create new conversation
  function createChat() {
  const chat = {
    id: `local-${Date.now()}`,
    serverId: null,
    title: "New conversation",
    messages: [],
    moodAtStart: selectedMood || "Not specified",
    moodHistoryAtStart: moodHistory.slice(-5),
  };

  setChats((previous) => [chat, ...previous]);
  setActiveChatId(chat.id);
  setPage("chat");
  setMobileMenu("");
  setMessage("");
}

  // Send message to WellMind AI
  async function sendMessage(text = message) {
    const content = String(text ?? "").trim();

    if (!content || isLoading) return;

    const chatId = activeChatId || Date.now();

    const existingChat = chats.find(
      (chat) => chat.id === chatId
    );

    const userMessage = {
      role: "user",
      text: content,
    };

    if (existingChat) {
      setChats((previous) =>
        previous.map((chat) =>
          chat.id === chatId
            ? {
                ...chat,
                title:
                  chat.messages.length === 0
                    ? content.slice(0, 30)
                    : chat.title,
                messages: [...chat.messages, userMessage],
              }
            : chat
        )
      );
    } else {
      setChats((previous) => [
        {
          id: chatId,
          title: content.slice(0, 30),
          messages: [userMessage],
        },
        ...previous,
      ]);
    }

    setActiveChatId(chatId);
    setMessage("");
    setPage("chat");
    setMobileMenu("");
    setIsLoading(true);

    try {
      const data = await apiRequest("/api/chat", {
        method: "POST",
        body: JSON.stringify({
          message: content,
          conversationId: existingChat?.serverId || null,
          mood: existingChat?.moodAtStart || selectedMood || "Not specified",
        }),
      });

      // The backend creates a database conversation on the first message.
      setChats((previous) => previous.map((chat) =>
        chat.id === chatId ? { ...chat, serverId: data.conversationId } : chat
      ));

      if (
        typeof data.reply !== "string" ||
        !data.reply.trim()
      ) {
        throw new Error(
          "The AI returned an empty response."
        );
      }

      setChats((previous) =>
        previous.map((chat) =>
          chat.id === chatId
            ? {
                ...chat,
                messages: [
                  ...chat.messages,
                  {
                    role: "assistant",
                    text: data.reply,
                  },
                ],
              }
            : chat
        )
      );
    } catch (error) {
      console.error("WellMind AI error:", error);

      setChats((previous) =>
        previous.map((chat) =>
          chat.id === chatId
            ? {
                ...chat,
                messages: [
                  ...chat.messages,
                  {
                    role: "assistant",
                    text:
                      error.message ||
                      "I'm having trouble connecting. Please check the backend.",
                  },
                ],
              }
            : chat
        )
      );
    } finally {
      setIsLoading(false);
    }
  }

  // Mood check-in
async function selectMood(mood) {
  const moodEntry = { mood, date: new Date().toISOString() };
  setSelectedMood(mood);
  setMoodHistory((previous) => [moodEntry, ...previous].slice(0, 30));
  localStorage.setItem("wellmindSelectedMood", mood);

  try {
    await apiRequest("/api/moods", {
      method: "POST",
      body: JSON.stringify({ mood }),
    });
  } catch (error) {
    console.error("Unable to save mood to database:", error);
    setProfileNotice("Your mood could not be synced. Please check your connection.");
  }
}

  // Navigation
  function openPage(nextPage) {
    setPage(nextPage);
    setMobileMenu("");
  }

  // Relaxation exercise
  function startExercise(exercise) {
    setPage("exercise");
    setBreathing(false);
    setMobileMenu("");
  }

  // Save profile
  async function saveProfile() {
    try {
      const styleMap = {
        "Friendly and supportive": "friendly",
        "Calm and professional": "calm",
        "Simple and direct": "direct",
      };

      await apiRequest("/api/preferences", {
        method: "PUT",
        body: JSON.stringify({
          communicationStyle: styleMap[profile.communication] || "friendly",
          wellnessGoal: profile.wellnessGoal,
          preferredLanguage: profile.language,
        }),
      });

      // These display-only preferences remain local because the current
      // database schema has no columns for reminder toggles or profile edits.
      localStorage.setItem("wellmindProfile", JSON.stringify(profile));
      setProfileNotice("Your personalization preferences have been saved to your account.");
      setProfileEditing(false);
    } catch (error) {
      setProfileNotice(error.message || "Unable to save your preferences.");
    }
  }
    function cancelProfileEdit() {
    try {
      const saved = localStorage.getItem("wellmindProfile");

      setProfile(
        saved
          ? { ...defaultProfile, ...JSON.parse(saved) }
          : defaultProfile
      );
    } catch {
      setProfile(defaultProfile);
    }

    setProfileEditing(false);
    setProfileNotice("");
  }

  if (!authReady) {
    return (
      <div className="wellmind-auth-screen wellmind-auth-loading">
        <div className="wellmind-auth-card">
          <img className="wellmind-auth-logo" src={largeLogo} alt="WellMind logo" />
          <p>Preparing your personal wellness space...</p>
        </div>
      </div>
    );
  }

  if (!authToken) {
    return (
      <div className="wellmind-auth-screen">
        <section className="wellmind-auth-brand-panel">
          <div className="wellmind-auth-brand">
            <img src={largeLogo} alt="WellMind" />
            <span>WellMind</span>
          </div>
          <div className="wellmind-auth-brand-copy">
            <div className="wellmind-auth-kicker">YOUR SPACE TO FEEL BETTER</div>
            <h1>A healthier mind starts with a small pause.</h1>
            <p>Take a moment for yourself. Understand your emotions, build resilience, and make space for calm — one day at a time.</p>
          </div>
          <div className="wellmind-auth-benefits">
            <div className="wellmind-auth-benefit"><span className="wellmind-auth-benefit-icon"><Heart size={18} /></span><div><strong>Check in with yourself</strong><small>Notice your feelings without judging them.</small></div></div>
            <div className="wellmind-auth-benefit"><span className="wellmind-auth-benefit-icon"><Wind size={18} /></span><div><strong>Make room for calm</strong><small>Try simple breathing and relaxation exercises.</small></div></div>
            <div className="wellmind-auth-benefit"><span className="wellmind-auth-benefit-icon"><Sprout size={18} /></span><div><strong>Build healthy habits</strong><small>Track your mood and grow at your own pace.</small></div></div>
          </div>
          <div className="wellmind-auth-quote">“You don't have to have it all figured out today.”</div>
        </section>
        <section className="wellmind-auth-form-side">
          <div className="wellmind-auth-card">
            <div className="wellmind-auth-tabs" role="tablist" aria-label="Account access">
              <button type="button" role="tab" aria-selected={authMode === "login"} className={authMode === "login" ? "active" : ""} onClick={() => { setAuthMode("login"); setAuthError(""); }}>Log in</button>
              <button type="button" role="tab" aria-selected={authMode === "signup"} className={authMode === "signup" ? "active" : ""} onClick={() => { setAuthMode("signup"); setAuthError(""); }}>Sign up</button>
            </div>
            <div className="wellmind-auth-heading">
              <div className="wellmind-auth-mini-logo"><img src={smallLogo} alt="" /></div>
              <div className="wellmind-auth-kicker">WELCOME TO WELLMIND</div>
              <h2>{authMode === "login" ? "Welcome back" : "Create your account"}</h2>
              <p>{authMode === "login" ? "Log in to continue your wellness journey." : "Start building a little more balance into each day."}</p>
            </div>
            <form className="wellmind-auth-form" onSubmit={handleAuthSubmit}>
              {authMode === "signup" && <label>Full name<input type="text" value={authName} onChange={(e) => setAuthName(e.target.value)} placeholder="Your name" autoComplete="name" required maxLength={100} /></label>}
              <label>Email address<input type="email" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} placeholder="name@example.com" autoComplete="email" required /></label>
              <label>Password<input type="password" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} placeholder="Enter your password" autoComplete={authMode === "login" ? "current-password" : "new-password"} required minLength={8} maxLength={72} /></label>
              {authError && <div className="wellmind-auth-error" role="alert">{authError}</div>}
              <button className="wellmind-auth-submit" type="submit" disabled={authLoading}>{authLoading ? "Please wait..." : authMode === "login" ? "Log in" : "Create account"} <span aria-hidden="true">→</span></button>
            </form>
            <div className="wellmind-auth-footnote"><ShieldCheck size={15} /> Your wellness space is personal and private.</div>
          </div>
          <p className="wellmind-auth-disclaimer">WellMind supports emotional wellness. It is not a substitute for professional mental health care.</p>
        </section>
      </div>
    );
  }

  return (
    <div className="wellmind-app">
      {/* TOP NAVIGATION */}
      <header className="topbar">
        <button
          className="icon-button mobile-menu-button"
          onClick={() =>
            setMobileMenu(
              mobileMenu === "left" ? "" : "left"
            )
          }
          aria-label="Open navigation"
        >
          <Menu size={20} />
        </button>

        <div className="brand-mark">
          <img src={smallLogo} alt="WellMind logo" />
        </div>

        <div className="brand-copy">
          <div className="brand-name">WellMind</div>
          <div className="brand-subtitle">
            Emotional Wellness &amp; Resilience Hub
          </div>
        </div>

        <div className="topbar-spacer" />

        <span className="topbar-note">
          A little space for you
        </span>

        <button className="icon-button wellmind-logout-button" onClick={logout} title="Log out" aria-label="Log out">
          <LogOut size={18} />
        </button>

        <button
          className="icon-button mobile-menu-button"
          onClick={() =>
            setMobileMenu(
              mobileMenu === "right" ? "" : "right"
            )
          }
          aria-label="Open relaxation panel"
        >
          <Leaf size={19} />
        </button>
      </header>

      <div className="app-layout">
        {/* MOBILE BACKDROP */}
        {mobileMenu && (
          <button
            className="mobile-backdrop"
            onClick={() => setMobileMenu("")}
            aria-label="Close menu"
          />
        )}

        {/* LEFT SIDEBAR */}
        <aside
          className={`left-sidebar ${
            mobileMenu === "left" ? "mobile-open" : ""
          }`}
        >
          <div className="profile-row">
            <div className="profile-avatar">
              {(profile.name.trim()[0] || "Y").toUpperCase()}
            </div>

            <div>
              <strong>{profile.name || "Your space"}</strong>
              <span>Personal wellness</span>
            </div>

            <button
              className="icon-button profile-settings"
              onClick={() => openPage("profile")}
              aria-label="Profile settings"
            >
              <Settings size={17} />
            </button>
          </div>

          <button
            className="new-chat-button"
            onClick={createChat}
          >
            <Plus size={18} />
            New chat
          </button>

          <div className="section-label">
            YOUR CONVERSATIONS
          </div>

          <div className="chat-list">
            {chats.length === 0 ? (
              <p className="sidebar-empty">
                Your conversations will appear here.
              </p>
            ) : (
              chats.map((chat) => (
                <button
                  key={chat.id}
                  className={`chat-history-item ${
                    activeChatId === chat.id ? "active" : ""
                  }`}
                  onClick={() => openConversation(chat)}
                >
                  <MessageCircle size={16} />
                  <span>{chat.title}</span>
                </button>
              ))
            )}
          </div>

          {/* MOOD CHECK-IN */}
          <div className="mood-section">
            <div className="section-label">
              A QUICK CHECK-IN
            </div>

            <div className="mood-card">
              <strong>How are you feeling?</strong>
              <p>Choose what feels closest today.</p>

              <div className="mood-options">
                {moodOptions.map((mood) => (
                  <button
                    key={mood.name}
                    title={mood.name}
                    aria-label={mood.name}
                    className={`mood-option ${
                      selectedMood === mood.name
                        ? "selected"
                        : ""
                    }`}
                    onClick={() => selectMood(mood.name)}
                  >
                    <span className="mood-emoji">
                      {mood.emoji}
                    </span>
                    <span className="mood-name">
                      {mood.name}
                    </span>
                  </button>
                ))}
              </div>

              <p className="mood-status">
                {selectedMood
                  ? `Today's mood: ${selectedMood}`
                  : "No check-in yet"}
              </p>

              <button
                className="text-link"
                onClick={() => openPage("insights")}
              >
                View mood insights →
              </button>
            </div>
          </div>
        </aside>

        {/* MAIN APPLICATION */}
        <main className="main-panel">
          {/* MAIN HEADER */}
          <div className="main-header">
            <div>
              <h2>
                {page === "chat" && "A supportive conversation"}
                {page === "insights" && "Mood insights"}
                {page === "games" && "Relax & Play"}
                {page === "exercise" && "Relaxation space"}
                {page === "profile" && "Your profile"}
              </h2>

              <p>
                {page === "insights"
                  ? "Notice patterns without judgment"
                  : page === "profile"
                  ? "Your space, your preferences"
                  : "Take things at your own pace"}
              </p>
            </div>

            <span className="online-status">
              <span className="status-dot" />
              Your space
            </span>
          </div>

          {/* CHAT PAGE */}
          {page === "chat" && (
            <>
              <section
                className="chat-messages"
                aria-live="polite"
              >
                {!hasMessages ? (
                  <div className="empty-state">
                    <div className="watermark">
                      <Flower2 size={43} />
                    </div>

                    <h1>A moment for yourself.</h1>

                    <p>
                      You don't have to figure everything
                      out at once. Start wherever you are,
                      and we'll take it one step at a time.
                    </p>

                    <div className="suggestion-grid">
                      {suggestions.map((item) => (
                        <button
                          className="suggestion-card"
                          key={item.title}
                          onClick={() => sendMessage(item.text)}
                        >
                          <span className="suggestion-icon">
                            {item.icon}
                          </span>
                          <span>{item.title}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  activeChat.messages.map((item, index) => (
                    <div
                      key={`${activeChat.id}-${index}`}
                      className={`message-row ${item.role}`}
                    >
                      <div className="message-avatar">
                        {item.role === "user" ? (
                          "Y"
                        ) : (
                          <Flower2 size={18} />
                        )}
                      </div>

                      <div className="message-bubble">
                        {item.text}
                      </div>
                    </div>
                  ))
                )}

                {isLoading && (
                  <div className="message-row assistant">
                    <div className="message-avatar">
                      <Flower2 size={18} />
                    </div>

                    <div className="message-bubble">
                      WellMind is thinking...
                    </div>
                  </div>
                )}
              </section>

              {/* MESSAGE INPUT */}
              <div className="composer-area">
                <form
                  className="message-composer"
                  onSubmit={(event) => {
                    event.preventDefault();
                    sendMessage();
                  }}
                >
                  <textarea
                    rows="1"
                    value={message}
                    onChange={(event) =>
                      setMessage(event.target.value)
                    }
                    onKeyDown={(event) => {
                      if (
                        event.key === "Enter" &&
                        !event.shiftKey &&
                        !event.nativeEvent.isComposing
                      ) {
                        event.preventDefault();
                        sendMessage();
                      }
                    }}
                    placeholder="Share what's on your mind..."
                    aria-label="Message WellMind"
                  />

                  <button
                    type="submit"
                    className="send-button"
                    aria-label="Send message"
                    disabled={isLoading}
                  >
                    <Send size={18} />
                  </button>
                </form>

                <p className="disclaimer">
                  WellMind offers wellness support, not a
                  diagnosis or a replacement for
                  professional care.
                </p>
              </div>
            </>
          )}

          {/* MOOD INSIGHTS PAGE */}
          {page === "insights" && (
            <section className="content-page">
              <h1 className="page-title">
                Your mood, over time
              </h1>

              <p className="page-description">
                Your check-ins are snapshots of how you
                felt, not a definition of who you are.
              </p>

              <div className="stats-grid">
                <div className="stat-card">
                  <span>Total check-ins</span>
                  <strong>{moodHistory.length}</strong>
                </div>

                <div className="stat-card">
                  <span>Latest mood</span>
                  <strong>{selectedMood || "—"}</strong>
                </div>
              </div>

              <div className="content-card">
                <h3>Mood check-ins</h3>

                <div className="mood-chart">
                  {moodOptions.map((mood) => {
                    const count = moodHistory.filter(
                      (entry) => entry.mood === mood.name
                    ).length;

                    return (
                      <div
                        className="chart-column"
                        key={mood.name}
                      >
                        <div className="chart-bar-wrap">
                          <div
                            className="chart-bar"
                            style={{
                              height: `${Math.max(8, count * 28)}px`,
                            }}
                          />
                        </div>

                        <span>{mood.name}</span>
                        <small>{count}</small>
                      </div>
                    );
                  })}
                </div>

                <p className="muted-note">
                  Your recent mood check-ins are synced with your WellMind account.
                </p>
              </div>

              <div className="content-card">
                <h3>Recent check-ins</h3>

                {moodHistory.length === 0 ? (
                  <p className="muted-note">
                    Choose a mood in the sidebar to begin.
                  </p>
                ) : (
                  [...moodHistory]
                    .reverse()
                    .slice(0, 10)
                    .map((entry, index) => (
                      <div
                        className="history-row"
                        key={`${entry.date}-${index}`}
                      >
                        <span>
                          {
                            moodOptions.find(
                              (mood) => mood.name === entry.mood
                            )?.emoji
                          }{" "}
                          {entry.mood}
                        </span>
                        <small>{entry.date}</small>
                      </div>
                    ))
                )}
              </div>

              <button
                className="secondary-button"
                onClick={() => openPage("chat")}
              >
                <ArrowLeft size={16} />
                Back to chat
              </button>
            </section>
          )}

          {/* RELAX AND PLAY PAGE */}
          {page === "games" && (
            <section className="content-page">
              <h1 className="page-title">Relax &amp; Play</h1>

              <p className="page-description">
                Choose a low-pressure activity. There is no
                need to compete or get anything perfect.
              </p>

              {bubbleGameOpen ? (
                <div className="bubble-game-panel">
                  <div className="bubble-game-heading">
                    <div>
                      <span className="game-emoji">🫧</span>
                      <h2>Bubble Pop</h2>
                      <p>
                        Take a little pause and pop at your own pace.
                      </p>
                    </div>

                    <button
                      className="secondary-button"
                      onClick={closeAllGames}
                    >
                      <X size={15} />
                      Close game
                    </button>
                  </div>

                  <div className="bubble-game-stats">
                    <div>
                      <span>Time left</span>
                      <strong>{bubbleSecondsLeft}s</strong>
                    </div>

                    <div>
                      <span>Bubbles popped</span>
                      <strong>{bubbleScore}</strong>
                    </div>
                  </div>

                  <div
                    className={`bubble-play-area ${
                      !bubbleGameStarted ? "game-finished" : ""
                    }`}
                  >
                    {bubbleGameStarted ? (
                      bubbles.map((bubble) => (
                        <button
                          key={bubble.id}
                          type="button"
                          className={`pop-bubble bubble-${bubble.color}`}
                          style={{
                            width: bubble.size,
                            height: bubble.size,
                          }}
                          onClick={() => popBubble(bubble.id)}
                          aria-label="Pop bubble"
                        />
                      ))
                    ) : (
                      <div className="bubble-finished-message">
                        <span>🌿</span>
                        <h3>Lovely pause!</h3>
                        <p>
                          You popped {bubbleScore} bubbles.
                          Take a slow breath before you continue.
                        </p>
                        <button
                          className="primary-button"
                          onClick={startBubbleGame}
                        >
                          Play again
                        </button>
                      </div>
                    )}
                  </div>

                  <p className="bubble-game-hint">
                    {bubbleGameStarted
                      ? "There is no target score. Just enjoy the little pops."
                      : "You can play again whenever you need a short break."}
                  </p>
                </div>
              ) : memoryGameOpen ? (
                <div className="memory-game-panel">
                  <div className="memory-game-heading">
                    <div>
                      <span className="game-emoji">🧠</span>
                      <h2>Memory Match</h2>
                      <p>Find all 8 matching pairs.</p>
                    </div>

                    <button
                      className="secondary-button"
                      onClick={closeAllGames}
                    >
                      <X size={15} />
                      Close game
                    </button>
                  </div>

                  <div className="memory-stats">
                    <div>
                      <span>Moves</span>
                      <strong>{memoryMoves}</strong>
                    </div>

                    <div>
                      <span>Matched pairs</span>
                      <strong>
                        {memoryDeck.filter((card) => card.matched).length / 2}/8
                      </strong>
                    </div>
                  </div>

                  <div className="memory-grid">
                    {memoryDeck.map((card) => {
                      const revealed =
                        selectedCards.includes(card.id) || card.matched;

                      return (
                        <button
                          key={card.id}
                          type="button"
                          className={`memory-card ${
                            revealed ? "revealed" : ""
                          } ${card.matched ? "matched" : ""}`}
                          onClick={() => handleMemoryCardClick(card)}
                          disabled={card.matched || revealed}
                          aria-label={
                            revealed
                              ? `Card ${card.symbol}`
                              : "Reveal card"
                          }
                        >
                          {revealed ? card.symbol : "?"}
                        </button>
                      );
                    })}
                  </div>

                  {memoryDeck.length > 0 &&
                    memoryDeck.every((card) => card.matched) && (
                      <div className="memory-win-message">
                        <h3>🎉 Wonderful!</h3>
                        <p>
                          You found all pairs in {memoryMoves} moves.
                        </p>
                      </div>
                    )}

                  <button
                    className="primary-button"
                    onClick={startMemoryGame}
                  >
                    <Plus size={16} />
                    Restart game
                  </button>
                </div>
              ) : zenGardenOpen ? (
                <div className="zen-game-panel">
                  <div className="memory-game-heading">
                    <div>
                      <span className="game-emoji">🌱</span>
                      <h2>Zen Garden</h2>
                      <p>
                        Build a tiny garden, one mindful choice at a time.
                      </p>
                                          </div>

                    <button
                      className="secondary-button"
                      onClick={closeAllGames}
                    >
                      <X size={15} />
                      Close game
                    </button>
                  </div>

                  <div className="zen-garden-canvas">
                    {zenPlants.length === 0 ? (
                      <p>
                        Your peaceful garden is waiting for its first plant.
                      </p>
                    ) : (
                      zenPlants.map((plant) => (
                        <span key={plant.id}>{plant.emoji}</span>
                      ))
                    )}
                  </div>

                  <p className="zen-instruction">
                    Choose something to add to your garden:
                  </p>

                  <div className="zen-plant-options">
                    {[
                      "🌸", "🌻", "🌿", "🌳",
                      "🍄", "🪨", "🦋", "🌷",
                    ].map((plant) => (
                      <button
                        key={plant}
                        onClick={() => plantInGarden(plant)}
                        aria-label={`Add ${plant}`}
                      >
                        {plant}
                      </button>
                    ))}
                  </div>

                  <button
                    className="secondary-button"
                    onClick={() => setZenPlants([])}
                  >
                    Clear garden
                  </button>
                </div>
              ) : colorTherapyOpen ? (
                <div className="color-therapy-panel">
                  <div className="memory-game-heading">
                    <div>
                      <span className="game-emoji">🎨</span>
                      <h2>Color Therapy</h2>
                      <p>
                        Choose a color that matches the feeling
                        you want to invite.
                      </p>
                    </div>

                    <button
                      className="secondary-button"
                      onClick={closeAllGames}
                    >
                      <X size={15} />
                      Close game
                    </button>
                  </div>

                  <div className="color-mood-options">
                    {[
                      { name: "Calm", color: "#d9ead3" },
                      { name: "Joy", color: "#ffe599" },
                      { name: "Comfort", color: "#f4cccc" },
                      { name: "Focus", color: "#cfe2f3" },
                      { name: "Hope", color: "#d9d2e9" },
                    ].map((item) => (
                      <button
                        key={item.name}
                        className={`color-choice ${
                          selectedTherapyColor === item.color
                            ? "active"
                            : ""
                        }`}
                        onClick={() => {
                          setSelectedTherapyColor(item.color);
                          setColorMood(item.name);
                        }}
                      >
                        <span
                          style={{ backgroundColor: item.color }}
                        />
                        {item.name}
                      </button>
                    ))}
                  </div>

                  <div
                    className="color-canvas"
                    style={{
                      backgroundColor: selectedTherapyColor,
                    }}
                  >
                    <span>{colorMood}</span>
                    <p>
                      Take a slow breath and notice how this
                      color makes you feel.
                    </p>
                  </div>

                  <p className="muted-note">
                    There is no right color. Pick the one
                    that feels comfortable to you.
                  </p>
                </div>
              ) : (
                <div className="games-grid">
                  <div className="game-card">
                    <span className="game-emoji">🫧</span>
                    <h3>Bubble Pop</h3>
                    <p>
                      Pop soft, colorful bubbles for a simple
                      mindful break.
                    </p>
                    <button
                      className="primary-button"
                      onClick={startBubbleGame}
                    >
                      Play now
                    </button>
                  </div>

                  <div className="game-card">
                    <span className="game-emoji">🧠</span>
                    <h3>Memory Match</h3>
                    <p>
                      Find matching pairs of calming symbols
                      and give your mind a gentle workout.
                    </p>
                    <button
                      className="primary-button"
                      onClick={startMemoryGame}
                    >
                      Play now
                    </button>
                  </div>

                  <div className="game-card">
                    <span className="game-emoji">🌱</span>
                    <h3>Zen Garden</h3>
                    <p>
                      Create a tiny peaceful garden by adding
                      plants, flowers and stones.
                    </p>
                    <button
                      className="primary-button"
                      onClick={startZenGarden}
                    >
                      Create garden
                    </button>
                  </div>

                  <div className="game-card">
                    <span className="game-emoji">🎨</span>
                    <h3>Color Therapy</h3>
                    <p>
                      Explore gentle colors and choose the
                      feeling you want to invite.
                    </p>
                    <button
                      className="primary-button"
                      onClick={startColorTherapy}
                    >
                      Explore colors
                    </button>
                  </div>
                </div>
              )}

              <button
                className="secondary-button"
                onClick={() => {
                  closeAllGames();
                  openPage("chat");
                }}
              >
                <ArrowLeft size={16} />
                Back to chat
              </button>
            </section>
          )}

          {/* BREATHING / EXERCISE PAGE */}
          {page === "exercise" && (
            <section className="content-page">
              <h1 className="page-title">
                Take a gentle pause
              </h1>

              <p className="page-description">
                There is no rush. Follow the exercise at
                your own pace.
              </p>

              <div className="content-card exercise-card">
                <Wind size={30} />

                <h3>Breathing space</h3>

                <p>
                  Breathe in gently as the circle expands.
                  Breathe out slowly as it contracts.
                </p>

                <div
                  className={`breathing-circle ${
                    breathing ? "breathing" : ""
                  }`}
                >
                  {breathing ? "Breathe" : "Ready"}
                </div>

                <button
                  className="primary-button"
                  onClick={() => setBreathing(!breathing)}
                >
                  {breathing ? "Pause exercise" : "Start breathing"}
                </button>
              </div>

              <button
                className="secondary-button"
                onClick={() => openPage("chat")}
              >
                <ArrowLeft size={16} />
                Back to chat
              </button>
            </section>
          )}

          {/* PROFILE PAGE */}
          {page === "profile" && (
            <section className="content-page profile-content">
              <div className="profile-page-heading">
                <div>
                  <h1 className="page-title">
                    Your personal space
                  </h1>

                  <p className="page-description">
                    Manage your account and shape how
                    WellMind supports you.
                  </p>
                </div>

                {!profileEditing ? (
                  <button
                    className="primary-button"
                    onClick={() => {
                      setProfileNotice("");
                      setProfileEditing(true);
                    }}
                  >
                    <Pencil size={15} />
                    Edit profile
                  </button>
                ) : (
                  <div className="profile-action-group">
                    <button
                      className="secondary-button"
                      onClick={cancelProfileEdit}
                    >
                      Cancel
                    </button>

                    <button
                      className="primary-button"
                      onClick={saveProfile}
                    >
                      <Save size={15} />
                      Save changes
                    </button>
                  </div>
                )}
              </div>

              {/* PROFILE HEADER CARD */}
              <div className="profile-hero content-card">
                <div className="profile-large-avatar">
                  {(profile.name.trim()[0] || "Y").toUpperCase()}
                </div>

                <div className="profile-hero-copy">
                  <h2>{profile.name || "Your name"}</h2>

                  <p>
                    {profile.email || "Add your email address"}
                  </p>

                  <span>
                    <HeartHandshake size={14} />
                    Your emotional wellness journey
                  </span>
                </div>

                <div className="profile-member-label">
                  WELLMIND MEMBER
                </div>
              </div>

              <div className="profile-sections-grid">
                {/* PERSONAL INFORMATION */}
                <div className="content-card profile-section-card">
                  <div className="profile-section-title">
                    <span className="profile-section-icon">
                      <UserRound size={18} />
                    </span>

                    <div>
                      <h3>Personal information</h3>
                      <p>Update your basic profile details.</p>
                    </div>
                  </div>

                  <label className="profile-field">
                    <span>Full name</span>
                    <input
                      type="text"
                      value={profile.name}
                      disabled={!profileEditing}
                      onChange={(e) =>
                        setProfile({
                          ...profile,
                          name: e.target.value,
                        })
                      }
                    />
                  </label>

                  <label className="profile-field">
                    <span>Email address</span>
                    <input
                      type="email"
                      value={profile.email}
                      disabled={!profileEditing}
                      onChange={(e) =>
                        setProfile({
                          ...profile,
                          email: e.target.value,
                        })
                      }
                    />
                  </label>

                  <label className="profile-field">
                    <span>Preferred language</span>
                    <select
                      value={profile.language}
                      disabled={!profileEditing}
                      onChange={(e) =>
                        setProfile({
                          ...profile,
                          language: e.target.value,
                        })
                      }
                    >
                      <option>English</option>
                      <option>Hindi</option>
                      <option>Hinglish</option>
                    </select>
                  </label>
                </div>

                {/* WELLNESS PREFERENCES */}
                <div className="content-card profile-section-card">
                  <div className="profile-section-title">
                    <span className="profile-section-icon">
                      <HeartHandshake size={18} />
                    </span>

                    <div>
                      <h3>Wellness preferences</h3>
                      <p>
                        Choose how WellMind communicates with you.
                      </p>
                    </div>
                  </div>

                  <label className="profile-field">
                    <span>Communication style</span>
                    <select
                      value={profile.communication}
                      disabled={!profileEditing}
                      onChange={(e) =>
                        setProfile({
                          ...profile,
                          communication: e.target.value,
                        })
                      }
                    >
                      <option>Friendly and supportive</option>
                      <option>Calm and professional</option>
                      <option>Simple and direct</option>
                    </select>
                  </label>

                  <label className="profile-field">
                    <span>Current wellness goal</span>
                    <select
                      value={profile.wellnessGoal}
                      disabled={!profileEditing}
                      onChange={(e) =>
                        setProfile({
                          ...profile,
                          wellnessGoal: e.target.value,
                        })
                      }
                    >
                      <option>Manage stress</option>
                      <option>Understand my emotions</option>
                      <option>Build resilience</option>
                      <option>Improve daily well-being</option>
                      <option>Build healthier habits</option>
                    </select>
                  </label>
                </div>

                {/* REMINDERS */}
                <div className="content-card profile-section-card">
                  <div className="profile-section-title">
                    <span className="profile-section-icon">
                      <Bell size={18} />
                    </span>

                    <div>
                      <h3>Reminders &amp; check-ins</h3>
                      <p>
                        Choose which prompts you want to see.
                      </p>
                    </div>
                  </div>

                  <label className="profile-toggle-row">
                    <span>
                      <strong>Wellness reminders</strong>
                      <small>
                        Gentle reminders to take a pause.
                      </small>
                    </span>

                    <input
                      type="checkbox"
                      checked={profile.reminders}
                      disabled={!profileEditing}
                      onChange={(e) =>
                        setProfile({
                          ...profile,
                          reminders: e.target.checked,
                        })
                      }
                    />
                  </label>

                  <label className="profile-toggle-row">
                    <span>
                      <strong>Mood check-ins</strong>
                      <small>
                        Prompts to reflect on how you feel.
                      </small>
                    </span>

                    <input
                      type="checkbox"
                      checked={profile.moodCheckIns}
                      disabled={!profileEditing}
                      onChange={(e) =>
                        setProfile({
                          ...profile,
                          moodCheckIns: e.target.checked,
                        })
                      }
                    />
                  </label>
                </div>

                {/* PRIVACY AND SECURITY */}
                <div className="content-card profile-section-card">
                  <div className="profile-section-title">
                    <span className="profile-section-icon">
                      <ShieldCheck size={18} />
                    </span>

                    <div>
                      <h3>Privacy &amp; data</h3>
                      <p>
                        Review how this prototype handles
                        your preferences.
                      </p>
                    </div>
                  </div>

                  <label className="profile-toggle-row">
                    <span>
                      <strong>Save chat history</strong>
                      <small>
                        Preference for retaining conversations.
                      </small>
                    </span>

                    <input
                      type="checkbox"
                      checked={profile.saveChatHistory}
                      disabled={!profileEditing}
                      onChange={(e) =>
                        setProfile({
                          ...profile,
                          saveChatHistory: e.target.checked,
                        })
                      }
                    />
                  </label>

                  <div className="profile-privacy-note">
                    <LockKeyhole size={16} />
                    <p>
                      Your account, communication style, wellness goal, language, conversations and mood check-ins are stored on the WellMind server. Reminder toggles and display-name edits are currently saved only in this browser.
                    </p>
                  </div>
                </div>
              </div>

              {profileNotice && (
                <p
                  className="profile-save-notice"
                  role="status"
                >
                  {profileNotice}
                </p>
              )}

              <button
                className="secondary-button profile-back-button"
                onClick={() => openPage("chat")}
              >
                <ArrowLeft size={16} />
                Back to chat
              </button>
            </section>
          )}
        </main>

        {/* RIGHT RELAXATION SIDEBAR */}
        <aside
          className={`right-sidebar ${
            mobileMenu === "right" ? "mobile-open" : ""
          }`}
        >
          <div className="right-sidebar-heading">
            <div className="right-heading-icon">
              <Leaf size={19} />
            </div>

            <div>
              <h3>Relaxation Center</h3>
              <p>Small pauses, softer moments.</p>
            </div>
          </div>

          {/* BREATHING */}
          <div className="relax-card">
            <div className="relax-icon">
              <Wind size={20} />
            </div>

            <div className="relax-card-copy">
              <strong>Breathing space</strong>
              <p>A gentle paced-breathing exercise.</p>

              <button
                onClick={() => startExercise("breathing")}
              >
                Start exercise →
              </button>
            </div>
          </div>

          {/* GROUNDING */}
          <div className="relax-card">
            <div className="relax-icon">
              <Sprout size={20} />
            </div>

            <div className="relax-card-copy">
              <strong>Grounding exercise</strong>
              <p>
                Reconnect with the present through your senses.
              </p>

              <button
                onClick={() => startExercise("grounding")}
              >
                Try grounding →
              </button>
            </div>
          </div>

          {/* REFLECTION */}
          <div className="relax-card">
            <div className="relax-icon">
              <Heart size={20} />
            </div>

            <div className="relax-card-copy">
              <strong>Reflection prompt</strong>
              <p>What is one thing you need right now?</p>

              <button
                onClick={() =>
                  sendMessage(
                    "Help me reflect on what I need right now."
                  )
                }
              >
                Reflect →
              </button>
            </div>
          </div>

          {/* RELAX AND PLAY */}
          <div className="play-section">
            <p className="section-label">
              NEED A CHANGE OF PACE?
            </p>

            <button
              className="play-button"
              onClick={() => openPage("games")}
            >
              <span>
                <Gamepad2 size={19} />
                Relax &amp; Play
              </span>

              <span>↗</span>
            </button>

            <p className="play-description">
              Explore simple, low-pressure activities.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default App;