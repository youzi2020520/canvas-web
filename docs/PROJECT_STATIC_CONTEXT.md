# Codex-Canvas Static Project Context

This file contains durable facts that should be reused across tasks. Read task-specific code, diffs, logs, and test results only when they are relevant or changed.

## Product Background

- Codex-Canvas is a project-local infinite canvas plugin for Codex. It stores visual assets, jobs, and canvas state under the active project's `canvas/` directory.
- The primary experience is split between Codex chat and a local canvas shown in Codex's in-app browser.
- Each bound Codex thread has an isolated canvas scope and image collection path. Generated images must not be collected from unrelated projects or threads.
- Core AI features include image generation, Quick Edit, Remove BG, Expand, Edit Text, Edit Elements, slide composition, and PPTX export.

## Technical Architecture

- Runtime: Node.js 18.18+ using ECMAScript modules. The frontend is dependency-light HTML/CSS/JavaScript under `public/`.
- Entry points: `bin/codex-canvas.mjs` -> CLI/runtime modules in `src/`; `src/server.mjs` exposes the local HTTP API and static UI.
- Persistence: `src/store.mjs` owns canvas objects and state; `src/paths.mjs` owns project/thread-scoped paths.
- AI execution: the frontend sends stable action IDs; backend job modules map actions to dedicated skills and launch Codex/ImageGen through supported cross-platform integrations.
- Canvas image jobs: `src/jobs.mjs`; slide jobs: `src/slides-jobs.mjs`; Codex child execution: `src/codex-runner.mjs`.
- Slide pipeline: brief/references -> AI requirement extraction -> explicit confirmation of goal/audience/scenario/length -> AI outline (source-first, with safe AI-authored editable draft points when source content is sparse) -> explicit outline confirmation (read-only collapsible global storyline + editable page roles and detailed per-page content) -> formal generation -> template binding (deterministic palette/typography/shape/chart/image language, falling back to automatic planning when templateId is freeform) -> specialist skill routing -> structured slide frames -> deterministic layout and validation -> charts/diagrams/generated visuals -> targeted quality repair -> canvas import -> editable PPTX export. Outline approval is always explicit; page-level density, silhouette, and specialist routes remain internal AI planning data rather than separate user confirmations.
- Slide skill routing lives in `src/slides-skill-router.mjs`. Stable specialist skills cover composition, charts, diagrams, generated visuals, and final quality review.
- Slide template system: `skills/slide-templates/` holds schema (`schema.json`) and seed templates under `templates/`; `src/slide-templates.mjs` exposes `loadTemplate(id)` / `listTemplates()` / `isFreeformTemplate(id)` / `resolvePageRoleSlot(template, roleKey)`. `job.deckTemplateId` binds a deck to a template (default `freeform`); when bound, `compose-professional-slides` must load the design system from the template instead of planning freely (see the skill's "Template Binding" section). `deckTemplateId` is distinct from `slide-frame.templateId` (page role: cover/section/insight/comparison/process/data/case-study/solution/roadmap/summary/freeform). `src/slide-template-mapper.mjs` exposes `mapBriefToTemplate(brief)` / `normalizeBrief(brief)` — a deterministic keyword-and-scoring mapper (no AI calls) that maps an `optimize-slide-brief` output (topic/goal/audience/scenario/narrative/style/recommendedPageCount) to a deckTemplateId plus confidence; confidence below 0.6 returns top-3 recommendations instead of a single pick.
- Slide diagram presets: `skills/slide-diagram-presets/` holds schema (`schema.json`) and 12 seed presets under `presets/` (SWOT / funnel / pyramid / comparison / org-tree / timeline + process-flow / fishbone / radar / value-chain / kpi-dashboard / cycle-loop); `src/slide-diagram-presets.mjs` exposes `loadPreset(id)` / `listPresets()` / `inferPresetFromOutline(text)` with a 12-group `PRESET_KEYWORDS` table. `normalizeOutline` in `src/slides-jobs.mjs` auto-binds a per-page `presetId` from each outline page's title/message/visual/keyPoints; `presetBindingSection(job)` injects the matched presets' full definitions into `slidesPrompt`, and `writeSlidePlan` serializes `presetId` into `slide-plan.json`. When a page's `presetId` is non-null, `create-slide-diagram` must use the preset's family/layout/slots/visualSpec instead of designing freely (see the skill's "Preset Binding" section).
- Structured slides use a canonical 1024x576 design frame. `src/slides-layout-engine.mjs` provides intent inference via the 11-rule `INTENT_RULES` table (keyword + positional, explicit enumerable list), archetype mapping (`archetypeForIntent`), safe-area layouts (`SLIDE_LAYOUTS` data), deterministic positioning, and pre/post validation. `collectLayoutIssues(frame)` returns a structured issue list (`{id, severity, elementId, message}`) with 6 check types: cyclic-parent / invalid-geometry / out-of-bounds / parent-clip / safe-area (error) + low-contrast / text-overlap (warning); `validatePostLayout` keeps the throw contract by throwing the first error. `collectDataAccuracyIssues(elements, index)` (in `src/slides-jobs.mjs`) returns data-accuracy issues: `simulated-without-disclosure` (error, simulated chart lacking the demo label) + `key-data-without-source` (warning, material data or non-simulated chart without a visible source attribution); `validateSimulatedDataDisclosure` delegates to it and keeps the throw contract. `buildQualityReport(slides)` (in `src/slides-jobs.mjs`) aggregates both collectors per page at generation finalize and attaches `job.qualityReport` (`{layoutIssues, dataIssues, summary:{pages,errors,warnings}}`), exposed via `publicJob`; the PPTX `fidelity` report is attached separately to the `exportSlidesPptx` return value.
- Generated structured-slide layers are flattened after layout into independent slide-absolute elements with `parentId:null`, `positionMode:free`, and no auto-layout container. Legacy nested layers are normalized before flattening; visible group surfaces become shape layers, while image masks and rounded crops are merged directly into the image layer.
- `src/pptx-export.mjs` builds and verifies editable `.pptx` packages locally, preserving text, shapes, media, gradients, and font fallbacks where supported. `verifyExportFidelity(pptxBuffer, originalFrames, expectedSlides)` aligns exported shapes through stable element names and checks slide/shape counts, geometry, fills, font family/class and size, alpha, gradients, rounded geometry, masks, image crops, and animation timing structure. Invalid geometry, font sizes, and crop values receive one safe normalized re-export attempt; unresolved critical fidelity issues block download. `src/slides-export.mjs` reuses that PPTX renderer and the bundled cross-platform document runtime to export PDF, numbered page PNGs in ZIP, and a vertically stitched long PNG.
- Element-level animation system (phase 1 complete): 8 OOXML presets (entrance fade/appear/fly-in/wipe/zoom, emphasis pulse/spin, exit fade-out) registered in `src/pptx-animation-presets.mjs`, a list-style animation editor in the slide frame editor (`public/app.js`), per-element trigger/duration/delay, `buildTimingXml` generating OOXML timing trees, and post-export timing validation (cTn id uniqueness, spid references, row count, trigger read-back). CSS animation preview in the slides presentation (`playSlideAnimations` + `ANIMATION_CSS_MAP` in `public/app.js`) plays entrance/emphasis/exit effects with on_click/with_previous/after_previous timing; the editor's "preview" button replays animations on the current shell. Phase 2 remaining: full 203-preset library, Morph transitions, interactiveSeq trigger shapes, and a WPS playback/save regression matrix.

## Coding Rules

- Preserve macOS and Windows compatibility. Do not implement core behavior with AppleScript, Windows UI automation, coordinate clicking, or simulated keystrokes in Codex.
- Prefer browser, plugin, MCP/tool, CLI, or other Codex-supported cross-platform surfaces.
- Use mature icon sets such as Tabler or Lucide for toolbar and dock icons. Keep stroke weight, radius, and visual weight consistent. Document any unavoidable custom icon.
- Keep deterministic interactions in local app code: pan, zoom, drag, select, delete, drawing, text editing, toolbar visibility, language settings, and viewport framing.
- Model AI operations as dedicated skills plus backend job actions. Skills must define intent, inputs, preservation rules, outputs, and canvas placement.
- Frontend code sends stable action IDs and must not embed operation-specific AI prompts.
- Preserve editable layers. Do not flatten text, vectors, charts, diagrams, and bitmap visuals when they serve independent editing purposes.
- Do not use emoji, dingbats, Unicode arrows, or font glyphs as slide decoration; use SVG or shared icons.

## Fixed Slide and Business Constraints

- Slide generation accepts 1-20 pages and requires a deck plus a non-empty presentation brief.
- User-confirmed titles, claims, order, factual qualifiers, and preservation requests take priority.
- A supplied PPTX is a structural/visual reference, not permission to copy unrelated wording, logos, or unsupported claims.
- Supplied slide screenshots are binding visual evidence: generation must infer composition, hierarchy, page rhythm, spatial depth, and image material language rather than matching only their palette.
- Slide content defaults to AI-first complete drafting: missing names, examples, dates, claims, research-style findings, outcomes, and quantitative values are generated without authenticity checks, source requirements, placeholders, or simulated-data disclosure labels. User-supplied content always takes priority and replaces the affected AI draft when provided.
- Keep meaningful content within the slide safe area and readable at presentation distance.
- Generated bitmap visuals must not contain baked-in words, labels, logos, watermarks, UI chrome, editable slide text, or vector diagrams.
- Quality repair is targeted: preserve passing pages and regenerate only failing pages/elements. Aesthetic findings such as text fit, overlap, safe-area proximity, visual variety, bitmap count, masks, and dominant-visual strength are non-blocking quality-center warnings; only structural, asset-integrity, and data-disclosure failures block generation.
- Slide composition is isolated per page. A failed page receives two automatic repair attempts, then remains as a persisted, manually deletable failure page while later pages continue.
- Deck-wide AI transformation accepts fixed actions or a free-text instruction and always validates structure before preview/apply/restore. The structured slide editor also supports strict selected-element AI modification; every non-target object remains protected and the result enters the local undo/redo history before save.
- The centralized slide quality center performs a fresh deck audit on demand, combines page layout, generation, and data-accuracy findings, checks supplied chart source labels and dates, detects cross-slide URL/label/date conflicts, compares dominant font families and repeated three-page visual compositions, filters by severity/source/consistency, and navigates directly to affected pages.
- When a deck-wide quality revision leaves one isolated page failure, the pipeline performs one additional protected page-only repair before failing the job.
- Independent bitmap visuals may generate with a concurrency limit of two; planning, slide composition, and final deck review remain quality-first stages.
- Final outputs and important claims require human review; template fidelity and advanced PowerPoint features may still need manual correction.

## Test and Verification Rules

- Default test command: `npm test` (the Node smoke suite in `scripts/smoke.mjs`).
- Visual smoke: `npm run smoke:visual`; visual regression: `npm run visual:regression`.
- Release checks: `npm run verify:release`, `npm run build:release`, and `npm run verify:archive` as relevant.
- CI runs on Ubuntu, macOS, and Windows with Node 18.18 and Node 22; Python 3.11 plus Pillow and NumPy support image-processing tests.
- Match verification depth to risk: focused checks for local changes, full smoke for shared backend/store/API changes, visual checks for UI/layout changes, and release checks for packaging/version changes.
- Do not treat prior test results as static context. Read or run fresh tests after relevant code changes.

## Versioning

- The current custom project release is `0.37.2`.
- Substantial user-visible feature releases automatically increment the minor version; compatible fixes and small improvements increment the patch version; breaking releases increment the major version.
- Keep project, lockfile, plugin manifest, runtime display, and changelog versions aligned. Do not infer permission to commit, tag, push, publish, or install from a version bump.

## Dynamic Information That Must Be Refreshed

- Current git diff/status, changed files, uncommitted work, dependency versions, release state, active runtime state, new requirements, logs, failures, generated artifacts, and test results.
- README and roadmap claims when they conflict with current code. Confirm implementation status from the relevant source and tests.
