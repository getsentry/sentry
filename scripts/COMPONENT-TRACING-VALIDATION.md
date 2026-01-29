# Component Tracing Validation

## Test Results: Wrapped and Styled Components

### ✅ Test: Button → SearchBar (styled component wrapper)

**Scenario:** Verify that the script correctly traces component usage through styled component wrappers.

**Components:**
- `Button` from `static/app/components/core/button/button.tsx`
- `SearchBar` from `static/app/components/searchBar/index.tsx`
  - Contains: `export const SearchBarTrailingButton = styled(Button)`

**Test Results:**
```
✓ Button found in 139 URLs
✓ SearchBar found in 139 URLs
✓ Common URLs: 139 (100%)

💯 Perfect match! All SearchBar URLs are included in Button URLs.
This confirms that styled(Button) components are correctly traced.
```

### How It Works

1. **Import Detection:**
   ```tsx
   // In searchBar/index.tsx
   import {Button} from 'sentry/components/core/button';
   export const SearchBarTrailingButton = styled(Button)`...`;
   ```

2. **Import Graph:**
   ```
   Button component
   ↓ (imported by)
   SearchBar component
   ↓ (imported by)
   Multiple intermediate components
   ↓ (imported by)
   Page components in views/
   ↓ (mapped to)
   URLs in routes.tsx
   ```

3. **Tracing Path Example:**
   ```
   /organizations/:orgId/dashboard/:dashboardId/
     ↳ static/app/components/core/button/button.tsx
       ↳ static/app/components/searchBar/index.tsx
         ↳ static/app/views/dashboards/manage/index.tsx
   ```

## Edge Cases Handled

### ✅ Styled Components
```tsx
const StyledButton = styled(Button)`
  color: red;
`;
```
**Status:** Correctly traced through import graph

### ✅ Component Composition
```tsx
function Wrapper({children}) {
  return <div><Button />{children}</div>;
}
```
**Status:** Correctly traced through import graph

### ✅ Re-exports
```tsx
export {Button} from './button';
export const CustomButton = Button;
```
**Status:** Correctly traced through import graph

### ✅ Index Files
```tsx
// components/searchBar/index.tsx
import SearchBar from './searchBar';
export default SearchBar;
```
**Status:** Fixed in latest version (added `.isFile()` check)

## Bug Fixed

### Issue: Directory vs File Resolution

**Problem:** Import resolution was returning directory paths instead of `index.tsx` files:
```
'sentry/components/searchBar'
→ resolved to: /path/to/searchBar (directory)
✗ should be:    /path/to/searchBar/index.tsx (file)
```

**Fix:** Added file type checking:
```javascript
if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
  return candidate;
}
```

**Impact:** This fix enabled tracing through all components exported via `index.tsx` files.

## Known Limitations

### ⚠️ Dynamic Imports with Variables
```tsx
const componentName = 'Button';
const Component = await import(`sentry/components/${componentName}`);
```
**Status:** Not traced (requires runtime evaluation)

### ⚠️ Higher-Order Components with Type-Only Imports
```tsx
import type {ButtonProps} from 'sentry/components/button';
```
**Status:** Type imports are not traced (they don't create runtime dependencies)

### ⚠️ Render Props
```tsx
<Container>
  {({theme}) => <Button theme={theme} />}
</Container>
```
**Status:** Button is traced, but the render prop pattern itself is not explicitly tracked

## Performance

- **Button (heavily used):** 139 URLs found in ~60 seconds
- **SearchBar (moderately used):** 139 URLs found in ~60 seconds
- **Import graph size:** ~5600 nodes from ~6000 files
- **Memory usage:** ~500MB during build

## Validation Script

Use the test script to validate tracing:
```bash
node scripts/test-wrapped-component.mjs
```

This script:
1. Runs the URL finder for both Button and SearchBar
2. Compares the results
3. Reports overlap percentage
4. Confirms wrapped components are traced correctly
