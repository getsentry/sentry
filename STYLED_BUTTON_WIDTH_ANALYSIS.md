# Styled Button Width Expansion Analysis

**Analysis Date:** February 5, 2026

## Summary

This report identifies all instances of `styled(Button)` and `styled(LinkButton)` in the Sentry codebase that have styling rules causing the button width to expand and fill the surrounding white space.

**Total instances found:** 14

## Pattern Distribution

| Pattern              | Count | Description                                           |
| -------------------- | ----- | ----------------------------------------------------- |
| `width_100_percent`  | 9     | Sets button width to 100% of parent                   |
| `flex_grow_1`        | 3     | Allows button to grow (flex-grow: 1)                  |
| `flex_1`             | 2     | Makes button grow to fill available space (flex: 1)   |
| `align_self_stretch` | 1     | Stretches button in cross-axis of flex/grid container |

## All Locations

### Format: `file:line:column`

- `static/app/components/core/disclosure/disclosure.tsx:113:1`
- `static/app/components/events/autofix/v2/autofixSidebarCtaButton.tsx:147:1`
- `static/app/components/group/tagFacets/tagFacetsDistributionMeter.tsx:397:1`
- `static/app/components/onboarding/gettingStartedDoc/step.tsx:102:1`
- `static/app/stories/view/storyFooter.tsx:82:1`
- `static/app/views/dashboards/globalFilter/numericFilterSelector.tsx:390:1`
- `static/app/views/dashboards/manage/templateCard.tsx:83:1`
- `static/app/views/discover/savedQuery/index.tsx:733:1`
- `static/app/views/explore/toolbar/toolbarSaveAs.tsx:356:1`
- `static/app/views/issueDetails/streamline/sidebar/seerSectionCtaButton.tsx:247:1`
- `static/app/views/onboarding/welcome.tsx:178:1`
- `static/app/views/preprod/buildComparison/main/sizeCompareSelectedBuilds.tsx:141:1`
- `static/gsApp/views/amCheckout/components/cart.tsx:1004:1`
- `static/gsApp/views/seerAutomation/components/projectDetails/autofixRepositoriesItem.tsx:225:1`

## Detailed Analysis

### 1. `static/app/components/core/disclosure/disclosure.tsx`

**Location:** `static/app/components/core/disclosure/disclosure.tsx:113:1`

**Component Name:** `StretchedButton`

**Type:** `styled(Button)`

**Matched Patterns:** `flex_grow_1`

**CSS:**

```css
flex-grow: 1;
  justify-content: flex-start;
  padding-left: ${p => p.theme.space.xs};
```

---

### 2. `static/app/components/events/autofix/v2/autofixSidebarCtaButton.tsx`

**Location:** `static/app/components/events/autofix/v2/autofixSidebarCtaButton.tsx:147:1`

**Component Name:** `StyledButton`

**Type:** `styled(LinkButton)`

**Matched Patterns:** `width_100_percent`

**CSS:**

```css
margin-top: ${p => p.theme.space.md};
  width: 100%;
```

---

### 3. `static/app/components/group/tagFacets/tagFacetsDistributionMeter.tsx`

**Location:** `static/app/components/group/tagFacets/tagFacetsDistributionMeter.tsx:397:1`

**Component Name:** `StyledButton`

**Type:** `styled(Button)`

**Matched Patterns:** `width_100_percent`

**CSS:**

```css
width: 100%;
> span {
  display: block;
}
```

---

### 4. `static/app/components/onboarding/gettingStartedDoc/step.tsx`

**Location:** `static/app/components/onboarding/gettingStartedDoc/step.tsx:102:1`

**Component Name:** `ToggleButton`

**Type:** `styled(Button)`

**Matched Patterns:** `flex_1`

**CSS:**

```css
flex: 1;
  display: flex;
  justify-content: flex-start;
  padding: 0;
  &,
  :hover {
    color: ${p => p.theme.colors.gray800};
  }
```

---

### 5. `static/app/stories/view/storyFooter.tsx`

**Location:** `static/app/stories/view/storyFooter.tsx:82:1`

**Component Name:** `Card`

**Type:** `styled(LinkButton)`

**Matched Patterns:** `width_100_percent, flex_1`

**CSS:**

```css
display: flex;
  flex-direction: column;
  flex: 1;
  height: 80px;
  margin-bottom: ${p => p.theme.space['3xl']};
  span:last-child {
    width: 100%;
    display: grid;
    grid-template-areas:
      'icon label'
      'icon text';
    grid-template-columns: auto 1fr;
    place-content: center;
    gap: ${p => p.theme.space.md} ${p => p.theme.space.xl};
  }
  &[data-flip] span:last-child {
    grid-template-areas:
      'label icon'
      'text icon';
    grid-template-columns: 1fr auto;
... (5 more lines)
```

---

### 6. `static/app/views/dashboards/globalFilter/numericFilterSelector.tsx`

**Location:** `static/app/views/dashboards/globalFilter/numericFilterSelector.tsx:390:1`

**Component Name:** `StyledOperatorButton`

**Type:** `styled(Button)`

**Matched Patterns:** `width_100_percent`

**CSS:**

```css
width: 100%;
  font-weight: ${p => p.theme.font.weight.sans.regular};
```

---

### 7. `static/app/views/dashboards/manage/templateCard.tsx`

**Location:** `static/app/views/dashboards/manage/templateCard.tsx:83:1`

**Component Name:** `StyledButton`

**Type:** `styled(Button)`

**Matched Patterns:** `flex_grow_1`

**CSS:**

```css
flex-grow: 1;
```

---

### 8. `static/app/views/discover/savedQuery/index.tsx`

**Location:** `static/app/views/discover/savedQuery/index.tsx:733:1`

**Component Name:** `SaveAsButton`

**Type:** `styled(Button)`

**Matched Patterns:** `width_100_percent`

**CSS:**

```css
width: 100%;
```

---

### 9. `static/app/views/explore/toolbar/toolbarSaveAs.tsx`

**Location:** `static/app/views/explore/toolbar/toolbarSaveAs.tsx:356:1`

**Component Name:** `SaveAsButton`

**Type:** `styled(Button)`

**Matched Patterns:** `width_100_percent`

**CSS:**

```css
width: 100%;
```

---

### 10. `static/app/views/issueDetails/streamline/sidebar/seerSectionCtaButton.tsx`

**Location:** `static/app/views/issueDetails/streamline/sidebar/seerSectionCtaButton.tsx:247:1`

**Component Name:** `StyledButton`

**Type:** `styled(LinkButton)`

**Matched Patterns:** `width_100_percent`

**CSS:**

```css
margin-top: ${space(1)};
  width: 100%;
```

---

### 11. `static/app/views/onboarding/welcome.tsx`

**Location:** `static/app/views/onboarding/welcome.tsx:178:1`

**Component Name:** `ButtonWithFill`

**Type:** `styled(Button)`

**Matched Patterns:** `width_100_percent`

**CSS:**

```css
width: 100%;
position: relative;
z-index: 1;
```

---

### 12. `static/app/views/preprod/buildComparison/main/sizeCompareSelectedBuilds.tsx`

**Location:** `static/app/views/preprod/buildComparison/main/sizeCompareSelectedBuilds.tsx:141:1`

**Component Name:** `StyledLinkButton`

**Type:** `styled(LinkButton)`

**Matched Patterns:** `align_self_stretch`

**CSS:**

```css
height: auto;
min-height: auto;
align-self: stretch;

/* Override ButtonLabel overflow to allow close button to extend beyond */
> span:last-child {
  overflow: visible;
}
```

---

### 13. `static/gsApp/views/amCheckout/components/cart.tsx`

**Location:** `static/gsApp/views/amCheckout/components/cart.tsx:1004:1`

**Component Name:** `StyledButton`

**Type:** `styled(Button)`

**Matched Patterns:** `flex_grow_1`

**CSS:**

```css
display: flex;
flex-grow: 1;
align-items: center;
justify-content: center;
```

---

### 14. `static/gsApp/views/seerAutomation/components/projectDetails/autofixRepositoriesItem.tsx`

**Location:** `static/gsApp/views/seerAutomation/components/projectDetails/autofixRepositoriesItem.tsx:225:1`

**Component Name:** `RowButton`

**Type:** `styled(Button)`

**Matched Patterns:** `width_100_percent`

**CSS:**

```css
padding: ${p => p.theme.space.lg};
  justify-content: start;
  border-radius: 0;
  width: 100%;
  height: 100%;
```

---
