# Parent Dashboard Banner Redesign

**Date:** 2026-05-10
**Status:** Approved

## Summary

Refactor the parent homepage banner (currently inline JSX in `ParentView.tsx` lines 624-696) into a standalone `DashboardBanner` component with modern + playful childlike style, smooth entrance animations, and responsive layout across all device sizes.

## Current State

Two separate elements in the dashboard tab of `ParentView.tsx`:
1. **Welcome header** (lines 624-629): Plain text greeting + subtitle, no visual flair
2. **Gradient leaderboard card** (lines 631-696): Full-width gradient card with child points display

Problems:
- PC/tablet: elements cramped, poor spacing
- Mobile: awkward short-line wrapping
- No animation, visually flat
- Two disconnected elements feel fragmented

## Target Design

**Style:** 炫彩活泼型 (Colorful Playful) — multi-color gradient, large emoji decorations, glass-morphism stat cards

**Layout:**
- Single unified `DashboardBanner` component
- Gradient: `from-brand via-purple-500 to-pink-500`
- Top: Greeting line with wave emoji (`👋` + name)
- Middle: Encouragement subtitle
- Bottom: Child data display
  - **1 child:** Large centered card with name, points, task count
  - **2+ children:** Responsive grid (2-col mobile → 3-col tablet → 4-5 col desktop)
  - **0 children:** Empty state with CTA
- Decorative: Large semi-transparent emoji backgrounds (`🌟`, `⭐`, `🎈`)

**Animation (initial mount only):**
1. Banner card: slide from right + fade in (500ms, ease-out)
2. Sparkle particles: 3-5 stars float from behind card (800ms, 100ms delay)
3. Greeting text: fade up (400ms, 200ms delay)
4. Child cards: staggered pop-up, 80ms between each (350ms/ea, 250ms start delay)
5. Respect `prefers-reduced-motion`: disable all animations

**Responsive Breakpoints:**
- Mobile (default): grid-cols-2, compact padding
- Tablet (sm: 640px): grid-cols-3
- Desktop (lg: 1024px): grid-cols-4
- Wide (xl: 1280px): grid-cols-5

**No-wrapping strategy:**
- `whitespace-nowrap` on name labels
- `truncate` with `min-w-0` parent
- Fixed-width child card containers

## Technical Plan

1. Create `src/components/Parent/DashboardBanner.tsx`
2. Extract banner code from `ParentView.tsx` dashboard tab
3. Add Framer Motion `motion.div` variants
4. Use `useState` flag to prevent animation replay
5. Update `ParentView.tsx` to import and render `DashboardBanner`
6. Remove old inline banner JSX

## Edge Cases

| Case | Handling |
|------|----------|
| 0 children | Empty state: "添加第一个孩子吧~" + link to family management |
| 1 child | Single highlight card with large points + task count |
| 2-6 children | Grid display with responsive columns |
| 6+ children | Show top 6 + "查看全部" link |
| Long names | CSS truncate + title attribute for full name |
| Theme switch | Gradient start follows `--color-brand`; via/to fixed for consistent vibe |
| Tab re-entry | No animation replay (mount-once flag) |
| Reduced motion | All animations disabled, instant display |
