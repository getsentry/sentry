# Migrate Gray Colors Codemod

This codemod migrates gray color references from the legacy `theme.grayXXX` format to the new `theme.colors.grayXXX` structure.

## Color Mappings

Based on the `deprecatedColorMappings` in `static/app/utils/theme/theme.tsx`, this codemod transforms:

| Legacy                     | New                    |
| -------------------------- | ---------------------- |
| `theme.gray500`            | `theme.colors.gray800` |
| `theme.gray400`            | `theme.colors.gray500` |
| `theme.gray300`            | `theme.colors.gray400` |
| `theme.gray200`            | `theme.colors.gray200` |
| `theme.gray100`            | `theme.colors.gray100` |
| `theme.translucentGray200` | `theme.colors.gray200` |
| `theme.translucentGray100` | `theme.colors.gray100` |

## What Gets Transformed

✅ **Transforms:**

- Direct theme access: `theme.gray300` → `theme.colors.gray400`
- Props access: `p.theme.gray300` → `p.theme.colors.gray400`
- Props object access: `props.theme.gray300` → `props.theme.colors.gray400`
- All gray color variants (gray100, gray200, gray300, gray400, gray500)
- Translucent gray variants (translucentGray100, translucentGray200)

❌ **Does NOT Transform:**

- String values: `"gray100"` (remains unchanged)
- Non-theme gray references: `customObj.gray100` (remains unchanged)
- Already migrated colors: `theme.colors.gray100` (remains unchanged)
- Object property names
- Comments

## Installation

```bash
cd codemods/migrate-gray-colors
pnpm install
```

## Running Tests

```bash
# Run all tests
pnpm test

# Run with verbose output
npx codemod jssg test -l tsx ./scripts/codemod.ts -v

# Update test snapshots if needed
npx codemod jssg test -l tsx ./scripts/codemod.ts -u
```

## Usage

### Option 1: Run on specific files

```bash
npx codemod jssg run -l tsx ./scripts/codemod.ts <target-file-or-directory>
```

### Option 2: Run on the entire Sentry frontend

```bash
# From the codemod directory
npx codemod jssg run -l tsx ./scripts/codemod.ts ../../static/app

# Or from the Sentry root
npx codemod jssg run -l tsx ./codemods/migrate-gray-colors/scripts/codemod.ts ./static/app
```

### Option 3: Run with workflow (recommended for large-scale changes)

Create a `workflow.yaml` file:

```yaml
version: '1'
nodes:
  transform:
    js-ast-grep:
      js_file: scripts/codemod.ts
      include:
        - '**/*.ts'
        - '**/*.tsx'
      exclude:
        - '**/*.test.ts'
        - '**/*.spec.ts'
        - '**/node_modules/**'
```

Then run:

```bash
npx codemod workflow run -w workflow.yaml -t ../../static/app
```

## Examples

### Before

```typescript
const styles = (theme: Theme) => css`
  color: ${theme.gray500};
  background: ${theme.gray300};
  border: 1px solid ${p => p.theme.gray200};
`;

const colors = {
  text: theme.gray400,
  bg: theme.translucentGray100,
};
```

### After

```typescript
const styles = (theme: Theme) => css`
  color: ${theme.colors.gray800};
  background: ${theme.colors.gray400};
  border: 1px solid ${p => p.theme.colors.gray200};
`;

const colors = {
  text: theme.colors.gray500,
  bg: theme.colors.gray100,
};
```

## Test Coverage

The codemod includes comprehensive tests for:

1. **Basic Transformations**: All gray color variants with different theme access patterns
2. **Negative Cases**: Ensures strings, non-theme references, and already-migrated code remain unchanged
3. **Edge Cases**: Complex expressions, nested usage, function calls, and multiple transformations on the same line

## Notes

- This codemod only handles **gray colors**. Other color migrations (blue, red, green, etc.) should be handled separately.
- The codemod preserves the original formatting and only modifies the color references.
- Already migrated code (`theme.colors.grayXXX`) is safely ignored.
