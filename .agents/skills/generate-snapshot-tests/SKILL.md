---
name: generate-snapshot-tests
description: Generate or update Sentry visual snapshot tests (`*.snapshots.tsx`). Use when asked to snapshot a React component, add visual regression coverage, cover responsive or feature-flagged rendering, or capture hover and active states.
type: workflow-process
---

# Generate Snapshot Tests

Create a colocated `<component>.snapshots.tsx` that captures meaningful visual behavior with the snapshot framework already installed by `jest.config.snapshots.ts`.

## Workflow

1. Read the component, its props, nearby tests/stories, and representative `*.snapshots.tsx` files. Identify what users see: default content, named states, visual prop variants, responsive changes, feature-gated output, and pointer feedback.
2. Choose a small set of named scenarios. Prefer names such as `empty`, `loading`, `with long title`, and `disabled checked` over implementation details.
3. Render real component behavior. Use fixtures and no-op required handlers; add only the providers or mocks the component actually needs under SSR.
4. Write `it.snapshot` cases and use `it.snapshot.each` for one visual prop/state dimension. Do not create manual light/dark loops: every logical case automatically runs in both themes.
5. Run `pnpm run snapshots path/to/component.snapshots.tsx` and the relevant JS lint/format checks. Inspect generated images when available; a passing render does not prove that the scenarios are useful.

## Current API

```tsx
it.snapshot('scenario name', context => <Component />, {
  containers: ['xs', '3xl'],
  features: ['feature-name'],
  interaction: {
    state: 'hover',
    target: snapshotLocator.role('button', 'Save'),
  },
});
```

- The render callback may ignore `context` or use `{theme, container, containerWidth, features}` when rendering truly differs by scenario.
- Light and dark themes are automatic.
- The default container is `3xl` (1024 px). Omit `containers` unless container-query behavior changes. When it does, list the smallest meaningful boundary set, such as `['xs', '3xl']`, rather than every size.
- The framework adds an 8 px capture gutter. Render the component directly; do not add a padding wrapper to protect shadows, outlines, or focus rings.
- `features` becomes the fixture organization's exact, sorted feature set. Use exact production flag names. Omit it for no features; write separately named off/on cases only when both outputs matter.
- Use `viewport` only for behavior driven by the browser viewport. Do not use a viewport or a width wrapper to imitate container-query breakpoints.
- Interaction targets must resolve to exactly one element inside the snapshot root. Prefer semantic `snapshotLocator.role`, `label`, or `text`; these are exact by default. Name hover and active cases separately.
- Framework metadata for theme, container, features, and interaction is automatic. Add `tags` only when the owning area already relies on them, not to identify the scenario.

## Happy Path

```tsx
import {Alert, type AlertProps} from '@sentry/scraps/alert';

describe('Alert', () => {
  it.snapshot.each<AlertProps['variant']>(['info', 'warning', 'success', 'danger'])(
    '%s',
    variant => <Alert variant={variant}>Deployment status</Alert>
  );
});
```

Use `.each` for a finite prop dimension. Do not produce a Cartesian product unless each combination represents a distinct visual contract.

## Context, Responsive, And Interaction

```tsx
import {MemoryRouter} from 'react-router-dom';

import {snapshotLocator} from 'sentry-test/snapshots/snapshotLocator';

describe('ProjectActions', () => {
  it.snapshot(
    'responsive with replay enabled',
    ({container}) => (
      <MemoryRouter>
        <ProjectActions compact={container === 'xs'} />
      </MemoryRouter>
    ),
    {containers: ['xs', '3xl'], features: ['session-replay']}
  );

  it.snapshot.each(['hover', 'active'] as const)(
    'save %s',
    () => (
      <MemoryRouter>
        <ProjectActions />
      </MemoryRouter>
    ),
    state => ({
      features: ['session-replay'],
      interaction: {
        state,
        target: snapshotLocator.role('button', 'Save'),
      },
    })
  );
});
```

Theme and `OrganizationContext` are already provided. Add `MemoryRouter` or another real provider only when the component consumes that context. Prefer a provider over mocking its public behavior.

## SSR Boundary

Snapshots call `renderToString`, load that static HTML in Playwright, and do not hydrate it.

- Effects, ref callbacks, event handlers, client-side state transitions, lazy browser measurements, and hydration-only content do not run.
- Hover and active interactions apply CSS pointer states to the server-rendered DOM; they do not click handlers or update React state.
- There is no `document` during render. Portals cannot render normally; Tooltip is mocked globally.
- Global shims cover a small `window`, storage, media, and `CSS.escape` surface. If another browser-only dependency crashes, mock only that boundary with stable visible output. Do not mock the component behavior being tested.
- Use the smallest deterministic mock for data hooks, clocks, charts, or browser APIs. If the component cannot produce its meaningful UI without hydration, use a regular browser/component test instead of forcing a snapshot.

## Anti-Pattern Correction

```tsx
// Wrong: duplicate tests per theme, manual capture padding, a fixed-width
// wrapper standing in for a container scenario, and a generated class target.

// Right: one logical test expands across themes and targets stable semantics.
it.snapshot('compact save hover', () => <ProjectActions />, {
  containers: ['xs'],
  interaction: {
    state: 'hover',
    target: snapshotLocator.role('button', 'Save'),
  },
});
```

## Finish

- Keep the file colocated and focused on visual contracts, not exhaustive prop permutations.
- Use the component's supported import path; follow neighboring suppressions for unpublished core imports.
- Confirm scenario names and semantic locators are stable and unique.
- Confirm mocks are SSR-specific, deterministic, and minimal.
