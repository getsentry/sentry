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
- For every responsive change, test both sides of each affected container boundary using the [container breakpoint matrix](references/capture-plan.md#container-breakpoints). Cover every responsive declaration changed by the diff, even when the user does not explicitly request breakpoint coverage. Include widths created by consequential product states, such as the Seer Explorer drawer reducing the content container.

## Boundaries

- Use only the synthetic `demo` organization through `demo.dev.getsentry.net`, including Scraps routes. Stop if an interaction leaves the planned local origin or, for stories, the Scraps route.
- Do not capture `sentry.sentry.io/_admin` or any admin page backed by real Sentry data. Admin UI evidence is out of scope for now; a future workflow must run Sentry locally with synthetic or mock data.
- Explicit invocation authorizes replacing this skill's marked screenshot table in the current PR description, or in file-level review comments when the user requests them. Do not publish anywhere else.
- Keep published evidence to the screenshot table. Do not add narrative capture summaries such as which demo page was used or how widths were measured. Use only concise labels needed to distinguish pairs, such as the affected breakpoint, theme, or interaction state.
- Capture with the dedicated Chrome profile in [references/chrome-setup.md](references/chrome-setup.md). Normal capture connects to the hidden background Chrome process and must not open or foreground a browser window.
- Do not publish authenticated personal UI such as a real user name, email address, or avatar. Prefer a crop or story that excludes account chrome; otherwise use a synthetic identity in both builds. Treat identity chrome as customer information even when the product data comes from the `demo` organization.
- Capture PNG at device scale factor 2. Wait for fonts and lazy-loaded images; reject broken images.
- Preserve the user's worktree. Put the merge-base build in a temporary detached worktree and remove only that worktree and its server afterward.

## Workflow

1. Confirm `gh pr view` resolves the current branch's PR. Before the first upload, complete the one-time setup in [references/github-setup.md](references/github-setup.md). Stop before capture if there is no current PR.
2. Inspect the merge-base diff, including uncommitted and untracked frontend files. Ignore `.spec.*` files as capture targets, but use them as route and interaction evidence. Search beside changed files for MDX and stories, responsive declarations, import parents, and route registrations. Map every visually changed surface to evidence or state why it cannot be captured; one convenient story is not coverage for an unrelated multi-file diff.
3. Choose one of two paths:
   - `product`: visit the demo route, reproduce the state with safe accessible actions, and retain surrounding context. Do not submit mutations.
   - `story`: capture the diff-relevant section or, when no section clearly wins, the useful variation gallery.
4. Confirm the inferred target in the browser. For Scraps, use the registered canonical path (for example `/scraps/principles/icons/`), never the internal `?name=<source-file>` loader URL. Prefer product context when a story cannot demonstrate the actual behavior. Add any feature flag referenced by the render path to the plan; the helper preserves and restores existing overrides.
5. State the inferred path, route/story, state, themes, viewport widths, and supporting diff evidence before capture.
6. Keep the current dev-ui running and note its actual port. Create a detached merge-base worktree, then start its dev-ui with `SENTRY_WEBPACK_PROXY_PORT=7998 pnpm dev-ui`. If that port is occupied, use the automatically selected port and report both actual URLs. Reuse `node_modules` only when dependency manifests match; otherwise sync the base worktree.
7. Write a deterministic plan using [references/capture-plan.md](references/capture-plan.md), then run from the current worktree root:

```bash
node .agents/skills/frontend-ui-screenshots/scripts/capture.mjs --plan .artifacts/ui-capture/plan.json
```

8. Inspect every Before/After pair from the final manifest immediately before publishing. Reject login redirects, loading skeletons, broken assets, mismatched state/data, clipped UI, customer information, or evidence that does not expose the changed behavior. Do not rely on an earlier inspection when a later capture may have overwritten the same paths. At matched container widths, treat unexplained changes in column count, visible labels, counts, wrapping, or content as possible regressions: investigate and fix or explain them before publishing. For responsive changes, verify the rendered query-container content box at the exact boundary pixels, not only the viewport size, and confirm the manifest includes both sides of every affected boundary.
9. Treat screenshots as derived from the current code. If code changes after capture and could affect a captured surface or state, recapture and reinspect every affected After pair before publishing or completing the task. If evidence was already published, replace each old affected pair with its refreshed pair in the existing table; never append duplicate evidence or leave the stale image referenced in the PR. Reuse only pairs demonstrably unaffected by the code update.
10. Publish the accepted pairs:

```bash
node .agents/skills/frontend-ui-screenshots/scripts/publish.mjs --manifest .artifacts/ui-capture/<name>/manifest.json
```

By default, the publisher replaces its marked Before/After table in the current PR description. Do not add an introduction or capture description around the table. When the user wants evidence beside a changed file, publish one manifest per file:

```bash
node .agents/skills/frontend-ui-screenshots/scripts/publish.mjs \
  --manifest .artifacts/ui-capture/<name>/manifest.json \
  --comment-path static/app/path/to/component.tsx
```

File mode creates or replaces the skill's marked file-level review comment without changing the PR description. In either mode, verify the returned body and retrieve the uploaded assets to confirm they are the inspected local PNGs, not merely that their URLs appear in the comment. Retain the local artifacts so a reviewer-requested correction can reuse the unaffected images. If upload or PR editing fails, report how to retry. Remove capture artifacts only when the user asks or confirms the evidence is accepted.

After publication, stop only the merge-base dev-ui process started for the capture and remove its temporary worktree. Do not stop the current dev-ui.
