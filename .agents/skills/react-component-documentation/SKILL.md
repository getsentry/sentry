---
name: react-component-documentation
description: Create or update component documentation in Sentry's MDX stories format. Use when asked to "document a component", "add stories", "write component docs", "create an mdx file", "add a stories.mdx", or document a design system component. Generates structured MDX with live demos, accessibility guidance, and auto-generated API docs from TypeScript types.
allowed-tools: Read, Grep, Glob, Write, Edit
---

# Component Documentation (MDX Stories)

Create a `.mdx` file for a Sentry component following the conventions in `static/app/components/core/`.

## Step 0: Gather Editorial Content

Before writing, collect the information that makes documentation useful beyond mechanical structure. Ask the user these questions — or, if they aren't available, search existing usages in the codebase (`Grep` for the component name across `static/app/views/`) to infer answers.

| Question                                                                                | Where it surfaces in the docs                                                           |
| --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| **When should a developer reach for this component?**                                   | Introduction or a `## When to use` section                                              |
| **When should they NOT use it — and what should they use instead?**                     | `> [!WARNING]` callout or `## See Also` with guidance                                   |
| **What does each variant/priority mean semantically?**                                  | Description in each variant's section (e.g., "`danger` = destructive and irreversible") |
| **What do developers commonly get wrong?**                                              | `> [!WARNING]` callouts, icon-only accessibility notes, required prop reminders         |
| **Does this component require a specific parent, peer, or provider to work correctly?** | Noted in the introduction or a `> [!NOTE]` callout                                      |
| **Are there related components that overlap in purpose?**                               | `## See Also` with one-line guidance on when to prefer each                             |
| **Which props and variants are worth documenting with a demo?**                         | See prop triage below                                                                   |

You don't need answers to all questions for every component. Skip ones that don't apply. The goal is to not write docs that only describe _how_ to use the API — write docs that tell developers _when and why_.

### Prop triage

Not every prop needs a demo section. Ask the user: **"Which props should I document, and are there any variants or values with specific intended uses?"**

If the user isn't available, read the component's TypeScript props and classify each:

| Tier                                                                | Document how                                                              | Examples                                    |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------- |
| **Core** — defines the component's primary behavior or appearance   | Full `##` section with live demo and semantic description of each value   | `priority`, `variant`, `size`               |
| **Modifier** — adjusts a single aspect; values are self-explanatory | Brief mention with a demo, or a single combined demo with other modifiers | `disabled`, `busy`, `icon`, `showIcon`      |
| **Structural** — controls layout or composition                     | Demo showing the before/after or compound usage                           | `system`, `expand`, `trailingItems`         |
| **Internal / pass-through** — not user-facing                       | Skip entirely                                                             | `className`, `style`, `ref`, `data-test-id` |

For **enum props** specifically, always ask: "Does each value have a distinct intended meaning, or are they purely visual?" If distinct (e.g., `danger` means destructive, not just red), document the semantics — not just the visual difference.

## Step 1: Locate the Component

Find the component source file:

```
static/app/components/core/<category>/<component>/index.tsx
static/app/components/core/<category>/<component>/<component>.tsx
```

Read the component file to understand:

- Props and their types
- Exported named variants and sub-components (e.g., `Component.SubComponent`, `export {TabList, TabPanels}`)
- Available values for enum/union props
- Default prop values

The MDX file goes next to the component: `<component-dir>/<component>.mdx`.

If the file already exists, read it first and update rather than overwrite.

**Determining the import path:**

- Components in `static/app/components/core/` are published as `@sentry/scraps/<name>`
- All other components use the sentry-internal path: `sentry/components/<path>`

To confirm the exact `@sentry/scraps` package name and type-loader path, check an existing import in the component directory or a neighboring `.mdx` file — the type-loader path can be `@sentry/scraps/<name>` or `@sentry/scraps/<name>/<name>` depending on the package structure.

## Step 2: Determine Frontmatter

```yaml
---
title: <ComponentName>
description: <One sentence describing what it is and its primary purpose.>
category: <category> # See category table below; omit for principle docs
source: '@sentry/scraps/<component>' # or 'sentry/<path>' for product components
resources:
  figma: <figma-url> # Include if known
  js: https://github.com/getsentry/sentry/blob/master/static/app/components/core/<path>
  a11y: # Include for interactive components
    WCAG 1.4.3: https://www.w3.org/TR/WCAG22/#contrast-minimum
    WAI-ARIA <Pattern> Practices: https://www.w3.org/WAI/ARIA/apg/patterns/<pattern>/
---
```

**Category values:**

| Category     | Components                                     |
| ------------ | ---------------------------------------------- |
| `buttons`    | Button, ButtonBar, LinkButton                  |
| `forms`      | Input, Select, Checkbox, Radio, Slider, Switch |
| `navigation` | Tabs, SegmentedControl, Disclosure             |
| `status`     | Alert, Badge, Tag, Toast                       |
| `layout`     | Flex, Grid, Stack, Container, Surface          |
| `typography` | Text, Heading, Prose                           |
| `patterns`   | design patterns, principles                    |

For principle/pattern docs (no interactive component), use `layout: document` instead of `category`, and replace `a11y:` with `reference:` under resources.

## Step 3: Write Imports

Follow this import order exactly:

```jsx
// 1. External packages (react, etc.) — only if needed for examples
import {useState} from 'react';
// 5. Type-loader for auto-generated API docs (@sentry/scraps components only)
import documentation from '!!type-loader!@sentry/scraps/<component>';

// 3. @sentry/scraps component(s)
import {ComponentName} from '@sentry/scraps/<component>';

// 2. Sentry internals used in examples (icons, utils)
import {IconAdd, IconEdit} from 'sentry/icons';
// 4. Stories namespace (always last before type-loader)
import * as Storybook from 'sentry/stories';

export {documentation};
```

Omit any group that isn't needed. For product components (not in `@sentry/scraps`), omit the type-loader lines and document props manually in a table (see Step 5).

**Complex export:** If the component exports need filtering (e.g., to hide internal exports), use the explicit form instead of `export {documentation}`:

```jsx
import RawDocumentation from '!!type-loader!@sentry/scraps/<component>';

export const documentation = {
  exports: RawDocumentation.exports,
  props: {
    ...RawDocumentation?.props,
    // Remove internal props if needed
  },
};
```

## Step 4: Write Content

### Section structure

Organize content by **feature or user-facing variant**, not by prop name:

1. **Introduction** — 1-2 sentences, then a minimal usage code block (no demo wrapper)
2. **When to use** _(if the component has meaningful alternatives or misuse risk)_ — prose guidance, optionally a do/don't `<Storybook.SideBySide>`
3. **Feature sections** — one `##` per major feature: `## Sizes`, `## Priorities`, `## States`, `## Composition`
4. **Accessibility** — WCAG claims and developer responsibilities
5. **See Also** — links to related components with one-line guidance (optional)

Prefer titles like `## Sizes`, `## Variants`, `## States` over `## The size prop`.

**When to use / See Also patterns:**

```mdx
## When to use

Use `<Alert>` for inline feedback within a page. For application-level banners that span the full viewport, use the `system` prop or reach for `<Toast>` if the message is transient.

> [!WARNING]
> Do not use `<Alert variant="danger">` for confirmation dialogs. Use a modal instead.
```

```mdx
## See Also

- [LinkButton](/stories/core/linkbutton/) — use when the action navigates to a new URL
- [Link](/stories/core/link/) — use for inline text navigation, not standalone CTAs
```

### Introduction pattern

````mdx
To create a basic <component>, wrap content in `<ComponentName>`.

```jsx
<ComponentName prop="value">Content</ComponentName>
```
````

````

### Sub-components

When a component exposes sub-components, show the full compound usage early:

```mdx
`<Tabs>` is a compound component. Use `<TabList>` and `<TabPanels>` together:

```jsx
<Tabs>
  <TabList>
    <TabList.Item key="tab1">Tab 1</TabList.Item>
  </TabList>
  <TabPanels>
    <TabPanels.Item key="tab1">Content 1</TabPanels.Item>
  </TabPanels>
</Tabs>
````

````

### Demo pattern

Every feature section must have a `<Storybook.Demo>` followed **immediately** by the matching code block:

```mdx
## Sizes

<brief description>

<Storybook.Demo>
  <Component size="sm">Small</Component>
  <Component size="md">Medium</Component>
  <Component size="lg">Large</Component>
</Storybook.Demo>
```jsx
<Component size="sm">Small</Component>
<Component size="md">Medium</Component>
<Component size="lg">Large</Component>
````

````

**Demo layout helpers:**

| Component | Use when |
|-----------|----------|
| `<Storybook.Demo>` | Default; horizontally arranges examples |
| `<Storybook.Grid>` | Grid layout for many variants |
| `<Storybook.SideBySide>` | Two-column comparisons (do/don't) |
| `<Storybook.TokenReference>` | Displaying design tokens (spacing, color, etc.) |
| `<Storybook.ColorReference>` | Displaying color tokens specifically |

### Accessibility section

```mdx
## Accessibility

This component meets [WCAG 2.2 AA](https://www.w3.org/TR/WCAG22/) standards:

- **Color contrast**: Meets 4.5:1 ratio (WCAG 1.4.3)
- **Keyboard navigation**: <what interactions are supported>
- **Screen reader support**: <ARIA role and labeling behavior>

### Developer responsibilities

- Always provide <required accessible prop> (e.g., `aria-label` or visible label text)
- <other requirement>
````

### Callout syntax

```mdx
> [!TIP]
> Use the `<prop>` prop when you need <use case>.

> [!WARNING]
> Avoid <pattern> because <reason>.

> [!NOTE]
>
> <Additional context.>
```

## Step 5: Props Table (product components only)

For components not in `@sentry/scraps`, list props manually instead of using the type-loader:

```mdx
## Props

| Prop      | Type                              | Default  | Description               |
| --------- | --------------------------------- | -------- | ------------------------- |
| `variant` | `'info' \| 'warning' \| 'danger'` | `'info'` | Controls the visual style |
| `size`    | `'sm' \| 'md' \| 'lg'`            | `'md'`   | Controls the size         |
```

## Complete Example

````mdx
---
title: Alert
description: Alerts provide contextual feedback messages with different severity levels.
category: status
source: '@sentry/scraps/alert'
resources:
  js: https://github.com/getsentry/sentry/blob/master/static/app/components/core/alert/index.tsx
  a11y:
    WCAG 1.4.3: https://www.w3.org/TR/WCAG22/#contrast-minimum
    WCAG 2.1.1: https://www.w3.org/TR/WCAG22/#keyboard
    WAI-ARIA Alert Pattern: https://www.w3.org/WAI/ARIA/apg/patterns/alert/
---

import {Alert} from '@sentry/scraps/alert';

import * as Storybook from 'sentry/stories';

import documentation from '!!type-loader!@sentry/scraps/alert';

export {documentation};

To create a basic alert, wrap a message in `<Alert>` and specify the appropriate type.

```jsx
<Alert variant="info">This is an informational message</Alert>
```
````

## Types

Alerts come in five types: `muted`, `info`, `warning`, `success`, and `danger`.

<Storybook.Demo>
<Alert.Container>
<Alert variant="muted">Muted</Alert>
<Alert variant="info">Info</Alert>
<Alert variant="warning">Warning</Alert>
<Alert variant="success">Success</Alert>
<Alert variant="danger">Danger</Alert>
</Alert.Container>
</Storybook.Demo>

```jsx
<Alert.Container>
  <Alert variant="muted">Muted</Alert>
  <Alert variant="info">Info</Alert>
  <Alert variant="warning">Warning</Alert>
  <Alert variant="success">Success</Alert>
  <Alert variant="danger">Danger</Alert>
</Alert.Container>
```

## Accessibility

This component meets [WCAG 2.2 AA](https://www.w3.org/TR/WCAG22/) standards:

- **Color contrast**: All variants meet 4.5:1 ratio (WCAG 1.4.3)
- **Keyboard accessible**: Fully operable via keyboard (WCAG 2.1.1)

```

```

## Checklist

Before completing, verify:

- [ ] MDX file is colocated next to the component source file (named `<component>.mdx`)
- [ ] Frontmatter has `title`, `description`, and `source`
- [ ] Imports follow the correct order (external → icons/utils → @sentry/scraps → Storybook → type-loader)
- [ ] Type-loader import is included for `@sentry/scraps` components
- [ ] Every `<Storybook.Demo>` is immediately followed by a matching code block
- [ ] Sections are organized by feature/variant, not by prop name
- [ ] Sub-components are documented with compound usage examples
- [ ] Accessibility section covers WCAG compliance and developer responsibilities
- [ ] No raw `<img>` tags (use `<Image>`), no inline SVGs, no styled components
