# Breathing light feature — implementation guide

Hand this document to Claude Code along with the reference file `BreathingLight.tsx`. It contains everything needed to integrate the feature: what to build, how it should behave, and how to verify it's done.

---

## What we're building

A guided breathing screen where a soft, multi-colored light ("aurora") expands, holds, and contracts in sync with the user's breath. The light itself is the instruction — users should be able to follow a session with eyes half-closed, guided purely by brightness and motion. Each breathing practice (box breathing, 4-7-8, coherent breathing, energize) has its own color palette and timing, all driven by config.

Visual reference: a dark indigo screen (#151222) with three overlapping blurred circles of light (coral, purple, amber) behind a large phase label ("Inhale"), a one-line cue below, a thin progress bar, and a circular pause button.

## Stack and dependencies

The app is React Native. Install:

```bash
npm install react-native-reanimated @shopify/react-native-skia expo-haptics
```

- Add `'react-native-reanimated/plugin'` as the **last** plugin in `babel.config.js`.
- Rebuild the native app after installing (Skia and Reanimated are native modules).
- If the project is bare React Native (not Expo), use `react-native-haptic-feedback` instead of `expo-haptics`.

## Architecture requirements

**1. Practices are pure config, never code.**
Every breathing exercise is a `Practice` object: `{ id, name, pattern, palette: [c1, c2, c3], phases: Phase[] }`. Each `Phase` is `{ label, cue, seconds, scale, brightness }`. Adding a new technique must require only adding one object to the config — no component changes. Keep the config in its own module (e.g. `practices.ts`) so it can later be fetched from the backend or extended with user-created practices.

Ship these four practices initially (exact values are in `BreathingLight.tsx`):

| Practice | Pattern | Palette mood | Phases |
|---|---|---|---|
| Box breathing | 4-4-4-4 | coral / purple / amber | inhale 4s → hold 4s → exhale 4s → hold 4s |
| 4-7-8 relax | 4-7-8 | lavender / deep purple / pink | inhale 4s → hold 7s → exhale 8s |
| Coherent calm | 5-5 | blue / teal / pale blue | inhale 5s → exhale 5s |
| Energize | 6-2 | coral / amber / red | inhale 6s → exhale 2s |

**2. The aurora is Skia, not Views.**
Render three `Circle` elements on a Skia `Canvas`, each with a `BlurMask` (blur ≈ 34, tune 28–45). Offset each circle from center so the colors overlap like the reference. Plain RN Views cannot produce this soft glow — do not substitute opacity-only circles.

**3. Animations run on the UI thread.**
`scale` and `brightness` are Reanimated shared values. Skia circle positions, radii, and opacities are `useDerivedValue`s computed from them, so there are zero React re-renders per frame and the light animates at 60fps regardless of JS-thread load. Animate with `withTiming` using `Easing.inOut(Easing.ease)`, with duration equal to the phase's `seconds * 1000` — the light must move for exactly the length of the breath.

**4. Phase engine behavior.**
A small state machine walks the phase array in a loop:
- On phase start: animate scale + brightness to the phase targets over the phase duration; a linear 0→1 `progress` value drives the progress bar.
- On phase end: fire a light haptic (`Haptics.impactAsync(Light)`) and advance to the next phase (wrapping).
- Inhale grows the light (scale ≈ 1.45–1.5) at high brightness; holds keep the current size but dim slightly (so hold-after-inhale reads differently from inhale without text); exhale shrinks (scale ≈ 0.7) and dims further.

**5. Pause must freeze mid-breath, not restart.**
Pausing cancels the in-flight animations (`cancelAnimation`) and records remaining phase time. Resuming continues the same phase with the remaining duration. Restarting the phase on resume is a bug.

## Integration tasks

1. Drop `BreathingLight.tsx` into the components directory and split the `PRACTICES` config into `practices.ts`.
2. Add a practice-picker entry point in the app's existing navigation: a screen or sheet listing the four practices (name + pattern), navigating to `<BreathingLight practice={selected} />`.
3. Add a session header matching the existing meditation flow ("Meditate for N minutes" with a close button) above the breathing screen, wired to the app's session-duration setting.
4. When the session timer ends, fade `brightness` to 0 over ~6 seconds instead of stopping abruptly, then show the app's existing session-complete state.
5. Respect the OS reduced-motion setting: if enabled, keep the light static at mid-scale and animate brightness only.
6. Match fonts, spacing, and the close/header components to the app's existing design system — the styles in `BreathingLight.tsx` are reference values, not final design tokens.

## Acceptance criteria

- [ ] All four practices selectable; switching practices resets to phase 1 of the new practice.
- [ ] Light expansion/contraction duration exactly matches each phase's configured seconds.
- [ ] Glow is soft and blurred (Skia), overlapping three palette colors, on the dark background.
- [ ] Phase label and cue text update at every phase change; progress bar fills linearly per phase.
- [ ] Haptic tap fires on every phase transition.
- [ ] Pause freezes the light mid-animation; resume completes the same phase with correct remaining time.
- [ ] Adding a fifth practice object to config makes it fully work with no component edits.
- [ ] No dropped frames during animation with JS-thread work running (verify with the perf monitor).
- [ ] Reduced-motion setting is respected.

## Suggested Claude Code prompt

> Read IMPLEMENTATION_GUIDE.md and BreathingLight.tsx in this directory. Integrate the breathing light feature into our app following the guide: install the dependencies, split the practices config into its own module, wire the component into our navigation with a practice picker, connect the session timer with the end-of-session fade-out, and adapt the styles to our design system. Then verify each acceptance criterion and show me what's left.
