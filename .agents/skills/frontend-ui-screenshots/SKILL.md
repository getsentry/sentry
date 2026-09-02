---
name: frontend-ui-screenshots
description: Capture high-quality before-and-after screenshots for Sentry frontend changes. Use for PR visual evidence, Scraps components, product pages and interactive states, theme checks, and responsive or container-query changes.
---

# Frontend UI Screenshots

Produce reviewable evidence of the UI affected by the current frontend diff. Infer where the change renders and how to reach it.

## Options

Infer these unless the user overrides them:

- `mode=product|story|auto` (default `product`): use `story` for a changed component with a useful Scraps story; `auto` lets the agent choose.
- `themes=light|dark|both` (default `light`).
- `breakpoints=none|auto|all` (default `none`): `none` captures one representative viewport; `auto` uses responsive evidence to select affected breakpoint boundaries; `all` captures all relevant defined breakpoints.

When breakpoint coverage is requested, use widths immediately below and above affected container-query boundaries, plus any width needed to reproduce consequential product states such as the Seer Explorer drawer reducing the content container.

## Safety and invariants

- Every capture must use the synthetic `demo` organization through `demo.dev.getsentry.net`, including Scraps routes. Validate the location after every interaction and immediately before capture; stop if navigation leaves that hostname.
- Never publish screenshots automatically. Leave them in `.artifacts/ui-capture/` unless the user separately authorizes posting them.
- Use the dedicated Chrome profile in [references/chrome-setup.md](references/chrome-setup.md); CDP must bind to localhost.
- Capture PNG at device scale factor 2. Wait for fonts and lazy-loaded images; reject broken images.
- Preserve the user's worktree. Put the merge-base build in a temporary detached worktree and remove only that worktree and its server afterward.

## Workflow

1. Inspect the merge-base diff with Git, including uncommitted and untracked frontend files. Ignore `.spec.*` files as capture targets, but use them as route and interaction evidence. Search beside changed files for MDX and stories, and inspect the diff for responsive or container-query declarations.
2. Choose one of two paths:
   - `story`: a changed Scraps primitive or component has useful visual documentation. Capture the diff-relevant section or, when no section clearly wins, its useful variation gallery.
   - `product`: the change needs real application context. This includes pages, forms, navigation, modals, popovers, and drawers. These are product states, not separate modes: visit the demo route, reproduce the state with inferred accessible actions, and capture the viewport so its relationship to surrounding UI remains visible.
3. Infer the target from colocated MDX/stories, tests, import parents and route registrations, accessible labels, and browser verification. Prefer a product capture when a story cannot demonstrate the actual changed behavior. Avoid submitting mutations.
4. State the inferred path, route/story, state, themes, viewport widths, and supporting diff evidence before capture.
5. Keep the current dev-ui running and note its actual port. Create a detached merge-base worktree, then start its dev-ui with `SENTRY_WEBPACK_PROXY_PORT=7998 pnpm dev-ui`. If that port is occupied, use the automatically selected port and report both actual URLs. Reuse `node_modules` only when dependency manifests match; otherwise sync the base worktree.
6. Write a deterministic plan under `.artifacts/ui-capture/` and run:

```bash
node .agents/skills/frontend-ui-screenshots/scripts/capture.mjs --plan .artifacts/ui-capture/plan.json
```

A story plan uses `"target":{"kind":"story","heading":"Image Avatars"}`; omit `heading` to capture its main gallery. A product plan uses `"target":{"kind":"product"}` plus accessible `click`, `fill`, `press`, or `wait` actions. Use `themes` and concrete `viewports` derived from the selected options.

7. Inspect every comparison. Reject login redirects, loading skeletons, broken assets, mismatched state/data, clipped UI, customer information, or evidence that does not expose the changed behavior. Report clickable artifact paths and any limitation.
8. Stop only the merge-base dev-ui process started for the capture and remove the temporary worktree. Do not stop the current dev-ui or delete the persistent Chrome profile.
