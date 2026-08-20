---
name: cmdk-actions
description: Add or update Sentry Command+K actions, including scoped actions, async resource pickers, chained editing, and contextual More Actions entries.
---

# Command Palette Actions

`CMDKAction.*` components register themselves in a tree collection wherever
they are mounted. There is no central action registry.

Before implementing a non-trivial action, read the current API in:

- `static/app/components/commandPalette/ui/cmdk.tsx`
- `static/app/components/commandPalette/types.tsx`
- `static/app/components/commandPalette/ui/commandPaletteSlot.tsx`

## Choose the Right Slot

Slots set root-level priority and follow the lifetime of their mounted owner:

| Slot     | Priority | Use                                                                                                                   |
| -------- | -------- | --------------------------------------------------------------------------------------------------------------------- |
| `task`   | First    | Actions for temporary task state, such as the current issue-list bulk selection. Mount only while the task is active. |
| `page`   | Second   | Actions owned by the current page or entity view.                                                                     |
| `global` | Last     | Organization-wide actions available across pages. Add these inside `GlobalCommandPaletteActions`.                     |

`task` is not a background job. It is the highest-priority contextual bucket
for a transient user task. See
`static/app/views/issueList/issueListBulkCommandPaletteActions.tsx`.

Only the owning component creates a slot. Components that split an action tree
inherit the enclosing slot. Do not mount a second `global` slot consumer.

```tsx
function IssueActions({issue}: Props) {
  return (
    <CommandPaletteSlot.Root name="page">
      <CMDKAction.Group display={{label: issue.title}}>
        <CMDKAction.Callback
          display={{label: t('Resolve')}}
          onAction={() => resolveIssue(issue.id)}
        />
      </CMDKAction.Group>
    </CommandPaletteSlot.Root>
  );
}
```

## Choose the Right Variant

| Variant     | Use                                                                            |
| ----------- | ------------------------------------------------------------------------------ |
| `Group`     | Static drill-in children.                                                      |
| `Link`      | Navigation. Use `onNavigate` for analytics associated with following the link. |
| `Callback`  | An operation that does not primarily navigate.                                 |
| `Resource`  | Large or server-filtered async children.                                       |
| `TextInput` | A free-text editing step.                                                      |
| `Target`    | A summary row that opens another mounted action by stable `id`.                |

All variants require `display`. Use the variant types instead of combining
incompatible behaviors or adding boolean mode props.

For `Group`:

- Children mount eagerly and participate in top-level search by default.
- Use `mount="on-open"` only for expensive children when losing top-level child
  search is acceptable.
- Use `initialFocus="first-action"` only when drill-in should bypass the search
  input.

## Async Resources

Every `Resource` must return `cmdkQueryOptions(...)`; its metadata drives the
palette loading indicator.

```tsx
<CMDKAction.Resource
  display={{label: t('Switch project')}}
  prompt={t('Search for projects')}
  limit={5}
  resource={(query, context) =>
    cmdkQueryOptions({
      ...apiOptions.as<Project[]>()('/organizations/$organizationIdOrSlug/projects/', {
        path: {organizationIdOrSlug: organization.slug},
        query: {query, per_page: 20},
      }),
      enabled: context.state === 'selected',
      staleTime: 30_000,
      select: projects =>
        projects.map(project => ({
          display: {label: project.slug},
          to: `/organizations/${organization.slug}/projects/${project.slug}/`,
        })),
    })
  }
/>
```

Major resource rules:

- The first query after drill-in is empty; the endpoint must support it.
- Normally defer with `enabled: context.state === 'selected'`.
- Pass the live `query` to server search and return `CommandPaletteAction[]`
  from `select`.
- Set an intentional `staleTime` and `limit`. The default limit of 4 applies
  only when the resource uses render-prop children.
- Prefer automatic rendering. Use render-prop children only to combine static
  and async entries or for genuinely custom composition. Narrow returned groups,
  links, and callbacks before rendering their matching variants.
- For a small bounded dataset already loaded by a cached hook, use static group
  children and client-side fuzzy search instead.

## Editing and Contextual Actions

- For Shift+Enter multi-select, provide `onMultiSelect` and control the built-in
  checkbox with `isSelected`. Do not render a separate checkbox/checkmark icon.
- For Shift+Arrow reordering, provide `onReorder` and an explicit sibling
  `order`.
- Wrap draft-editing actions in `CMDKChainedActionScope` so callbacks return to
  the enclosing group. Wrap only the final action in `CMDKTerminalActionScope`.
- Use `TextInput` for raw text editing; provide `ariaLabel`, `initialValue` when
  applicable, and `onSubmit`.
- Use `Target` to open an expensive picker registered once under a stable `id`.
  The target must be mounted and IDs must be unique.

For the Ctrl+Shift+Enter More Actions panel:

- Put a stable semantic `actionContext` on the selectable row.
- Register the existing action with a matching `actionPanel.context`; do not
  duplicate its business logic.
- Contexts are hierarchical: `chart:3` matches `chart` and `chart:3`.
- Use `placement="panel-only"` to hide an action from normal browsing.
- Use `execution="preserve-view"` for callbacks that must keep the current
  palette step; otherwise use normal navigation behavior.
- Use `actionPanel.label` for panel-specific wording and `order` when actions
  registered in different branches need deterministic ordering.

## General Rules

- Render actions conditionally when feature flags, permissions, or entity state
  make them inapplicable. Use `disabled` only for an applicable action that is
  temporarily unavailable, and explain why in `display.details`.
- Use `keywords` only for useful synonyms missing from label/details.
- Use default icon sizing for groups; entity avatars use `size={16}`.
- Derive current/selected indicators from the state being edited. If persisted
  and draft state are both shown, distinguish them explicitly.
- Prefix keys in mixed entity lists (`member-${id}`, `team-${id}`).
- Use `t('... %s', value)`, not template literals, for translated dynamic labels.
- Prefix `id` with `cmdk:supplementary:` only for content such as Help that must
  always sort after normal results.
- Add or update colocated interaction tests for registration, visibility,
  keyboard behavior, and execution.
