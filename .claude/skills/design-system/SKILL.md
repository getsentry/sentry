---
name: design-system
description: Guide for using Sentry's layout and text primitives. Use when implementing UI components, layouts, or typography. Enforces use of core components over styled components.
---

# Layout and Text Primitives at Sentry

## Core Principle

**ALWAYS use core components from `@sentry/scraps` instead of creating styled components with Emotion.**

Core components provide consistent styling, responsive design, and better maintainability across the codebase.

## Layout Primitives

### Flex

Use `<Flex>` from `@sentry/scraps/layout` for flex layouts.

```tsx
import {Flex} from '@sentry/scraps/layout';

// ❌ Don't create styled components
const Component = styled('div')`
  display: flex;
  flex-direction: column;
`;

// ✅ Use Flex primitive
<Flex direction="column">
  <Child1 />
  <Child2 />
</Flex>;
```

**Common Props:**

- `direction`: "row" | "column" | "row-reverse" | "column-reverse"
- `align`: Alignment of items
- `justify`: Justification of items
- `gap`: Spacing between children (use tokens: "sm", "md", "lg", etc.)
- `wrap`: Whether items should wrap
- `width`, `height`: Size properties
- `padding`, `margin`: Spacing properties

### Grid

Use `<Grid>` from `@sentry/scraps/layout` for grid layouts.

```tsx
import {Grid} from '@sentry/scraps/layout';

// ❌ Don't create styled components
const Component = styled('div')`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
`;

// ✅ Use Grid primitive
<Grid columns={3} gap="md">
  <Item1 />
  <Item2 />
  <Item3 />
</Grid>;
```

### Container

Use `<Container>` from `@sentry/scraps/layout` for elements with borders or border radius.

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

## Typography Primitives

### Heading

Use `<Heading>` from `@sentry/scraps/text` for all headings.

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
```

**Important:** Always use `<Heading>` instead of raw `h1`, `h2`, `h3`, `h4`, `h5`, `h6` elements.

### Text

Use `<Text>` from `@sentry/scraps/text` for all text content.

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

**Common Props:**

- `variant`: "default" | "muted" | "error" | "success"
- `size`: "xs" | "sm" | "md" | "lg" | "xl"
- `bold`: Boolean for bold text
- `uppercase`: Boolean for uppercase text
- `truncate`: Boolean to truncate with ellipsis
- `align`: Text alignment
- `as`: Semantic HTML element ("p", "span", "div", etc.)

## General Guidelines

### 1. Favor Props Over Style Attribute

```tsx
// ❌ Don't use style attribute
<Flex style={{width: "100%", padding: `${space(1)} ${space(1.5)}`}}>

// ✅ Use props
<Flex width="100%" padding="md lg">
```

### 2. Use Responsive Props

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

### 3. Prefer Gap/Padding Over Margin

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

### 4. Split Layout from Typography

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

## Token Reference

### Spacing Tokens

Use these for `gap`, `padding`, `margin`:

- `"xs"`, `"sm"`, `"md"`, `"lg"`, `"xl"`, `"xxl"`
- Multiple values: `"md lg"` (vertical horizontal)
- Responsive: `{{xs: "sm", md: "lg"}}`

### Border Tokens

Use these for `border` prop:

- `"primary"`, `"secondary"`, `"error"`, `"success"`

## When to Use Styled Components

Only use Emotion styled components for:

- Complex, custom UI patterns not covered by core components
- One-off styling that doesn't fit primitive props
- Integration with third-party libraries requiring specific DOM structure

Even in these cases, try to compose primitives first.

## Quick Reference Checklist

Before creating a styled component, ask:

- ✅ Can I use `<Flex>` or `<Grid>` for layout?
- ✅ Can I use `<Container>` for borders/padding?
- ✅ Can I use `<Text>` or `<Heading>` for typography?
- ✅ Can I use responsive props instead of media queries?
- ✅ Can I use `gap` instead of margins?

If you answered yes to any of these, **use the primitive instead**.
