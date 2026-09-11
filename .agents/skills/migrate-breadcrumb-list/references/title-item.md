# Building the title item

The legacy leaf crumb allowed `label: React.ReactNode`. Both new title types require `label: string`. Everything else in that JSX has to be placed into a named slot, moved elsewhere, or consciously dropped.

## Contents

- [Which title type](#which-title-type)
- [Decompose a rich label](#decompose-a-rich-label)
- [Label content that is not one string](#label-content-that-is-not-one-string)
- [Trailing actions](#trailing-actions)
- [Pagination](#pagination)
- [Building the item outside JSX](#building-the-item-outside-jsx)

## Which title type

| Type             | Use when                               | Notes                                                                                                                                                                    |
| ---------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `page-title`     | The page name is fixed text            | Accepts `labelTooltip`, `leadingGraphic`, `pagination`, `trailingActions`                                                                                                |
| `editable-title` | The user can rename the thing in place | Requires `value`, `onChange`, and `'aria-label'` as a quoted key. Has **no** `trailingActions` and **no** `pagination` — `EditableText` supplies its own edit affordance |

`editable-title` also takes `allowEmpty`, `autoSelect`, `errorMessage`, `isDisabled`, `leadingGraphic`, `maxLength`, `placeholder`. The only exemplar in the repo is `views/dashboards/dashboardBreadcrumbTitle.tsx`.

If the page is editable in one state and static in another, return a different item per state rather than toggling `isDisabled` — one early return each, as `dashboardBreadcrumbTitle.tsx` does.

## Decompose a rich label

| Legacy label contained                              | Goes to                                                                                                      |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `IdBadge`, `ProjectBadge`, `ProjectAvatar`, an icon | `leadingGraphic`                                                                                             |
| An always-on tooltip explaining the name            | `labelTooltip`                                                                                               |
| A copy-to-clipboard button                          | `trailingActions: {type: 'copy'}`                                                                            |
| An editable text field                              | the `editable-title` type                                                                                    |
| Prev/next chevrons                                  | `pagination`                                                                                                 |
| A `Tooltip showOnlyOnOverflow`                      | **nothing** — the title already truncates with an ellipsis                                                   |
| A `<Version>` element                               | `label: formatVersion(version)` — `Version` formats by default, so this preserves the rendered text          |
| A 28px badge lifted from `Layout.Title`             | `leadingGraphic` with `avatarSize={16}` — 28px overflows the fixed slot                                      |
| A badge rendering its own slug text                 | add `hideName`; that text belongs in `label`, not the 16×16 slot                                             |
| An `<ExternalLink>` wrapping an icon                | `trailingActions: {type: 'button'}` with a `LinkButton` (`external`, `size="zero"`, `variant="transparent"`) |

`leadingGraphic` is a fixed **16×16** slot rendered `aria-hidden`, so the label carries all the meaning. Two rules follow, and the second is the one that bites:

1. Pass `avatarSize={16}` — a 28px avatar carried over from `Layout.Title` will clip.
2. **Pass `disableLink` on every `IdBadge` and `ProjectBadge`.** They render a real focusable `<a href>` to an auto-generated project page unless you do, putting a tabbable link inside an `aria-hidden` subtree. It typechecks, passes every test, and is an `aria-hidden-focus` axe violation.

Safe as a blanket rule: across every current and prospective leading graphic, **none** passes an explicit `to` or `onClick`, so `disableLink` drops no intentional destination. `ProjectAvatar` and `AppIcon` have no link path at all and need nothing.

```tsx
leadingGraphic: project ? (
  <ProjectBadge disableLink project={project} avatarSize={16} hideName />
) : (
  <Placeholder width="16px" height="16px" />
),
```

**Drop `avatarProps={{hasTooltip: true, tooltip: project.slug}}` — do not route it to `labelTooltip`.** Several legacy badges carry it, and it is dead code rather than information worth rescuing: inside `aria-hidden` with no focusable trigger the tooltip is already unreachable by keyboard and invisible to assistive tech. The content is `project.slug` in every instance, and the trail already discloses the project.

**The exemplars predate this ruling.** `issueIdBreadcrumb.tsx`, `traceBreadcrumbs.tsx`, and `transactionBreadcrumbs.tsx` all still pass `avatarProps={{hasTooltip: true}}` on a `leadingGraphic`. Follow the rule, not those three lines — and do not treat them as precedent for adding it back.

Keep `labelTooltip` for genuinely non-obvious content — `issueIdBreadcrumb.tsx` uses it to explain what a short-ID _is_, `conversationsBreadcrumbs.tsx` to expose a full UUID behind a truncated one. Restating a slug there competes with that. If a page really needs the project surfaced, the answer is a `type: 'link'` crumb pointing at it, not a tooltip on a decorative icon.

## Label content that is not one string

The table above is not exhaustive. Three shapes have **no representable form**, and each needs a decision recorded in the PR description rather than a silent workaround.

**A sibling decorative badge** — `<FeatureBadge type="new" />` rendered next to the trail. It is not part of the label. `trailingActions: {type: 'button'}` is typed `React.ReactElement<ButtonProps | LinkButtonProps>`, so a badge will not typecheck there, and `leadingGraphic` is an `aria-hidden` 16×16 slot, which is semantically wrong. Either drop it or move it to `TopBar.Slot name="actions"` — say which in the PR.

**Multi-part text** — `AppIcon + name + '-' + <Version truncate />`. Flatten to a template string:

```tsx
label: buildNumber ? `${appName} (${version})` : appName,
```

The `<Version>` and `<Text>` wrappers are lost, including their own truncation. That is accepted: the title truncates already.

**An action with no accessible name.** Legacy markup sometimes wrapped a bare icon in a link or button with only a `Tooltip` for context. Moving it into `trailingActions` forces a real name — `copy` needs `label`, `menu` needs `triggerLabel`, a `button` element needs its own. That is a new user-facing string: wrap it in `t()` and call it out in the PR rather than passing the tooltip text through silently.

**A skeleton label** — a `Flex` of `Placeholder`s in a pending branch. `label` is required and non-optional, so there is nowhere to put it. Render the title only once the name resolves, using one early return per state. Do not pass `label: ''`.

## Trailing actions

One action is a bare object. Two or more is an array whose absent entries are `null` — `undefined` and `false` are not assignable:

```tsx
trailingActions: [
  {type: 'copy', text: id, label: t('Copy ID'), tooltip: t('Copy ID')},
  canShare ? {type: 'button', element: <Button ... />} : null,
],
```

| Action   | Required                                                                              |
| -------- | ------------------------------------------------------------------------------------- |
| `copy`   | `text`, `label` (accessible name). Optional `icon`, `tooltip`, `onCopy` for analytics |
| `menu`   | `items` (`MenuItemProps[]`), `triggerLabel`. Optional `triggerIcon`                   |
| `button` | `element`, typed `React.ReactElement<ButtonProps \| LinkButtonProps>`                 |

Reach for a standalone `copy` only when it would otherwise be a single-element array. As soon as the title also needs a menu, put the copy entry **inside** the menu — one affordance beside the title reads better than a row of icons.

Build conditional menu items by spreading, not filtering:

```tsx
const items = [
  favoriteItem,
  ...(canEdit ? [editItem] : []),
  ...(organization.features.includes('dashboards-import') ? [exportItem] : []),
];
```

When a button you are deleting had a `data-test-id`, reuse it as the menu item's `key` so existing selectors keep working. Move any `trackAnalytics` call onto the item's `onAction` — a menu-level handler would fire for siblings too.

## Pagination

`{previous, next}`, each `{ariaLabel, to?, disabled?, onClick?, tooltip?}`. A direction with no `to` renders disabled.

Keep `pagination` present even when neither direction is navigable, rather than adding it once data resolves — the chevrons hold their space from the first render, so the title does not shift. Give the disabled state a `tooltip` too: it is what explains the feature to someone whose current item has no neighbours. `tooltip` accepts rich content and stays hoverable, so links inside remain reachable.

## Building the item outside JSX

A hook or helper returning a title item must pin the discriminant, or `type` widens to `string` and the union stops narrowing:

```tsx
return {
  type: 'page-title',
  label: group.shortId,
  // ...
} as const satisfies BreadcrumbTitleItem;
```

`import type {BreadcrumbTitleItem} from '@sentry/scraps/breadcrumbList'`. Exemplar: `views/issueDetails/header/issueIdBreadcrumb.tsx`.
