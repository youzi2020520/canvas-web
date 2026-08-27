---
name: review-slide-quality
description: Audit and repair presentation slides for hierarchy, layout, crop, visual meaning, consistency, accessibility, and structured editability. Use after generation or when slides look clipped, repetitive, sparse, or visually weak.
---

# Review Slide Quality

## Workflow

1. Review narrative continuity and whether every page has one clear communication job.
2. Inspect bounds, safe margins, text fit, collisions, contrast, image crop, and layer structure.
3. Compare adjacent pages for repeated silhouettes and weak focal points.
4. Check charts for numerical honesty, diagrams for clear direction, and generated images for relevance.
5. Repair only failing pages while preserving confirmed content and page order.
6. After generated bitmaps are resolved, run a final post-asset review. Repair only the failing page files, then rerun the same checks once.

Read [rubric.md](references/rubric.md) and reject any hard failure.

## Output Requirements

- Return a pass or targeted repair result for every page.
- Never regenerate or rewrite pages that passed the final post-asset review.
- Preserve independent movable layers.
- Do not solve overflow by shrinking all text below presentation-readable size.
- Use SVG instead of decorative text glyphs.
