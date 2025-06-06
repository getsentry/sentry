# Project Filter Scroll Fix

## Issue Description
The project filter menu was scrolling unexpectedly when hovering over menu items with the mouse. Users reported that moving the mouse to the bottom of the last visible item would cause the component to scroll down without explicit user scrolling.

**GitHub Issue**: #86251

## Root Cause
The issue was caused by the `shouldFocusOnHover` prop being set to `true` (default) in the project filter component. This prop instructs the React Aria library to automatically focus elements when they are hovered over. When an element gains focus via the `.focus()` method, browsers automatically scroll that element into view, which was causing the unwanted scrolling behavior.

## Solution
Added `shouldFocusOnHover={false}` to the `HybridFilter` component in the project filter to prevent focus-on-hover behavior while preserving keyboard navigation focus.

## Code Changes
**File**: `static/app/components/organizations/projectPageFilter/index.tsx`

```tsx
<HybridFilter
  {...selectProps}
  searchable
  checkboxPosition="trailing"
  multiple={allowMultiple}
  shouldFocusOnHover={false}  // <- Added this line
  options={options}
  // ... rest of props
/>
```

## Behavior After Fix
- ✅ Mouse hover over menu items: No scrolling
- ✅ Keyboard navigation (Arrow keys): Focus and scroll work correctly
- ✅ All other functionality preserved (selection, checkboxes, etc.)

## Testing
The fix maintains the existing distinction between mouse interaction and keyboard navigation:
- Mouse hover will highlight items visually but won't cause scrolling
- Keyboard navigation (Arrow Up/Down) will properly focus items and scroll them into view when needed

This matches the expected behavior tested in the AutoComplete component's test suite.
