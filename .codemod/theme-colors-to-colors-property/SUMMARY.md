# Codemod Summary: Theme Colors to colors Property

## ✅ Verification Complete

The codemod has been fully validated against the `deprecatedColorMappings` in `static/app/utils/theme/theme.tsx`. All mappings are correct and tests are passing.

## 🎯 What This Codemod Does

Transforms deprecated theme color references to use `theme.colors`, respecting the **exact mappings** from `deprecatedColorMappings`:

```tsx
// Before
const color = theme.gray500; // Deprecated property
const bg = theme.blue400; // Deprecated property
const purple = theme.purple300; // Deprecated property

// After (with CORRECT mappings!)
const color = theme.colors.gray800; // gray500 → gray800 (shifted!)
const bg = theme.colors.blue500; // blue400 → blue500 (shifted!)
const purple = theme.colors.blue400; // purple300 → blue400 (different color!)
```

## ⚠️ Critical: Mappings Are NOT 1:1!

Many deprecated colors map to **different** values in `theme.colors`:

### Key Shifted Mappings

- `gray500` → `colors.gray800` (NOT gray500!)
- `gray400` → `colors.gray500` (NOT gray400!)
- `gray300` → `colors.gray400` (NOT gray300!)
- `blue400` → `colors.blue500` (NOT blue400!)
- `blue300` → `colors.blue400` (NOT blue300!)
- Similar pattern for pink, red, yellow, green colors (300/400 are shifted)

### Purple Maps to Blue!

- `purple400` → `colors.blue500`
- `purple300` → `colors.blue400`
- `purple200` → `colors.blue200`
- `purple100` → `colors.blue100`

### Surface Colors Are Shifted

- `surface100` → `colors.surface200`
- `surface200` → `colors.surface300`
- `surface300` → `colors.surface400`
- `surface400` → `colors.surface500`
- `surface500` → `colors.surface500` (only this one is the same!)

## 📋 Complete Mapping Table

See `README.md` for the full mapping table with all 50+ deprecated colors.

## ✅ Test Coverage

All 6 test suites pass:

- ✅ `positive-basic` - Basic transformations
- ✅ `positive-multiple` - Multiple color references
- ✅ `positive-all-colors` - All deprecated color types including purple→blue
- ✅ `negative-strings` - String literals NOT transformed
- ✅ `negative-chained` - Already transformed code unchanged
- ✅ `edge-template-literal` - Template literals and various syntaxes

## 🚀 Usage

### Run Tests

```bash
cd .codemod/theme-colors-to-colors-property
pnpm test
```

### Apply to Codebase

```bash
npx codemod workflow run \
  -w .codemod/theme-colors-to-colors-property/workflow.yaml \
  -t ./static
```

### Dry Run (Preview)

```bash
npx codemod workflow run \
  -w .codemod/theme-colors-to-colors-property/workflow.yaml \
  -t ./static \
  --dry-run
```

## 📁 Files

- `scripts/codemod.ts` - Main transformation logic with complete mapping table
- `tests/` - 6 comprehensive test cases
- `README.md` - Complete documentation with mapping table
- `USAGE.md` - Usage guide with examples
- `workflow.yaml` - Workflow configuration
- `package.json` - Dependencies and scripts

## 🔍 What Gets Transformed

Only the **50+ deprecated colors** from `deprecatedColorMappings`:

- Gray: 100, 200, 300, 400, 500
- Surface: 100, 200, 300, 400, 500
- Purple: 100, 200, 300, 400 (maps to blue!)
- Blue: 100, 200, 300, 400
- Pink: 100, 200, 300, 400
- Red: 100, 200, 300, 400
- Yellow: 100, 200, 300, 400
- Green: 100, 200, 300, 400
- Black, White, and translucent variants

## 🚫 What Doesn't Get Transformed

- String literals: `"gray100"` stays as-is
- Already transformed: `theme.colors.gray100` stays as-is
- Non-theme objects: `myObj.gray100` stays as-is
- Non-deprecated colors: `theme.gray800` (doesn't exist, would be invalid code)
- Other theme properties: `theme.space`, `theme.fontSize`, etc.

## ✨ Key Features

1. **Correct Mappings** - Uses exact mappings from theme.tsx
2. **Smart Detection** - Only transforms deprecated colors
3. **Nested Access** - Handles `p.theme.gray100`, `props.theme.gray100`, etc.
4. **Template Literals** - Works in styled-components and template strings
5. **Safe** - Skips string literals and non-theme objects
6. **Comprehensive Tests** - All edge cases covered

## 📊 Expected Impact

When run on the Sentry codebase, this codemod will:

- Transform all deprecated theme color accesses
- Update colors to their correct mapped values
- Maintain visual appearance (colors map to same underlying values)
- Enable eventual removal of deprecatedColorMappings from theme
