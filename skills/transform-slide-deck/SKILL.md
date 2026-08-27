---
name: transform-slide-deck
description: Transform an existing presentation as a whole while preserving its slide order, element identities, layout geometry, facts, charts, and locked content. Use for deck-wide requests such as making every slide more businesslike, shortening all copy by about 30%, or applying one consistent dark brand style after a deck has been generated.
---

# Transform Slide Deck

Apply one controlled deck-wide transformation and return structured slide data that the host application can validate, preview, apply, and restore.

## Inputs

- Read `source-deck.json` from the job directory.
- Use the requested `actionId`:
  - `businesslike`: improve clarity, hierarchy, tone, and restrained professional styling.
  - `shorten-30`: reduce editable prose by roughly 30% without removing essential meaning.
  - `dark-brand`: convert visual styling to a coherent dark brand system without rewriting content.
  - `custom`: follow the supplied free-text instruction within all preservation rules.
- A custom request may include a strict slide and element scope. When present, every object outside that scope must remain byte-for-byte unchanged.
- Treat slide IDs, element IDs, element types, parent relationships, geometry, z-order, and chart data as immutable structure.

## Preservation Rules

1. Keep the same number and order of slides.
2. Keep every existing element ID exactly once on its original slide.
3. Do not change `type`, `parentId`, `x`, `y`, `width`, `height`, `rotation`, or element order.
4. Never modify an element marked `locked` or `aiLocked`.
5. Never invent facts. Preserve names, dates, quantities, percentages, currencies, citations, and chart source data.
6. Preserve the presentation's narrative and page intent. Do not add or remove pages or elements.
7. Keep text within the available geometry. Prefer shorter wording over smaller text.

## Action Rules

### `businesslike`

- Replace casual or repetitive wording with concise professional language.
- Strengthen headings and parallel structure.
- Use restrained typography, spacing, and color changes only within existing element bounds.
- Do not change numeric claims or their meaning.

### `shorten-30`

- Target a 25%–35% reduction in editable prose across the whole deck.
- Keep titles, essential qualifiers, evidence, and calls to action intelligible.
- Do not shorten citations, source labels, proper nouns, numeric facts, or locked content.
- Change text only; preserve visual styles unless a tiny fit adjustment is necessary.

### `dark-brand`

- Preserve all text verbatim.
- Use a consistent dark background, high-contrast text, restrained accent color, and readable chart palette.
- Preserve chart values, series names, and categories.
- Do not move, resize, add, or remove elements.

### `custom`

- Apply only changes directly required by the supplied instruction.
- Keep facts, citations, chart data, element geometry, identities, and locked content unchanged.
- Under strict element scope, modify only that element and return all other content unchanged.

## Output

Write `transformed-deck.json` in the job directory with:

```json
{
  "actionId": "businesslike",
  "slides": [],
  "summary": {
    "changedSlides": 0,
    "changedElements": 0,
    "beforeCharacters": 0,
    "afterCharacters": 0,
    "highlights": []
  }
}
```

Return complete slide and element objects, including unchanged fields. Do not emit Markdown, commentary, or additional files. If a request conflicts with a preservation rule, keep the protected value unchanged.
