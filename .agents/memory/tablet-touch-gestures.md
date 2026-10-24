---
name: Tablet touch gestures
description: Browser gesture conflicts observed when verifying the parking side panel.
---

Do not rely solely on pointerup for panel swipes inside the scrollable lot list. Keep touch-movement handling available through pointercancel, and consume native screen-edge gestures in the dedicated reopening strip.

**Why:** Chromium touch testing emitted pointercancel followed by touchmove/touchend instead of pointerup inside the nested list. A left-edge gesture also navigated browser history before the app could reopen its panel.

**How to apply:** When changing panel gestures, verify horizontal close, vertical list scrolling, and edge reopening separately in a touch-enabled browser. Preserve normal map gestures outside the narrow edge strip.
