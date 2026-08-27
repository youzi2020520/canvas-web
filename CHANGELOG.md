# Changelog

## 0.38.0 (2026-08-27)

- Added dual runtime support: existing Codex stdio MCP remains local-first while ChatGPT can connect to a new Streamable HTTP MCP endpoint.
- Added a ChatGPT MCP App UI resource that renders the hosted Codex-Canvas board and a web-safe tool set.
- Added GPT Image 2 generation/editing and Responses API text generation for the web runtime.
- Added a persistent single-tenant web project, Nginx/PM2 deployment examples, remote Codex config example, and web runtime security guards.

## 0.37.2 (2026-08-26)

- Fixed AI Slides canvas movement to use the board's world coordinates instead of raw client-pixel deltas, so drag placement stays accurate while zoomed or panned.
- Unified AI Slides visual bounds with drop-target hit testing and made new persisted deck dimensions match the displayed `1280 × 900` canvas frame.

## 0.37.1 (2026-08-26)

- Fixed single-page AI regeneration losing the original page's content and deck visual context.
- Regeneration now inherits editable page copy, page layout intent, deck palette, background, fonts, confirmed design system, visual rhythm, brand profile, and template binding.

## 0.37.0 (2026-08-26)

- Reworked the structured-slide editor's format action into a proper right-side dock, matching the animation editing workflow instead of overlaying the canvas.
- Made format and animation docks mutually exclusive, added persistent layout selection, and made background application update every page in the active deck.

## 0.36.3 (2026-08-26)

- Unified editor toolbar panel state with `aria-expanded` feedback and prevented format, animation, and insert menus from competing for focus.
- Added accessible region labels and close actions for the format and animation panels, plus reduced-motion-safe panel transitions.

## 0.36.2 (2026-08-26)

- Removed the redundant “编辑页面 / Edit page” action from the slide preview header; page editing remains available from the selected canvas slide toolbar and each thumbnail's secondary menu.
- Fixed a duplicate `updateHistoryButtons` initialization that raised a runtime error before the structured slide editor could mount.

## 0.36.1 (2026-08-26)

- Added CSS animation preview in the slides presentation: `playSlideAnimations` + `ANIMATION_CSS_MAP` play entrance/emphasis/exit effects with on_click/with_previous/after_previous timing; spacebar/click/next trigger the next on_click group before advancing slides.
- Added a "preview" button in the slide frame editor's animation panel that replays animations on the current shell.
- Updated static context to document the animation preview capability.

## 0.36.0 (2026-08-26)

- Added element-level animation system (phase 1): 8 OOXML presets (entrance fade/appear/fly-in/wipe/zoom, emphasis pulse/spin, exit fade-out) registered in `src/pptx-animation-presets.mjs`.
- Added a list-style animation editor in the slide frame editor (`public/app.js`) with per-element trigger/duration/delay, add/delete rows, and real-time patch to the backend.
- Rewrote `buildTimingXml` in `src/pptx-export.mjs` to generate OOXML timing trees from `animation.groups` with three trigger types (on_click/with_previous/after_previous), cumulative offset, and `entrance_appear` 1ms non-scaling.
- Extended `verifyExportFidelity` with animation timing validation: cTn id uniqueness, spid references, row count, and trigger read-back.
- Added `pptx animation export` smoke test covering fidelity, timing XML structure, and appear 1ms duration.
- Updated static context to reflect phase 1 completion; phase 2 (full 203-preset library, Morph, interactiveSeq, WPS regression matrix) remains.

## 0.35.1 (2026-08-26)

- 修复整套 AI 修改逐页预览中“全不选”导致卡片半透明、旧修改选项穿透显示的问题。
- 未选页面现在使用不透明的浅灰背景和虚线边框表达排除状态，应用按钮在零选择时显示明确的禁用样式。

## 0.35.0 (2026-08-26)

- Added a slide-by-slide whole-deck AI modification review with before/after previews and change-type summaries.
- Added select all, select none, and per-slide acceptance so only approved pages are applied.
- Limited undo to the pages actually applied during the last deck-wide modification.

## 0.34.1 (2026-08-26)

- Fixed the deck-wide impact confirmation opening behind the AI modification dialog.
- Temporarily made the underlying dialog inert while confirmation is active and restored it after apply or discard.
- Styled “Apply changes” as a normal confirmation instead of a destructive red action.

## 0.34.0 (2026-08-26)

- Reworked whole-deck AI modification into an explicit select, preview impact, confirm, apply, and undo flow with affected-page summaries.
- Added consistent toolbar styling, localized transformation presets, keyboard dismissal, focus states, and responsive action scrolling.
- Renamed the misleading always-warning “Quality issues” action to the neutral “Quality check” and clarified its audit scope.

## 0.33.4 (2026-08-26)

- Made isolated Codex img2 jobs automatically inherit the active Codex login authorization, matching slide text and structure jobs.
- Kept credentials outside the project and plugin package while preventing anonymous image requests that returned HTTP 401.

## 0.33.3 (2026-08-26)

- Separated visual-service authentication failures from slide quality failures so a global 401 no longer marks every preserved page as failed.
- Added a recovery path that retries visual generation after authentication is restored or imports every retained draft without unavailable bitmap visuals.
- Exposed the failed stage and failure category to show actionable recovery copy instead of the misleading quality-repair message.

## 0.33.2 (2026-08-26)

- Fixed the dotted canvas background stopping at a stale workspace boundary after an internal layout resize.
- Synchronized the grid canvas CSS size and high-DPI backing store with the live board dimensions, using resize-frame coalescing to avoid redundant redraws.

## 0.33.1 (2026-08-26)

- Changed slide-generation timing to measure active work time instead of wall-clock time, freezing elapsed time and ETA from the moment pause is requested.
- Persisted accumulated pause duration and resumed the elapsed timer from its previous value while recalculating ETA against the latest progress state.
- Unified planning, generation, status badges, completion duration, cancellation duration, and backend progress logs on the same pause-aware elapsed-time source.

## 0.33.0 (2026-08-25)

- Changed the default slide content mode to AI-first complete drafting, generating missing names, examples, dates, claims, metrics, findings, and recommendations without authenticity checks or placeholders.
- Removed mandatory source requests and simulated-data disclosure labels from AI-authored presentation content while preserving user-provided content as the highest-priority replacement source.
- Updated brief optimization and professional slide composition skills to use the same AI-generated content contract throughout planning and generation.

## 0.32.0 (2026-08-25)

- Displayed planned image-generation prompts as clear inline chips on every outline page that requests imagery, including ordinary content pages, with a shared icon treatment matching the reference workflow.
- Added deck-wide typography consistency and three-page composition repetition comparisons to the centralized quality center.
- Added a dedicated cross-slide consistency filter alongside source consistency, warnings, and blocking errors.

## 0.31.0 (2026-08-25)

- Reclassified aesthetic slide checks as non-blocking quality-center warnings, including clipped text, overlap, safe-area proximity, visual variety, title hierarchy, dominant visual size, bitmap count, masks, and SVG decoration.
- Kept invalid files, duplicate identifiers, invalid geometry, hard frame overflow, cyclic/clipped hierarchy, invalid SVG, manifest integrity, and missing simulated-data disclosure as blocking errors.
- Made bitmap generation optional when a valid deck does not request visual assets, and normalized missing image crop settings locally instead of launching an AI repair pass.

## 0.30.1 (2026-08-25)

- Renamed the generation-time quality bypass action to the shorter “Skip and continue”.
- Made the pause control switch immediately to “Resume” while a task is waiting for its safe pause point, so users can cancel a pending pause without waiting for the current AI operation to finish.

## 0.30.0 (2026-08-25)

- Added an explicit “Skip quality check” control for page-attributed quality repairs, with confirmation and live continuation into visual generation and import.
- Preserved the last valid page draft before stopping an active AI repair, then marked the skipped page for manual follow-up in the quality center.
- Kept structural, unreadable-file, and deck-manifest failures non-skippable so bypassing visual quality cannot corrupt the presentation workflow.

## 0.29.1 (2026-08-25)

- Changed generation-time quality repair from repeated full-deck passes to page-attributed repair whenever an error contains a slide number, including wrapped validation errors.
- Limited page quality repair to two attempts and deck-wide repair to one attempt, with shorter timeouts and visible repair attempt progress.
- Retained pages that still fail quality repair, recorded their failure state, and continued the remaining visual, review, and import stages.

## 0.29.0 (2026-08-25)

- Added a centralized slide quality issue center with live deck auditing, severity filters, summaries, and direct navigation to affected pages.
- Unified layout, generation-failure, data-accuracy, missing-source, and missing-as-of-date findings in one report.
- Added cross-slide source consistency checks for conflicting URLs, labels, and as-of dates.

## 0.28.0 (2026-08-25)

- Added free-text whole-deck AI transformations using the dedicated transform skill, with structural validation, preview confirmation, and restore support.
- Added selected-element AI editing inside the structured slide editor, with strict scope protection and local undo/redo before save.
- Protected slide order, geometry, IDs, locked content, chart data, facts, and every object outside a selected-element edit scope.

## 0.27.0 (2026-08-25)

- Added deterministic slide-deck export to PDF, a ZIP package of numbered page PNGs, and one vertically stitched long PNG.
- Reused the existing PowerPoint renderer as the single export source, then converted and rasterized locally for consistent page geometry across formats.
- Added a compact export menu alongside editable PPTX export.

## 0.26.0 (2026-08-25)

- Isolated AI slide generation per page so a page failure no longer aborts the entire presentation.
- Added two automatic page repair attempts, persisted failed-page state, continued later pages, and imported a clearly marked placeholder that can be manually deleted.
- Kept generation progress and completed pages visible on fatal interruptions instead of clearing the task and returning to the input home.

## 0.25.0 (2026-08-25)

- Expanded PowerPoint fidelity verification to cover element geometry, font size, alpha, gradients, rounded geometry, masks, and image crops using stable exported shape identities.
- Added one safe automatic re-export repair for invalid or out-of-bounds geometry, font sizes, and crop values, and blocked downloads when critical visual fidelity remains unresolved.

## 0.24.22 (2026-08-25)

- Reduced Slides generation I/O by throttling and deduplicating job-state snapshots, reusing each polling directory scan, streaming Codex logs through one file handle, and restoring protected repair files only when changed.

## 0.24.21 (2026-08-25)

- Isolated slides job state db via per-job `CODEX_HOME` temp directory so concurrent Codex CLI processes no longer contend for `~/.codex/state_N.sqlite` write locks, preventing `Operation not permitted` failures during slide generation.
- Preserved Codex authentication inside the isolated Slides environment and surfaced the actionable API failure instead of a trailing shutdown log.

## 0.24.20 (2026-08-25)

- Preserved absolute free-position slide geometry after AI quality repairs so deterministic layout cannot reintroduce overlaps.
- Made quality-stage failures recoverable with retained previews, targeted multi-page repair attempts, and retry without regenerating completed drafts.
- Kept the third-step generation view open when quality review fails, including recoverable page state returned by the backend.

## 0.24.19 (2026-08-25)

- Unified AI PPT elapsed-time labels as minutes and seconds, such as “已用时 13 分 13 秒”.
- Applied the same clock format to outline planning, slide regeneration, generation history, and remaining-time estimates.

## 0.24.18 (2026-08-25)

- Fixed nested Codex CLI jobs failing to initialize with `Operation not permitted` when Canvas runs inside a Codex session.
- Isolated child job processes from host sandbox and thread markers while preserving task-specific settings.

## 0.24.17 (2026-08-25)

- Replaced the start-generation button's rotating outline with a clipped left-to-right light sweep.
- Changed the active button label to “生成中...” and restored “开始生成” after a failed request.

## 0.24.16 (2026-08-25)

- Restored a safe top inset for the third-step workflow status so it remains inside the generation card.
- Added a compact mobile inset without sacrificing the adaptive one-page layout.

## 0.24.15 (2026-08-25)

- Removed the duplicated overall percentage from the generation status summary.
- Formatted long generation durations as minutes and seconds with a clear elapsed-time label.

## 0.24.14 (2026-08-25)

- Made the third-step generation workspace shrink to its content instead of reserving large fixed blank areas.
- Limited scrolling to the thumbnail region only when multiple rows require it.
- Changed the five-stage generation indicator to wrap responsively instead of overflowing horizontally.

## 0.24.13 (2026-08-25)

- Removed the redundant per-thumbnail draft, quality, visual, and final-review track.
- Kept the live page status beside each page number as the single page-level status indicator.

## 0.24.12 (2026-08-25)

- Replaced the redundant generation-step eyebrow with the persistent three-stage workflow navigation.
- Fixed per-page draft, quality, visual, and final-review tracks inheriting the slide preview's 16:9 aspect ratio.

## 0.24.11 (2026-08-25)

- Shortened the outline approval action to “确认大纲”.
- Matched the outline approval button to the established black primary-action style.

## 0.24.10 (2026-08-25)

- Kept the three-stage workflow indicator visible through requirement confirmation, outline confirmation, and visual generation.
- Added distinct completed, current, and upcoming states with an accessible current-step marker.

## 0.24.9 (2026-08-25)

- Preserved generated slide drafts and the generation gallery when a quality gate fails.
- Added an in-place “Repair and continue” recovery action instead of forcing the user back to the start screen.
- Exempted intentional locked gradient tone overlays from the unrelated-panel obstruction check.

## 0.24.8 (2026-08-25)

- Added a per-page workflow track below every live slide preview for draft, quality, visual, and final-review stages.
- Updated thumbnail status copy continuously through quality checking, visual checking, final checking, and import.
- Added reduced-motion-aware sheen and stage-pulse animations to make every active generation action visible.

## 0.24.7 (2026-08-25)

- Added source-first content drafting for slide key points.
- Allowed safe AI-authored explanations, frameworks, recommendations, hypothetical examples, and actions when source content is sparse.
- Kept evidence-sensitive facts protected: unsupported names, dates, quotations, policies, citations, research findings, and claimed results remain placeholders rather than fabricated claims.

## 0.24.6 (2026-08-25)

- Removed the redundant full-form “Confirm how this presentation should work” screen.
- Migrated saved legacy brief-review states directly into requirement confirmation.
- Kept outline-start failures on requirement confirmation instead of returning to the obsolete form.

## 0.24.5 (2026-08-25)

- Renamed the entry action from “Generate outline” to “Start generating”.
- Replaced visible analysis-status copy with an animated trace around the submit button.
- Kept analysis progress available to assistive technology and respected reduced-motion preferences.

## 0.24.4 (2026-08-24)

- Replaced editable narrative controls with a read-only outline-storyline summary card.
- Added a persistent expand/collapse control for the narrative path, presentation type, and chapter responsibilities.
- Preserved all detailed page editing, reordering, deletion, and page-addition controls below the storyline.

## 0.24.3 (2026-08-24)

- Added a dedicated delete control to every user-created requirement option while keeping AI recommendations protected.
- Persisted custom-option identity separately from recommended choices.
- Automatically selects the first remaining option when the currently selected custom option is deleted.

## 0.24.2 (2026-08-24)

- Rebalanced requirement confirmation into a narrower reading column with consistent option grids and stronger heading hierarchy.
- Prevented option selection from rebuilding the entire confirmation screen, eliminating scroll jumps and visual flicker.
- Reset the outer workspace to the top only when entering requirement confirmation and improved responsive stacking at tablet and phone widths.

## 0.24.1 (2026-08-24)

- Flattened requirement confirmation into one workspace surface instead of a nested modal-style card.
- Removed the inner requirement-list scrollbar so the outer slide workspace is the only scrolling region.
- Simplified borders, shadows, padding, and the footer behavior while preserving all requirement choices and custom input controls.

## 0.24.0 (2026-08-24)

- Reworked outline confirmation around an editable deck-wide narrative framework, chapter plan, and detailed page plan.
- Removed creative-intent and generic presentation-type summaries from the outline confirmation screen.
- Preserved detailed per-page editing, drag reordering, page-role controls, deletion, and adding a content page before the closing page.
- Removed automatic outline approval so formal generation requires an explicit confirmation.

## 0.23.0 (2026-08-24)

- Added a three-stage slide workflow: requirement confirmation, outline confirmation, and formal generation.
- Added AI-derived confirmation choices for goal, audience, presentation scenario, and recommended deck length, with optional user notes.
- Prevented requirement confirmation from starting slide generation and required explicit outline approval before formal generation.

## 0.22.1 (2026-08-24)

- Separated one-click brief rewriting from the Generate Outline action.
- Kept automatic slide-count evaluation in the background and proceeded directly to outline planning without changing the user's text.

## 0.22.0 (2026-08-24)

- Flattened generated Frame contents into independent, slide-absolute editable layers.
- Removed invisible groups and auto-layout containers from generated slide output.
- Preserved visible group surfaces as ordinary shape layers.
- Merged image masks and rounded crops directly into their image layer so they move together.
- Automatically normalised legacy grouped Frames when opened in the page editor.

## 0.21.0 (2026-08-24)

- Added project-local enterprise brand profiles with enforced colors, typography, brand identity, and footer rules.
- Applied brand profiles as binding generation constraints without changing confirmed content or data.
- Removed the obsolete full-flow regression-test deck from the active canvas.

## 0.20.0 (2026-08-24)

- Added intent-based single-slide AI modification while preserving the rest of the deck.
- Added real, simulated, and placeholder data provenance editing for charts, including source and as-of fields.
- Persisted page-level quality results and displayed them directly on slide thumbnails.
- Strengthened bound diagram preset routing for deterministic business diagrams.

## 0.19.0 (2026-08-24)

- Added user-selectable recommended templates in the outline confirmation workflow.
- Added supplied, simulated, and placeholder data modes as explicit generation controls.
- Displayed final quality warnings after successful generation.
- Added a PowerPoint fidelity preflight before download, blocking critical failures and disclosing compatibility warnings.

## 0.18.0 (2026-08-24)

- Preserved chart data provenance fields across Canvas storage and editing.
- Exposed template confidence and alternative recommendations in the outline workflow.
- Added a blocking final quality gate before slide import.
- Blocked PowerPoint downloads on critical fidelity failures and surfaced warning metadata for non-critical differences.

## 0.17.0 (2026-08-24)

- Added simulated demonstration data for charts, metrics, and dashboards when the user has not supplied quantitative values.
- Added mandatory visible disclosure validation so simulated values cannot be presented as real evidence.

## 0.16.2 (2026-08-24)

- Fixed cover-title geometry so deterministic layout no longer reintroduces CJK text clipping after quality repair.
- Fixed the quality-revision retry path so an isolated post-revision slide failure reaches the protected page-only repair pass.

## 0.16.1 (2026-08-24)

### Bug Fixes

* preserve slide and element gradients in editable PowerPoint output
* export image cover crops and focal positions with schema-valid OOXML source rectangles
* preserve rounded and polygon image masks in WPS-compatible shape geometry
* map Chinese text to an explicit East Asian typeface instead of allowing Latin display fonts to fall back to a serif font

## 0.16.0 (2026-08-24)

### Features

* persist one deck-wide slide plan before rendering begins
* generate slide drafts in progressive batches with a two-page first result and three-page follow-up batches
* expose real batch number and page readiness in the live generation interface
* assemble batch visual plans into one deck-wide manifest before global quality review

## 0.15.3 (2026-08-24)

### Bug Fixes

* prevent multiple elements that declare the same deterministic slot from being collapsed into one rectangle
* preserve source-note coordinates while reserving the canonical footer slot for the final page footer

## 0.15.2 (2026-08-24)

### Bug Fixes

* route bitmap, SVG, and chart layers away from a conflicting generic content slot when the selected archetype has a distinct visual region
* prevent valid pending cover artwork from failing the pre-asset dominant-visual quality gate

## 0.15.1 (2026-08-24)

### Improvements

* treat uploaded slide screenshots as a binding template-quality contract instead of a loose color reference
* reconstruct title scale, composition rhythm, layered depth, 3D illustration language, and page-family structure from image references
* reject reference-driven covers with weak hierarchy, insufficient hero focus, or visually flat content compositions

## 0.15.0 (2026-08-24)

### Features

* establish parent-local coordinates as the canonical contract for nested slide layers
* normalize legacy AI slide coordinates before validation, preview, import, and export
* recursively reject child layers that render outside or are clipped by their parent groups
* preserve coordinate-space metadata across Canvas storage and editable PowerPoint export

### Bug Fixes

* render legacy nested slide layers at their intended positions instead of double-applying parent offsets
* mark pages as reviewed when the final post-asset quality gate passes without repair

## 0.14.3 (2026-08-24)

### Bug Fixes

* add one protected page-level repair when a deck-wide quality revision leaves an isolated slide failure
* preserve all passing slides and both manifest files during the follow-up repair

## 0.14.2 (2026-08-24)

### Improvements

* generate independent slide bitmap assets with a quality-safe concurrency limit of two
* lock passing slide files during page-specific quality repair so only the failing page is regenerated
* cancel all active visual-generation children when a slide job is cancelled

## 0.14.1 (2026-08-24)

### Bug Fixes

* prevent deterministic title, subtitle, and content slots from overlapping after AI quality revision
* attribute layout validation failures only to the slide that actually failed
* hide unstable ETA estimates until the first slide draft is available

## 0.14.0 (2026-08-24)

### Features

* recommend an optimal slide count from content scope, audience, scenario, duration, and evidence density when the user does not specify a length
* preserve explicit numeric or Chinese-text page counts as exact requirements
* make AI-recommended length the default while retaining manual page-count overrides

## 0.13.1 (2026-08-21)

### Bug Fixes

* persist AI Slides job recovery points so a Canvas restart no longer silently loses generation state
* keep interrupted generation on the progress page and offer an explicit continue action instead of returning home
* reuse completed slide outputs and visual assets when retrying an interrupted generation

## 0.13.0 (2026-08-21)

### Features

* show the complete AI Slides production workflow from page drafts through quality checks, visual generation, final review and repair, and canvas import
* calculate overall progress across backend stages instead of treating completed page drafts as 100 percent
* show visual-asset counts, elapsed time, estimated remaining time, and accessible live progress status

## 0.12.1 (2026-08-21)

### Bug Fixes

* keep the complete outline confirmation form inside one continuous workspace and prevent the action footer from covering page fields

## 0.12.0 (2026-08-21)

### Improvements

* unify AI Slides planning and confirmation screens with the main light workspace instead of nesting floating cards
* flatten and stabilize the outline confirmation layout across desktop and narrow viewports
* reduce generation status metadata to a compact caption beneath each slide preview

## 0.11.1 (2026-08-21)

### Improvements

* show the running Canvas version and Git commit in Settings, with PID, port, start time, and source path for development checkouts
* warn prominently when the running service version differs from the active workspace package version

## 0.11.0 (2026-08-21)

### Features

* paste clipboard images directly onto the active canvas
* paste clipboard images into the focused AI Slides prompt as reference material while preserving normal text paste

## 0.10.4 (2026-08-21)

* combine storyline, page structure, and page-outline review into one content-structure confirmation
* merge requirements, storyline, page structure, and outline review into one outline confirmation; visual rhythm is now planned automatically before generation

### Bug Fixes

* keep the inline optimization control aligned after PPTX or image attachments change the prompt layout
* hide reference attachment removal controls until hover or keyboard focus

## 0.10.3 (2026-08-21)

### Bug Fixes

* position the one-click optimization control immediately after the rendered prompt or placeholder text
* keep the inline control aligned while text wraps, resizes, or types in the optimized result

## 0.10.2 (2026-08-21)

### Improvements

* replace the brief optimization dialog with an inline one-click optimization control and color-ring progress state
* type optimized copy into the prompt and provide a one-click discard action that restores the original wording

## 0.10.1 (2026-08-21)

### Bug Fixes

* keep storyline groupings as internal AI references instead of forcing standalone chapter pages
* restore editable per-page content confirmation and let the full slide workflow area scroll vertically

## 0.10.0 (2026-08-21)

### Features

* add a confirmable deck design system for palette roles, typography, shapes, imagery, and charts
* add a page-by-page visual rhythm plan with treatment, density, silhouette, and specialist routing
* invoke the professional slide workflow during generation and preserve confirmed visual constraints through specialist routing and quality review

## 0.9.0 (2026-08-21)

### Features

* add an adaptive page-structure confirmation step for cover, agenda, section, content, summary, and closing roles
* let users edit page roles, chapter ownership, titles, narrative purposes, order, and page count before content generation
* protect the first cover and final closing pages while avoiding unnecessary agenda and section pages in short decks
* add Agenda, Summary, and Closing semantic PowerPoint layouts and persist structural roles through generation and export

## 0.8.0 (2026-08-21)

### Features

* add a screenshot-inspired deck storyline confirmation step between presentation requirements and the page outline
* generate an editable narrative path, presentation type tag, and 3–6 ordered chapters with roles, summaries, and page coverage
* replan the page outline only when the confirmed storyline changes, while preserving the requested page count and factual boundaries

## 0.7.0 (2026-08-21)

### Features

* add deck-wide AI transformation previews for business tone, 30% shorter copy, and a unified dark brand style
* protect slide order, element geometry, locked content, facts, and chart data, with one-click restoration after applying a transformation
* export semantic PowerPoint layouts, speaker notes, transitions, object entrance timing, native editable charts, and opt-in project-local embedded fonts

### Compatibility

* keep font fallback and all AI actions cross-platform across macOS and Windows

## 0.5.3 (2026-08-20)

### Improvements

* show prompt-derived AI recommendations for presentation goal, audience, and scenario in the editable input flow

## 0.5.2 (2026-08-20)

### Bug Fixes

* preserve explicit presentation fields and requested page counts across repeated AI brief optimization

## 0.5.1 (2026-08-20)

### Improvements

* lock the viewport during AI brief optimization and return the structured result to the editable prompt for repeat optimization

## 0.5.0 (2026-08-20)

### Features

* add AI-assisted presentation brief completion with an editable confirmation step

## 0.4.0 (2026-08-20)

### Features

* add editable AI slide generation, canvas slide management, and PPTX export
* add targeted single-slide regeneration and improved presentation editing flows
* improve PPTX layout, typography, color, gradient, shape, and media fidelity

## [0.3.1](https://github.com/Xiangyu-CAS/codex-canvas/compare/v0.3.0...v0.3.1) (2026-07-10)


### Bug Fixes

* surface available updates in settings ([1208e36](https://github.com/Xiangyu-CAS/codex-canvas/commit/1208e36f053002b3a385d4d744d3374812452727))

## [0.3.0](https://github.com/Xiangyu-CAS/codex-canvas/compare/v0.2.1...v0.3.0) (2026-07-10)


### Features

* add arrow-note quick edit workflow ([770657a](https://github.com/Xiangyu-CAS/codex-canvas/commit/770657aa22045a39dd69df5f3142015312b62bcd))
* refine quick edit annotations and layer browser ([28d5b79](https://github.com/Xiangyu-CAS/codex-canvas/commit/28d5b799b0bb276f8c10a35792aba6e1e0973be0))

## [0.2.1](https://github.com/Xiangyu-CAS/codex-canvas/compare/v0.2.0...v0.2.1) (2026-07-10)


### Bug Fixes

* honor proxy settings in release checks ([83f50be](https://github.com/Xiangyu-CAS/codex-canvas/commit/83f50be81fa4794bcc5e788d42094197ebe7d314))

## 0.2.0 (2026-07-10)


### Features

* add stable release pipeline ([292f9b5](https://github.com/Xiangyu-CAS/codex-canvas/commit/292f9b59255abd53724a241f7a085c66299cbfc7))


### Bug Fixes

* harden Windows Codex process handling ([9024d7d](https://github.com/Xiangyu-CAS/codex-canvas/commit/9024d7d78dadb954ac3dd13430341688ca141437))
* make chroma-key processing self-contained ([73a650d](https://github.com/Xiangyu-CAS/codex-canvas/commit/73a650dcb60d2733fa5391973bfb9dc402696769))
* preserve Windows command arguments ([3e2f450](https://github.com/Xiangyu-CAS/codex-canvas/commit/3e2f450e1d8b3611250a388fc5061277935177df))
* refine chat handoff and canvas editing flows ([7cfde09](https://github.com/Xiangyu-CAS/codex-canvas/commit/7cfde09e36e9ae300015eb7991e6f6503dc62b79))
* retry Windows lock sharing violations ([5ec3bf9](https://github.com/Xiangyu-CAS/codex-canvas/commit/5ec3bf9dda4d277ac837967fbae02860e45cf4d3))

Notable changes to Codex-Canvas are recorded here. This file is maintained by
[Release Please](https://github.com/googleapis/release-please); do not edit a
pending release section by hand.
