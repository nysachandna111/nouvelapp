// ✍️ Writing Modes (Phase 2, Section 2). One shared editor, driven by a mode
// config: header text, tagline, placeholder, prompt/timer visibility, and any
// mode-specific data (templates, recipients, guided prompts). Never six screens.

export const MODES = {
  standard: {
    key: 'standard', emoji: '✎', title: 'Guided Prompt',
    tagline: 'Reflect on today’s prompt',
    placeholder: 'Write freely…', showPrompt: true,
  },
  freewrite: {
    key: 'freewrite', emoji: '✏️', title: 'Free Write',
    tagline: 'What’s on your mind?',
    placeholder: 'Write freely about anything…', showTimer: true, showWordCount: true,
  },
  scripting: {
    key: 'scripting', emoji: '✨', title: 'Scripting',
    tagline: 'Write as if it’s already real',
    opening: 'Today I’m scripting my reality. I write as if it’s already done.',
    affirmation: 'Write boldly. Your words shape your world.',
    placeholder: 'I am so grateful that…',
    templates: [
      { id: 'ideal-day', title: 'My Ideal Day', starters: ['I wake up feeling...', 'My days are filled with...', 'I am so grateful that...'] },
      { id: 'relationship', title: 'My Relationship Vision', starters: ['I am surrounded by love that...', 'In my closest relationships I feel...', 'Together we...'] },
      { id: 'career', title: 'My Career & Purpose', starters: ['My work allows me to...', 'I am recognized for...', 'Each day I contribute...'] },
      { id: 'health', title: 'My Health & Body', starters: ['I move my body and feel...', 'I nourish myself by...', 'My energy is...'] },
      { id: 'inner', title: 'My Inner World', starters: ['My mind feels...', 'I speak to myself with...', 'At peace, I am...'] },
    ],
  },
  braindump: {
    key: 'braindump', emoji: '🌪️', title: 'Brain Dump',
    tagline: 'Clear your mind. Leave it all here.',
    header: 'Dump everything. Don’t edit. Don’t judge.',
    placeholder: 'Let it all out…', loose: true, burn: true,
  },
  letter: {
    key: 'letter', emoji: '💌', title: 'Letter Writing',
    tagline: 'Some things are easier to say in a letter',
    prompt: 'What do you most want them to know?',
    placeholder: 'Dear one,',
    recipients: ['Future Self', 'Past Self', 'My Younger Self', 'Someone I Need to Forgive', 'My Highest Self', 'Someone I Miss', 'My Body', 'My Fear'],
  },
  dream: {
    key: 'dream', emoji: '🌙', title: 'Dream Journal',
    tagline: 'Capture it before it fades',
    twilight: true,
    placeholder: 'It began somewhere soft…',
    prompts: ['What do you remember?', 'Who was there?', 'How did it feel?', 'Any symbols or images?'],
  },
  gratitude: {
    key: 'gratitude', emoji: '🙏', title: 'Gratitude',
    tagline: 'Three good things',
    gratitude: true,
    fields: ['1. I’m grateful for...', '2. Today I appreciate...', '3. Something that made me smile...'],
  },
  conversation: {
    key: 'conversation', emoji: '💬', title: 'Journal with your guide',
    tagline: 'The guide asks, you respond',
    chat: true,
  },
};

// Order shown in the mode picker grid.
export const MODE_ORDER = ['standard', 'freewrite', 'gratitude', 'braindump', 'scripting', 'letter', 'dream', 'conversation'];

export const modeLabel = (k) => (MODES[k] || MODES.standard).title;
export const modeEmoji = (k) => (MODES[k] || MODES.standard).emoji;
