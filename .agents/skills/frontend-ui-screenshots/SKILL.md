---
name: frontend-ui-screenshots
description: Capture before-and-after screenshots for Sentry frontend changes and attach them to the current PR. Use for visual evidence in Scraps or the demo product, including interactive, themed, responsive, and container-query states.
---

# Frontend UI Screenshots

Produce reviewable evidence of the UI affected by the current frontend diff. Infer where the change renders and how to reach it; report uncertainty instead of producing misleading evidence.

## Options

Use these defaults unless the user asks for broader coverage:

- Capture the product in light mode at one representative viewport.
- Use a Scraps story when the user requests one or product context cannot demonstrate a changed primitive honestly.
- Add dark mode when theme behavior is relevant.
- When responsive coverage is requested, test both sides of each affected container boundary using the [container breakpoint matrix](references/capture-plan.md#container-breakpoints). Include widths created by consequential product states, such as the Seer Explorer drawer reducing the content container.

## Boundaries

- Use only the synthetic `demo` organization through `demo.dev.getsentry.net`, including Scraps routes. Stop if an interaction leaves the planned local origin or, for stories, the Scraps route.
- Explicit invocation authorizes replacing this skill's screenshot table in the current PR description. Do not publish anywhere else.
- Use the dedicated localhost-only Chrome profile in [references/chrome-setup.md](references/chrome-setup.md).
- Capture PNG at device scale factor 2. Wait for fonts and lazy-loaded images; reject broken images.
- Preserve the user's worktree. Put the merge-base build in a temporary detached worktree and remove only that worktree and its server afterward.

## Workflow

1. Confirm `gh pr view` resolves the current branch's PR. Before the first upload, complete the one-time setup in [references/github-setup.md](references/github-setup.md). Stop before capture if there is no current PR.
2. Inspect the merge-base diff, including uncommitted and untracked frontend files. Ignore `.spec.*` files as capture targets, but use them as route and interaction evidence. Search beside changed files for MDX and stories, responsive declarations, import parents, and route registrations.
3. Choose one of two paths:
   - `product`: visit the demo route, reproduce the state with safe accessible actions, and retain surrounding context. Do not submit mutations.
   - `story`: capture the diff-relevant section or, when no section clearly wins, the useful variation gallery.
4. Confirm the inferred target in the browser. Prefer product context when a story cannot demonstrate the actual behavior. Add any feature flag referenced by the render path to the plan; the helper preserves and restores existing overrides.
5. State the inferred path, route/story, state, themes, viewport widths, and supporting diff evidence before capture.
6. Keep the current dev-ui running and note its actual port. Create a detached merge-base worktree, then start its dev-ui with `SENTRY_WEBPACK_PROXY_PORT=7998 pnpm dev-ui`. If that port is occupied, use the automatically selected port and report both actual URLs. Reuse `node_modules` only when dependency manifests match; otherwise sync the base worktree.
7. Write a deterministic plan using [references/capture-plan.md](references/capture-plan.md), then run from the current worktree root:

```bash
node .agents/skills/frontend-ui-screenshots/scripts/capture.mjs --plan .artifacts/ui-capture/plan.json
```

8. Inspect every Before/After pair. Reject login redirects, loading skeletons, broken assets, mismatched state/data, clipped UI, customer information, or evidence that does not expose the changed behavior.
9. Publish the accepted pairs and clean up locally:

```bash
node .agents/skills/frontend-ui-screenshots/scripts/publish.mjs --manifest .artifacts/ui-capture/<name>/manifest.json
```

The publisher replaces its marked Before/After table in the current PR description, verifies the returned body, then deletes only the local directory containing that manifest. If upload or PR editing fails, retain the artifacts and report how to retry.

After publication, stop only the merge-base dev-ui process started for the capture and remove its temporary worktree. Do not stop either persistent browser profile or the current dev-ui.
