# Quality Rubric

## Hard failures

- Content outside 1024x576 or meaningful content outside the 48-72px safe area.
- Clipped or overlapping text, unreadable contrast, stretched bitmap, or hidden focal subject.
- Emoji, Unicode arrows, stars, or dingbats used as visual graphics.
- Empty placeholder panels presented as finished visuals.
- A generated bitmap without content relevance or without intentional crop.
- Repeated generic card grids on consecutive pages.
- Unsupported numbers presented as facts.

## Acceptance checks

- The title, primary evidence, and takeaway are understandable in five seconds.
- Each page has a distinct silhouette but belongs to the same visual system.
- Charts and diagrams communicate a conclusion, not merely decorate.
- Bitmap, SVG, text, and groups remain movable at the appropriate layer level.
- At least one visual element materially explains or reinforces the page message.

## Post-asset gate

After bitmap replacement, recheck every page for crop mode, subject position, mask, text obstruction, safe margins, focal balance, and movable-layer integrity. Mark passing pages immutable during repair. Permit one targeted repair pass for failing pages, then fail the job if the same page remains invalid.
