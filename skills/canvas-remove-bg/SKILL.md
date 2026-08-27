---
name: canvas-remove-bg
description: "Remove the background from a selected Codex-Canvas image and collect a transparent PNG result back onto the canvas."
---

# Codex-Canvas Remove BG

Use this skill when the user invokes Remove BG from Codex-Canvas or asks to isolate the foreground subject of a selected canvas image.

## Behavior

1. Treat the selected canvas image as the edit target.
2. Preserve only the primary foreground subject, proportions, and visual quality.
3. Remove the background only; do not redesign, restyle, crop, or replace the subject.
4. Do not preserve or recreate readable text, captions, labels, logos, watermarks, UI text, or decorative typography. The cutout should contain the subject only, without text.
5. Always use ImageGen to regenerate the isolated foreground subject. Do not use the bundled local foreground-segmentation path for Remove BG.
6. Treat this as a faithful image edit: preserve the primary subject's identity, proportions, pose, framing, colors, materials, and important fine details while removing everything behind it.
7. Place the regenerated foreground subject on a perfectly flat solid `#ff00ff` chroma-key background.
8. The chroma-key background must be one uniform color with no shadows, gradients, texture, reflections, floor plane, or lighting variation.
9. Do not use `#ff00ff` anywhere in the subject.
10. Keep crisp foreground edges, no cast shadow, no contact shadow, no reflection, and enough padding for reliable alpha conversion.
11. Save the transparent local result or generated chroma-key PNG under the Codex-Canvas job output directory.
12. Codex-Canvas removes the chroma key locally using its bundled chroma-key helper with soft matte and despill. It then verifies the RGBA alpha PNG, collects it, and places it in a row to the right of the source image.

Do not ask follow-up questions from a background Remove BG job. Make the most reasonable subject isolation from the selected image.
