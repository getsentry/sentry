# Generate Snapshot Tests Specification

## Intent

Guide agents to create compact, behavior-focused Sentry visual snapshot tests against the current SSR snapshot API.

## Scope

In scope:

- Colocated React `*.snapshots.tsx` files.
- Visual prop states, themes, container scenarios, exact feature sets, and CSS hover/active states.
- Minimal SSR-compatible providers and mocks.

Out of scope:

- Snapshot framework implementation changes.
- DOM assertions, client-side interaction tests, hydration tests, and exhaustive prop matrices.
- Additional runtime references, scripts, or templates.

## Users And Trigger Context

- Primary users: coding agents working in Sentry frontend code.
- Trigger for requests to add, generate, update, or improve visual snapshot coverage.
- Do not trigger for Jest value snapshots, React Testing Library tests, or screenshot product features.

## Runtime Contract

- Inspect component intent and nearby usage before selecting scenarios.
- Rely on automatic theme and organization providers, capture padding, and the default `3xl` container.
- Use explicit options only for meaningful containers, exact features, viewport behavior, or semantic pointer interactions.
- Produce a colocated test and validate it with the targeted snapshot command and formatting checks.
- Keep all runtime guidance inline in `SKILL.md`; load no bundled references.

## Source And Evidence Model

Treat snapshot framework code, types, and tests as authoritative. Use representative consumers and frontend `AGENTS.md` for local conventions. Treat the prior detailed skill as superseded input, not API authority. See `SOURCES.md`.

Do not store secrets, customer data, or private identifiers in examples or fixtures.

## Validation

- Run the skill-writer quick validator.
- Check Markdown formatting and diff whitespace.
- When using the skill, run the targeted snapshot test and relevant frontend lint checks.
- Accept only if examples match current types and obsolete manual provider, breakpoint, selector, and metadata recipes are absent.

## Known Limitations

- SSR snapshots are static and unhydrated; they cannot test effects, event-driven state, measurements, portals, or hydration behavior.
- Framework behavior may change as the snapshot API evolves.

## Maintenance Notes

- Update `SKILL.md` when `SnapshotTestInput`, render context, providers, locator types, or SSR behavior changes.
- Update `SOURCES.md` when evidence changes or a superseded source is replaced.
- Keep the skill scan-friendly; add no reference or script unless a distinct runtime branch cannot remain inline.
