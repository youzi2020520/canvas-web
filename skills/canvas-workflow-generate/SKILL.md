---
name: canvas-workflow-generate
description: Generate a new canvas image from a prompt, or transform an existing canvas image from a connected node workflow. Use when a Codex Canvas Workflow generator node starts a text-to-image or image-to-image job.
---

# Canvas Workflow Generate

Use the existing Canvas backend job for every workflow generation. Do not perform
image generation in the browser.

## Inputs

- A non-empty prompt is required.
- A source image object ID is optional.
- Without a source image, run a text-to-image generation.
- With a source image, preserve the source composition unless the prompt requests a
  structural change.

## Execution

1. Submit the prompt and optional source object ID to `/api/workflow/jobs`.
2. Treat the returned job as asynchronous and poll its normal Canvas job endpoint.
3. Keep the generator node's status visible while the job is running.
4. After completion, create an image node linked to the imported Canvas result.
5. On failure, retain the workflow and show the backend error on the generator node.

## Output

The final artifact must be imported into the current Canvas project as an image
object. The workflow stores only the Canvas object ID, never a temporary file path.
