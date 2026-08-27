---
name: compose-professional-slides
description: Plan and compose a professional presentation by routing each page to chart, diagram, bitmap-visual, and quality-review capabilities. Use for AI slide outlines, full deck generation, narrative replanning, or converting a short brief into a coherent deck.
---

# Compose Professional Slides

## Workflow

1. Establish the audience, goal, scenario, page count, evidence, and visual direction.
   When a PPTX reference is supplied, use its extracted slide sequence, theme colors, aspect ratio, text hierarchy, density, and media as binding reference evidence.
2. Build a narrative arc with one communication job per page. Use cover and conclusion pages as bookends; include navigation only when the page count or topic complexity benefits from it.
3. Establish one confirmed deck design system: palette roles, typography hierarchy, shape language, image language, and chart language.
4. Build a page-by-page visual rhythm plan. Assign every page a treatment, density, silhouette, and specialist route; never repeat the same silhouette on consecutive pages.
5. Route quantitative evidence to `$create-slide-chart`, relationships and processes to `$create-slide-diagram`, and photographic or illustrative focal points to `$generate-slide-visual`.
6. Produce structured 1024x576 Frame JSON with stable, independently movable layers.
7. Run `$review-slide-quality` on every page and the whole deck before accepting it.

## User confirmation flow

- Combine the narrative path, chapter groupings, page roles, page titles, and key messages into one outline confirmation. Do not ask the user to confirm requirements, storyline, page structure, and page outline on separate screens.
- Treat outline confirmation as a complete page-by-page content-draft review. Each page should expose its title, subtitle or key claim, lead, substantive content points, optional emphasis quote, narrative logic, and speaker notes so the user can control the actual message before visual generation.
- Preserve every confirmed content-draft field during visual generation. Do not silently replace confirmed copy with a thinner generic outline.
- Keep the deck design system, treatment, density, silhouette, and specialist routing as internal planning data. Do not add a separate visual-system confirmation in the default flow; derive it automatically from the brief, references, and confirmed outline.
- After the outline confirmation, begin generation directly. Advanced visual controls may exist only as an explicit expert mode.

Read [contracts.md](references/contracts.md) for the page-role and routing contract.

## Preservation Rules

- Preserve user-confirmed titles, claims, order, and explicit edits; user-provided content always overrides AI-authored draft content.
- Use explicit prompt copy and parsed source material before authoring new content.
- When sources do not contain enough content points, create substantive editable draft copy from domain-general knowledge: explanations, frameworks, recommendations, hypothetical examples, options, and action steps. Do not leave content pages empty when safe conceptual material can be proposed.
- Complete the entire deck with AI-authored names, people, organizations, dates, quotations, examples, research-style findings, results, and quantitative values when the user has not supplied them. Do not add authenticity checks, source requirements, placeholders, or simulated-data disclosures.
- Keep AI-authored details internally consistent across the deck. When the user later supplies replacement content, apply it as the new source of truth without preserving the earlier AI draft.
- Treat a supplied PPTX as a structural and visual reference, not as permission to copy its unrelated wording, logos, or unsupported claims.
- Maintain a shared deck system while varying page silhouette and reading path.
- Treat a user-confirmed design system and visual rhythm plan as binding during generation and regeneration.
- Keep text, vector, bitmap, and container layers separate when they serve separate editing purposes.
- Never express decorative graphics with emoji, dingbats, or font glyphs.

## Template Binding

- When the deck `deckTemplateId` is bound to a concrete template ID (non-`freeform`), Workflow step 3 "Establish one confirmed deck design system" must load the system from that template instead of planning freely. Template definitions live in [../slide-templates/schema.json](../slide-templates/schema.json) and [../slide-templates/templates/](../slide-templates/templates/). Backend loader is `src/slide-templates.mjs` (`loadTemplate(id)` / `listTemplates()`).
- `deckTemplateId` is the deck-level template binding (e.g., `annual-report-business-chart`), distinct from `slide-frame.templateId` which holds the page role (cover/section/insight/comparison/process/data/case-study/solution/roadmap/summary/freeform). Do not confuse the two.
- Template fields are deterministic constraints, not suggestions:
  - Palette must use the eight `palette.roles` hex values declared in the template; do not introduce off-template colors.
  - Typography must stay within each `typography.roles` entry's `fontFamily` stack, `sizeRange`, `weight`, and `lineHeight`.
  - Shape language (corner radius, shadow, border width) must follow the template's `shape` field.
  - Chart series colors must use the template's `chart.palette` in order; chart font, grid, and axis colors must match.
  - Image language must follow the template's `image.language`, `image.treatment`, and `image.cropStyle` when generating or selecting visuals.
- Each page's role must be one of the keys in the template's `pageRoleSlots`; that entry's `layout` archetype and `slots` list are binding. When the deck uses a page role not declared in the template, fall back to the layout-engine's default archetype for that role, but visual specs (color, typography, shape) remain template-bound.
- When `templateId` is `freeform` or missing, keep the existing "automatic visual-system planning" behavior; no template constraint applies.
- Density inherits from the template's top-level `density`, overridden per-page when the `pageRoleSlots` entry declares its own `density`.

## Output Requirements

- Emit the requested page count and no empty pages.
- Use concise presentation copy and real visual hierarchy.
- Keep all meaningful content inside the safe area.
- Request specialist visual work only when it communicates the page more clearly.
