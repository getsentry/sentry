# SecondaryNavigation Reorderable API Plan

## New components

### `SecondaryNavigation.ReorderableList`

```tsx
<SecondaryNavigation.ReorderableList
  items={T[]}               // T extends { id: string | number }
  onDragEnd={(items: T[]) => void}
>
  {(item: T) => ReactNode}
</SecondaryNavigation.ReorderableList>
```

All drag mechanics are fully encapsulated — consumers never see `sectionRef`,
`isDragging`, `useDragControls`, `useState`, `useEffect`, `Reorder.Group`,
or `Reorder.Item`. Renders as `ul > li` matching `List > ListItem` semantics.

**Stale state fix:** `Reorder.Group.onReorder` updates React state asynchronously.
`onDragEnd` must not read from state — it reads from a ref that is kept in sync
with every `onReorder` call, guaranteeing the final ordered array is always
up-to-date when the callback fires.

---

### `SecondaryNavigation.ReorderableLink`

Drop-in for `SecondaryNavigation.Link`. Accepts an `icon` prop — when rendered
inside a `ReorderableList`, the grab handle is automatically injected alongside
the icon via context. No grab handle plumbing at the call site.

```tsx
<SecondaryNavigation.ReorderableLink
  to={...}
  isActive={...}
  analyticsItemName={...}
  icon={<SecondaryNavigation.ProjectIcon ... />}
  trailingItems={...}   // optional, same as Link
>
  {children}
</SecondaryNavigation.ReorderableLink>
```

Baked-in behaviours (standardised across all three UIs):

- Hover: shows grab handle, hides project icon. Un-hover: reverses.
- `onPointerDown`: prevents text selection during drag.
- `onClick`: blocks navigation if a drag interaction is in progress.

**Error when used outside context:** throws at runtime if rendered outside a
`ReorderableList`. Both components depend on `ReorderableItemContext` being
present — failing loudly is better than silently rendering without drag behaviour.

---

### `SecondaryNavigation.Indicator`

A small dot for signalling unsaved or pending state. Mirrors
`PrimaryNavigationUnreadIndicator` exactly — same sizing, same token usage,
same `variant` prop — so both navigation levels are visually consistent.

```tsx
// Styling mirrors primary nav:
// background: theme.tokens.graphics[variant].vibrant
// border: 2px solid theme.tokens.border[variant].muted
// position: absolute; top: 0; right: 0; width: 10px; height: 10px

// In issueViewItem.tsx
{
  hasUnsavedChanges && (
    <Tooltip
      title={constructUnsavedTooltipTitle(changedParams)}
      position="top"
      skipWrapper
    >
      <SecondaryNavigation.Indicator variant="accent" />
    </Tooltip>
  );
}
```

Does NOT wrap `CircleIndicator` — `CircleIndicator` uses different tokens and has
no border. Built directly to match the primary nav implementation.

No `isActive` gating needed at the styled-component level — the conditional is
expressed directly in JSX. The old `${StyledSecondaryNavigationItem}:hover &`
hover selector is dropped entirely (it was a no-op in practice since the
indicator only rendered when `isActive` was already true).

---

## All three consumers look like this

```tsx
<SecondaryNavigation.ReorderableList items={items} onDragEnd={onDragEnd}>
  {item => (
    <SecondaryNavigation.ReorderableLink
      to={...}
      isActive={...}
      analyticsItemName={...}
      icon={<SecondaryNavigation.ProjectIcon projectPlatforms={...} allProjects={...} />}
    >
      <Tooltip title={item.label} position="top" showOnlyOnOverflow skipWrapper>
        <Text ellipsis variant="muted">{item.label}</Text>
      </Tooltip>
    </SecondaryNavigation.ReorderableLink>
  )}
</SecondaryNavigation.ReorderableList>
```

Only the domain-specific `onDragEnd` callback content differs between them
(which API to call, whether to update a store). The structure is identical.

---

## Files changed

### `components.tsx`

New additions (all implementation details are unexported):

- `ReorderableItemContext` — carries `{ controls, grabbing, itemId }` per item
- `ReorderableListItem` — internal, renders `Reorder.Item as="li"`, calls `useDragControls()`
- `SecondaryNavigationReorderableList` — exported via namespace
- `SecondaryNavigationReorderableLink` — exported via namespace

### `dashboardsNavigationItems.tsx`

Removed: `useState`, `useEffect`, `useRef`, `useDragControls`,
`StyledReorderItem`, `StyledSecondaryNavigationItem`, `GrabHandleWrapper`,
`Reorder.Group`, `Reorder.Item`.

### `exploreSavedQueryNavigationItems.tsx`

Same removals as dashboards, plus `StyledInteractionStateLayer`, `TruncatedTitle`.

### `issueViews.tsx`

Removed: `useState(isDragging)`, `Reorder.Group`, `sectionRef` prop,
`handleReorderComplete` callback (logic moves inline to `onDragEnd`),
`debounce` wrapper (unnecessary — `onDragEnd` fires exactly once per gesture).

### `issuesSecondaryNavigation.tsx`

Removed: `useRef(sectionRef)`, `sectionRef` prop passed to `<IssueViews />`.

### `issueViewItem.tsx`

Removed: `useDragControls`, `StyledReorderItem`, `StyledSecondaryNavigationItem`,
`GrabHandleWrapper`, `isDragging`/`setIsDragging`/`onReorderComplete`/`isLastView`/
`sectionRef` props, `setInteraction` call, `interaction` check on click,
`UnsavedChangesIndicator` styled component (replaced by `SecondaryNavigation.Indicator`).
