---
name: generate-snapshot-tests
description: Generate snapshot test files for Sentry frontend React components. Use when asked to "generate snapshot tests", "add snapshot tests", "create visual snapshots", "write snapshot tests", "add visual regression tests", or "snapshot this component". Accepts an optional component path or name via $ARGUMENTS.
type: workflow-process
---

# Generate Snapshot Tests

Generate a `*.snapshots.tsx` file colocated with a Sentry React component. Snapshot tests run via SSR in a bare Node environment (no jsdom, no RTL, no router context) — Playwright captures a PNG screenshot of the rendered HTML.

## Step 1: Locate the Component

If `$ARGUMENTS` is provided, treat it as a path or component name. Otherwise ask the user which component to snapshot.

Read the component source to understand:

- Exported name and `Props` type
- Union types and enum-like string literals on props (e.g., `variant`, `priority`, `size`)
- Boolean toggle props with visual impact (e.g., `disabled`, `checked`, `busy`)
- Whether the component is interactive (needs `onChange={() => {}}` or similar no-op handlers)
- Whether it reads from context (organization, router, page filters)
- Whether it fetches network data or uses browser-only APIs
- Which feature flags gate visual differences

## Step 2: Determine the Import Path

| Condition | Import style |
|-----------|-------------|
| Published as `@sentry/scraps/<name>` | `import {Component} from '@sentry/scraps/<name>';` |
| Under `components/core/` but NOT in scraps | `// eslint-disable-next-line @sentry/scraps/no-core-import -- SSR snapshot needs direct import`<br>`import {Component} from 'sentry/components/core/<path>';` |
| All other components | `import {Component} from 'sentry/components/<path>';` or the view-relative path |

## Step 3: Classify the Component

| Type | Characteristics | Mocking needs |
|------|----------------|---------------|
| **Pure presentational** | Props in, JSX out. No context, no hooks beyond styling. | None — theme only |
| **Context-dependent** | Reads organization, project, or page filters from context | Context providers in wrapper |
| **Data-fetching** | Calls hooks that hit the network (useQuery, useApiQuery) | Mock the hook or its transitive deps |
| **Router-dependent** | Uses useLocation, useNavigate, Link | SSR mocks for router hooks + LinkBehaviorContextProvider |
| **Browser-dependent** | Uses IntersectionObserver, portals, tooltips, echarts | Mock the specific component to a sized placeholder |

## Step 4: Write SSR Mocks (Minimum Necessary)

**Mock as little as possible.** Only mock what crashes or is flaky in SSR. Every mock hides real rendering — prefer fixing the component to render in SSR over mocking it away.

### Always-safe mocks (copy when needed)

```tsx
// Router hooks — SSR has no router context
// oxlint-disable-next-line @sentry/scraps/no-restricted-module-mocks
jest.mock('sentry/utils/useLocation', () => ({
  useLocation: () => ({pathname: '/', query: {}, search: '', hash: ''}),
}));
// oxlint-disable-next-line @sentry/scraps/no-restricted-module-mocks
jest.mock('sentry/utils/useNavigate', () => ({useNavigate: () => () => {}}));

// Page filters — SSR has no URL context
// oxlint-disable-next-line @sentry/scraps/no-restricted-module-mocks
jest.mock('sentry/components/pageFilters/usePageFilters', () => ({
  usePageFilters: () => ({
    selection: {datetime: {}, environments: [], projects: []},
    isReady: true,
  }),
}));
```

### Common SSR-incompatible components (mock only if imported transitively)

```tsx
// TimeSince renders relative time — flaky without a frozen clock
jest.mock('sentry/components/timeSince', () => ({
  TimeSince: ({tooltipPrefix}: {tooltipPrefix?: string}) => (
    <span>{tooltipPrefix ?? ''} 2d ago</span>
  ),
}));

// Tooltip portals to document.body — mocked globally by the framework
// (no action needed — snapshot-framework.ts handles this)

// ErrorBoundary uses componentDidCatch — passthrough in SSR
jest.mock('sentry/components/errorBoundary', () => ({
  ErrorBoundary: ({children}: {children: React.ReactNode}) => children,
}));

// GuideAnchor registers with the guide store
jest.mock('sentry/components/assistant/guideAnchor', () => ({
  GuideAnchor: ({children}: {children?: React.ReactNode}) => children ?? null,
}));
```

### Interactive dropdowns and charts (mock to a sized placeholder)

```tsx
// GroupStatusChart uses IntersectionObserver + echarts
jest.mock('sentry/components/charts/groupStatusChart', () => ({
  GroupStatusChart: () => (
    <div style={{width: 175, height: 36, background: '#eee'}} data-testid="chart-stub" />
  ),
}));
```

### Link behavior for SSR

When the component renders `<Link>` from scraps, provide a plain `<a>` replacement:

```tsx
import {LinkBehaviorContextProvider} from '@sentry/scraps/link';

const ssrLinkBehavior = {
  component: ({to, children, ...props}: any) => (
    <a href={typeof to === 'string' ? to : '#'} {...props}>
      {children}
    </a>
  ),
  behavior: (props: any) => props,
};
```

### What NOT to mock

- Props and their visual output — that's what we're testing
- Theme logic — tested via the light/dark loop
- Feature flag checks — use `OrganizationFixture({features: [...]})` instead
- CSS / Emotion styles — rendered by the SSR pipeline

## Step 5: Write the Snapshot File

Name: `<component-name>.snapshots.tsx`, colocated with the component source.

### Required imports

```tsx
import {ThemeProvider} from '@emotion/react';

// eslint-disable-next-line no-restricted-imports -- SSR snapshot rendering needs direct theme access
import {darkTheme, lightTheme} from 'sentry/utils/theme/theme';

const themes = {light: lightTheme, dark: darkTheme};
```

### Coverage dimensions

Every snapshot file MUST cover:

| Dimension | How |
|-----------|-----|
| **Theme** | `describe.each(['light', 'dark'] as const)` wrapping all cases |
| **Props** | `it.snapshot.each` for union/enum props; `it.snapshot` for boolean toggles and state combos |
| **Feature flags** | Separate snapshots with `OrganizationFixture({features: ['flag-name']})` when a flag changes rendering |
| **Interaction states** | `interaction: {hover: '<selector>'}` or `interaction: {active: '<selector>'}` for interactive elements |

### Wrapper pattern for context-dependent components

```tsx
import {OrganizationFixture} from 'sentry-fixture/organization';
import {OrganizationContext} from 'sentry/utils/organizationContext';

const organization = OrganizationFixture();

function Wrapper({
  children,
  themeName,
}: {
  children: React.ReactNode;
  themeName: 'light' | 'dark';
}) {
  return (
    <ThemeProvider theme={themes[themeName]}>
      <LinkBehaviorContextProvider value={ssrLinkBehavior}>
        <OrganizationContext value={organization}>
          <div style={{padding: 8, width: 600}}>{children}</div>
        </OrganizationContext>
      </LinkBehaviorContextProvider>
    </ThemeProvider>
  );
}
```

Extract a `Wrapper` when the provider stack is more than `ThemeProvider` + one `div`. For pure presentational components, inline the `ThemeProvider` directly.

### Feature flag snapshots

When a component checks a feature flag, snapshot both states:

```tsx
const orgWithFlag = OrganizationFixture({features: ['my-feature-flag']});
const orgWithoutFlag = OrganizationFixture();

it.snapshot(
  'with-feature-flag',
  () => (
    <ThemeProvider theme={themes[themeName]}>
      <OrganizationContext value={orgWithFlag}>
        <div style={{padding: 8}}>
          <Component />
        </div>
      </OrganizationContext>
    </ThemeProvider>
  ),
  {theme: themeName}
);
```

### Interaction state snapshots

Use the `interaction` field on metadata to drive `:hover` and `:active` states:

```tsx
it.snapshot(
  'hover',
  () => (
    <ThemeProvider theme={themes[themeName]}>
      <div style={{padding: 8}}>
        <Component onClick={() => {}}>Click me</Component>
      </div>
    </ThemeProvider>
  ),
  {
    theme: themeName,
    interaction: {hover: '[data-interactive]'},
  }
);

it.snapshot(
  'active',
  () => (
    <ThemeProvider theme={themes[themeName]}>
      <div style={{padding: 8}}>
        <Component onClick={() => {}}>Click me</Component>
      </div>
    </ThemeProvider>
  ),
  {
    theme: themeName,
    interaction: {active: '[data-interactive]'},
  }
);
```

The CSS selector targets the element Playwright hovers/clicks. Use `data-*` attributes or tag selectors — not class names (Emotion generates them).

### Viewport breakpoints

For responsive components, use `it.snapshot.breakpoints`:

```tsx
it.snapshot.breakpoints(
  ['small', 'medium', 'large'],
  'responsive-layout',
  width => (
    <ThemeProvider theme={themes[themeName]}>
      <div style={{padding: 8, width}}>
        <Component />
      </div>
    </ThemeProvider>
  ),
  {theme: themeName}
);
```

### `it.snapshot.each` — union prop variants

```tsx
it.snapshot.each<ComponentProps['variant']>(['info', 'warning', 'success', 'danger'])(
  '%s',
  variant => (
    <ThemeProvider theme={themes[themeName]}>
      <div style={{padding: 8}}>
        <Component variant={variant}>Label</Component>
      </div>
    </ThemeProvider>
  ),
  variant => ({theme: themeName, variant: String(variant)})
);
```

The third argument is the metadata function — always include it. Include all props that vary.

### `it.snapshot` — single named states

```tsx
it.snapshot('disabled-unchecked', () => (
  <ThemeProvider theme={themes[themeName]}>
    <div style={{padding: 8}}>
      <Component disabled onChange={() => {}} />
    </div>
  </ThemeProvider>
));
```

### Container sizing

| Situation | Wrapper |
|-----------|---------|
| Default | `<div style={{padding: 8}}>` |
| Width-sensitive (alerts, text, tables) | `<div style={{padding: 8, width: 400}}>` |
| Full-width layout (stream rows, lists) | `<div style={{padding: 8, width: 1200}}>` |

### Fixtures for data-driven components

Use the standard `sentry-fixture/*` factories for test data:

```tsx
import {GroupFixture} from 'sentry-fixture/group';
import {ProjectFixture} from 'sentry-fixture/project';

const project = ProjectFixture({slug: 'javascript', platform: 'javascript'});
const defaultGroup = GroupFixture({
  id: '1337',
  title: 'RequestError: GET /issues/ 404',
  project,
  priority: PriorityLevel.MEDIUM,
});
```

Customize fixture properties to exercise the visual states you need. Create named fixture variants for each distinct visual state:

```tsx
const escalatingGroup = GroupFixture({...defaultGroup, substatus: GroupSubstatus.ESCALATING});
const resolvedGroup = GroupFixture({...defaultGroup, status: GroupStatus.RESOLVED});
```

## Step 6: Ordering Snapshots

Order within each theme loop, most impactful first:

1. Default state
2. Primary variant prop (the most visible visual differentiator)
3. Secondary variant props
4. Size variants
5. State combinations (disabled+unchecked, disabled+checked)
6. Feature flag variants
7. Interaction states (hover, active)
8. Edge cases (overflow, empty, loading)

## Anti-Patterns

```tsx
// ❌ Import theme from barrel re-export
import {theme} from 'sentry/utils/theme';

// ✅ Import directly with lint suppression
// eslint-disable-next-line no-restricted-imports -- SSR snapshot rendering needs direct theme access
import {darkTheme, lightTheme} from 'sentry/utils/theme/theme';
```

```tsx
// ❌ Omit metadata — snapshot names become ambiguous
it.snapshot.each<Props['variant']>(['a', 'b'])('%s', variant => (
  <Component variant={variant} />
));

// ✅ Always include metadata
it.snapshot.each<Props['variant']>(['a', 'b'])(
  '%s',
  variant => <Component variant={variant} />,
  variant => ({theme: themeName, variant: String(variant)})
);
```

```tsx
// ❌ Mock a feature flag check directly
jest.mock('sentry/utils/features', () => ({has: () => true}));

// ✅ Use OrganizationFixture with the flag
const org = OrganizationFixture({features: ['my-flag']});
```

```tsx
// ❌ Mock more than necessary
jest.mock('sentry/components/group/inboxBadges/statusBadge', () => ...);

// ✅ Only mock what crashes in SSR — let the real component render
```

```tsx
// ❌ Use Emotion class names as interaction selectors
interaction: {hover: '.css-1a2b3c'}

// ✅ Use data attributes or semantic selectors
interaction: {hover: '[data-chip-interactive]'}
interaction: {hover: 'button'}
```

## Checklist

Before finishing:

- [ ] File is `<component-name>.snapshots.tsx`, colocated with the component
- [ ] Both `light` and `dark` themes covered via `describe.each`
- [ ] All primary variant/union props snapshotted
- [ ] Interactive components include disabled and checked/unchecked states
- [ ] Interaction states (hover/active) covered for components with pointer feedback
- [ ] Feature flags that change rendering are snapshotted with and without the flag
- [ ] `no-restricted-imports` suppression on the theme import
- [ ] `no-restricted-module-mocks` suppression on router/page-filter mocks
- [ ] Metadata argument provided to all `it.snapshot.each` calls
- [ ] No-op handlers for required event props
- [ ] Mocks are minimal — only what crashes or is flaky in SSR
- [ ] Import path uses `@sentry/scraps/<name>` if published, otherwise direct path with suppression
