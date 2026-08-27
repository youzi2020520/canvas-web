# Codex-Canvas Development Notes

## Context Reuse Protocol

- Treat `docs/PROJECT_STATIC_CONTEXT.md` as the compact, reusable source of stable project context.
- At the start of every task, briefly tell the user: (1) which static context is being reused, (2) which dynamic information will be read now, and (3) which known material does not need to be read again.
- Do not rescan or resummarize stable project background, architecture, coding rules, test rules, or fixed business constraints when the static context already covers them.
- Re-read only the dynamic evidence needed for the task, such as changed code, new files, current diffs, fresh logs, test output, runtime output, or newly supplied requirements.
- Refresh `docs/PROJECT_STATIC_CONTEXT.md` only when a verified long-lived fact changes. Keep transient status, dirty-worktree details, logs, and one-off results out of it.
- If accuracy conflicts with context minimization, read the smallest authoritative source needed and report why it was refreshed.

## Versioning Policy

- Keep the version in `package.json`, the root package entries in `package-lock.json`, and `.codex-plugin/plugin.json` synchronized.
- For a substantial, user-visible feature release, automatically increment the minor version before handoff (for example, `0.4.0` to `0.5.0`).
- For backward-compatible fixes and small improvements, increment the patch version. Increment the major version only for intentional breaking changes.
- Record meaningful release changes in `CHANGELOG.md` when the version changes.
- Version changes do not authorize staging, committing, tagging, pushing, publishing, or installing a release; those actions still require the user's explicit request.

## Cross-Platform Requirement

- Codex-Canvas must remain compatible with both macOS and Windows.
- Do not implement core app behavior with OS-specific UI automation such as AppleScript, `osascript`, System Events, Windows UI Automation, coordinate clicking, or simulated keystrokes into the Codex desktop app.
- Prefer browser, plugin, MCP/tool, or other Codex-supported integration surfaces that work consistently across macOS and Windows.

## Frontend UI

- Toolbar, dock, and control icons must come from a mature icon set, not hand-built CSS shapes or one-off custom drawings. Prefer inline Tabler or Lucide SVG paths for consistency, portability, and low runtime overhead.
- Keep icon style, stroke width, corner radius, and visual weight consistent across the same toolbar or dock.
- Only hand-draw an icon when no suitable existing icon exists, and document why it cannot come from the shared icon set.

## Skill Boundary

- Canvas AI operations should be modeled as dedicated skills plus backend job actions. Examples: Quick Edit, Remove BG, Edit Elements, Edit Text, and image generation.
- Each AI operation skill should document the edit intent, required inputs, preservation rules, output requirements, and canvas placement behavior.
- The frontend should send stable action ids such as `quick-edit` or `remove-bg`; it should not embed operation-specific prompts.
- The backend job layer should map action ids to operation prompts/skills, run Codex/ImageGen through cross-platform Codex-supported tooling, and collect outputs back to the canvas.
- Deterministic canvas interactions should remain local app code, not skills. Examples: pan, zoom, drag, select, delete, pencil drawing, text object creation/editing, toolbar visibility, language settings, and viewport framing.
