# Button Width Analysis - Complete Documentation

**Project:** Sentry Button Width Styling Analysis
**Date:** February 5, 2026
**Context:** Supporting design team's exploration of expandable button widths in Figma

## 📋 Overview

This analysis examines how buttons are styled to expand and fill available width in the Sentry codebase. The analysis was requested to help the design team understand existing patterns when considering making buttons more flexible in Figma component library.

## 📁 Files in This Analysis

### 1. `STYLED_BUTTON_WIDTH_ANALYSIS.md` ⭐ **Primary Analysis**

**Focus:** Direct CSS width-expanding rules on styled buttons

Identifies all instances of `styled(Button)` and `styled(LinkButton)` with explicit width-expansion CSS:

- `width: 100%` (9 instances)
- `flex-grow: 1` (3 instances)
- `flex: 1` (2 instances)
- `align-self: stretch` (1 instance)

**Total:** 14 locations with detailed code examples

**Best for:** Finding specific files where buttons use direct width rules

---

### 2. `EXPANDED_BUTTON_PATTERNS.md` ⭐ **Comprehensive Overview**

**Focus:** All button width patterns, including alternative approaches

Covers:

- **Direct width rules** (14 files) - Covered in detail above
- **Display block pattern** (31 files) - Implicit full-width behavior
- **ButtonBar component** (219 files) - Most common pattern
- **Wrapper patterns** (167 files) - Container-based width control
- **Grid positioning** (4+ files) - CSS Grid-based sizing

**Best for:** Understanding the full landscape of button width patterns and best practices

---

### 3. `button_width_locations_list.txt` ⭐ **Quick Reference**

Simple list of file:line:column locations for all 14 instances with direct width-expanding rules.

**Best for:** Quick lookup or programmatic processing

---

### 4. `analyze_button_width_final.py` 🔧 **Analysis Script**

Python script used to generate the initial analysis. Can be re-run for future analysis.

**Note:** Formatted for Sentry's pre-commit hooks.

---

## 🎯 Key Findings

### Most Common Pattern: ButtonBar Component (219 files)

The `ButtonBar` component is the **recommended approach** for button groups:

```tsx
import {ButtonBar} from 'sentry/components/core/button';

<ButtonBar gap="md">
  <Button>Action 1</Button>
  <Button>Action 2</Button>
</ButtonBar>;
```

**Benefits:**

- Handles spacing automatically
- Supports merged borders (pill bars)
- Consistent across codebase
- Responsive-ready

### Second Most Common: Wrapper Patterns (167 files)

Custom styled containers control button widths:

```tsx
const ButtonWrapper = styled('div')`
  display: flex;
  > * {
    flex: 1;
  }
`;
```

### Less Common: Direct Width Rules (14 files)

Explicit CSS on buttons themselves - these are the ones most relevant to the Figma discussion:

```tsx
const FullWidthButton = styled(Button)`
  width: 100%; // or flex: 1, flex-grow: 1, etc.
`;
```

---

## 💡 Recommendations for Design Team

Based on this analysis:

### 1. **Current State**

- Developers use **multiple approaches** to achieve button width expansion
- **ButtonBar** is the standard for button groups (219 files)
- **Direct width styling** is used sparingly (14 files) for specific needs
- **Wrapper-based control** is common (167 files) for custom layouts

### 2. **Figma Component Considerations**

If making button widths flexible in Figma:

✅ **Helpful for:**

- Single button layouts needing full width (currently using `width: 100%`)
- Matching specific design layouts in complex UIs
- Rapid prototyping without manual adjustments

⚠️ **Consider:**

- Most production uses are handled by `ButtonBar` or wrapper components
- Text-locked buttons prevent accidental stretching in most cases
- Developers often prefer container-based control for consistency

### 3. **Suggested Figma Approach**

Based on codebase patterns:

**Option A: Variable Property** (Recommended)

- Default: `width = hug` (locked to text width)
- Optional: `width = fill` (expands to fill container)
- Matches how developers think about button sizing

**Option B: Manual Resize** (Current State)

- Keep default text-locked behavior
- Allow manual width adjustment when needed
- Closest to current developer workflow

---

## 📊 Statistics Summary

| Pattern                | Files | Percentage | Primary Use Case                   |
| ---------------------- | ----- | ---------- | ---------------------------------- |
| ButtonBar & containers | 219   | ~45%       | Multiple buttons, standard layouts |
| Wrapper patterns       | 167   | ~34%       | Custom layouts, complex UIs        |
| Display block          | 31    | ~6%        | Single full-width buttons          |
| Direct width rules     | 14    | ~3%        | Explicit control needed            |
| Grid positioning       | 4+    | <1%        | Complex grid layouts               |

**Total files analyzed:** ~435 unique files with button width considerations

---

## 🔗 Related Components

### Core Components

- `Button` - `@sentry/scraps/button`
- `LinkButton` - `@sentry/scraps/button`
- `ButtonBar` - `sentry/components/core/button`

### Layout Primitives

- `Flex` - `@sentry/scraps/layout`
- `Grid` - `@sentry/scraps/layout`
- `Stack` - `@sentry/scraps/layout`

---

## 🚀 Usage Guide

### For Design Review

1. Start with `EXPANDED_BUTTON_PATTERNS.md` for full context
2. Reference `STYLED_BUTTON_WIDTH_ANALYSIS.md` for specific examples
3. Use `button_width_locations_list.txt` for quick file lookups

### For Development

1. **New button groups?** → Use `ButtonBar` component
2. **Single full-width button?** → Use `display: block` or wrapper
3. **Complex layout?** → Use flex/grid container to control widths
4. **Explicit control needed?** → Use direct width rules (sparingly)

### For Analysis Updates

1. Run `python3 analyze_button_width_final.py` to regenerate analysis
2. Update `EXPANDED_BUTTON_PATTERNS.md` with new findings
3. Commit changes to tracking branch

---

## 📞 Questions?

This analysis was created to support the #team-product-design discussion around expandable buttons in Figma. See the [Slack thread](https://sentry.slack.com/archives/GLV7M40EQ/p1770247568941859) for context.

**Created by:** Cursor AI Agent
**Branch:** `cursor/styled-button-width-analysis-e36d`
**PR:** #107643
