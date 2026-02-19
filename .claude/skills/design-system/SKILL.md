---
name: design-system
description: Guide for using Sentry's layout and text primitives. Use when implementing UI components, layouts, or typography. Enforces use of core components over styled components.
---

# Layout and Text Primitives at Sentry

## Core Principle

**ALWAYS use core components from `@sentry/scraps` instead of creating styled components with Emotion.**

Core components provide consistent styling, responsive design, and better maintainability across the codebase.

## Component Implementation Reference

For the complete list of supported props and their types, refer to the implementation files:

- **Layout Components**: `/static/app/components/core/layout/`
  - `container.tsx` - Base container with all layout props
  - `flex.tsx` - Flex layout primitive
  - `grid.tsx` - Grid layout primitive
  - `stack.tsx` - Stack layout primitive (Flex with column direction by default)
- **Typography Components**: `/static/app/components/core/text/`
  - `text.tsx` - Text primitive
  - `heading.tsx` - Heading primitive

## Layout Primitives

> **Important**: `Flex`, `Grid`, and `Stack` all extend `Container`. This means **every prop available on Container is also available on Flex, Grid, and Stack**. When you use `<Flex>`, you get all Container props (position, padding, border, overflow, etc.) PLUS the flex-specific props. The same applies to Grid and Stack.

### Container

Base layout component that supports all common layout properties. Flex, Grid, and Stack extend Container, inheriting all of its props.

**Key Props** (see `container.tsx` for complete list):

- `position`: "static" | "relative" | "absolute" | "fixed" | "sticky"
- `padding`, `paddingTop`, `paddingBottom`, `paddingLeft`, `paddingRight`: SpaceSize tokens
- `margin`, `marginTop`, etc.: SpaceSize tokens (deprecated, prefer gap)
- `width`, `height`, `minWidth`, `maxWidth`, `minHeight`, `maxHeight`
- `border`, `borderTop`, `borderBottom`, `borderLeft`, `borderRight`: BorderVariant tokens
- `radius`: RadiusSize tokens
- `overflow`, `overflowX`, `overflowY`: "visible" | "hidden" | "scroll" | "auto"
- `background`: SurfaceVariant ("primary" | "secondary" | "tertiary")
- `display`: Various display types
- Flex item props: `flex`, `flexGrow`, `flexShrink`, `flexBasis`, `alignSelf`, `order`
- Grid item props: `area`, `row`, `column`

```tsx
import {Container} from '@sentry/scraps/layout';

// ❌ Don't create styled components
const Component = styled('div')`
  padding: ${space(2)};
  border: 1px solid ${p => p.theme.tokens.border.primary};
`;

// ✅ Use Container primitive
<Container padding="md" border="primary">
  Content
</Container>;
```

### Flex

Use `<Flex>` for flex layouts. Extends `Container`, inheriting all Container props plus flex-specific props.

**Flex-Specific Props** (see `flex.tsx` for complete list):

- `direction`: "row" | "row-reverse" | "column" | "column-reverse"
- `align`: "start" | "end" | "center" | "baseline" | "stretch"
- `justify`: "start" | "end" | "center" | "between" | "around" | "evenly" | "left" | "right"
- `gap`: SpaceSize or `"${SpaceSize} ${SpaceSize}"` for row/column gap
- `wrap`: "nowrap" | "wrap" | "wrap-reverse"
- `display`: "flex" | "inline-flex" | "none"

**Plus ALL Container props**: `position`, `padding`, `margin`, `width`, `height`, `border`, `radius`, `overflow`, `background`, flex/grid item props, and more (see Container section above).

```tsx
import {Flex} from '@sentry/scraps/layout';

// ❌ Don't create styled components
const Component = styled('div')`
  display: flex;
  flex-direction: column;
  position: relative;
`;

// ✅ Use Flex primitive with props
<Flex direction="column" position="relative" gap="md">
  <Child1 />
  <Child2 />
</Flex>;
```

### Grid

Use `<Grid>` for grid layouts. Extends `Container`, inheriting all Container props plus grid-specific props.

**Grid-Specific Props** (see `grid.tsx` for complete list):

- `columns`: Grid template columns (number or CSS value)
- `rows`: Grid template rows
- `areas`: Named grid areas
- `gap`: SpaceSize or `"${SpaceSize} ${SpaceSize}"` for row/column gap
- `align`: "start" | "end" | "center" | "baseline" | "stretch" (align-items)
- `alignContent`: "start" | "end" | "center" | "between" | "around" | "evenly" | "stretch"
- `justify`: "start" | "end" | "center" | "between" | "around" | "evenly" | "stretch" (justify-content)
- `justifyItems`: "start" | "end" | "center" | "stretch"
- `flow`: "row" | "column" | "row dense" | "column dense"
- `autoColumns`, `autoRows`: Size of auto-generated tracks

**Plus ALL Container props**: `position`, `padding`, `margin`, `width`, `height`, `border`, `radius`, `overflow`, `background`, flex/grid item props, and more (see Container section above).

```tsx
import {Grid} from '@sentry/scraps/layout';

// ❌ Don't create styled components
const Component = styled('div')`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: ${space(2)};
`;

// ✅ Use Grid primitive
<Grid columns="repeat(3, 1fr)" gap="md">
  <Item1 />
  <Item2 />
  <Item3 />
</Grid>;
```

### Stack

Use `<Stack>` for vertical layouts. Stack is essentially `Flex` with `direction="column"` by default. It also provides `Stack.Separator` for adding separators between items.

**Props** (see `stack.tsx` for complete list):

- Same as Flex props (inherits all Flex and Container props)
- `direction` defaults to "column" (but can be overridden)
- `Stack.Separator` component for adding dividers between stack items

```tsx
import {Stack} from '@sentry/scraps/layout';

// ❌ Don't create styled components for vertical layouts
const Component = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(2)};
`;

// ✅ Use Stack primitive (automatically column direction)
<Stack gap="md">
  <Item1 />
  <Item2 />
  <Item3 />
</Stack>;

// ✅ With separators between items
<Stack gap="md">
  <Item1 />
  <Stack.Separator />
  <Item2 />
  <Stack.Separator />
  <Item3 />
</Stack>;

// ✅ Stack supports all Flex and Container props
<Stack gap="md" padding="lg" position="relative" border="primary">
  <Item1 />
  <Item2 />
</Stack>;
```

## Typography Primitives

### Text

Use `<Text>` for all text content. Never use raw `<p>`, `<span>`, or `<div>` elements with text styling.

**Key Props** (see `text.tsx` for complete list):

- `as`: "span" | "p" | "label" | "div" (semantic HTML element)
- `size`: TextSize ("xs" | "sm" | "md" | "lg" | "xl" | "2xl")
- `variant`: ContentVariant | "muted" (see Content Variant Tokens below)
- `align`: "left" | "center" | "right" | "justify"
- `bold`: boolean
- `italic`: boolean
- `uppercase`: boolean
- `monospace`: boolean
- `tabular`: boolean (fixed-width numbers)
- `ellipsis`: boolean (truncate with ellipsis)
- `wrap`: "nowrap" | "normal" | "pre" | "pre-line" | "pre-wrap"
- `textWrap`: "wrap" | "nowrap" | "balance" | "pretty" | "stable"
- `wordBreak`: "normal" | "break-all" | "keep-all" | "break-word"
- `density`: "compressed" | "comfortable" (line-height)
- `underline`: boolean | "dotted"
- `strikethrough`: boolean

```tsx
import {Text} from '@sentry/scraps/text';

// ❌ Don't create styled text components
const Label = styled('span')`
  color: ${p => p.theme.tokens.content.secondary};
  font-size: ${p => p.theme.fontSizes.small};
`;

// ❌ Don't use raw elements
<p>This is a paragraph</p>
<span>Status: Active</span>

// ✅ Use Text primitive with semantic 'as' prop
<Text as="p" variant="muted" density="comfortable">
  This is a paragraph
</Text>
<Text as="span" bold uppercase>
  Status: Active
</Text>
```

### Heading

Use `<Heading>` for all headings. Never use raw `<h1>`, `<h2>`, etc. elements.

**Key Props** (see `heading.tsx` for complete list):

- `as`: "h1" | "h2" | "h3" | "h4" | "h5" | "h6" (REQUIRED)
- `size`: HeadingSize ("xs" | "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl")
- `variant`: Same as Text
- `align`: Same as Text
- `italic`, `monospace`, `tabular`: Same as Text
- `ellipsis`, `wrap`, `textWrap`, `wordBreak`: Same as Text
- `density`: Same as Text
- `underline`, `strikethrough`: Same as Text

Note: `bold` and `uppercase` are NOT available on Heading (headings are always bold).

```tsx
import {Heading} from '@sentry/scraps/text';

// ❌ Don't style heading elements
const Title = styled('h2')`
  font-size: ${p => p.theme.fontSize.md};
  font-weight: bold;
`;

// ❌ Don't use raw heading elements
<h2>My Title</h2>

// ✅ Use Heading primitive with semantic 'as' prop
<Heading as="h2">My Title</Heading>

// ✅ With custom size
<Heading as="h3" size="xl">Large H3</Heading>
```

## Info Components

> **Important**: Always prefer `InfoTip` and `InfoText` over using raw `<Tooltip>` components. These provide consistent, accessible patterns for contextual help.

### InfoTip

Use `<InfoTip>` to add an info icon with tooltip next to labels or headings. It's keyboard accessible and provides a consistent pattern for supplementary help.

```tsx
import {InfoTip} from '@sentry/scraps/info';
import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

// ❌ Don't use Tooltip with arbitrary icons
<Flex gap="xs" align="center">
  <Text>Retention Period</Text>
  <Tooltip title="The number of days...">
    <IconInfo size="xs" />
  </Tooltip>
</Flex>

// ✅ Use InfoTip for contextual help icons
<Flex gap="xs" align="center">
  <Text>Retention Period</Text>
  <InfoTip title="The number of days event data is stored before being automatically deleted." />
</Flex>
```

**Key Props**:

- `title`: Tooltip content (required)
- `size`: "xs" | "sm" (default) | "md"

**When to Use**:

- Add context to headings or section titles
- Show supplementary information without inline text
- Explain settings or configuration options

### InfoText

Use `<InfoText>` for inline text with a tooltip. It renders text with a dotted underline that reveals a tooltip on hover/focus.

```tsx
import {InfoText} from '@sentry/scraps/info';

// ❌ Don't wrap text with raw Tooltip
<Tooltip title="Time to First Byte measures the time...">
  <span style={{textDecoration: 'underline dotted'}}>TTFB</span>
</Tooltip>

// ✅ Use InfoText for inline explanations
<InfoText title="Time to First Byte measures the time from the request start until the first byte of the response is received.">
  TTFB
</InfoText>
```

**Key Props**:

- `title`: Tooltip content (required)
- Extends `Text`, so supports all Text props: `size`, `variant`, `bold`, etc.

```tsx
// With Text styling props
<InfoText title="Small muted text" size="sm" variant="muted">
  Hint text
</InfoText>
<InfoText title="Bold text" bold>
  Important term
</InfoText>
```

**When to Use**:

- Define technical terms or acronyms inline
- Provide additional context without adding visual clutter
- Create consistent, accessible inline help patterns

## Creating Thin Abstractions

> **⚠️ CRITICAL: ALWAYS prompt the user for confirmation before creating abstractions over layout primitives (`Container`, `Flex`, `Grid`, `Stack`, `Text`, `Heading`) when the intent is to DRY (Don't Repeat Yourself) repeated props.**

You can create thin abstractions over primitives with the purpose of improving the semantic structure by using meaningful names (e.g., `TableCell` vs generic `Flex`) and with the purpose of providing some default props. It is very important that you do this sparingly, and only when it is a net gain for readability. For example, if there are only two instances of the duplicated props, and they are placed next to each other, the price of the abstraction outweights the terseness.

**Before creating an abstraction, you MUST:**

1. Ask the user for confirmation
2. Explain what abstraction you plan to create
3. Justify why the abstraction is worth the added complexity
4. Wait for explicit approval before proceeding

```tsx
import {Flex, type FlexProps} from '@sentry/scraps/layout';

// ❌ Don't repeat the same props everywhere
<Flex align="center" gap="xs" flex="1" padding="sm">Content 1</Flex>
<Flex align="center" gap="xs" flex="1" padding="sm">Content 2</Flex>
<Flex align="center" gap="xs" flex="1" padding="sm">Content 3</Flex>
<Flex align="center" gap="xs" flex="1" padding="sm">Content 4</Flex>

// ✅ Create a thin wrapper with default props (AFTER USER CONFIRMATION)
function TableCell(props: FlexProps) {
  return <Flex align="center" gap="md" {...props} />;
}

<TableCell>Content 1</TableCell>
<TableCell>Content 2</TableCell>
<TableCell align="start">Content 3</TableCell>{/* Can override defaults */}
```

**Key points:**

- **ALWAYS prompt for user confirmation BEFORE creating the abstraction**
- Extend the primitive's props type (`extends FlexProps`)
- Set defaults on JSX component and spread `{...props}` to allow overrides
- Don't use styled components - compose primitives instead

## General Guidelines

### 1. Use Responsive Props

Most props support responsive syntax using breakpoint keys.

```tsx
// ❌ Don't use styled media queries
const Component = styled('div')`
  display: flex;
  flex-direction: column;

  @media screen and (min-width: ${p => p.theme.breakpoints.md}) {
    flex-direction: row;
  }
`;

// ✅ Use responsive prop signature
<Flex direction={{xs: 'column', md: 'row'}}>
```

### 2. Prefer Gap/Padding Over Margin

Container supports `margin` props but they are deprecated. Use `gap` on parent containers instead.

```tsx
// ❌ Don't use margin between children
const Child = styled('div')`
  margin-right: ${p => p.theme.spacing.lg};
`;

// ✅ Use gap on parent container
<Flex gap="lg">
  <Child1 />
  <Child2 />
</Flex>;
```

### 3. Split Layout from Typography

Don't couple layout and typography in a single styled component. Use separate primitives.

```tsx
// ❌ Don't couple layout and typography
const Component = styled('div')`
  display: flex;
  flex-direction: column;
  color: ${p => p.theme.tokens.content.secondary};
  font-size: ${p => p.theme.fontSize.lg};
`;

// ✅ Split into layout and typography primitives
<Flex direction="column">
  <Text variant="muted" size="lg">
    Content
  </Text>
</Flex>;
```

### 4. Check Implementation Files for All Props

The implementation files contain the complete, up-to-date list of supported props with TypeScript types. When in doubt:

- Read `/static/app/components/core/layout/container.tsx` for base layout props
- Read `/static/app/components/core/layout/flex.tsx` for Flex-specific props
- Read `/static/app/components/core/layout/grid.tsx` for Grid-specific props
- Read `/static/app/components/core/layout/stack.tsx` for Stack-specific props
- Read `/static/app/components/core/text/text.tsx` for Text props
- Read `/static/app/components/core/text/heading.tsx` for Heading props

## Token Reference

### Spacing Tokens (SpaceSize)

Use these for `gap`, `padding`:

- `"0"`, `"2xs"`, `"xs"`, `"sm"`, `"md"`, `"lg"`, `"xl"`, `"2xl"`, `"3xl"`
- Multiple values: `"md lg"` (vertical horizontal)
- Responsive: `{{xs: "sm", md: "lg"}}`

### Border Tokens (BorderVariant)

Use these for `border` prop:

- `"primary"`, `"muted"`, `"accent"`, `"danger"`, `"promotion"`, `"success"`, `"warning"`

### Radius Tokens (RadiusSize)

Use these for `radius` prop:

- `"0"`, `"2xs"`, `"xs"`, `"sm"`, `"md"`, `"lg"`, `"xl"`, `"2xl"`, `"full"`

### Text Size Tokens

- **TextSize**: "xs" | "sm" | "md" | "lg" | "xl" | "2xl"
- **HeadingSize**: "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl"

### Surface Variant Tokens (SurfaceVariant)

Use these for `background` prop on layout components:

- `"primary"`, `"secondary"`, `"tertiary"`

### Content Variant Tokens (ContentVariant)

Use these for `variant` prop on Text and Heading:

- **ContentVariant**: "primary" | "secondary" | "accent" | "danger" | "promotion" | "success" | "warning"
- **Plus "muted"**: Text and Heading also accept "muted" in addition to ContentVariant values

## Quick Reference Checklist

Before creating a styled component, ask:

- ✅ Can I use `<Flex>`, `<Grid>`, or `<Stack>` for layout?
- ✅ Can I use `<Stack>` for vertical layouts with default column direction?
- ✅ Can I use `<Container>` for borders/padding/positioning?
- ✅ Can I use `<Text>` or `<Heading>` for typography?
- ✅ Can I use `<InfoTip>` or `<InfoText>` instead of `<Tooltip>`?
- ✅ Can I use responsive props instead of media queries?
- ✅ Can I use `gap` instead of margins?
- ✅ Does the primitive support the prop I need? (Check implementation files)

If you answered yes to any of these, **use the primitive instead**.
