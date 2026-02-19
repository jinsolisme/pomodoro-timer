# Iteration Lessons

## Repeated Pain Points

- Beige edge persisted because color was changed in one layer but not all nested wrappers.
- Dial tuning took many cycles because radius/pointer values were adjusted incrementally without a single tracked knob list.
- User-perceived cache issues created extra reopen loops.

## High-Value Fixes

- Set all visible background layers consistently and reduce inner-shadow alpha.
- Keep dial geometry in explicit constants for fast directional changes.
- Add drag preview channel (`onDragPreview`) so header MMSS updates before release.
- Reset preview state explicitly on timer reset to avoid stale display.

## Practical Loop

1. Read owning files and map visual ownership.
2. Apply one coherent knob update.
3. Build/check behavior if logic changed.
4. Open localhost with cache-busting query when needed.
5. Capture delta and continue.
