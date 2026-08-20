---
name: cmdk-actions
description: Add or update actions in Sentry's Command+K palette, including task-, page-, and global-scoped actions, async resource pickers, chained workflows, text editors, and contextual More Actions entries.
---

# Command Palette Actions

Sentry's Command+K palette uses a tree collection. `CMDKAction.*` components
register wherever they are mounted; there is no central action registry.

## Start Here

Read the current types before adding a non-trivial action:

- `static/app/components/commandPalette/ui/cmdk.tsx` — action variants and props
- `static/app/components/commandPalette/types.tsx` — async result types and
  `cmdkQueryOptions`
- `static/app/components/commandPalette/ui/commandPaletteSlot.tsx` — slot names
- `static/app/components/commandPalette/ui/commandPaletteGlobalActions.tsx` —
  global registrations

Use the typed variant matching the behavior. Do not add incompatible behavior
props to a variant or introduce boolean mode props.

```tsx
<CMDKAction.Group display={{label}}>{children}</CMDKAction.Group>
<CMDKAction.Link display={{label}} to="/issues/" />
<CMDKAction.Callback display={{label}} onAction={handleAction} />
<CMDKAction.Resource display={{label}} resource={resource} />
<CMDKAction.TextInput display={{label}} input={{ariaLabel, onSubmit}} />
<CMDKAction.Target display={{label}} target="stable-action-id" />
```

Every variant requires `display`. Shared metadata includes `id`, `keywords`,
`order`, `limit`, `disabled`, `actionContext`, and `actionPanel`.

## Slots: Task, Page, and Global

Slots determine root-level priority and registration lifetime:

| Slot     | Priority | Lifetime and use                                                                                                       |
| -------- | -------- | ---------------------------------------------------------------------------------------------------------------------- |
| `task`   | First    | Temporary task state, such as actions for the current issue-list bulk selection. Mount only while that task is active. |
| `page`   | Second   | Contextual actions owned by the current page or entity view.                                                           |
| `global` | Last     | Organization-wide navigation and actions that remain available across pages.                                           |

`task` does not mean a background job. It is the highest-priority contextual
bucket for a transient user task. The production reference is
`static/app/views/issueList/issueListBulkCommandPaletteActions.tsx`.

Register task and page actions near the state that owns their lifetime:

```tsx
function IssueListBulkActions({selectedIssues}: Props) {
  if (selectedIssues.length === 0) {
    return null;
  }

  return (
    <CommandPaletteSlot name="task">
      <CMDKAction.Group display={{label: t('%s selected issues', selectedIssues.length)}}>
        <CMDKAction.Callback
          display={{label: t('Resolve selected issues')}}
          onAction={resolveSelectedIssues}
        />
      </CMDKAction.Group>
    </CommandPaletteSlot>
  );
}

<CommandPaletteSlot name="page">
  <CMDKAction.Callback display={{label: t('Resolve issue')}} onAction={resolveIssue} />
</CommandPaletteSlot>;
```

Add global actions inside `GlobalCommandPaletteActions`. Do not mount a second
`global` slot consumer: the navigation shell has one outlet for each slot, and
competing consumers do not merge into that outlet.

Child components that split a task or page action tree inherit the enclosing
slot. Only the owning component should wrap the tree in `CommandPaletteSlot`.

## Variants

### Link

Use `Link` for navigation. Use `onNavigate` for analytics or another synchronous
side effect associated with following the link; do not model navigation as a
callback.

```tsx
<CMDKAction.Link
  display={{label: t('Go to Issues'), icon: <IconIssues />}}
  keywords={['bugs', 'errors', 'problems']}
  to={`/organizations/${organization.slug}/issues/`}
  onNavigate={() => trackAnalytics('command_palette.navigate', {organization})}
/>
```

### Callback

Use `Callback` for an operation that does not primarily navigate.

```tsx
<CMDKAction.Callback
  display={{label: t('Resolve issue'), details: t('Mark as resolved')}}
  onAction={handleResolve}
/>
```

For multi-select, `onMultiSelect` is the Shift+Enter capability signal. The
palette supplies the checkbox; control it with `isSelected`.

```tsx
<CMDKAction.Callback
  display={{label: environment}}
  isSelected={selectedEnvironments.includes(environment)}
  onAction={() => commitEnvironment(environment)}
  onMultiSelect={() => toggleEnvironment(environment)}
/>
```

Use `onReorder` for Shift+Arrow reordering and `order` for the explicit sibling
position. Do not encode checkboxes, selection marks, or reorder controls in the
display icon.

### Group

Use `Group` for static children. Its display should identify the context because
the label is used as a breadcrumb during search.

```tsx
<CMDKAction.Group
  display={{label: t('Priority'), icon: priorityIcon}}
  prompt={t('Select a priority')}
>
  <CMDKAction.Callback
    display={{label: t('High')}}
    onAction={() => setPriority('high')}
  />
  <CMDKAction.Callback display={{label: t('Low')}} onAction={() => setPriority('low')} />
</CMDKAction.Group>
```

Group controls:

- `mount="eager"` (default): children mount immediately and participate in
  top-level fuzzy search.
- `mount="on-open"`: expensive children mount only after drill-in. Use this
  when losing top-level child search is acceptable.
- `initialFocus="search"` (default): focus remains in the search input.
- `initialFocus="first-action"`: focus the first child when the group opens.

Prefer a group icon or summary label that reflects current state. Use Scraps
primitives for custom display content.

### Resource

Use `Resource` for large or server-filtered datasets. Every resource must return
`cmdkQueryOptions(...)`; its metadata drives the palette loading indicator.

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
          display: {
            label: project.slug,
            icon: <ProjectAvatar project={project} size={16} />,
          },
          to: `/organizations/${organization.slug}/projects/${project.slug}/`,
        })),
    })
  }
/>
```

Resource invariants:

- The first query after drill-in is empty. The endpoint must support that state.
- Set `enabled: context.state === 'selected'` unless the resource intentionally
  participates at another level, such as query-shape-gated lookup.
- Pass the live `query` to server-side search; it is not debounced.
- `select` returns `CommandPaletteAction[]`.
- Stable data may use `staleTime: Infinity`; dynamic user/session data should
  use a bounded stale time such as 30 seconds.
- A default `limit` of 4 applies only to a resource with render-prop children.
  Auto-rendered resources need an explicit limit when the result set is large.

Resources can auto-render links, callbacks, and nested action groups returned by
`select`. Prefer auto-rendering. Use render-prop children only to combine static
and async entries or provide genuinely custom composition:

```tsx
function renderResult(action: CommandPaletteAction, index: number) {
  if ('actions' in action) {
    const {actions, ...props} = action;
    return (
      <CMDKAction.Group key={index} {...props}>
        {actions.map(renderResult)}
      </CMDKAction.Group>
    );
  }
  if ('to' in action) {
    return <CMDKAction.Link key={index} {...action} />;
  }
  return <CMDKAction.Callback key={index} {...action} />;
}

<CMDKAction.Resource
  display={{label: t('Assign to')}}
  prompt={t('Search members')}
  resource={memberResource}
>
  {members => (
    <>
      <CMDKAction.Callback display={{label: t('Assign to me')}} onAction={assignToMe} />
      {members.map(renderResult)}
    </>
  )}
</CMDKAction.Resource>;
```

For a small bounded dataset already loaded by a cached hook, render static
children under `Group` and let the palette fuzzy-filter them client-side.

### TextInput

Use `TextInput` for a free-text editing step. `initialValue` seeds the editor,
`ariaLabel` names it, `onSubmit` receives the raw value, and `footer` can provide
brief help.

```tsx
<CMDKAction.TextInput
  display={{label: t('Edit query')}}
  input={{
    ariaLabel: t('Query'),
    initialValue: query,
    onSubmit: setQuery,
  }}
/>
```

### Target

Use `Target` for a summary row that opens an action registered elsewhere by a
stable `id`. This avoids registering expensive picker children twice.

```tsx
<CMDKAction.Group id="add-filter" display={{label: t('Add filter')}} prompt={...}>
  <FilterActions />
</CMDKAction.Group>

<CMDKAction.Target display={{label: t('Filter by')}} target="add-filter" />
```

The target must resolve to a mounted action. Stable IDs must be unique within
the registered collection.

## Chained Editing Workflows

Wrap draft-editing actions in `CMDKChainedActionScope`. Callback actions return
to the enclosing group instead of closing the palette. Wrap only terminal
actions in `CMDKTerminalActionScope`.

```tsx
<CMDKChainedActionScope>
  <CMDKAction.Group display={{label: t('Edit query')}}>
    <CMDKAction.Callback display={{label: t('Add filter')}} onAction={addFilter} />
    <CMDKTerminalActionScope>
      <CMDKAction.Callback
        display={{label: t('Apply changes')}}
        onAction={applyChanges}
      />
    </CMDKTerminalActionScope>
  </CMDKAction.Group>
</CMDKChainedActionScope>
```

Component structure defines whether an action stays open or closes. Do not add
`close`, `stayOpen`, or similar boolean props.

## Contextual More Actions

`actionContext` identifies the highlighted row. `actionPanel.context` exposes an
existing action in the Ctrl+Shift+Enter More Actions panel.

```tsx
<CMDKAction.Callback
  actionContext="issue-selection"
  display={{label: issue.title}}
  onAction={() => openIssue(issue)}
/>

<CMDKAction.Callback
  actionPanel={{
    context: 'issue-selection',
    label: t('Resolve'),
    placement: 'panel-only',
  }}
  display={{label: t('Resolve issue')}}
  onAction={resolveIssue}
/>
```

Contexts are hierarchical: `chart:3` matches panel context `chart` and
`chart:3`. Use stable semantic strings, never translated display labels.

Panel controls:

- `placement="palette-and-panel"` (default): show in normal browsing/search and
  in the panel.
- `placement="panel-only"`: hide from normal browsing/search.
- `execution="navigate"` (default): perform normal palette navigation/action
  behavior.
- `execution="preserve-view"`: run a callback without changing the current
  palette step.
- `order`: lower values appear first when actions come from separate branches.
- `label`: panel-specific label; use it when the regular display label contains
  state or needs different wording in the panel.

Reuse the existing action through `actionPanel` or `Target`; do not duplicate
business logic solely for the panel.

## Display, State, and Keys

- Use default icon sizing for section/group icons. Use `size={16}` for entity
  avatars.
- Use `keywords` for useful synonyms that are not already in the label/details.
- Use `labelSuffix` or `trailingItem` only when it communicates state not already
  conveyed by the label, icon, or checkbox. Derive selection markers from the
  state currently being edited; distinguish persisted state explicitly if both
  are shown.
- Hide actions that are inapplicable because of feature flags, permissions, or
  entity state. Use `disabled` when an applicable action is temporarily
  unavailable and `display.details` can explain why.
- Prefix keys in mixed entity lists (`member-${id}`, `team-${id}`) to prevent
  cross-type collisions.
- Use `t('... %s', value)`, not template literals, for translated dynamic labels.
- Prefix `id` with `cmdk:supplementary:` only for sections such as Help that must
  always sort after normal results.

## Checklist

- [ ] Choose the correct `CMDKAction.*` variant.
- [ ] Register transient task actions in `task`, page-owned actions in `page`,
      and global actions inside `GlobalCommandPaletteActions`.
- [ ] Mount task actions only while their task state is active.
- [ ] Keep one slot owner; split child components inherit it.
- [ ] Wrap every resource with `cmdkQueryOptions` and set an intentional
      `enabled`, `staleTime`, `select`, and `limit` policy.
- [ ] Use `mount="on-open"` only when deferred mounting is worth losing
      top-level child search.
- [ ] Use chained and terminal scopes for draft workflows.
- [ ] Use stable IDs for `Target` and supplementary sections.
- [ ] Use stable semantic contexts for More Actions.
- [ ] Render inapplicable actions conditionally; explain temporary disabled
      states.
- [ ] Derive current/selected indicators from the state being edited.
- [ ] Add or update colocated interaction tests for registration, visibility,
      keyboard behavior, and execution.
