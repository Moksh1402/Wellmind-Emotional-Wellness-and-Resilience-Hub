
import React, { useState } from "react";
import "./Profile.css";

function Profile() {
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);

  const [user, setUser] = useState({
    name: "Your Name",
    email: "your@email.com",
    language: "English",
    communication: "Friendly and supportive",
    reminders: true,
    moodUpdates: true,
    chatHistory: true,
  });

  const update = (key, value) => {
    setUser({ ...user, [key]: value });
    setSaved(false);
  };

  const handleSave = () => {
    setEditing(false);
    setSaved(true);
  };

  return (
    <div className="profile-page">
      <div className="profile-heading">
        <div>
          <h1>My Profile</h1>
          <p>Manage your account and wellness preferences.</p>
        </div>
        <span className="profile-tag">WellMind Member</span>
      </div>

      <div className="profile-card">
        <div className="profile-user">
          <div className="profile-avatar">
            {user.name.charAt(0).toUpperCase()}
          </div>

          <div className="profile-user-info">
            <h2>{user.name}</h2>
            <p>{user.email}</p>
            <span>Emotional Wellness Journey</span>
          </div>

          <button
            className="edit-btn"
            onClick={() => setEditing(!editing)}
          >
            {editing ? "Cancel" : "Edit Profile"}
          </button>
        </div>
      </div>

      <div className="profile-grid">
        <section className="profile-card">
          <h3>Personal Information</h3>
          <p className="section-description">
            Your basic account details.
          </p>

          <label>Full Name</label>
          <input
            value={user.name}
            disabled={!editing}
            onChange={(e) => update("name", e.target.value)}
          />

          <label>Email Address</label>
          <input
            type="email"
            value={user.email}
            disabled={!editing}
            onChange={(e) => update("email", e.target.value)}
          />

          <label>Preferred Language</label>
          <select
            value={user.language}
            disabled={!editing}
            onChange={(e) => update("language", e.target.value)}
          >
            <option>English</option>
            <option>Hindi</option>
            <option>Hinglish</option>
          </select>

          {editing && (
            <button className="save-btn" onClick={handleSave}>
              Save Changes
            </button>
          )}

          {saved && <p className="success-msg">Changes saved locally!</p>}
        </section>

        <section className="profile-card">
          <h3>Wellness Preferences</h3>
          <p className="section-description">
            Customize how WellMind communicates with you.
          </p>

          <label>Communication Style</label>
          <select
            value={user.communication}
            onChange={(e) => update("communication", e.target.value)}
          >
            <option>Friendly and supportive</option>
            <option>Calm and professional</option>
            <option>Simple and direct</option>
          </select>

          <div className="setting-row">
            <div>
              <strong>Wellness Reminders</strong>
              <p>Receive regular wellness reminders.</p>
            </div>
            <input
              type="checkbox"
              checked={user.reminders}
              onChange={(e) => update("reminders", e.target.checked)}
            />
          </div>

          <div className="setting-row">
            <div>
              <strong>Mood Check-ins</strong>
              <p>Enable daily mood check-in prompts.</p>
            </div>
            <input
              type="checkbox"
              checked={user.moodUpdates}
              onChange={(e) => update("moodUpdates", e.target.checked)}
            />
          </div>
        </section>

        <section className="profile-card">
          <h3>Privacy & Security</h3>
          <p className="section-description">
            Control your personal information.
          </p>

          <div className="setting-row">
            <div>
              <strong>Chat History</strong>
              <p>Allow saving conversations to your account.</p>
            </div>
            <input
              type="checkbox"
              checked={user.chatHistory}
              onChange={(e) => update("chatHistory", e.target.checked)}
            />
          </div>

          <button className="secondary-btn">
            Change Password
          </button>

          <button className="danger-btn">
            Log Out
          </button>
        </section>
      </div>
    </div>
  );
}

export default Profile;
