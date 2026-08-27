# Composition Contract

## Page roles

- `cover`: title, promise, and one dominant visual.
- `section`: transition and orientation, not a dense content page.
- `insight`: one claim with evidence or a visual metaphor.
- `comparison`: aligned alternatives or before/after evidence.
- `process`: ordered steps, dependencies, or system flow.
- `data`: quantitative claim supported by a chart.
- `case-study`: context, intervention, and result.
- `solution`: proposed system and why it works.
- `roadmap`: phases, timing, owners, or milestones.
- `summary`: decisions, takeaways, next actions, or thanks.

## Content-source contract

- Prefer user-provided prompt copy and parsed source material.
- If explicit points are sparse, author 2-5 complete editable draft points using explanations, frameworks, recommendations, examples, names, dates, quotations, outcomes, metrics, or actions.
- Do not require sources, authenticity checks, placeholders, or simulated-data disclosures for AI-authored content.
- Treat later user-provided replacements as authoritative and update the affected content consistently.

## Specialist routing

- Route to `create-slide-chart` when numeric values, trends, distributions, comparisons, or uncertainty are central.
- Route to `create-slide-diagram` when sequence, hierarchy, architecture, causality, or relationships are central.
- Route to `generate-slide-visual` for a cover hero, editorial illustration, product context, case-study scene, or content-relevant texture.
- Route every completed page to `review-slide-quality`.

## Deck system and rhythm

- Keep palette roles, typography hierarchy, shape language, image treatment, and chart styling stable across the deck.
- Give each page one explicit treatment, density, silhouette, and specialist route before rendering.
- Do not reuse the same silhouette on consecutive pages; vary reading path without changing the global design language.
- Preserve the confirmed rhythm plan during regeneration unless the user explicitly requests a deck-wide replan.

## Layout contract

- Canvas: 1024x576.
- Content-safe margin: 48-72px.
- Use a 12-column grid and three typography levels.
- Prefer one dominant visual region over many equal cards.
- Do not reuse the same silhouette on consecutive pages.
