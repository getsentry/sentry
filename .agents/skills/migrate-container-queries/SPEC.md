# Container Query Migration Guide Specification

## Intent

Provide a reliable, low-risk path for converting viewport-based responsive logic (`@media`, `useMedia`) to container queries, so components respond to their own available width instead of the raw viewport. The dominant failure mode this skill guards against is mapping a breakpoint token to the container token of the same name: the two scales share names but not pixel values.

## Scope

In scope: migrating `@media`/`useMedia` width logic to primitive props, `@container` CSS, `useContainerBreakpoint()`, or `screen:` keys, and deciding when to add `container-type`.

Out of scope: non-width media features (`prefers-*`, `hover`, `pointer`, `resolution`, height-based, `print`) stay on `useMedia`; building the primitives or tokens themselves.

## Non-negotiable Constraints

- Map to the `container` token with the pixel value _nearest_ the old breakpoint's — never the same-named token.
- Always visually verify by resizing the element (the container is often narrower than the viewport, so the nearest-px token is a starting point).
- Route genuine viewport-width cases to `screen:` keys; keep `useMedia` only for non-width media features.

## Sources

- Scraps `Container` story, "Container Queries" section — authoritative for container vs. `screen:` keys, both token scales, `useContainerBreakpoint`, and `container-type` guidance.
- Reference migration PR getsentry/sentry#120315 (trace-view).
- `components/core/breadcrumbList/breadcrumbList.tsx` — conditional `container-type` pattern.

## Known Limitations

- The nearest-px token is only a starting point; the true reflow width needs a browser visual check the skill cannot perform.
- `@container` silently no-ops without a query-container ancestor; the skill flags this but cannot detect it statically.

## Maintenance

- Update `SKILL.md` when token scales change, primitives gain/lose props, or a rung is added.
- Update `SPEC.md` when intent, scope, the non-negotiable constraints, or the sources change.
