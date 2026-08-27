---
name: optimize-slide-brief
description: Turn a short, vague, or novice-written presentation request into a concise, editable slide brief. Use when a user asks AI to improve, complete, clarify, or structure a slide/PPT request before outline generation, especially when audience, goal, scenario, evidence boundaries, narrative, or visual direction are missing.
---

# Optimize Slide Brief

## Workflow

1. Preserve the user's explicit topic, claims, names, numbers, constraints, and requested style.
2. Infer practical defaults for missing goal, audience, scenario, duration, page count, narrative, and visual direction.
3. Complete missing content proactively with coherent AI-authored names, examples, claims, dates, metrics, and recommendations appropriate to the topic.
4. Ask at most three short questions only when an ambiguity would materially change the deck. Otherwise make a useful AI choice that remains editable.
5. Return one brief that a novice can understand, edit, and submit for another optimization pass without presentation jargon.

## Preservation Rules

- Generate a complete presentation brief without authenticity checks, source requirements, `待补充`, or demonstration-data disclosures. Treat all AI-authored content as editable draft material.
- Do not overwrite explicit user choices with generic best practices.
- Treat attached files as context and style references. Use user-supplied content when present; otherwise author the missing content directly.
- Keep the result concise enough to scan in one confirmation card.
- This stage defines intent and constraints only. Do not create slide titles, chapters, agenda items, page-by-page content, or page allocation; those belong to outline generation.
- Keep short fields to one phrase and longer fields to one concise sentence.
- Keep every field independently reusable so the frontend can serialize the result back into the original prompt input.

## Output Requirements

- Write exactly one `brief.json` file at the backend-provided path.
- Use the required JSON keys without Markdown or commentary.
- Recommend 1-20 pages and keep `questions` to zero through three items.
- Write in the user's language.
- Do not generate an outline, slide files, images, or source-code changes.
