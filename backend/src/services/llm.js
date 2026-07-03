// LLM service. Uses OpenAI when OPENAI_API_KEY is set; otherwise falls back to a
// deterministic rule-based engine so the whole app runs offline (PRD §14 allows
// a simple scoring system for the MVP).
import OpenAI from 'openai';
import { QUESTIONS, FOCUS_AREA_CATALOG } from '../data/assessment.js';

const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const hasKey = () => Boolean(process.env.OPENAI_API_KEY);

let client = null;
function openai() {
  if (!client) client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return client;
}

export function aiEnabled() {
  return hasKey();
}

// System prompt encodes the brand voice and the safety boundaries from PRD §8/§12.
const SYSTEM_PROMPT = `You are the AI Guide inside "Nouvel", a luxury self-mastery and journaling app.
Voice: warm, wise, grounded, emotionally intelligent, calm, premium — encouraging but never overly casual.
You must NOT: diagnose mental health conditions, claim to replace therapy, give medical/legal advice, or make extreme spiritual or manipulative claims.
If a user expresses crisis or self-harm, gently encourage them to reach out to a professional or emergency services.
Keep responses concise, personal, and reflective. Speak directly to the user.`;

async function chat(messages, { json = false, maxTokens = 500 } = {}) {
  const res = await openai().chat.completions.create({
    model: MODEL,
    messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
    temperature: 0.8,
    max_tokens: maxTokens,
    ...(json ? { response_format: { type: 'json_object' } } : {}),
  });
  return res.choices[0].message.content.trim();
}

// ---------------- Rule-based scoring ----------------
// Tally categories from the user's answers and map the top 3 to focus areas.
function scoreCategories(answers) {
  const tally = {};
  for (const a of answers) {
    const q = QUESTIONS.find((x) => x.id === a.question_id);
    if (!q) continue;
    const opt = q.options.find((o) => o.label === a.answer);
    const cats = opt?.categories || (a.category ? [a.category] : []);
    for (const c of cats) tally[c] = (tally[c] || 0) + 1;
  }
  return tally;
}

function ruleFocusAreas(answers) {
  const tally = scoreCategories(answers);
  const ranked = Object.entries(tally).sort((a, b) => b[1] - a[1]).map(([c]) => c);

  // Map ranked categories to distinct focus areas; always return exactly 3.
  const chosen = [];
  const seenTitles = new Set();
  for (const cat of ranked) {
    const fa = FOCUS_AREA_CATALOG[cat];
    if (fa && !seenTitles.has(fa.title)) {
      chosen.push(fa);
      seenTitles.add(fa.title);
    }
    if (chosen.length === 3) break;
  }
  // Pad from the catalog if fewer than 3 distinct areas emerged.
  for (const fa of Object.values(FOCUS_AREA_CATALOG)) {
    if (chosen.length === 3) break;
    if (!seenTitles.has(fa.title)) {
      chosen.push(fa);
      seenTitles.add(fa.title);
    }
  }
  return chosen.slice(0, 3);
}

// ---------------- Public API ----------------

// Always returns exactly 3 { title, desc } focus areas (PRD §7 Feature 2).
export async function generateFocusAreas({ profile, answers }) {
  if (!hasKey()) return ruleFocusAreas(answers);
  try {
    const answerText = answers.map((a) => `Q${a.question_id}: ${a.answer}`).join('\n');
    const content = await chat(
      [
        {
          role: 'user',
          content: `User profile: ${JSON.stringify(profile)}.
Assessment answers:
${answerText}

Return JSON: {"focusAreas":[{"title":"...","desc":"..."},{...},{...}]}.
Return EXACTLY 3 focus areas. Each title is 3-6 words. Each desc is 1-2 warm sentences written directly to the user ("You may...").`,
        },
      ],
      { json: true, maxTokens: 500 }
    );
    const parsed = JSON.parse(content);
    const areas = (parsed.focusAreas || []).slice(0, 3).filter((a) => a.title && a.desc);
    if (areas.length === 3) return areas;
    return ruleFocusAreas(answers); // fall back if the model returned a bad shape
  } catch (err) {
    console.error('generateFocusAreas LLM error, using fallback:', err.message);
    return ruleFocusAreas(answers);
  }
}

// A single personalized journaling prompt.
export async function generatePrompt({
  profile,
  focusAreas,
  recentThemes = [],
  recentEntries = [],
  mood = null,
  aiAllowed = true,
  daySeed = 0,
}) {
  const primary = focusAreas?.[0]?.title || 'self-awareness';
  // Static curated bank — used when AI is unavailable OR the user has not opted
  // in to AI (Phase 2: "Fallback to a curated static prompt bank").
  if (!hasKey() || !aiAllowed) {
    const pool = [
      `Where in your life are you craving more emotional safety, clarity, or truth — and what would change if you honored that need today?`,
      `Thinking about ${primary.toLowerCase()}: what is one small, honest step you could take this week?`,
      `What feeling has been asking for your attention lately, and what might it be trying to protect?`,
      `If the next version of you were writing today's entry, what would they want you to remember?`,
      `What are you ready to release, and what would lightness feel like in its place?`,
      `Name one thing you're quietly proud of. Why does it matter to you?`,
      `What did today ask of you, and where did you meet it with grace?`,
      `Is there something you've been avoiding putting into words? What would it say if you let it?`,
      `When did you last feel fully yourself — and what conditions helped that feeling arrive?`,
      `What boundary, if honored today, would give you more room to breathe?`,
      `Describe a moment this week when you chose yourself. What made that possible?`,
      `What story about yourself are you ready to outgrow?`,
      `If your body could speak right now, what would it ask for?`,
      `What would "enough" look like for you today — not someday, but today?`,
      `Who or what are you grateful for that you rarely mention out loud?`,
      `What emotion keeps visiting you — and what is its wisest message?`,
      `Where are you performing instead of being honest, and what would authenticity cost you?`,
      `What would you do differently if you trusted that you belong here?`,
      `Name a fear that has been running quietly in the background. What is it protecting?`,
      `What does rest actually look like for you — not productivity in disguise?`,
      `If you could send one sentence of compassion to your younger self, what would it say?`,
      `What pattern keeps repeating, and what is it trying to teach you?`,
      `What would change if you stopped waiting to feel ready?`,
      `Where in your life do you need more softness — toward yourself or toward someone else?`,
      `What truth about ${primary.toLowerCase()} feels tender but necessary to name today?`,
      `What are you carrying that was never yours to hold?`,
      `Describe the kind of day your future self would thank you for choosing.`,
      `What need have you been meeting indirectly — through busyness, pleasing, or control?`,
      `When you imagine feeling at peace, what is the first small detail you notice?`,
      `What would it mean to treat yourself with the same patience you offer others?`,
      `What is one thing you know in your gut but haven't fully admitted yet?`,
      `If today were a chapter title in your story, what would it be — and why?`,
    ];
    // Seeded by the day so the prompt CHANGES every day, nudged by recent themes.
    const idx = (daySeed + recentThemes.length + (mood ? String(mood).length : 0)) % pool.length;
    return pool[idx];
  }
  try {
    // Learn from the individual: summarize their own recent writing so tomorrow's
    // prompt speaks to where they actually are (spec: send summaries, not full text).
    const recentText = recentEntries
      .map((e, i) => `Entry ${i + 1}${e.mood ? ` (felt ${e.mood})` : ''}: ${String(e.text || '').replace(/\s+/g, ' ').slice(0, 240)}`)
      .join('\n');
    return await chat(
      [
        {
          role: 'user',
          content: `Write ONE fresh journaling prompt (1-2 sentences) tailored to THIS person, so it never feels generic.
Profile: ${JSON.stringify(profile)}.
Top focus area: ${primary}.
Recurring themes/tags: ${recentThemes.join(', ') || 'none yet'}.
Their recent entries (learn what's alive for them, then gently move them forward — do not just repeat it back):
${recentText || 'No entries yet.'}
Time context: day #${daySeed} — make it different from a typical prompt.
Return only the prompt text, no quotes.`,
        },
      ],
      { maxTokens: 140 }
    );
  } catch (err) {
    console.error('generatePrompt LLM error, using fallback:', err.message);
    return `Thinking about ${primary.toLowerCase()}: what is one honest truth you are ready to face today?`;
  }
}

// A short reflection after a journal entry (PRD §7 Feature 4 optional AI).
export async function reflectOnEntry({ entryText, focusAreas = [] }) {
  if (!hasKey()) {
    return `I notice a theme of honesty and alignment in what you wrote. There's a tenderness here too — a wish to be fully yourself. What would it feel like to honor that need before making others comfortable?`;
  }
  try {
    return await chat(
      [
        {
          role: 'user',
          content: `You are a compassionate journaling companion. Read this entry and respond in 3-5 sentences: briefly name one theme you noticed, one emotion that seems present, and ask one gentle, open-ended question to sit with. Do not give advice. Do not solve problems. Just reflect.
Focus areas: ${focusAreas.map((f) => f.title).join(', ')}.
Entry: """${entryText}"""`,
        },
      ],
      { maxTokens: 200 }
    );
  } catch (err) {
    console.error('reflectOnEntry LLM error, using fallback:', err.message);
    return `I notice a theme of wanting to be honest with yourself, and a quiet courage underneath it. What is one thing you're ready to acknowledge today?`;
  }
}

// Free-form AI Guide conversation (PRD §6 Screen 12).
export async function guideReply({ message, history = [], profile, focusAreas = [] }) {
  if (!hasKey()) {
    return `It sounds like something meaningful is moving in you. Let's slow down together — what feels most unknown or unsettled right now, and what would feel supportive in this moment?`;
  }
  try {
    const msgs = [
      {
        role: 'user',
        content: `Context — profile: ${JSON.stringify(profile)}; focus areas: ${focusAreas
          .map((f) => f.title)
          .join(', ')}.`,
      },
      ...history.map((h) => ({ role: h.role === 'ai' ? 'assistant' : 'user', content: h.content })),
      { role: 'user', content: message },
    ];
    return await chat(msgs, { maxTokens: 350 });
  } catch (err) {
    console.error('guideReply LLM error, using fallback:', err.message);
    return `I'm here with you. Tell me a little more about what's present for you right now.`;
  }
}

// Pattern Recognition (Phase 2 AI). One caring observation across recent entries.
export async function patternInsight({ entries = [] }) {
  if (!hasKey()) {
    const moods = entries.map((e) => e.mood || e.mood_after).filter(Boolean);
    const common = moods.length ? moods.sort((a, b) =>
      moods.filter((m) => m === b).length - moods.filter((m) => m === a).length)[0] : null;
    return common
      ? `Something I've noticed in your writing lately: the word "${common}" keeps surfacing. It may be asking for a little more of your attention.`
      : `Something I've noticed: you keep returning to the page. That consistency itself is a quiet form of self-respect.`;
  }
  try {
    const text = entries
      .map((e) => `- (${(e.created_at || '').slice(0, 10)}) ${(e.journal_text || '').slice(0, 220)}`)
      .join('\n')
      .slice(0, 3500);
    return await chat(
      [
        {
          role: 'user',
          content: `Read these recent journal entries and name ONE emotional or thematic pattern in 1-2 warm sentences. Begin with "Something I've noticed in your writing lately". Be caring, not clinical. No advice.\n${text}`,
        },
      ],
      { maxTokens: 160 }
    );
  } catch (err) {
    console.error('patternInsight LLM error, using fallback:', err.message);
    return `Something I've noticed in your writing lately: you keep returning to the page, and that steadiness matters.`;
  }
}

// Conversation Mode (Phase 2 AI). Synthesize a dialogue into a flowing entry.
export async function conversationToEntry({ history = [] }) {
  const transcript = history
    .map((h) => `${h.role === 'ai' ? 'Guide' : 'Me'}: ${h.content}`)
    .join('\n');
  if (!hasKey()) {
    return history.filter((h) => h.role !== 'ai').map((h) => h.content).join('\n\n')
      || 'Today I sat with my thoughts and let them surface.';
  }
  try {
    return await chat(
      [
        {
          role: 'user',
          content: `Turn this reflective conversation into a flowing first-person journal entry (2-3 short paragraphs). Keep the user's voice and feelings; drop the question/answer format.\n\n${transcript}`,
        },
      ],
      { maxTokens: 400 }
    );
  } catch (err) {
    console.error('conversationToEntry LLM error, using fallback:', err.message);
    return history.filter((h) => h.role !== 'ai').map((h) => h.content).join('\n\n');
  }
}

// Weekly growth summary (PRD §6 Screen 14).
export async function weeklySummary({ entries = [], focusAreas = [] }) {
  if (entries.length === 0) {
    return 'You have not journaled yet this period. When you are ready, even a few honest minutes can reveal a meaningful pattern.';
  }
  if (!hasKey()) {
    return `This period, your reflections centered around emotional safety, self-trust, and creating stronger boundaries. Your next growth edge may be expressing your needs more clearly without overexplaining.`;
  }
  try {
    const text = entries.map((e) => e.journal_text).join('\n---\n').slice(0, 4000);
    return await chat(
      [
        {
          role: 'user',
          content: `Summarize the emotional themes across these journal entries in 2-3 sentences and name one growth edge. Warm, non-clinical.
Focus areas: ${focusAreas.map((f) => f.title).join(', ')}.
Entries:\n${text}`,
        },
      ],
      { maxTokens: 200 }
    );
  } catch (err) {
    console.error('weeklySummary LLM error, using fallback:', err.message);
    return 'This period your writing returned to themes of clarity and self-trust. A gentle next step may be honoring one need without overexplaining it.';
  }
}
