# Usage Guide

## ⚠️ Important Note

This codemod respects the **deprecated color mappings** from `theme.tsx`. Many colors have **shifted mappings** where the deprecated name maps to a different color value! For example:

- `theme.gray500` → `theme.colors.gray800` (NOT gray500!)
- `theme.blue400` → `theme.colors.blue500` (NOT blue400!)
- `theme.purple400` → `theme.colors.blue500` (purple maps to blue!)

See the README for the complete mapping table.

## Quick Start

Run the codemod on your codebase:

```bash
# Test on a specific directory (dry run to preview changes)
npx codemod workflow run \
  -w .codemod/theme-colors-to-colors-property/workflow.yaml \
  -t ./static \
  --dry-run

# Apply changes to the entire codebase
npx codemod workflow run \
  -w .codemod/theme-colors-to-colors-property/workflow.yaml \
  -t ./static
```

## Before and After Examples

### Example 1: Styled Components (Note the shifted mapping!)

**Before:**
```tsx
const StyledDiv = styled('div')`
  background: ${p => p.theme.gray100};
  color: ${p => p.theme.gray500};
  border: 1px solid ${props => props.theme.gray200};
`;
```

**After:**
```tsx
const StyledDiv = styled('div')`
  background: ${p => p.theme.colors.gray100};
  color: ${p => p.theme.colors.gray800};  // Note: gray500 → gray800!
  border: 1px solid ${props => props.theme.colors.gray200};
`;
```

### Example 2: Direct Theme Access (Note the shifted mappings!)

**Before:**
```tsx
function Component({theme}) {
  const backgroundColor = theme.gray200;
  const textColor = theme.gray400;

  return (
    <div style={{
      color: theme.gray500,
      backgroundColor: theme.surface100,
      borderColor: theme.blue400
    }}>
      Content
    </div>
  );
}
```

**After:**
```tsx
function Component({theme}) {
  const backgroundColor = theme.colors.gray200;
  const textColor = theme.colors.gray500;  // Note: gray400 → gray500!

  return (
    <div style={{
      color: theme.colors.gray800,  // Note: gray500 → gray800!
      backgroundColor: theme.colors.surface200,  // Note: surface100 → surface200!
      borderColor: theme.colors.blue500  // Note: blue400 → blue500!
    }}>
      Content
    </div>
  );
}
```

### Example 3: String Literals (NOT Transformed)

**Before:**
```tsx
const colorName = "gray100";  // String literal - NOT transformed
const config = {
  key: "blue500",              // String literal - NOT transformed
  value: theme.blue500         // This WILL be transformed
};
```

**After:**
```tsx
const colorName = "gray100";  // String literal - NOT transformed
const config = {
  key: "blue500",              // String literal - NOT transformed
  value: theme.colors.blue500  // Transformed!
};
```

### Example 4: All Color Types (Note the shifted mappings!)

**Before:**
```tsx
const colors = {
  gray: theme.gray300,
  surface: theme.surface100,
  blue: theme.blue400,
  pink: theme.pink300,
  red: theme.red400,
  yellow: theme.yellow300,
  green: theme.green400,
  purple: theme.purple400,
  black: theme.black,
  white: theme.white
};
```

**After:**
```tsx
const colors = {
  gray: theme.colors.gray400,      // gray300 → gray400
  surface: theme.colors.surface200, // surface100 → surface200
  blue: theme.colors.blue500,       // blue400 → blue500
  pink: theme.colors.pink400,       // pink300 → pink400
  red: theme.colors.red500,         // red400 → red500
  yellow: theme.colors.yellow400,   // yellow300 → yellow400
  green: theme.colors.green500,     // green400 → green500
  purple: theme.colors.blue500,     // purple400 → blue500 (purple maps to blue!)
  black: theme.colors.black,
  white: theme.colors.white
};
```

### Example 5: Already Transformed (No Change)

**Before:**
```tsx
const color1 = theme.colors.gray100;  // Already transformed
const color2 = theme.colors.blue500;  // Already transformed
```

**After:**
```tsx
const color1 = theme.colors.gray100;  // No change
const color2 = theme.colors.blue500;  // No change
```

## Testing

Run the test suite to verify the codemod works correctly:

```bash
cd .codemod/theme-colors-to-colors-property
pnpm test
```

All tests should pass:
- ✅ positive-basic: Basic transformations
- ✅ positive-multiple: Multiple color references
- ✅ positive-all-colors: All color types
- ✅ negative-strings: String literals not transformed
- ✅ negative-chained: Already transformed code
- ✅ edge-template-literal: Template literals and various syntaxes

## Files Affected

This codemod will transform:
- `**/*.tsx` - TypeScript React files
- `**/*.ts` - TypeScript files
- `**/*.jsx` - JavaScript React files
- `**/*.js` - JavaScript files

It will skip:
- `**/node_modules/**`
- `**/*.test.ts(x)`
- `**/*.spec.ts(x)`
- `**/dist/**`
- `**/build/**`

## Deprecated Colors That Will Be Transformed

Only colors in the `deprecatedColorMappings` will be transformed:

| Color Type | Deprecated Properties | Notes |
|------------|----------------------|-------|
| Gray | `gray100` - `gray500` | ⚠️ gray300-500 have shifted mappings! |
| Surface | `surface100` - `surface500` | ⚠️ All except surface500 are shifted! |
| Purple | `purple100` - `purple400` | ⚠️ Maps to **blue** colors! |
| Blue | `blue100` - `blue400` | ⚠️ blue300-400 have shifted mappings! |
| Pink | `pink100` - `pink400` | ⚠️ pink300-400 have shifted mappings! |
| Red | `red100` - `red400` | ⚠️ red300-400 have shifted mappings! |
| Yellow | `yellow100` - `yellow400` | ⚠️ yellow300-400 have shifted mappings! |
| Green | `green100` - `green400` | ⚠️ green300-400 have shifted mappings! |
| Black/White | `black`, `white` | ✓ Same mapping |
| Translucent | `translucentGray100/200`, `translucentSurface100/200` | ✓ Same mapping |

**Colors NOT in this list** (like `gray600`, `gray700`, `gray800`, `blue500`, etc.) are **NOT deprecated** and should already be accessed via `theme.colors.X`. If you see code like `theme.gray800`, it's likely invalid code since `gray800` doesn't exist as a top-level theme property.
