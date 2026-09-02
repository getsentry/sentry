---
name: frontend-ui-screenshots
description: Capture high-quality before-and-after screenshots for Sentry frontend changes. Use for PR visual evidence, Scraps components, product pages and interactive states, theme checks, and responsive or container-query changes.
---

# Frontend UI Screenshots

Produce reviewable evidence of the UI affected by the current frontend diff. Infer where the change renders and how to reach it; never require a CSS selector.

## Options

Infer these unless the user overrides them:

- `mode=auto|story|product` (default `auto`): use `story` when the changed component has a useful Scraps story; otherwise use `product`.
- `themes=both|light|dark` (default `both`).
- `breakpoints=auto|all|none` (default `auto`): responsive evidence captures affected breakpoint boundaries; `all` captures all relevant defined breakpoints; `none` captures one representative viewport.

`auto` should avoid an unnecessary viewport matrix for non-responsive changes. For container-query changes, use widths immediately below and above affected boundaries, plus any width needed to reproduce consequential product states such as the Seer Explorer drawer reducing the content container.

## Safety and invariants

- Product UI must use only the synthetic `demo` organization through `demo.dev.getsentry.net`. Stop if navigation leaves that hostname or resolves to another organization.
- Scraps may use `sentry.dev.getsentry.net` because it renders local fixtures.
- Never publish screenshots automatically. Leave them in `.artifacts/ui-capture/` unless the user separately authorizes posting them.
- Use the dedicated Chrome profile in [references/chrome-setup.md](references/chrome-setup.md); CDP must bind to localhost.
- Capture PNG at device scale factor 2. Wait for fonts and lazy-loaded images; reject broken images.
- Preserve the user's worktree. Put the merge-base build in a temporary detached worktree and remove only that worktree and its server afterward.

## Workflow

1. Run `node .agents/skills/frontend-ui-screenshots/scripts/capture.mjs discover`. Default to the merge base with `origin/master`. Ignore test-only changes as capture targets, but use tests as route and interaction evidence.
2. Choose one of two paths:
   - `story`: a changed Scraps primitive or component has useful visual documentation. Capture the diff-relevant section or, when no section clearly wins, its useful variation gallery.
   - `product`: the change needs real application context. This includes pages, forms, navigation, modals, popovers, and drawers. These are product states, not separate modes: visit the demo route, reproduce the state with inferred accessible actions, and capture the viewport so its relationship to surrounding UI remains visible.
3. Infer the target from colocated MDX/stories, tests, import parents and route registrations, accessible labels, and browser verification. Prefer a product capture when a story cannot demonstrate the actual changed behavior. Avoid submitting mutations.
4. State the inferred path, route/story, state, themes, viewport widths, and supporting diff evidence before capture.
5. Keep current dev-ui on port 7999. Create a detached merge-base worktree and start its dev-ui on port 7998. Reuse `node_modules` only when dependency manifests match; otherwise sync the base worktree.
6. Write a deterministic plan under `.artifacts/ui-capture/` and run:

```bash
node .agents/skills/frontend-ui-screenshots/scripts/capture.mjs capture --plan .artifacts/ui-capture/plan.json
```

A story plan uses `"target":{"kind":"story","heading":"Image Avatars"}`; omit `heading` to capture its main gallery. A product plan uses `"target":{"kind":"product"}` plus accessible `click`, `fill`, `press`, or `wait` actions. Use `themes` and concrete `viewports` derived from the selected options. Do not put selectors in a plan.

7. Inspect every comparison. Reject login redirects, loading skeletons, broken assets, mismatched state/data, clipped UI, customer information, or evidence that does not expose the changed behavior. Report clickable artifact paths and any limitation.
8. Stop port 7998 and remove the temporary worktree. Do not stop port 7999 or delete the persistent Chrome profile.
