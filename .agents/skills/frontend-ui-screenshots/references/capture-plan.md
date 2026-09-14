# Capture plan

Write the plan beneath `.artifacts/ui-capture/`. The helper accepts this shape:

```json
{
  "name": "issue-stream-filter",
  "surface": "Issue stream",
  "beforeUrl": "https://demo.dev.getsentry.net:7998/issues/",
  "afterUrl": "https://demo.dev.getsentry.net:7999/issues/",
  "target": {"kind": "product"},
  "themes": ["light"],
  "viewports": [{"name": "desktop", "width": 1440, "height": 1000}],
  "featureFlags": ["organizations:new-issue-stream"],
  "actions": [
    {"kind": "click", "role": "button", "name": "Filters"},
    {"kind": "fill", "label": "Search", "value": "assigned:me"},
    {"kind": "press", "key": "Enter"}
  ]
}
```

`name`, both URLs, and `target.kind` are required. `surface` is an optional concise product/story label; set it when multiple manifests will share one published table so their rows remain distinguishable. The URLs may use different local ports but must use HTTPS and `demo.dev.getsentry.net`. Omit optional arrays to use light mode at 1440×1000 with no actions or feature-flag overrides. Omit `container` and `containerWidth` when the change is not responsive.

For data-backed product comparisons, use the same explicit absolute `start` and `end` query parameters in both URLs. A relative `statsPeriod` continues moving while the sequential Before/After captures run and can produce different charts, counts, rows, or relative timestamps. Confirm the rendered date control retained the absolute interval; some routes normalize or ignore unsupported query combinations.

Set `settleMs` only when the surface needs longer than the default 2500ms after fonts and images are ready, such as a slow chart or table query. The value must be a non-negative integer. When a late-loading pair fails inspection, use a focused one-viewport plan with a longer delay instead of recapturing an otherwise accepted matrix.

Set `forceVerticalScrollbar` to `true` when a viewport breakpoint changes page height and makes the scrollbar appear or disappear, creating a gap in attainable container widths. If the first measurement is not the expected width, the helper reserves a scrollbar and measures again. The option can be set on the whole plan or an individual viewport.

For a Scraps section, use `"target":{"kind":"story","heading":"Image Avatars"}`. Omit `heading` to capture the whole main story gallery.

Use the canonical Scraps URL shown by its route registration/navigation. Do not use the internal `?name=<source-file>` loader URL: it is not a stable, reviewable route and can render a misleading fallback state.

Clicks and fills must identify exactly one element by `label` or by `role` and accessible `name`. Matching is exact. Use only actions that do not submit or otherwise mutate data. Feature flags are enabled on both local origins for the capture and their previous `feature-flag-overrides` values are restored afterward.

## Container breakpoints

Sentry's container scale uses these minimum widths:

| Token  | Min width |
| ------ | --------- |
| `zero` | 0px       |
| `3xs`  | 320px     |
| `2xs`  | 384px     |
| `xs`   | 448px     |
| `sm`   | 512px     |
| `md`   | 576px     |
| `lg`   | 640px     |
| `xl`   | 768px     |
| `2xl`  | 896px     |
| `3xl`  | 1024px    |
| `4xl`  | 1152px    |
| `5xl`  | 1280px    |

Test only affected boundaries unless the user requests the full matrix. Represent each side with the same endpoint of its T-shirt-size range, rather than capturing adjacent boundary pixels. Prefer the minimum width of both neighboring ranges: for a `3xl` boundary, capture `2xl` at 896px and `3xl` at 1024px, not 1023px and 1024px. If the maximum better exposes the changed layout, use the maximum of both ranges consistently instead (1023px and 1151px for that boundary). Do not mix the lower range's maximum with the upper range's minimum.

Also compare the representative Before/After state at the same measured container width. Crossing a breakpoint successfully is insufficient when the migration changes the resulting column count, visibility, wrapping, or content from the behavior being replaced.

These values are query-container content-box widths, not viewport or border-box widths. Choose viewport widths or safe actions—such as opening and resizing the Seer Explorer drawer—that place the query container at the selected endpoints. Set each viewport's `containerWidth` to the expected rendered width; the helper measures the accessible `container` element in both versions and fails when it differs by more than 1px. The default container locator is `{"role":"main"}`.

For a nested query container, identify it by an accessible `label` or by `role` and optional accessible `name`. Name each planned viewport for the represented ranges, such as `2xl` and `3xl`; `containerWidth` retains the exact pixel assertion. Viewport names become published table labels, so do not put pixel values, route names, measurement explanations, or sentence-length descriptions in them. The publisher also removes a trailing parenthesized pixel measurement from older manifests.
