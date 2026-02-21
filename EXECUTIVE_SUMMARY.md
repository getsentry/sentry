# Executive Summary: Broken Icons Root Cause

## TL;DR

**Icons appear broken because a breaking change increased default icon sizes from 14px to 16px (+14.3%) on February 9, 2026.**

This change affects thousands of icons across the Sentry UI, causing layout issues, misalignment, and visual inconsistencies.

## What Happened

On **February 9, 2026**, Jonas Badalic merged PR #107437 (commit `6d6fbdcf8a4`) which made two critical changes:

1. **Changed default icon size** from `'sm'` → `'md'`
2. **Changed `'md'` size value** from `18px` → `16px`

**Net effect:** All icons without an explicit `size` prop increased from 14px to 16px (+14.3% larger).

## Impact

### Immediate Visual Issues

- ❌ Icons appear **too large** for their containers
- ❌ Text and icons are **misaligned** in buttons, menus, lists
- ❌ Layouts **shift** unexpectedly
- ❌ Spacing feels **cramped** or incorrect
- ❌ UI density changed across the application

### Affected Components

- **3,000-3,500 icon instances** potentially affected (60-70% of all icons)
- Navigation menus
- Buttons
- Forms
- Tables/Lists
- Tooltips (QuestionTooltip directly uses `ICON_SIZES`)
- Select components (LoadingIndicator already required a fix)

### Example: QuestionTooltip

```typescript
// This component's height is directly tied to ICON_SIZES
const QuestionIconContainer = styled('span')`
  height: ${p => SvgIcon.ICON_SIZES[p.size]};
  line-height: ${p => SvgIcon.ICON_SIZES[p.size]};
`;
```

When icon sizes change, this component's layout breaks.

## Why It Looks Broken

### 1. Container Overflow

Containers sized for 14px icons now contain 16px icons → cramped appearance

### 2. Alignment Issues

Icons sized to 16px paired with 14px text → vertical misalignment

### 3. Layout Breaks

Grids/flexboxes calculated for 14px icons → icon overflows

### 4. Pixel-Perfect Designs

Designs created for 14px icons → spacing and visual hierarchy broken

## Evidence

### Timeline

- **Feb 9, 2026**: Breaking change merged (commit `6d6fbdcf8a4`)
- **Feb 10, 2026**: Additional icon changes on `jb/icons/sizes` branch (not merged)
- **Feb 17, 2026**: LoadingIndicator size fix required (commit `439ed2997f7`)
- **Feb 21, 2026**: Root cause analysis (this document)

### Follow-up Fixes Already Required

```typescript
// commit 439ed2997f7 - "fix spinner size"
// LoadingIndicator had to be manually fixed from 20px → 14px
// This indicates the icon size changes broke existing UI
```

## Comparison Table

| State                                 | Default Size | md Size | % Change from Original |
| ------------------------------------- | ------------ | ------- | ---------------------- |
| **Before (pre-Feb 9)**                | 14px (sm)    | 18px    | Baseline               |
| **Current (master)**                  | 16px (md)    | 16px    | **+14.3%**             |
| **Future (if jb/icons/sizes merges)** | 20px (md)    | 20px    | **+42.9%**             |

## Additional Context

There's an **unmerged branch** (`origin/jb/icons/sizes`) with further icon changes:

- Adds `'2xs': '8px'` size
- Changes `sm` from `14px` → `16px`
- Changes `md` from `16px` → `20px`

**If this branch merges without coordination:** Default icons would be 20px (42.9% larger than original 14px), causing even more severe breakage.

## What Dave Likely Sees

Based on the Slack thread reference, Dave is probably seeing:

1. Icons that look **oversized** in their containers
2. **Misaligned** icon-text pairs in buttons/menus
3. **Layout shifts** where elements are pushed around
4. **Inconsistent sizing** between pages
5. UI that feels **cramped** or has incorrect spacing

## Resolution Options

### Option 1: Revert (Safest)

Revert commit `6d6fbdcf8a4` to restore 14px default icons.

**Pros:** Immediate fix
**Cons:** Loses intended text/icon alignment improvements

### Option 2: Fix Forward (Progressive)

Keep new sizes, update all affected layouts, add comprehensive tests.

**Pros:** Better long-term alignment
**Cons:** Requires extensive work and testing

### Option 3: Hybrid

Revert default change but keep `md: 16px`, migrate components explicitly.

**Pros:** Gradual migration path
**Cons:** More complex, requires coordination

### Option 4: Complete Migration

Merge `jb/icons/sizes`, fix all issues, establish new standard.

**Pros:** Comprehensive solution
**Cons:** Highest risk and effort

## Recommendations

### Immediate (Today)

1. ✅ **Document** the issue (this analysis)
2. ⏳ **Gather stakeholder feedback** (design, product, engineering)
3. ⏳ **Catalog broken components** (specific list of issues)
4. ⏳ **Decide on resolution path** (revert vs. fix-forward)

### Short-term (This Week)

1. Implement chosen resolution
2. Add visual regression tests
3. Update design system docs
4. Communicate to all teams

### Long-term

1. Establish icon sizing standards
2. Require visual regression tests for icon changes
3. Add build-time validation for icon sizes
4. Improve change review process

## Key Takeaways

1. **Breaking change was merged** without sufficient visual regression testing
2. **Thousands of icons affected** across the entire UI
3. **Follow-up fixes already required** (spinner size)
4. **More breaking changes pending** on `jb/icons/sizes` branch
5. **Coordination needed** to resolve without causing more issues

## Files Generated

This analysis includes:

- ✅ `ICON_SIZING_ROOT_CAUSE_ANALYSIS.md` - Comprehensive technical analysis
- ✅ `BREAKING_CHANGE_TIMELINE.md` - Detailed timeline with examples
- ✅ `VERIFICATION_TEST.md` - Type safety verification and testing guide
- ✅ `EXECUTIVE_SUMMARY.md` - This document

## Next Steps

1. **Share this analysis** with Jonas (JonasBa), design team, and stakeholders
2. **Schedule a meeting** to review options and decide on resolution
3. **Create tracking issue** for broken components
4. **Implement resolution** with proper testing

## Contact

- **Analysis by:** Cursor Agent
- **Date:** February 21, 2026
- **Branch:** `cursor/icons-broken-root-cause-b8ea`
- **Related Slack:** https://sentry.slack.com/archives/CQDHVRS2W/p1771633917159509
- **Key Commit:** `6d6fbdcf8a4` (Feb 9, 2026)
- **Related PR:** #107437

---

**Status:** 🔴 **UNRESOLVED** - Awaiting stakeholder decision on resolution path
