# Comprehensive Button Width Styling Patterns Analysis

**Analysis Date:** February 5, 2026

## Executive Summary

This expanded analysis examines all approaches developers use to make buttons fill available space in the Sentry codebase, going beyond direct CSS width rules. The analysis identified **multiple patterns** used across hundreds of files.

### Key Findings

| Pattern Category         | Files Analyzed | Description                                                                              |
| ------------------------ | -------------- | ---------------------------------------------------------------------------------------- |
| **Direct Width Rules**   | 14             | Buttons with explicit `width: 100%`, `flex: 1`, `flex-grow: 1`, or `align-self: stretch` |
| **Display Block**        | 31             | Buttons styled with `display: block` (makes them fill container width)                   |
| **Container Components** | 219            | Files using `ButtonBar`, `ButtonGroup`, or similar layout components                     |
| **Wrapper Patterns**     | 167            | Custom styled wrappers that control button sizing through container properties           |
| **Grid Positioning**     | 4+             | Buttons positioned/sized using CSS Grid properties                                       |

---

## Pattern 1: Direct Width-Expanding Rules

### Overview

These are buttons with explicit CSS properties that cause width expansion. **Covered in detail in `STYLED_BUTTON_WIDTH_ANALYSIS.md`.**

**Total instances:** 14

**Common patterns:**

- `width: 100%` (9 instances)
- `flex-grow: 1` (3 instances)
- `flex: 1` (2 instances)
- `align-self: stretch` (1 instance)

### Example

```tsx
const StyledButton = styled(Button)`
  width: 100%;
`;
```

**Use case:** When you need a button to explicitly fill its container.

---

## Pattern 2: Display Block

### Overview

Setting `display: block` on a button makes it behave as a block-level element, causing it to fill the container width by default without needing explicit `width: 100%`.

**Total files:** 31

### Example from `static/app/components/globalDrawer/index.stories.tsx`

```tsx
const LeftButton = styled(Button)`
  margin: 12px 0;
  display: block;
`;
```

### Why Developers Use This

- **Implicit full-width:** Block elements naturally fill container width
- **Vertical stacking:** Makes buttons stack vertically in a container
- **Cleaner CSS:** Avoids explicit `width: 100%`

### Common Files Using This Pattern

- `static/app/components/globalDrawer/index.stories.tsx`
- `static/app/components/banner.tsx`
- `static/app/components/events/interfaces/nativeFrame.tsx`
- `static/app/components/events/highlights/highlightsDataSection.tsx`
- `static/gsApp/views/subscriptionPage/subscriptionUpsellBanner.tsx`

---

## Pattern 3: ButtonBar and Container Components

### Overview

The codebase has a dedicated `ButtonBar` component that handles button layout using CSS Grid. This is the **most common pattern** for managing multiple buttons.

**Total files:** 219 files use ButtonBar or similar components

### ButtonBar Implementation

From `static/app/components/core/button/buttonBar.tsx`:

```tsx
export function ButtonBar({
  children,
  merged = false,
  gap = 'md',
  ...props
}: ButtonBarProps) {
  return (
    <StyledButtonBar merged={merged} gap={gap} {...props}>
      {children}
    </StyledButtonBar>
  );
}

const StyledButtonBar = styled('div')`
  display: grid;
  grid-auto-flow: column;
  grid-column-gap: ${p => p.theme.space[p.gap]};
  align-items: center;
`;
```

### Usage Example

From `static/app/components/modals/navigateToExternalLinkModal.tsx`:

```tsx
<ButtonBar>
  <LinkButton priority="primary" href={linkText} onClick={handleClose} external>
    {t('Continue')}
  </LinkButton>
  <Button priority="default" onClick={handleClose}>
    {t('Cancel')}
  </Button>
</ButtonBar>
```

**Alternative Pattern:** Custom ButtonBar

Many files define their own `ButtonBar` styled component:

```tsx
const ButtonBar = styled('div')`
  display: flex;
  flex-direction: row;
  gap: 5px;
  justify-content: end;
`;
```

### Benefits

- **Consistent spacing:** Handles gaps between buttons automatically
- **Merged buttons:** Supports "pill bar" style with merged borders
- **Responsive layout:** Can adapt to different screen sizes
- **Reusability:** Single component for all button groups

### Common Use Cases

- Modal footers (action buttons)
- Form submission areas
- Toolbar button groups
- Navigation button sets

---

## Pattern 4: Wrapper-Based Width Control

### Overview

Instead of styling the button directly, developers wrap buttons in styled containers that control child sizing through flex or grid properties.

**Total files:** 167 files use this pattern

### Example 1: Flex Container Controls Width

```tsx
const ButtonWrapper = styled('div')`
  display: flex;
  > * {
    flex: 1; // All children (buttons) grow equally
  }
`;

<ButtonWrapper>
  <Button>Action 1</Button>
  <Button>Action 2</Button>
</ButtonWrapper>;
```

### Example 2: Grid Container Sets Width

```tsx
const GridContainer = styled('div')`
  display: grid;
  grid-template-columns: 1fr 1fr; // Two equal columns
  gap: ${space(1)};
`;

<GridContainer>
  <Button>Left</Button>
  <Button>Right</Button>
</GridContainer>;
```

### Why This Pattern?

- **Separation of concerns:** Layout logic in container, not button
- **Consistency:** All buttons in container behave the same way
- **Flexibility:** Easy to adjust all buttons by changing container
- **Reusability:** Button component stays generic

### Common Wrapper Names

- `ActionBar`, `Actions`, `ButtonWrapper`
- `Footer`, `ModalFooter`, `DrawerFooter`
- `Toolbar`, `Controls`, `ButtonGroup`

---

## Pattern 5: CSS Grid Positioning

### Overview

Using CSS Grid properties like `grid-column` to control button sizing and positioning within a grid layout.

**Files identified:** 4+

### Example from `static/app/components/events/highlights/editHighlightsModal.tsx`

```tsx
const EditButton = styled(Button)`
  grid-column: span 1;
  width: 18px;
  height: 18px;
  align-self: start;
`;
```

### Example from `static/app/components/replays/jumpButtons.tsx`

```tsx
const JumpButton = styled(Button)`
  position: absolute;
  justify-self: center;
`;
```

### When to Use

- **Complex layouts:** When buttons are part of multi-column grids
- **Precise positioning:** When buttons need specific grid placement
- **Responsive design:** Grid columns can adjust to screen size

---

## Pattern 6: Display Flex on Button

### Overview

Some styled buttons use `display: flex` to control internal layout (for icons + text) rather than width, but this can be combined with flex-grow for expansion.

**Example from `static/gsApp/views/amCheckout/components/cart.tsx`:**

```tsx
const StyledButton = styled(Button)`
  display: flex;
  flex-grow: 1;
  align-items: center;
  justify-content: center;
`;
```

### Use Case

- Buttons need to both **expand width** AND **control internal layout**
- Commonly used with icons + text combinations

---

## Best Practices and Recommendations

### 1. **Prefer Container-Based Approaches**

✅ **Recommended:**

```tsx
<ButtonBar gap="md">
  <Button>Action 1</Button>
  <Button>Action 2</Button>
</ButtonBar>
```

❌ **Less ideal:**

```tsx
<div>
  <StyledButton>Action 1</StyledButton>
  <StyledButton>Action 2</StyledButton>
</div>;

const StyledButton = styled(Button)`
  width: 100%;
  margin-bottom: ${space(1)};
`;
```

**Why:** Container handles layout, buttons stay generic and reusable.

### 2. **Use ButtonBar for Multiple Buttons**

The `ButtonBar` component is specifically designed for button groups and handles:

- Spacing/gaps
- Alignment
- Merged borders (when needed)
- Responsive behavior

### 3. **Display Block for Single Full-Width Buttons**

When you need a single button to fill width:

```tsx
const FullWidthButton = styled(Button)`
  display: block;
`;
```

This is cleaner than `width: 100%` for simple cases.

### 4. **Grid for Complex Layouts**

When buttons are part of a complex multi-element grid:

```tsx
const FormGrid = styled('div')`
  display: grid;
  grid-template-columns: 1fr 1fr auto;
  gap: ${space(2)};
`;
```

---

## Summary Statistics

| Approach                | Files | When to Use                                  |
| ----------------------- | ----- | -------------------------------------------- |
| **Direct width rules**  | 14    | Explicit control, single button scenarios    |
| **Display block**       | 31    | Single full-width buttons, vertical stacking |
| **ButtonBar component** | 219   | Multiple buttons, standard layouts           |
| **Wrapper patterns**    | 167   | Custom layouts, complex UIs                  |
| **Grid positioning**    | 4+    | Multi-element grids, precise positioning     |

---

## Migration Opportunities

Based on this analysis, there may be opportunities to:

1. **Consolidate to ButtonBar:** Some files using custom wrappers could use the standard `ButtonBar` component
2. **Replace width: 100% with display: block:** In simple single-button cases
3. **Standardize wrapper patterns:** Create reusable layout components for common patterns

---

## Related Components

### Core Button Components

- **`Button`** (`@sentry/scraps/button`) - Primary button component
- **`LinkButton`** (`@sentry/scraps/button`) - Button styled as link
- **`ButtonBar`** (`sentry/components/core/button`) - Button group container

### Layout Components

- **`Flex`** (`@sentry/scraps/layout`) - Flex layout primitive
- **`Grid`** (`@sentry/scraps/layout`) - Grid layout primitive
- **`Stack`** (`@sentry/scraps/layout`) - Vertical/horizontal stacking

---

## Conclusion

The Sentry codebase uses a **diverse set of patterns** for button width styling:

- **14 files** use direct CSS width-expanding rules
- **31 files** use `display: block` for implicit full-width
- **219 files** use `ButtonBar` or similar container components (most common)
- **167 files** use wrapper-based approaches
- **Grid positioning** used in specialized layouts

The **ButtonBar component is the recommended approach** for most multi-button scenarios, while **display: block** works well for simple single-button cases. Direct width rules should be used sparingly when explicit control is needed.
