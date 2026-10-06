# Building a title item

Read the current item unions before choosing a shape. Pass the item as `title` on `TopBar.Slot name="breadcrumbs"`; do not wrap `BreadcrumbList.Title` in a second public slot.

## Choose the title type

| Type              | Required fields                                                     | Supporting props                                                                                       |
| ----------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `page-title`      | String `label`                                                      | `labelTooltip`, `leadingGraphic`, `pagination`, `trailingActions`                                      |
| `editable-title`  | `value`, `onChange`, `'aria-label'`                                 | `allowEmpty`, `autoSelect`, `errorMessage`, `isDisabled`, `leadingGraphic`, `maxLength`, `placeholder` |
| `select-projects` | `options`, `value`, `onChange`; string `label` when used as a title | `onOpenChange`, `search`, `loading`, `leadingGraphic`                                                  |

`editable-title` and `select-projects` have no trailing-action or pagination props. Return a different item for a static state if needed.

Editable titles use the standard `EditableText` behavior: a single click starts editing, clicking outside saves the draft, and Escape cancels it.

The selectable item also serves Settings team and integration titles. `label` keeps the title visible when search results omit the current selection. `leadingGraphic` carries the avatar or icon. Forward `search`, `loading`, and `onOpenChange` when the old selector uses them. Use the non-clearable `SingleSelectProps` variant before picking callback props, so `onChange` retains one inferable signature.

## Map existing content

| Existing content                  | Destination                                                              |
| --------------------------------- | ------------------------------------------------------------------------ |
| Page name                         | String `label`                                                           |
| Project avatar or decorative icon | `leadingGraphic`                                                         |
| Explanation or help tooltip       | `labelTooltip`                                                           |
| Documentation link in a tooltip   | JSX inside `labelTooltip`                                                |
| Feature badge                     | `trailingActions: {type: 'badge', element: <FeatureBadge type="new" />}` |
| Copy button                       | `trailingActions: {type: 'copy', ...}`                                   |
| Rename input                      | `editable-title`                                                         |
| Project/team/integration selector | `select-projects` item                                                   |
| Previous/next chevrons            | `pagination`                                                             |
| Formatted version                 | Format the value into the label string                                   |

There are no dedicated title-level `help`, `badge`, `href`, `status`, or `titleGuide` props. Authentication titles no longer display an active/inactive indicator. Integration title names render as plain text. Do not restore those removed props as migration escape hatches.

### Tooltips

Move explanations and documentation links into `labelTooltip`. The title's `InfoText` supplies the hover/focus trigger, so do not nest `InfoTip` or `Tooltip` inside it.

```tsx
labelTooltip: <ReadTheDocs docsUrl={docsUrl}>{description}</ReadTheDocs>,
```

Import `ReadTheDocs` from `sentry/components/readTheDocs`. It renders only the text and documentation link. Outside a title, it can be passed as the `title` of an `InfoTip`.

For plain explanatory text, pass the string directly. Preserve conditional descriptions and documentation URLs. The separate info icon is removed.

### Leading graphics

The leading slot is fixed at 16×16 and `aria-hidden`. Use `size={16}` for avatars or `avatarSize={16}` for badge wrappers. For unresolved data, use a `<Placeholder width="16px" height="16px" />` if needed to preserve space.

Pass `disableLink` on project `IdBadge` or legacy `ProjectBadge` components, and hide any repeated slug text. The core `ProjectsBadge` is already a non-interactive 16×16 graphic. Do not place focusable links, buttons, feature badges, or interactive tooltips in this slot. Some existing callers still have avatar tooltips; do not copy that pattern.

### Feature badges

Place feature badges after the title with a trailing `badge` action. Match the secondary sidebar's `new`, `alpha`, or `beta` type. Use shared configuration when the caller already has it, such as `ISSUE_TAXONOMY_CONFIG`.

Import `FeatureBadge` from `@sentry/scraps/badge`. Do not add it to `leadingGraphic`, the title string, or the page actions slot.

## Trailing actions

| Action   | Fields                                                         |
| -------- | -------------------------------------------------------------- |
| `copy`   | Required `text`, `label`; optional `icon`, `tooltip`, `onCopy` |
| `menu`   | Required `items`, `triggerLabel`; optional `triggerIcon`       |
| `badge`  | `element: <FeatureBadge ... />`                                |
| `button` | `element: <Button ... />` or `<LinkButton ... />`              |

The current `badge` and `button` variants accept JSX elements. `ReactElement<FeatureBadgeProps>` and `ReactElement<ButtonProps | LinkButtonProps>` do **not** restrict the JSX component identity: `<div />` can typecheck. Review the rendered component and its accessible name; do not claim that these annotations enforce the intended components. A props-only action API would need a separate implementation change.

Use a bare object for one action and an array for several. Use `null` for absent array entries:

```tsx
trailingActions: [
  {type: 'badge', element: <FeatureBadge type="beta" />},
  canShare ? {type: 'button', element: <Button onClick={share}>{t('Share')}</Button>} : null,
],
```

Use a standalone copy action when it is the only control. When a menu is also needed, put the copy action in that menu. Preserve analytics on each menu item's `onAction` and preserve useful item keys. Icon-only actions need a translated accessible label.

There is no trailing `select` action. Use a selectable breadcrumb item instead.

## Pagination and pending states

`pagination` takes `{previous, next}`, each with `{ariaLabel, to?, disabled?, onClick?, tooltip?}`. A direction without `to` renders disabled. Keep pagination present while data loads to preserve its space, and supply explanatory tooltips for disabled directions when useful.

Keep labels as strings. Format multi-part names once, and use the title's built-in truncation. If a pending branch has no name, render the title only when a meaningful label is available; do not use an empty string to satisfy the type.

Check that a guide target still has a guide definition before preserving a legacy `GuideAnchor`. A reachable page does not prove its guide remains in use.

## Typed builders

Pin discriminants when constructing items outside JSX:

```tsx
return {
  type: 'page-title',
  label: group.shortId,
} as const satisfies BreadcrumbTitleItem;
```

Import `BreadcrumbTitleItem` from `@sentry/scraps/breadcrumbList`. See `static/app/views/issueDetails/header/issueIdBreadcrumb.tsx`.
