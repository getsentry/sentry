# Capture plan

Write the plan beneath `.artifacts/ui-capture/`. The helper accepts this shape:

```json
{
  "name": "issue-stream-filter",
  "beforeUrl": "https://demo.dev.getsentry.net:7998/issues/",
  "afterUrl": "https://demo.dev.getsentry.net:7999/issues/",
  "target": {"kind": "product"},
  "themes": ["light"],
  "viewports": [{"name": "desktop", "width": 1440, "height": 1000}],
  "featureFlags": ["organizations:new-issue-stream"],
  "actions": [
    {"kind": "click", "role": "button", "name": "Filters"},
    {"kind": "fill", "label": "Search", "value": "assigned:me"},
    {"kind": "press", "key": "Enter"},
    {"kind": "wait", "ms": 500}
  ]
}
```

`name`, both URLs, and `target.kind` are required. The URLs may use different local ports but must use HTTPS and `demo.dev.getsentry.net`. Omit optional arrays to use light mode at 1440×1000 with no actions or feature-flag overrides. Omit `container` and `containerWidth` when the change is not responsive.

For a Scraps section, use `"target":{"kind":"story","heading":"Image Avatars"}`. Omit `heading` to capture the whole main story gallery.

Clicks and fills must identify exactly one element by `label` or by `role` and accessible `name`; `exact` defaults to `true`. Use only actions that do not submit or otherwise mutate data. Feature flags are enabled on both local origins for the capture and their previous `feature-flag-overrides` values are restored afterward.

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

Test only affected boundaries unless the user requests the full matrix. For a mobile-first minimum, capture at `N - 1` and `N`; for a `max-width` query, capture at `N` and `N + 1`.

These values are query-container content-box widths, not viewport or border-box widths. Choose viewport widths or safe actions—such as opening and resizing the Seer Explorer drawer—that place the query container on both sides of the boundary. Set each viewport's `containerWidth` to the expected rendered width; the helper measures the accessible `container` element in both versions and fails when it differs by more than 1px. The default container locator is `{"role":"main"}`.

For a nested query container, identify it by an accessible `label` or by `role` and optional accessible `name`. Name each planned viewport for the container width it produces.
