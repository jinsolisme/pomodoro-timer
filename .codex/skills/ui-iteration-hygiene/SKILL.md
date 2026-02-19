---
name: ui-iteration-hygiene
description: Drive fast, high-accuracy frontend visual iteration loops with minimal repetition. Use when a user gives many sequential UI tweak requests (size, spacing, shadows, color, overlap, drag behavior), reports "still looks wrong" after refresh, or asks to preserve meaningful fixes from repeated adjustments.
---

# UI Iteration Hygiene

Use this skill to execute repeated UI tweak cycles without losing state, repeating the same edits, or misdiagnosing cache/layout issues.

## Workflow

1. Ground once before editing.
- Read the exact component and style files that own the requested visual.
- Identify one source of truth for geometry constants and one for container/background layers.

2. Convert "feel" feedback into explicit knobs.
- Promote tweak targets into named constants (`RADIUS`, `POINTER_W`, `SHADOW_ALPHA`, etc.).
- Prefer changing those knobs over scattered literal edits.

3. Separate preview state from committed state.
- If dragging/gestures are involved, expose live preview values to parent UI.
- Keep commit behavior on release (`onDragEnd`) and preview behavior during interaction (`onDragPreview`).

4. Resolve background and inset artifacts systematically.
- Check all wrapper layers (page shell, outer frame, inner frame).
- Remove or lower shadow/inner-shadow alpha when users report beige/dirty edges.

5. Handle refresh/cache complaints with deterministic steps.
- Reopen with a cache-busting query string (`?v=<timestamp>`).
- Re-check computed layers instead of repeating random color edits.

6. Validate after logic or interaction changes.
- Run a build/type check after TypeScript or state-flow edits.
- Confirm expected behavior with mouse and touch paths when drag logic changed.

7. Keep a micro-changelog during iteration.
- Record each knob changed and direction (e.g., `SECTOR_R 108 -> 96`).
- Use this log to avoid undo/redo loops and to summarize quickly.

## Project Hotspots (Pomodoro Timer)

- `src/components/AnalogDial.tsx`: dial geometry, center knob/pointer, drag-to-time behavior.
- `src/components/AnalogDial.css`: dial size and layout overlap with header.
- `src/styles/app.css`: page/outer/main backgrounds and shadow artifacts.
- `src/App.tsx`: MMSS display priority and preview-vs-running state wiring.

## Anti-Patterns to Avoid

- Changing only one container background when multiple nested wrappers render visible edges.
- Repeating visual tweaks without promoting literals to named constants.
- Treating every mismatch as cache without checking layer/shadow sources.
- Waiting for drag end to update all UI when real-time feedback is expected.

## Quick Acceptance Checklist

- Dragging updates user-visible time immediately.
- Releasing drag commits timer value once and starts expected behavior.
- No unintended beige/gray edge from wrappers or inner shadows.
- Dial visuals do not overlap header text at target viewport sizes.
- Build passes after behavioral changes.

## References

- Load `references/iteration-lessons.md` for concrete patterns from this project.
