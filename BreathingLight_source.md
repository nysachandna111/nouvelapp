# BreathingLight.tsx — source code (viewable copy)

This is a preview copy of the component so you can read it in chat. Give your developer the actual BreathingLight.tsx file.

```tsx
// BreathingLight.tsx
// A config-driven breathing guide with an animated aurora light.
// Dependencies:
//   npm install react-native-reanimated @shopify/react-native-skia expo-haptics
// (Reanimated also needs its babel plugin — see instructions in chat.)

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useDerivedValue,
  withTiming,
  Easing,
  cancelAnimation,
  runOnJS,
} from 'react-native-reanimated';
import { Canvas, Circle, BlurMask, Group } from '@shopify/react-native-skia';
import * as Haptics from 'expo-haptics';

// ---------------------------------------------------------------------------
// 1. THE DATA MODEL — every breathing exercise is just config.
//    To add a new practice, add an object here. Nothing else changes.
// ---------------------------------------------------------------------------

export type Phase = {
  label: 'Inhale' | 'Hold' | 'Exhale';
  cue: string;
  seconds: number;
  scale: number;      // how large the light grows (1 = resting size)
  brightness: number; // 0..1 opacity of the glow layers
};

export type Practice = {
  id: string;
  name: string;
  pattern: string;
  palette: [string, string, string]; // three glow layers, like the reference
  phases: Phase[];
};

export const PRACTICES: Practice[] = [
  {
    id: 'box',
    name: 'Box breathing',
    pattern: '4-4-4-4',
    palette: ['#F0997B', '#7F77DD', '#FAC775'], // coral / purple / amber aurora
    phases: [
      { label: 'Inhale', cue: 'Breathe in quietly through the nose for four seconds', seconds: 4, scale: 1.45, brightness: 0.85 },
      { label: 'Hold',   cue: 'Hold the breath gently, shoulders soft',               seconds: 4, scale: 1.45, brightness: 0.6 },
      { label: 'Exhale', cue: 'Release slowly through the mouth for four seconds',    seconds: 4, scale: 0.7,  brightness: 0.35 },
      { label: 'Hold',   cue: 'Rest empty before the next breath',                    seconds: 4, scale: 0.7,  brightness: 0.25 },
    ],
  },
  {
    id: 'relax478',
    name: '4-7-8 relax',
    pattern: '4-7-8',
    palette: ['#AFA9EC', '#534AB7', '#ED93B1'],
    phases: [
      { label: 'Inhale', cue: 'Breathe in through the nose for four seconds', seconds: 4, scale: 1.45, brightness: 0.85 },
      { label: 'Hold',   cue: 'Hold softly for seven seconds',                seconds: 7, scale: 1.45, brightness: 0.55 },
      { label: 'Exhale', cue: 'Exhale fully through the mouth for eight seconds', seconds: 8, scale: 0.7, brightness: 0.25 },
    ],
  },
  {
    id: 'coherent',
    name: 'Coherent calm',
    pattern: '5-5',
    palette: ['#85B7EB', '#5DCAA5', '#B5D4F4'],
    phases: [
      { label: 'Inhale', cue: 'Slow, even breath in for five seconds',  seconds: 5, scale: 1.45, brightness: 0.8 },
      { label: 'Exhale', cue: 'Slow, even breath out for five seconds', seconds: 5, scale: 0.7,  brightness: 0.3 },
    ],
  },
  {
    id: 'energize',
    name: 'Energize',
    pattern: '6-2',
    palette: ['#F0997B', '#FAC775', '#E24B4A'],
    phases: [
      { label: 'Inhale', cue: 'Deep expanding breath in for six seconds', seconds: 6, scale: 1.5, brightness: 0.9 },
      { label: 'Exhale', cue: 'Quick release for two seconds',            seconds: 2, scale: 0.7, brightness: 0.3 },
    ],
  },
];

// ---------------------------------------------------------------------------
// 2. THE AURORA — three blurred Skia circles offset from center.
//    scale + brightness are Reanimated shared values, so the light
//    animates on the UI thread at 60fps even during JS work.
// ---------------------------------------------------------------------------

const CANVAS = 300; // px, square canvas the glow lives in
const CENTER = CANVAS / 2;

// Offsets give the multi-hued, off-center look from the reference photo.
const LAYER_OFFSETS = [
  { x: -34, y: -26, r: 78 },
  { x: 36,  y: -18, r: 78 },
  { x: 0,   y: 34,  r: 68 },
];

type AuroraProps = {
  palette: [string, string, string];
  scale: Animated.SharedValue<number>;
  brightness: Animated.SharedValue<number>;
};

function Aurora({ palette, scale, brightness }: AuroraProps) {
  // Derived values feed Skia directly — no re-renders per frame.
  const layers = LAYER_OFFSETS.map((o, i) => {
    const cx = useDerivedValue(() => CENTER + o.x * scale.value);
    const cy = useDerivedValue(() => CENTER + o.y * scale.value);
    const r  = useDerivedValue(() => o.r * scale.value);
    const opacity = useDerivedValue(() => brightness.value * (1 - i * 0.15));
    return { cx, cy, r, opacity, color: palette[i] };
  });

  return (
    <Canvas style={{ width: CANVAS, height: CANVAS }}>
      <Group>
        {layers.map((l, i) => (
          <Circle key={i} cx={l.cx} cy={l.cy} r={l.r} color={l.color} opacity={l.opacity}>
            {/* The blur is what creates the soft light. Tune 28–45 to taste. */}
            <BlurMask blur={34} style="normal" />
          </Circle>
        ))}
      </Group>
    </Canvas>
  );
}

// ---------------------------------------------------------------------------
// 3. THE PHASE ENGINE — a tiny state machine that walks the phases
//    and drives the animations. Pausing freezes both timer and light.
// ---------------------------------------------------------------------------

export default function BreathingLight({ practice = PRACTICES[0] }: { practice?: Practice }) {
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [running, setRunning] = useState(true);

  const scale = useSharedValue(1);
  const brightness = useSharedValue(0.5);
  const progress = useSharedValue(0); // 0..1 through the current phase

  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const phaseStart = useRef(0);       // timestamp when phase began
  const remaining = useRef(0);        // ms left when paused

  const phase = practice.phases[phaseIdx];

  const advance = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); // eyes-closed cue
    setPhaseIdx((i) => (i + 1) % practice.phases.length);
  }, [practice]);

  // Start (or restart) the current phase's animation + timer.
  const startPhase = useCallback((ms: number) => {
    const easing = Easing.inOut(Easing.ease);
    scale.value = withTiming(phase.scale, { duration: ms, easing });
    brightness.value = withTiming(phase.brightness, { duration: ms, easing });
    progress.value = withTiming(1, { duration: ms, easing: Easing.linear });

    phaseStart.current = Date.now();
    remaining.current = ms;
    timeout.current = setTimeout(() => runOnJS(advance)(), ms);
  }, [phase, advance]);

  // New phase → reset progress and kick off animations.
  useEffect(() => {
    progress.value = 0;
    if (running) startPhase(phase.seconds * 1000);
    return () => { if (timeout.current) clearTimeout(timeout.current); };
  }, [phaseIdx, practice.id]);

  // Practice switched from outside → jump back to phase 0.
  useEffect(() => { setPhaseIdx(0); }, [practice.id]);

  const togglePause = () => {
    if (running) {
      // Freeze: cancel animations mid-flight and remember time left.
      if (timeout.current) clearTimeout(timeout.current);
      remaining.current -= Date.now() - phaseStart.current;
      cancelAnimation(scale);
      cancelAnimation(brightness);
      cancelAnimation(progress);
    } else {
      startPhase(Math.max(remaining.current, 50));
    }
    setRunning((r) => !r);
  };

  const barStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>{practice.name} · {practice.pattern}</Text>

      <View style={styles.stage}>
        <Aurora palette={practice.palette} scale={scale} brightness={brightness} />
        <Text style={styles.phaseLabel}>{phase.label}</Text>
      </View>

      <Text style={styles.cue}>{phase.cue}</Text>

      <View style={styles.track}>
        <Animated.View style={[styles.bar, { backgroundColor: practice.palette[0] }, barStyle]} />
      </View>

      <Pressable
        onPress={togglePause}
        accessibilityLabel={running ? 'Pause' : 'Resume'}
        style={styles.pauseBtn}
      >
        <Text style={styles.pauseIcon}>{running ? '❚❚' : '▶'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#151222',
    alignItems: 'center',
    paddingTop: 64,
    paddingHorizontal: 24,
  },
  title: { color: '#8D89A3', fontSize: 14, marginBottom: 8 },
  stage: {
    width: CANVAS,
    height: CANVAS,
    alignItems: 'center',
    justifyContent: 'center',
  },
  phaseLabel: {
    position: 'absolute',
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '300',
    letterSpacing: 1,
  },
  cue: {
    color: '#B9B5CC',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 21,
    minHeight: 42,
    marginTop: 12,
    marginBottom: 24,
  },
  track: {
    alignSelf: 'stretch',
    height: 3,
    borderRadius: 2,
    backgroundColor: '#2B2839',
    overflow: 'hidden',
    marginBottom: 32,
  },
  bar: { height: '100%' },
  pauseBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: '#4A4462',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pauseIcon: { color: '#FFFFFF', fontSize: 16 },
});
```
