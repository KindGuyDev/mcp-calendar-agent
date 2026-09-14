---
name: event-html-theme-builder
description: Reusable HTML rendering rules and template for turning an approved event summary (when/who/where) into a standalone HTML page. Use from the html-builder subagent.
---

# Event HTML theme builder

Renders `artifacts/event-summary-builder.md` as a single, self-contained HTML file.

## Rules

- **Self-contained**: inline all CSS in a `<style>` block; no external stylesheets, fonts, or scripts. No network calls at render or view time.
- **Structure**: title (a short event label + date), then three sections in this order: **When** (date + time), **Who** (attendee list), **Where** (resolved place + address, with the source link from `location-resolver`).
- **Sources**: the resolved location keeps its source link as a normal `<a href>`, opening in the same tab.
- **No internal leakage**: never print run ids, artifact file paths, or agent names — those are internal workflow details, not user-facing content.
- **Style**: clean, readable, print-friendly — plain system font stack, generous line-height, a single accent color, no heavy JS-driven interactivity.

## Template skeleton

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>{{event label}} — {{date}}</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 640px; margin: 2rem auto; padding: 0 1rem; line-height: 1.5; }
  h1, h2 { color: #1f2937; }
  ul { padding-left: 1.25rem; }
  .field { background: #f9fafb; border-radius: 8px; padding: 1rem; margin: 0.75rem 0; }
</style>
</head>
<body>
  <h1>{{event label}}</h1>
  <div class="field"><h2>When</h2>{{date, time}}</div>
  <div class="field"><h2>Who</h2><ul>{{attendee list}}</ul></div>
  <div class="field"><h2>Where</h2>{{resolved place, address}} — <a href="{{source url}}">source</a></div>
</body>
</html>
```
