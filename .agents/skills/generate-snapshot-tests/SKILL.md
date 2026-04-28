---
name: generate-snapshot-tests
description: Generate snapshot test files for Sentry frontend React components. Use when asked to "generate snapshot tests", "add snapshot tests", "create visual snapshots", "write snapshot tests", "add visual regression tests", or "snapshot this component". Accepts an optional component path or name via $ARGUMENTS.
type: workflow-process
---

# Generate Snapshot Tests

Generate a `*.snapshots.tsx` file colocated with a Sentry React component, following the established pattern used by core design system components.

## Step 1: Locate the Component

If `$ARGUMENTS` is provided, treat it as a path or component name. Otherwise ask the user which component to snapshot.

Search strategies:

```
static/app/components/core/<name>/<name>.tsx
static/app/components/core/<name>/index.tsx
static/app/components/<name>.tsx
static/app/components/<name>/index.tsx
```

Use Glob or Grep to find the file if the exact path is unknown.

Read the component source file to understand:

- The component's name and its exported `Props` / `<ComponentName>Props` type
- Union types and enum-like string literals on props (e.g., `variant`, `priority`, `size`)
- Boolean toggle props (e.g., `disabled`, `checked`, `busy`)
- Whether the component is interactive (needs `onChange={() => {}}` or similar no-op handlers)

## Step 2: Determine the Import Path

| Condition                                                                                       | Import style                                                                                                                                                                                                                          |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Component lives under `static/app/components/core/` AND is published as `@sentry/scraps/<name>` | `import {ComponentName, type ComponentNameProps} from '@sentry/scraps/<name>';`                                                                                                                                                       |
| Component lives under `static/app/components/core/` but is NOT in `@sentry/scraps`              | `// eslint-disable-next-line @sentry/scraps/no-core-import -- SSR snapshot needs direct import to avoid barrel re-exports with heavy deps`<br>`import {ComponentName, type ComponentNameProps} from 'sentry/components/core/<path>';` |
| All other components                                                                            | `import {ComponentName, type ComponentNameProps} from 'sentry/components/<path>';`                                                                                                                                                    |

To check if a component is in `@sentry/scraps`, look for an existing import using `@sentry/scraps/<name>` in neighboring files, or check if other snapshot files in the same directory use `@sentry/scraps`.

## Step 3: Identify Props to Snapshot

Read the TypeScript props and classify them:

| Prop type                                                 | Action                                       |
| --------------------------------------------------------- | -------------------------------------------- |
| Union of string literals (`'sm' \| 'md' \| 'lg'`)         | Snapshot each value with `it.snapshot.each`  |
| Boolean toggle with visual impact (`disabled`, `checked`) | Snapshot `true` and `false` states           |
| Boolean flag with no visual test value                    | Skip or add a single named snapshot          |
| `children` / `className` / `style` / event handlers       | Skip — not visually interesting on their own |

Prioritize props that change the component's visual appearance substantially. For interactive components (inputs, toggles), always include disabled/checked states.

## Step 4: Write the Snapshot File

Name the output file `<component-name>.snapshots.tsx`, colocated with the component source file.

### Required imports (always include)

```tsx
import {ThemeProvider} from '@emotion/react';

import {ComponentName, type ComponentNameProps} from '@sentry/scraps/<name>'; // or appropriate path

// eslint-disable-next-line no-restricted-imports -- SSR snapshot rendering needs direct theme access
import {darkTheme, lightTheme} from 'sentry/utils/theme/theme';

const themes = {light: lightTheme, dark: darkTheme};
```

### Core structure

Always wrap in light/dark theme loop:

```tsx
describe('ComponentName', () => {
  describe.each(['light', 'dark'] as const)('%s', themeName => {
    // ... snapshot cases here
  });
});
```

### `it.snapshot.each` — for union prop variants

Use when iterating over multiple values of a single prop:

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

The third argument to `it.snapshot.each` is the metadata function — include all props that vary in the snapshot. This metadata is used for snapshot naming and diffing.

### `it.snapshot` — for single named snapshots

Use for one-off states (disabled, checked combinations, etc.):

```tsx
it.snapshot('disabled-unchecked', () => (
  <ThemeProvider theme={themes[themeName]}>
    <div style={{padding: 8}}>
      <Component disabled onChange={() => {}} />
    </div>
  </ThemeProvider>
));
```

Pass metadata as a third argument when it adds useful snapshot context:

```tsx
it.snapshot(
  'bold',
  () => (
    <ThemeProvider theme={themes[themeName]}>
      <div style={{padding: 8}}>
        <Component bold>Bold text</Component>
      </div>
    </ThemeProvider>
  ),
  {theme: themeName}
);
```

### Sizing the container

Match container sizing to what makes the component readable:

| Situation                      | Wrapper                                  |
| ------------------------------ | ---------------------------------------- |
| Default                        | `<div style={{padding: 8}}>`             |
| Width-sensitive (alerts, text) | `<div style={{padding: 8, width: 400}}>` |
| Narrow (icons, small controls) | `<div style={{padding: 8}}>`             |

### Interactive components

For components that require event handlers (inputs, checkboxes, radios, switches), pass no-op handlers to satisfy required props:

```tsx
<Component onChange={() => {}} />
<Component checked onChange={() => {}} />
```

## Step 5: Ordering snapshots within the theme loop

Order cases from most impactful to least:

1. Primary variant/priority prop (the most visible visual differentiator)
2. Secondary variant props
3. Size variants
4. State combinations (disabled+unchecked, disabled+checked)
5. Boolean modifiers (bold, italic, etc.)
6. Edge cases and combined props

## Examples

### Simple variant component (Button-style)

```tsx
import {ThemeProvider} from '@emotion/react';

import {Button, type ButtonProps} from '@sentry/scraps/button';

// eslint-disable-next-line no-restricted-imports -- SSR snapshot rendering needs direct theme access
import {darkTheme, lightTheme} from 'sentry/utils/theme/theme';

const themes = {light: lightTheme, dark: darkTheme};

describe('Button', () => {
  describe.each(['light', 'dark'] as const)('%s', themeName => {
    it.snapshot.each<ButtonProps['priority']>([
      'default',
      'primary',
      'danger',
      'warning',
      'link',
      'transparent',
    ])(
      '%s',
      priority => (
        <ThemeProvider theme={themes[themeName]}>
          <div style={{padding: 8}}>
            <Button priority={priority}>{priority}</Button>
          </div>
        </ThemeProvider>
      ),
      priority => ({theme: themeName, priority: String(priority)})
    );
  });
});
```

### Interactive component with state combinations (Switch-style)

```tsx
import {ThemeProvider} from '@emotion/react';

import {Switch, type SwitchProps} from '@sentry/scraps/switch';

// eslint-disable-next-line no-restricted-imports -- SSR snapshot rendering needs direct theme access
import {darkTheme, lightTheme} from 'sentry/utils/theme/theme';

const themes = {light: lightTheme, dark: darkTheme};

describe('Switch', () => {
  describe.each(['light', 'dark'] as const)('theme-%s', themeName => {
    it.snapshot.each<SwitchProps['size']>(['sm', 'lg'])('size-%s-unchecked', size => (
      <ThemeProvider theme={themes[themeName]}>
        <div style={{padding: 8}}>
          <Switch size={size} onChange={() => {}} />
        </div>
      </ThemeProvider>
    ));

    it.snapshot.each<SwitchProps['size']>(['sm', 'lg'])('size-%s-checked', size => (
      <ThemeProvider theme={themes[themeName]}>
        <div style={{padding: 8}}>
          <Switch checked size={size} onChange={() => {}} />
        </div>
      </ThemeProvider>
    ));

    it.snapshot('disabled-unchecked', () => (
      <ThemeProvider theme={themes[themeName]}>
        <div style={{padding: 8}}>
          <Switch disabled onChange={() => {}} />
        </div>
      </ThemeProvider>
    ));

    it.snapshot('disabled-checked', () => (
      <ThemeProvider theme={themes[themeName]}>
        <div style={{padding: 8}}>
          <Switch checked disabled onChange={() => {}} />
        </div>
      </ThemeProvider>
    ));
  });
});
```

### Component with multiple independent variant props (Alert-style)

When a component has multiple meaningful boolean or variant props that combine independently, add separate `it.snapshot.each` blocks per combination:

```tsx
describe('Alert', () => {
  describe.each(['light', 'dark'] as const)('%s', themeName => {
    // Primary variants
    it.snapshot.each<AlertProps['variant']>([
      'info',
      'warning',
      'success',
      'danger',
      'muted',
    ])(
      '%s',
      variant => (
        <ThemeProvider theme={themes[themeName]}>
          <div style={{padding: 8, width: 400}}>
            <Alert variant={variant}>This is a {variant} alert</Alert>
          </div>
        </ThemeProvider>
      ),
      variant => ({theme: themeName, variant: String(variant)})
    );

    // Modifier combination: same variants but with showIcon={false}
    it.snapshot.each<AlertProps['variant']>([
      'info',
      'warning',
      'success',
      'danger',
      'muted',
    ])(
      '%s-no-icon',
      variant => (
        <ThemeProvider theme={themes[themeName]}>
          <div style={{padding: 8, width: 400}}>
            <Alert variant={variant} showIcon={false}>
              This is a {variant} alert without icon
            </Alert>
          </div>
        </ThemeProvider>
      ),
      variant => ({theme: themeName, variant: String(variant), showIcon: 'false'})
    );
  });
});
```

## Anti-Patterns

```tsx
// ❌ Don't import theme from the barrel re-export
import {theme} from 'sentry/utils/theme';

// ✅ Import directly and suppress the lint warning
// eslint-disable-next-line no-restricted-imports -- SSR snapshot rendering needs direct theme access
import {darkTheme, lightTheme} from 'sentry/utils/theme/theme';
```

```tsx
// ❌ Don't omit the metadata argument — snapshot names become ambiguous
it.snapshot.each<Props['variant']>(['a', 'b'])('%s', variant => (
  <Component variant={variant} />
));

// ✅ Include metadata that reflects all varying props
it.snapshot.each<Props['variant']>(['a', 'b'])(
  '%s',
  variant => <Component variant={variant} />,
  variant => ({theme: themeName, variant: String(variant)})
);
```

```tsx
// ❌ Don't snapshot implementation-detail props like className or style
it.snapshot('custom-class', () => <Component className="foo" />);
```

```tsx
// ❌ Don't use @sentry/scraps barrel import for components not in the scraps package
import {Badge} from '@sentry/scraps/badge'; // if Badge isn't published there

// ✅ Use the direct path with the no-core-import suppression comment
// eslint-disable-next-line @sentry/scraps/no-core-import -- SSR snapshot needs direct import to avoid barrel re-exports with heavy deps
import {Badge} from 'sentry/components/core/badge/badge';
```

## Checklist

Before finishing:

- [ ] File is named `<component-name>.snapshots.tsx` and colocated with the component
- [ ] Both `light` and `dark` themes are covered via `describe.each`
- [ ] All primary variant/priority props are snapshotted
- [ ] Interactive components include disabled and checked/unchecked states
- [ ] `no-restricted-imports` ESLint suppression comment is present on the theme import
- [ ] Metadata argument is provided to `it.snapshot.each` calls
- [ ] No-op handlers (`onChange={() => {}}`) provided for required event props
- [ ] Import path uses `@sentry/scraps/<name>` if available, otherwise the direct `sentry/components/...` path with the `no-core-import` suppression
