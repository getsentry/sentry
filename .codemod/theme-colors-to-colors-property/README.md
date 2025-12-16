# Theme Colors to colors Property Codemod

This codemod transforms **deprecated** theme color references to use the correct `theme.colors` property, respecting the color mappings defined in `theme.tsx`.

## ⚠️ Important: Mappings Are NOT 1:1!

The deprecated color properties on `theme` don't always map to the same name in `theme.colors`. For example:

- `theme.gray500` → `theme.colors.gray800` (NOT gray500!)
- `theme.gray400` → `theme.colors.gray500` (NOT gray400!)
- `theme.purple400` → `theme.colors.blue500` (purple maps to blue!)
- `theme.blue400` → `theme.colors.blue500` (NOT blue400!)

This codemod uses the exact mappings from `deprecatedColorMappings` in `static/app/utils/theme/theme.tsx`.

## What it does

Transforms deprecated color property access to use the correct `theme.colors` property:

### Before
```tsx
const StyledDiv = styled('div')`
  background: ${p => p.theme.gray100};
  color: ${p => p.theme.gray500};
`;

const color = theme.blue400;
const purple = theme.purple300;
```

### After
```tsx
const StyledDiv = styled('div')`
  background: ${p => p.theme.colors.gray100};
  color: ${p => p.theme.colors.gray800};  // Note: gray500 → gray800!
`;

const color = theme.colors.blue500;  // Note: blue400 → blue500!
const purple = theme.colors.blue400;  // Note: purple300 → blue400!
```

## Deprecated Color Mappings

The codemod transforms these deprecated colors (based on `deprecatedColorMappings` in theme.tsx):

### Gray Colors
- `gray100` → `colors.gray100` ✓ (same)
- `gray200` → `colors.gray200` ✓ (same)
- `gray300` → `colors.gray400` ⚠️ (shifted!)
- `gray400` → `colors.gray500` ⚠️ (shifted!)
- `gray500` → `colors.gray800` ⚠️ (shifted!)

### Surface Colors
- `surface100` → `colors.surface200` ⚠️ (shifted!)
- `surface200` → `colors.surface300` ⚠️ (shifted!)
- `surface300` → `colors.surface400` ⚠️ (shifted!)
- `surface400` → `colors.surface500` ⚠️ (shifted!)
- `surface500` → `colors.surface500` ✓ (same)

### Purple Colors (map to Blue!)
- `purple100` → `colors.blue100` ⚠️
- `purple200` → `colors.blue200` ⚠️
- `purple300` → `colors.blue400` ⚠️
- `purple400` → `colors.blue500` ⚠️

### Blue Colors
- `blue100` → `colors.blue100` ✓ (same)
- `blue200` → `colors.blue200` ✓ (same)
- `blue300` → `colors.blue400` ⚠️ (shifted!)
- `blue400` → `colors.blue500` ⚠️ (shifted!)

### Pink Colors
- `pink100` → `colors.pink100` ✓ (same)
- `pink200` → `colors.pink200` ✓ (same)
- `pink300` → `colors.pink400` ⚠️ (shifted!)
- `pink400` → `colors.pink500` ⚠️ (shifted!)

### Red Colors
- `red100` → `colors.red100` ✓ (same)
- `red200` → `colors.red200` ✓ (same)
- `red300` → `colors.red400` ⚠️ (shifted!)
- `red400` → `colors.red500` ⚠️ (shifted!)

### Yellow Colors
- `yellow100` → `colors.yellow100` ✓ (same)
- `yellow200` → `colors.yellow200` ✓ (same)
- `yellow300` → `colors.yellow400` ⚠️ (shifted!)
- `yellow400` → `colors.yellow500` ⚠️ (shifted!)

### Green Colors
- `green100` → `colors.green100` ✓ (same)
- `green200` → `colors.green200` ✓ (same)
- `green300` → `colors.green400` ⚠️ (shifted!)
- `green400` → `colors.green500` ⚠️ (shifted!)

### Other Colors
- `black` → `colors.black` ✓
- `white` → `colors.white` ✓
- `translucentSurface100` → `colors.surface100`
- `translucentSurface200` → `colors.surface200`
- `translucentGray100` → `colors.gray100`
- `translucentGray200` → `colors.gray200`
- `lightModeBlack` → `colors.black`
- `lightModeWhite` → `colors.white`

## What it doesn't transform

The codemod is smart about what it transforms:

- ❌ String literals like `"gray100"` are NOT transformed
- ❌ Already transformed code like `theme.colors.gray100` is left as-is
- ❌ Non-theme objects like `myObj.gray100` are NOT transformed
- ❌ Non-color theme properties like `theme.space` are NOT touched

## Running the codemod

### Using the workflow (recommended)

```bash
npx codemod workflow run -w .codemod/theme-colors-to-colors-property/workflow.yaml -t /path/to/target
```

### Running directly

```bash
cd .codemod/theme-colors-to-colors-property
npx codemod jssg run -l tsx ./scripts/codemod.ts /path/to/target
```

### Running tests

```bash
cd .codemod/theme-colors-to-colors-property
pnpm test
```

## Examples

### Styled components
```tsx
// Before
const Button = styled('button')`
  background: ${p => p.theme.blue400};
  color: ${p => p.theme.white};
  border: 1px solid ${p => p.theme.gray200};
`;

// After
const Button = styled('button')`
  background: ${p => p.theme.colors.blue400};
  color: ${p => p.theme.colors.white};
  border: 1px solid ${p => p.theme.colors.gray200};
`;
```

### Direct access
```tsx
// Before
function Component({theme}) {
  return <div style={{color: theme.gray800}}>Hello</div>;
}

// After
function Component({theme}) {
  return <div style={{color: theme.colors.gray800}}>Hello</div>;
}
```

### Nested access
```tsx
// Before
const getColor = (props) => props.theme.red500;

// After
const getColor = (props) => props.theme.colors.red500;
```
