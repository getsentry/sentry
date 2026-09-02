# Frontend UI Screenshots Specification

## Intent

Make before-and-after visual evidence for Sentry frontend PRs routine. Infer what changed, where it renders, and which responsive states matter while leaving final review and publication to the developer.

## Capture model

There are exactly two paths:

- `story`: a focused Scraps example or useful variation gallery for a documented component.
- `product`: a demo route after replaying safe, accessible interactions. Pages, forms, modals, drawers, popovers, navigation, and the Seer Explorer drawer are all product states, not special modes. Capture the viewport to retain application context.

The default options are `mode=product`, `themes=light`, and `breakpoints=none`. Story selection, dark-mode coverage, and breakpoint matrices are opt-in. When requested, container-query coverage uses meaningful widths around affected boundaries, including content widths created by opening adjacent UI such as the Seer Explorer drawer.

## Evidence and mechanics

Discovery uses the current diff, colocated stories/MDX, tests, import parents, route registrations, accessible names, responsive declarations, and rendered-browser verification. Static inference proposes a target; successful rendering confirms it. The agent owns semantic judgment; the script owns repeatable browser mechanics and safety checks.

When the inspected render path references a frontend feature flag, temporarily enable it through the `feature-flag-overrides` local storage value before loading both versions. Preserve and restore the previous value; do not add a separate flag-discovery phase.

Both merge-base and head run locally on separate ports and use the same persistent localhost-CDP Chrome profile. Prefer 7998 for merge-base and the current dev-ui's existing port for head, but record and use the actual ports selected by dev-ui. Captures are PNG at 2× and are written beneath `.artifacts/ui-capture/` with side-by-side comparisons and a manifest.

## Non-negotiable constraints

- Every capture, including Scraps, uses only `demo.dev.getsentry.net`; revalidate after every interaction and immediately before capture.
- Authentication state and browser-profile contents never enter Git.
- Uploading images or changing a PR requires separate authorization.
- Broken or unresolved lazy images, login redirects, loading states, and mismatched before/after state invalidate a capture.

## Evaluation expectations

Evaluate observable artifacts and selected targets for:

1. A core component whose diff clearly selects one MDX section.
2. A component with several relevant variations where the story gallery is more honest than one section.
3. A product modal whose route and trigger are inferred from a test and whose screenshot retains surrounding context.
4. A container-query product change at widths below and above the affected boundary.
5. A Seer Explorer drawer state that changes the available content-container width in light and dark themes.
6. An ambiguous shared component where uncertainty is reported rather than misleading evidence produced.
7. A non-demo product URL rejected by the helper.

## Known limitations

- File-to-route inference is not guaranteed for components with unrelated consumers.
- Demo data may not expose every feature state.
- Authentication periodically expires and needs manual refresh in the dedicated profile.
- The workflow detects broken external story assets but cannot repair them.
- GitHub has no general API for uploading local PR-description attachments, so publication remains separate.
