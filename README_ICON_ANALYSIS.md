# Icon Sizing Issue - Root Cause Analysis

## Quick Start

**TL;DR:** Icons appear broken because default icon size increased from 14px to 16px (+14.3%) on Feb 9, 2026.

**Read this first:** [EXECUTIVE_SUMMARY.md](./EXECUTIVE_SUMMARY.md)

## Documents in This Analysis

### 📊 [EXECUTIVE_SUMMARY.md](./EXECUTIVE_SUMMARY.md)

**Start here.** Quick overview for stakeholders with key findings and recommendations.

**Contains:**

- What happened and when
- Visual impact summary
- Affected components
- Resolution options
- Next steps

### 🔬 [ICON_SIZING_ROOT_CAUSE_ANALYSIS.md](./ICON_SIZING_ROOT_CAUSE_ANALYSIS.md)

**Technical deep dive.** Comprehensive analysis for engineers.

**Contains:**

- Branch divergence analysis
- Type system verification
- Runtime vs. compile-time comparison
- Critical issues identified
- Evidence and commit history
- Long-term solutions

### 📅 [BREAKING_CHANGE_TIMELINE.md](./BREAKING_CHANGE_TIMELINE.md)

**Historical context.** What changed, when, and why.

**Contains:**

- Detailed timeline of changes
- Visual impact comparison
- Before/after code examples
- Real-world component examples
- Reproduction steps
- Related issues

### ✅ [VERIFICATION_TEST.md](./VERIFICATION_TEST.md)

**Testing guide.** Type safety verification and testing approach.

**Contains:**

- TypeScript type safety checks
- Size value comparison table
- Visual regression risk assessment
- Verification commands
- Broken state examples

### 🔧 [HOW_LARGER_ICONS_BREAK_LAYOUTS.md](./HOW_LARGER_ICONS_BREAK_LAYOUTS.md)

**Mechanism deep-dive.** Explains exactly how larger icons break UI layouts.

**Contains:**

- 8 specific breakage mechanisms with real code examples
- Visual diagrams showing before/after states
- Grid layout failures (30px columns)
- Button alignment issues
- QuestionTooltip container coupling
- LoadingIndicator fix (proof of breakage)
- Why 2px (+14.3%) matters at UI scale

## Key Finding

### The Breaking Change

**Commit:** `6d6fbdcf8a4`
**Date:** February 9, 2026
**Author:** Jonas Badalic
**PR:** #107437
**Title:** "ref(scraps) default icon size to 16px"

**Changes:**

```typescript
// Before
ICON_SIZES = {
  sm: '14px',
  md: '18px',
  // ...
};
default_size = 'sm'; // 14px

// After
ICON_SIZES = {
  sm: '14px',
  md: '16px', // ⚠️ Changed from 18px
  // ...
};
default_size = 'md'; // ⚠️ Changed from 'sm', now 16px
```

**Impact:** ~3,000-3,500 icons across the UI increased by 14.3% in size.

## Quick Reference

### Icon Sizes Comparison

| Size        | Before        | Current          | Future (jb/icons/sizes) |
| ----------- | ------------- | ---------------- | ----------------------- |
| 2xs         | N/A           | N/A              | 8px                     |
| xs          | 12px          | 12px             | 12px                    |
| sm          | 14px          | 14px             | 16px ⚠️                 |
| md          | 18px          | 16px ⚠️          | 20px ⚠️                 |
| lg          | 24px          | 24px             | 24px                    |
| xl          | 32px          | 32px             | 32px                    |
| 2xl         | 72px          | 72px             | 72px                    |
| **Default** | **14px (sm)** | **16px (md)** ⚠️ | **20px (md)** ⚠️        |

### Why Icons Look Broken

1. **Container Overflow** - 14px containers now hold 16px icons
2. **Misalignment** - 16px icons paired with 14px text
3. **Layout Breaks** - Grids/flexboxes sized for 14px icons
4. **Design Mismatch** - Designs created for 14px icons

### Evidence of Breakage

**Immediate follow-up fix required:**

```typescript
// commit 439ed2997f7 - "fix spinner size" (Feb 17, 2026)
// Just 8 days after the icon change
-(<LoadingIndicator size={20} />) + <LoadingIndicator size={14} />;
```

## Resolution Paths

### Option 1: Revert ⏮️

```bash
git revert 6d6fbdcf8a4
```

**Time:** Hours
**Risk:** Low
**Outcome:** Back to 14px default

### Option 2: Fix Forward ⏩

Keep changes, fix all layouts, add tests.

**Time:** Weeks
**Risk:** Medium
**Outcome:** New 16px standard

### Option 3: Hybrid 🔄

Revert default, keep md=16px, explicit migration.

**Time:** Days-Weeks
**Risk:** Medium
**Outcome:** Gradual transition

### Option 4: Complete Migration 🚀

Merge jb/icons/sizes, fix everything, new 20px default.

**Time:** Weeks-Months
**Risk:** High
**Outcome:** Comprehensive new system

## Action Items

### Immediate (Today)

- [x] Root cause analysis complete
- [ ] Share with Jonas (JonasBa)
- [ ] Share with design team
- [ ] Share with product team
- [ ] Gather stakeholder input

### Short-term (This Week)

- [ ] Decide on resolution path
- [ ] Create tracking issue
- [ ] List specific broken components
- [ ] Begin implementation

### Long-term

- [ ] Establish icon standards
- [ ] Add visual regression tests
- [ ] Update design system docs
- [ ] Improve change review process

## Related Links

- **Slack Thread:** https://sentry.slack.com/archives/CQDHVRS2W/p1771633917159509
- **Breaking Commit:** `6d6fbdcf8a4`
- **PR:** #107437
- **Related Branch:** `origin/jb/icons/sizes`
- **Follow-up Fix:** `439ed2997f7`

## Key Files

```
static/app/icons/svgIcon.tsx         # Icon component & ICON_SIZES
static/app/utils/theme/types.tsx     # IconSize type definition
static/app/components/questionTooltip.tsx  # Example affected component
```

## Contact

**Analysis Date:** February 21, 2026
**Branch:** `cursor/icons-broken-root-cause-b8ea`
**Author:** Cursor Agent

## Summary

Icons are broken due to a **breaking change in default icon sizes** merged on February 9, 2026. The change increased default icons from 14px to 16px (+14.3%), affecting thousands of icons across the UI and causing layout issues, misalignment, and visual inconsistencies.

**Next Steps:** Coordinate with Jonas, design team, and stakeholders to decide on resolution path and implement fix with proper testing.

---

**Status:** 🔴 Analysis Complete - Awaiting Decision
