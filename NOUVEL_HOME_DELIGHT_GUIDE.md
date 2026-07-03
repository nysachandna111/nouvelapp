# Nouvel home screen — "ink and vine" delight guide

Hand this document to Claude Code inside the app repo. It specifies the opening animation and living-vine feature for the home screen. The design intent, behavior, data model, and acceptance criteria are all here.

---

## Design intent (read this first)

Nouvel's identity is calm, editorial, cream-and-serif. This feature adds delight through craft and meaning, not decoration:

1. **The opening feels like a pen touching paper.** On app open, a botanical vine stem draws itself up the right edge of the screen, then a slightly imperfect gold underline sketches itself beneath the "Today's focus" headline. Content (greeting → headline → prompt card → practice card → nav) fades up in a gentle stagger.
2. **The vine is a living record.** Each day the user journals, one leaf unfurls on the vine with a small springy scale-in. It is not a streak counter — missing a day adds no leaf but removes nothing. The vine only ever grows.
3. **Color lives in details.** Gold ink (#C99A3F), sage greens (#9A8F5F, #B7AB6C), warm terracotta label accents (#A4763A) against the existing cream (#F7F4EC) and ink text (#2B2823). No background washes, no gradients behind content.

The hand-drawn wobble in the underline and stem is deliberate. Do not straighten the paths.

## Stack

React Native. Install if not present:

```bash
npm install react-native-reanimated react-native-svg expo-haptics
```

- `'react-native-reanimated/plugin'` must be the last plugin in `babel.config.js`; rebuild natives after install.
- Vector work uses `react-native-svg` with Reanimated (`createAnimatedComponent(Path)` + animated `strokeDashoffset` / `transform` props).
- If this screen ships on web too (Expo web / React), the same spec applies — SVG `stroke-dasharray`/`stroke-dashoffset` transitions replace the Reanimated props one-to-one.

## Components to build

### 1. `InkStroke` — self-drawing path

A reusable animated SVG path. Props: `d`, `stroke`, `strokeWidth`, `duration`, `delay`.

Mechanism: measure path length, set `strokeDasharray = length` and animate `strokeDashoffset` from `length` to `0` with `withDelay(delay, withTiming(0, { duration, easing: Easing.out(Easing.ease) }))`. This is the standard line-drawing technique; get path length via `path.getTotalLength()` on web or precompute/props on native (react-native-svg paths can be measured with `getTotalLength()` on ref, or pass a known length).

Used for: the vine stem (≈1600ms, 200ms delay), the gold underline (≈900ms, starting ~1000ms in), any future flourish strokes.

### 2. `Vine` — the living record

An absolutely positioned SVG column (~60pt wide) along the right edge of the home screen, behind content but above the background.

- **Stem**: a single meandering cubic-bezier path from bottom to top, stroke #9A8F5F at 1.4pt. Drawn with `InkStroke` on every app open.
- **Leaves**: small closed leaf paths placed at ~10 predefined anchor points along the stem (alternating sides, alternating #9A8F5F / #B7AB6C fills). Render `min(journaledDays, anchors.length)` leaves.
- **Unfurl animation**: when a new day is recorded, the newest leaf scales from 0 → 1 around its anchor with an overshoot spring (`withSpring` or `Easing.bezier(0.34, 1.56, 0.64, 1)`, ~800ms) plus a light haptic.
- **Data**: leaf count comes from the journaling store — the number of distinct calendar days with at least one entry in the current "chapter". Wire to the real store; do not keep local state as the source of truth.
- **Beyond 10 leaves**: at each full vine, add a flower at the top (milestone moment with a slightly larger spring + medium haptic), then begin a second interleaved stem, or reset the vine for the next "chapter". Pick whichever fits the product's chapter model; confirm with the team before implementing.

### 3. Opening choreography

Orchestrate on home-screen mount (and only on cold open / foreground-after-long-background, not on every tab switch):

| Time | Event |
|---|---|
| 0ms | Screen visible, content at opacity 0 / translateY 12pt |
| 200ms | Vine stem begins drawing (1600ms) |
| 500ms | Greeting fades up |
| 680ms | Focus headline fades up |
| 860ms | Prompt card fades up |
| 1000ms | Gold underline begins drawing (900ms) |
| 1040ms | Practice card fades up |
| 1220ms | Bottom nav fades up |
| ~1500ms | Existing leaves pop in with 60ms stagger, oldest first |

Total under 2 seconds. Each fade: opacity + translateY, 900ms, ease-out. Use a single timeline (shared clock or chained `withDelay`s), not scattered `setTimeout`s.

### 4. Micro-interactions

- Prompt card: on press-in, scale to 1.015 and warm the border to #D9A15E; restore on release (150–400ms).
- "Journal on this" button: scale 0.97 on press-in, back on release.
- Tapping the vine opens a small sheet showing "N days of writing this chapter" with the dates — the vine should be touchable and meaningful, not just decorative.

## Constraints

- Respect the OS reduced-motion setting: skip stroke-drawing and staggering; show everything at rest, and swap the leaf spring for a simple fade.
- The opening must never block interaction — all buttons are tappable from frame one.
- 60fps: all animated values are Reanimated shared values on the UI thread; no per-frame setState.
- Match the app's existing fonts and spacing tokens; hex values above are design intent, map them into the theme file rather than hardcoding in components.

## Acceptance criteria

- [ ] Cold open plays the full choreography in under 2s; tab switches do not replay it.
- [ ] Stem and underline visibly draw themselves; paths keep their hand-drawn irregularity.
- [ ] Leaf count always equals distinct journaled days from the real store; journaling today adds exactly one leaf with the unfurl spring + haptic.
- [ ] Missing days never removes leaves.
- [ ] Vine is tappable and shows the days-written detail.
- [ ] Reduced motion shows a static, complete screen with fades only.
- [ ] No dropped frames during the opening with the perf monitor on.
- [ ] All hex values live in the theme, not inline.

## Suggested Claude Code prompt

> Read NOUVEL_HOME_DELIGHT_GUIDE.md. Implement the ink-and-vine home screen experience it describes: build the InkStroke and Vine components with react-native-svg + Reanimated, wire the leaf count to our journaling store, add the opening choreography timeline and micro-interactions, and respect reduced motion. Then walk through each acceptance criterion and show me what passes.
