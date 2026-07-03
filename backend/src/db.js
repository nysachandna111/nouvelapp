// Database layer for Nouvel. Uses Node's built-in node:sqlite (synchronous API).
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Resolve DB path. Use :memory: when explicitly requested (tests).
const rawPath = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'nouvel.db');
const dbPath =
  rawPath === ':memory:'
    ? ':memory:'
    : path.isAbsolute(rawPath)
      ? rawPath
      : path.join(__dirname, '..', rawPath);

if (dbPath !== ':memory:') {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
}

export const db = new DatabaseSync(dbPath);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

// ---- Schema (mirrors PRD §9 Data Requirements) ----
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  auth_provider TEXT DEFAULT 'email',
  subscription_status TEXT DEFAULT 'free',
  notification_pref TEXT DEFAULT 'on',
  reminder_time TEXT DEFAULT '08:00',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS user_profiles (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  age_range TEXT,
  life_season TEXT,
  intention TEXT,
  guidance_style TEXT,
  assessment_completed INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS assessment_answers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question_id INTEGER NOT NULL,
  answer TEXT NOT NULL,
  category TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  focus_1_title TEXT, focus_1_desc TEXT,
  focus_2_title TEXT, focus_2_desc TEXT,
  focus_3_title TEXT, focus_3_desc TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS journal_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  prompt_text TEXT,
  journal_text TEXT NOT NULL,
  mood_before TEXT,
  mood_after TEXT,
  tags TEXT,
  favorite INTEGER NOT NULL DEFAULT 0,
  ai_reflection TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS practices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  duration TEXT,
  description TEXT,
  steps TEXT
);

CREATE TABLE IF NOT EXISTS practice_completions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  practice_id INTEGER NOT NULL REFERENCES practices(id) ON DELETE CASCADE,
  completed_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

// ---- Phase 2 migrations (add columns/tables to an existing DB in place) ----
function ensureColumn(table, column, def) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
  if (!cols.includes(column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${def}`);
}
// Journal entry: writing-mode + Phase 2 metadata (spec "Tip 1: update schema first").
ensureColumn('journal_entries', 'mode', "TEXT NOT NULL DEFAULT 'standard'");
ensureColumn('journal_entries', 'mood', 'TEXT');
ensureColumn('journal_entries', 'recipient', 'TEXT');
ensureColumn('journal_entries', 'dream_time', 'TEXT');
// Personalization + AI privacy preferences on the user profile.
ensureColumn('user_profiles', 'journal_cover', "TEXT NOT NULL DEFAULT 'celestial'");
ensureColumn('user_profiles', 'journal_font', "TEXT NOT NULL DEFAULT 'georgia'");
ensureColumn('user_profiles', 'ambient_sound', "TEXT NOT NULL DEFAULT 'silence'");
ensureColumn('user_profiles', 'ai_opt_in', 'INTEGER NOT NULL DEFAULT 0');
ensureColumn('user_profiles', 'summary_time', "TEXT NOT NULL DEFAULT '19:00'");

db.exec(`
CREATE TABLE IF NOT EXISTS prompt_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  prompt TEXT NOT NULL,
  favorite INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS weekly_summaries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  summary TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ai_patterns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  insight TEXT NOT NULL,
  dismissed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

// ---- Seed practices (PRD §13 Practices) ----
const practiceCount = db.prepare('SELECT COUNT(*) AS c FROM practices').get().c;
if (practiceCount === 0) {
  const insert = db.prepare(
    'INSERT INTO practices (title, category, duration, description, steps) VALUES (?, ?, ?, ?, ?)'
  );
  const seed = [
    {
      title: '3-Minute Self-Trust Reset',
      category: 'Self-trust',
      duration: '3 minutes',
      description: 'A quick grounding ritual to reconnect with your inner knowing.',
      steps: [
        'Place one hand on your heart.',
        'Take five slow breaths.',
        'Ask yourself: "What do I already know to be true?"',
        'Write one sentence of truth.',
        'Choose one aligned action for today.',
      ],
    },
    {
      title: 'Box Breathing Reset',
      category: 'Breathwork',
      duration: '2 minutes',
      description: 'Calm your nervous system with rhythmic breathing.',
      steps: ['Inhale for 4 counts.', 'Hold for 4 counts.', 'Exhale for 4 counts.', 'Hold for 4 counts.', 'Repeat for 8 rounds.'],
    },
    {
      title: 'Nervous System Reset',
      category: 'Nervous system reset',
      duration: '4 minutes',
      description: 'Signal safety to your body and settle activation.',
      steps: ['Sit or lie comfortably.', 'Lengthen your exhale longer than your inhale.', 'Gently hum on the exhale.', 'Notice where tension is held and soften it.', 'Name one thing that feels safe right now.'],
    },
    {
      title: 'Confidence Affirmation',
      category: 'Confidence building',
      duration: '2 minutes',
      description: 'Reinforce a grounded sense of self.',
      steps: ['Stand tall and breathe.', 'Say: "I trust myself to handle what comes."', 'Recall one moment you were brave.', 'Choose one bold-but-kind action for today.'],
    },
    {
      title: 'Self-Worth Reflection',
      category: 'Self-worth reflection',
      duration: '5 minutes',
      description: 'Reconnect worth with being, not doing.',
      steps: ['Write: "I am worthy because..."', 'List three qualities unrelated to achievement.', 'Read them aloud slowly.'],
    },
    {
      title: 'Identity Scripting',
      category: 'Identity shift',
      duration: '5 minutes',
      description: 'Write from the version of you that you are becoming.',
      steps: ['Picture the next version of yourself.', 'Write a paragraph in present tense as that self.', 'Underline one belief you can practice today.'],
    },
    {
      title: 'Boundary Practice',
      category: 'Boundary practice',
      duration: '3 minutes',
      description: 'Clarify and honor a personal limit.',
      steps: ['Name one situation that drains you.', 'Complete: "I am allowed to..."', 'Draft one sentence to communicate the boundary.'],
    },
    {
      title: 'Gratitude Grounding',
      category: 'Gratitude',
      duration: '2 minutes',
      description: 'Shift your state by noticing what is already good.',
      steps: ['Name three things you are grateful for.', 'Feel each one for a breath.', 'Send silent thanks to one person.'],
    },
    {
      title: 'Emotional Release',
      category: 'Emotional release',
      duration: '4 minutes',
      description: 'Let an emotion move through without judgment.',
      steps: ['Name the emotion you feel.', 'Locate it in your body.', 'Breathe into that area.', 'Write what it wants you to know.'],
    },
    {
      title: 'Abundance Mindset Shift',
      category: 'Abundance mindset',
      duration: '3 minutes',
      description: 'Move from scarcity to spaciousness.',
      steps: ['Notice one scarcity thought.', 'Reframe it into possibility.', 'Write: "There is enough time for what matters."'],
    },
  ];
  for (const p of seed) {
    insert.run(p.title, p.category, p.duration, p.description, JSON.stringify(p.steps));
  }
}

export default db;
