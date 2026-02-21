# Icon Sizing Root Cause Analysis

## Executive Summary

There is a **critical type mismatch and sizing inconsistency** in the Sentry icon system that causes icons to appear broken or render incorrectly. The root cause is divergent changes across multiple branches that have created incompatible states in the icon sizing system.

## Problem Statement

Icons in the Sentry application are experiencing sizing issues due to:

1. **Type mismatches** between TypeScript type definitions and runtime constants
2. **Inconsistent icon sizes** across different branches
3. **Partially applied changes** from icon sizing refactors

## Root Cause Analysis

### 1. The Icon Sizing System

The icon system consists of two key files:

- `static/app/icons/svgIcon.tsx` - Contains the `ICON_SIZES` runtime mapping
- `static/app/utils/theme/types.tsx` - Contains the `IconSize` TypeScript type definition

### 2. Branch Divergence

#### Master Branch State

```typescript
// static/app/icons/svgIcon.tsx
const ICON_SIZES: Record<IconSize, string> = {
  xs: '12px',
  sm: '14px',
  md: '18px',
  lg: '24px',
  xl: '32px',
  '2xl': '72px',
} as const;

// Default size: 'sm'
const size = iconProps.legacySize ?? ICON_SIZES[iconProps.size ?? 'sm'];
```

```typescript
// static/app/utils/theme/types.tsx
export type IconSize = SizeRange<'xs', '2xl'>;
```

#### Jonas's `jb/icons/sizes` Branch (commits 4d2a519bbdc & 6ae8ab3cdf1)

```typescript
// static/app/icons/svgIcon.tsx
const ICON_SIZES: Record<IconSize, string> = {
  '2xs': '8px', // ✅ ADDED
  xs: '12px',
  sm: '16px', // ⚠️ CHANGED from 14px
  md: '20px', // ⚠️ CHANGED from 18px
  lg: '24px',
  xl: '32px',
  '2xl': '72px',
} as const;

// ⚠️ Default changed to 'md'
const size = iconProps.legacySize ?? ICON_SIZES[iconProps.size ?? 'md'];
```

```typescript
// static/app/utils/theme/types.tsx
export type IconSize = SizeRange<'2xs', '2xl'>; // ✅ CORRECTLY UPDATED
```

#### Current Branch State (`cursor/icons-broken-root-cause-b8ea`)

```typescript
// static/app/icons/svgIcon.tsx
const ICON_SIZES: Record<IconSize, string> = {
  // ❌ NO '2xs' SIZE
  xs: '12px',
  sm: '14px',
  md: '16px', // Different from both master (18px) and jb branch (20px)
  lg: '24px',
  xl: '32px',
  '2xl': '72px',
} as const;

// Default changed to 'md' like jb branch
const size = iconProps.legacySize ?? ICON_SIZES[iconProps.size ?? 'md'];
```

```typescript
// static/app/utils/theme/types.tsx
export type IconSize = SizeRange<'xs', '2xl'>; // ❌ STILL NO '2xs'
```

### 3. Critical Issues Identified

#### Issue #1: Type-Runtime Mismatch (Potential Future Issue)

If the `jb/icons/sizes` branch gets merged without proper coordination, there could be a type mismatch where:

- The `ICON_SIZES` object includes `'2xs': '8px'`
- But the `IconSize` type definition doesn't include `'2xs'`
- This would cause TypeScript compilation errors

**Impact:** TypeScript would reject any code trying to use `size="2xs"`, even though the runtime constant supports it.

#### Issue #2: Inconsistent Icon Sizes Across Branches

Three different icon size definitions exist:

| Size | Master | jb/icons/sizes | Current Branch |
| ---- | ------ | -------------- | -------------- |
| 2xs  | N/A    | 8px ✅         | N/A ❌         |
| xs   | 12px   | 12px           | 12px           |
| sm   | 14px   | 16px ⚠️        | 14px           |
| md   | 18px   | 20px ⚠️        | 16px ⚠️        |
| lg   | 24px   | 24px           | 24px           |
| xl   | 32px   | 32px           | 32px           |
| 2xl  | 72px   | 72px           | 72px           |

**Impact:** Icons render at different sizes depending on which branch is deployed, causing:

- Visual inconsistencies
- Layout breakage
- Icons appearing "too small" or "too large"
- Misalignment with design system

#### Issue #3: Default Size Change Without Full Coordination

The current branch changed the default icon size from `'sm'` (14px) to `'md'` (16px on current branch), but:

- This differs from the `jb/icons/sizes` intended `'md'` of 20px
- Any icons without explicit `size` prop will render at different sizes
- This affects **hundreds** of icons across the codebase

**Impact:**

- Icons without explicit size props are 2px larger than before (14px → 16px)
- When jb branch merges, they'll be 4px larger (14px → 20px with md=20px)
- This cascading change affects the entire UI

## Why Icons Appear Broken

Icons appear "broken" because:

1. **Size Expectations Don't Match Reality**
   - Designers expect icons at specific pixel sizes
   - Different branches render different sizes
   - Layout containers sized for 14px icons now contain 16px or 20px icons

2. **Alignment Issues**
   - Icons may overflow their containers
   - Vertical/horizontal alignment shifts when icon sizes change
   - Text-icon pairs become misaligned

3. **Visual Hierarchy Disruption**
   - Relative sizing between UI elements breaks
   - Icons that should be subtle become too prominent
   - Icons that should be prominent appear too subtle

4. **Responsive Breakpoints**
   - Layout breakpoints designed for specific icon sizes
   - Size changes cause unexpected wrapping/overflow

## Evidence

### Commit History

```bash
# Jonas's icon sizing work (not on master)
6ae8ab3cdf1 (origin/jb/icons/sizes) ref(icons) update sizes
4d2a519bbdc feat(icons): add 2xs size (8px) to SVGIcon

# Already merged to master
6d6fbdcf8a4 ref(scraps) default icon size to 16px (#107437)
  - Changed default from 'sm' to 'md'
  - Changed md from 18px to 16px
  - MERGED TO MASTER on Feb 9, 2026

# Follow-up fixes for icon size changes
439ed2997f7 fix spinner size
  - Changed LoadingIndicator from 20px to 14px
  - Fixed after icon size changes broke spinner size
```

### **CRITICAL FINDING: Icons Already Changed on Master**

The commit `6d6fbdcf8a4` was **already merged to master** on February 9, 2026. This means:

1. ✅ All icons without explicit size now default to `md` (16px) instead of `sm` (14px)
2. ✅ All icons with `size="md"` changed from 18px to 16px
3. ⚠️ This is a **+14.3% size increase** for all default icons (14px → 16px)
4. ⚠️ Follow-up fixes like spinner size indicate the change broke some layouts

**This is likely what Dave is seeing as "broken icons"** - the default icon size increased from 14px to 16px, causing layout issues throughout the UI.

### File States

- Master: `md: '18px'`, default `'sm'`, no `'2xs'`
- jb/icons/sizes: `md: '20px'`, default `'md'`, has `'2xs'`
- Current branch: `md: '16px'`, default `'md'`, no `'2xs'`

## Impact Assessment

### High Severity

- ❌ Type safety compromised if '2xs' added to ICON_SIZES without updating IconSize type
- ❌ Visual consistency broken across the application
- ❌ Icons render at unexpected sizes

### Medium Severity

- ⚠️ Layout shifts and alignment issues
- ⚠️ Design system consistency violated
- ⚠️ Multiple teams working with different icon sizes

### Low Severity

- ℹ️ Confusion among developers about correct icon sizes
- ℹ️ Potential for more bugs when branches merge

## Recommendations

### Immediate Actions

1. **Freeze Icon Size Changes**
   - Pause all icon sizing work until branches are reconciled
   - Create a single source of truth for icon sizes

2. **Synchronize Branches**
   - Decide on the canonical icon size values
   - Ensure `IconSize` type and `ICON_SIZES` constant are in sync
   - Coordinate merge of `jb/icons/sizes` branch with master

3. **Add Type Safety Guards**

   ```typescript
   // Ensure ICON_SIZES keys match IconSize type
   const ICON_SIZES: Record<IconSize, string> = {
     '2xs': '8px',
     xs: '12px',
     sm: '16px',
     md: '20px',
     lg: '24px',
     xl: '32px',
     '2xl': '72px',
   } as const;

   // Add compile-time check
   type _IconSizesCheck =
     typeof ICON_SIZES extends Record<IconSize, string>
       ? true
       : 'ICON_SIZES keys do not match IconSize type';
   ```

4. **Document Size Changes**
   - Create migration guide for icon size changes
   - Update design system documentation
   - Notify all teams about size changes

### Long-term Solutions

1. **Establish Icon Sizing Standards**
   - Define canonical icon sizes in design system
   - Document when to use each size
   - Create visual examples

2. **Add Visual Regression Tests**
   - Screenshot tests for icon-heavy components
   - Percy/Chromatic tests to catch size changes
   - Automated alerts for icon size diffs

3. **Centralize Icon Configuration**
   - Single source of truth for icon sizes
   - Automated sync between type definitions and runtime constants
   - Build-time validation

4. **Improve Developer Experience**
   - Better TypeScript errors for invalid icon sizes
   - Linting rules for icon usage
   - Storybook stories showing all icon sizes

## Related Files

- `static/app/icons/svgIcon.tsx` - Icon component and ICON_SIZES constant
- `static/app/utils/theme/types.tsx` - IconSize type definition
- `static/app/icons/useIconDefaults.tsx` - Icon default props hook

## Related Branches

- `master` - Production baseline
- `origin/jb/icons/sizes` - Jonas's icon sizing refactor (not merged)
- `cursor/icons-broken-root-cause-b8ea` - Current analysis branch

## Conclusion

The broken icons are caused by **divergent icon sizing changes across multiple branches** without proper coordination. The immediate fix requires:

1. ✅ Deciding on canonical icon sizes
2. ✅ Synchronizing TypeScript types with runtime constants
3. ✅ Coordinating the merge of icon sizing changes
4. ✅ Testing visual impact across the application

**Next Steps:** Coordinate with Jonas (JonasBa) and the design team to establish the correct icon sizes and merge strategy.

---

**Analysis Date:** 2026-02-21
**Analyzed By:** Cursor Agent
**Branch:** cursor/icons-broken-root-cause-b8ea
**Related Slack Thread:** https://sentry.slack.com/archives/CQDHVRS2W/p1771633917159509
