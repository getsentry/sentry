---
name: cmdk-actions
description: Guide for adding new actions to Sentry's Command+K palette. Use when implementing new cmdk actions, registering page-level or global actions, building async resource pickers, or adding contextual actions to a view.
---

# Adding Actions to the Command Palette (cmdk)

Sentry's Command+K palette (enabled behind `organizations:cmd-k-supercharged`) is built on a tree-collection system where `CMDKAction` components register themselves via React context. Actions render wherever in the component tree they live — no central registry to update.

## Core files

- **`static/app/components/commandPalette/ui/cmdk.tsx`** — `CMDKAction` component (the only primitive you need)
- **`static/app/components/commandPalette/types.tsx`** — public types + `cmdkQueryOptions` helper
- **`static/app/components/commandPalette/ui/commandPaletteSlot.tsx`** — `CommandPaletteSlot` for scoping
- **`static/app/components/commandPalette/ui/commandPaletteGlobalActions.tsx`** — always-on global actions

---

## The Three Slots

Slots control sort order and lifetime. Import from `commandPaletteSlot.tsx`:

```tsx
import {CommandPaletteSlot} from 'sentry/components/commandPalette/ui/commandPaletteSlot';
```

| Slot     | Order in palette         | Lifetime                                   | Use for                                                                 |
| -------- | ------------------------ | ------------------------------------------ | ----------------------------------------------------------------------- |
| `task`   | First (highest priority) | Reserved — not yet used in production      | Future transient workflow steps                                         |
| `page`   | Second                   | Tied to the page component's mount/unmount | Contextual actions for the current view (issue details, settings pages) |
| `global` | Last                     | Always present for any org                 | Org-wide navigation, create actions, help                               |

Wrap page-level actions in the slot provider:

```tsx
// In a page component or its sub-tree
<CommandPaletteSlot name="page">
  <CMDKAction display={{label: t('Resolve Issue')}} onAction={handleResolve} />
</CommandPaletteSlot>
```

Global actions are registered once in `GlobalCommandPaletteActions` — add to that component rather than creating a new global slot consumer.

---

## `CMDKAction` Props

```ts
interface CMDKActionProps {
  // Required: what the user sees
  display: {
    label: string; // primary text
    details?: string; // secondary description line
    icon?: React.ReactNode; // icon on the left — use default size for section icons,
    // size={16} for avatars (ProjectAvatar, ActorAvatar, TeamAvatar)
    trailingItem?: React.ReactNode; // right-side decoration (overrides link indicator)
  };

  // Optional: improve search recall
  keywords?: string[];

  // Optional stable key. Prefix with "cmdk:supplementary:" to sort last in
  // search results regardless of fuzzy score (used for the Help section).
  id?: string;

  // --- Choose one action type (TypeScript union enforces mutual exclusivity) ---

  // 1. Navigate
  to?: LocationDescriptor;

  // 2. Callback
  onAction?: () => void;

  // 3. Group/resource — requires children or resource to render anything.
  //    Without at least one of those the component returns null.
  resource?: (query: string, context: CMDKResourceContext) => CMDKQueryOptions;
  children?: React.ReactNode | ((data: CommandPaletteAction[]) => React.ReactNode);

  // --- Group display ---

  // Overrides the input placeholder when the user drills into this action.
  // Has no effect without children or resource — the node still needs content
  // to drill into.
  prompt?: string;

  // Max results shown before a "See all" expansion item appears.
  // Default: 4 when resource is set and children is a render-prop function.
  // No default for static children.
  limit?: number;
}
```

---

## Action Patterns

### 1. Navigation link

```tsx
import {CMDKAction} from 'sentry/components/commandPalette/ui/cmdk';
import {IconIssues} from 'sentry/icons';

<CMDKAction
  display={{
    label: t('Go to Issues'),
    icon: <IconIssues />,
  }}
  keywords={['bugs', 'errors', 'problems']}
  to={`/organizations/${org.slug}/issues/`}
/>;
```

### 2. Callback action

```tsx
<CMDKAction
  display={{label: t('Resolve Issue'), details: t('Mark as resolved')}}
  onAction={() => handleResolve(group.id)}
/>
```

### 3. Static group

Nest `CMDKAction` children to create a drillable group. The parent label appears as a breadcrumb prefix in search results (e.g. `Set Priority > High`), so use a label that identifies the context.

**Group icon as current-state indicator**: set the group's own icon to reflect the current value so the user can see the state before drilling in. Both the priority and assignee selectors do this:

```tsx
// Icon reflects current priority — user sees state at a glance
<CMDKAction
  display={{
    label: t('Set Priority'),
    icon: <IconCellSignal bars={PRIORITY_BARS[group.priority ?? PriorityLevel.MEDIUM]} />,
  }}
>
  <CMDKAction
    display={{label: t('High'), icon: <IconCellSignal bars={3} />}}
    onAction={() => setPriority('high')}
  />
  <CMDKAction
    display={{label: t('Medium'), icon: <IconCellSignal bars={2} />}}
    onAction={() => setPriority('medium')}
  />
  <CMDKAction
    display={{label: t('Low'), icon: <IconCellSignal bars={1} />}}
    onAction={() => setPriority('low')}
  />
</CMDKAction>;

// Icon reflects current assignee — avatar when assigned, generic icon when not
const assigneeIcon = group.assignedTo ? (
  <ActorAvatar actor={group.assignedTo} size={16} hasTooltip={false} />
) : (
  <IconUser />
);

<CMDKAction display={{label: t('Assign to'), icon: assigneeIcon}}>
  {/* children */}
</CMDKAction>;
```

### 4. Async resource picker

Use `resource` + `cmdkQueryOptions` to load items from an API. The user types to filter. The loading spinner activates automatically while the query is in flight.

Note: when the user drills into a resource node the palette clears the query. Your `resource` function will initially receive an empty string — design your query params accordingly.

```tsx
import {cmdkQueryOptions} from 'sentry/components/commandPalette/types';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {ProjectAvatar} from '@sentry/scraps/avatar';

<CMDKAction
  display={{label: t('Switch Project')}}
  prompt={t('Select a project...')}
  limit={5}
  resource={(query, context) =>
    cmdkQueryOptions({
      ...apiOptions.as<Project[]>()('/organizations/$organizationIdOrSlug/projects/', {
        path: {organizationIdOrSlug: org.slug},
        query: {query, per_page: 20},
        staleTime: 30_000,
      }),
      // Only fetch once the user has drilled into this node
      enabled: context.state === 'selected',
      select: projects =>
        projects.map(project => ({
          display: {
            label: project.slug,
            icon: <ProjectAvatar project={project} size={16} />,
          },
          to: `/organizations/${org.slug}/projects/${project.slug}/`,
        })),
    })
  }
/>;
```

**Rules for `resource`:**

- **Always** wrap with `cmdkQueryOptions(...)` — this injects `meta: { cmdk: true }` so the palette's loading spinner tracks the request via `useIsFetching`.
- Use `enabled: context.state === 'selected'` to defer fetching until the user actually drills in.
- The `select` field must transform the API response into `CommandPaletteAction[]`.
- `query` is the live search input value (not debounced) — pass it through as a search param.
- Use `staleTime: Infinity` for data that rarely changes (project lists, settings nav items). Use `staleTime: 30_000` for user/session data.

### 5. Resource with render-prop children

Use a render-prop when you need custom rendering or want to mix static and async items.

`CommandPaletteAction` is a union that includes groups (which have `actions`, not `children`). Don't blindly spread items into `CMDKAction` — type-narrow to only handle `to` and `onAction` variants, as the codebase's own `renderAsyncResult` helper does:

```tsx
// Type-safe helper — skip groups, which can't be spread into CMDKAction
function renderAsyncResult(item: CommandPaletteAction, index: number) {
  if ('to' in item) return <CMDKAction key={index} {...item} />;
  if ('onAction' in item) return <CMDKAction key={index} {...item} />;
  return null;
}

<CMDKAction
  display={{label: t('Assign to')}}
  prompt={t('Search teammates...')}
  resource={(query, context) =>
    cmdkQueryOptions({
      queryKey: ['members', org.slug, query],
      queryFn: () => fetchMembers(org.slug, query),
      enabled: context.state === 'selected',
      select: members =>
        members.map(m => ({
          display: {label: m.name, details: m.email},
          onAction: () => assignTo(m.id),
        })),
    })
  }
>
  {members => (
    <>
      {/* Static first entry */}
      <CMDKAction display={{label: t('Assign to me')}} onAction={assignToMe} />
      {/* Dynamic entries from resource */}
      {members.map(renderAsyncResult)}
    </>
  )}
</CMDKAction>;
```

**Auto-render limitation**: when `children` is _not_ a render-prop (static children + `resource`), resource results that are `CommandPaletteActionGroup` items are silently skipped. Only `to` and `onAction` results are auto-rendered. Use the render-prop pattern if you need groups from a resource.

### 6. Static async children via hook

When a dataset is small and already cached, fetch it with a hook and render it as static JSX children. The palette's built-in fuzzy search handles filtering client-side — no `resource` prop needed:

```tsx
// useProjectMembers fetches once and caches; palette fuzzy-searches the results
const {data: members = []} = useProjectMembers(project.id);
const assignableUsers = members.filter(m => m.id !== currentUser.id);

<CMDKAction display={{label: t('Assign to'), icon: assigneeIcon}}>
  <CMDKAction
    display={{label: t('Assign to me')}}
    onAction={() => handleAssign(currentUser)}
  />
  {assignableUsers.map(member => (
    <CMDKAction
      key={`member-${member.id}`}
      display={{
        label: member.name || member.email,
        icon: (
          <ActorAvatar
            actor={{id: member.id, name: member.name, type: 'user'}}
            size={16}
            hasTooltip={false}
          />
        ),
      }}
      onAction={() => handleAssign(member)}
    />
  ))}
  {teams.map(team => (
    <CMDKAction
      key={`team-${team.id}`}
      display={{
        label: `#${team.slug}`,
        icon: <TeamAvatar team={team} size={16} hasTooltip={false} />,
      }}
      onAction={() => handleAssign(team)}
    />
  ))}
</CMDKAction>;
```

**When to use static children vs `resource`:**

|               | Static children via hook   | `resource` prop         |
| ------------- | -------------------------- | ----------------------- |
| Dataset size  | Small, bounded             | Large or unbounded      |
| Filtering     | Client-side fuzzy search   | Server-side search      |
| Fetch timing  | Eager (on component mount) | Deferred (on drill-in)  |
| Query updates | Fixed at render            | Responds to typed query |

**Key naming for mixed entity lists**: prefix keys with the entity type to prevent collisions — `member-${id}`, `team-${id}`, `${owner.type}-${owner.id}`, `coding-agent:${id}`.

### 7. `trailingItem` — marking the active item

Use `trailingItem` to indicate which item in a list is the currently active one:

```tsx
import {Tag} from '@sentry/scraps/badge';

// Static current item with a "Current" badge, async others via resource
<CMDKAction
  display={{label: t('Switch Project')}}
  prompt={t('Select a project...')}
  resource={(query, context) => cmdkQueryOptions({...})}
>
  {/* Current project rendered statically so it always appears first */}
  <CMDKAction
    display={{
      label: currentProject.slug,
      icon: <ProjectAvatar project={currentProject} size={16} />,
      trailingItem: <Tag variant="muted">{t('Current')}</Tag>,
    }}
    to={`/organizations/${org.slug}/projects/${currentProject.slug}/`}
  />
</CMDKAction>
```

### 7. Query-content-gated resource

A resource can activate based on what the user has typed, not just drill-in state. Use this for contextual lookup tools that only make sense for a specific query shape:

```tsx
const DSN_PATTERN = /^https?:\/\/.+@.+\/.+/;

<CMDKAction
  display={{label: t('DSN Lookup')}}
  prompt={t('Paste a DSN...')}
  resource={(query, context) =>
    cmdkQueryOptions({
      ...apiOptions.as<DsnLookupResponse>()(/* ... */),
      // Only fetch when the query looks like a DSN
      enabled: context.state === 'selected' && DSN_PATTERN.test(query),
      select: result => result.navTargets.map(/* ... */),
    })
  }
/>;
```

### 8. State-conditional actions

Render different actions based on current entity state — not just feature flags. Actions that don't apply to the current state should simply not render:

```tsx
<CommandPaletteSlot name="page">
  <CMDKAction display={{label: issueTitle}} icon={<ProjectAvatar ... />}>
    {!isResolved && !isArchived && (
      <CMDKAction display={{label: t('Resolve')}} onAction={handleResolve} />
    )}
    {!isResolved && !isArchived && (
      <CMDKAction display={{label: t('Archive')}} onAction={handleArchive} />
    )}
    {isResolved && (
      <CMDKAction display={{label: t('Unresolve')}} onAction={handleUnresolve} />
    )}
    {isArchived && (
      <CMDKAction display={{label: t('Unarchive')}} onAction={handleUnarchive} />
    )}
  </CMDKAction>
</CommandPaletteSlot>
```

### 9. Supplementary (always-last) section

Prefix `id` with `cmdk:supplementary:` to sort the section after all other results, regardless of search score. Reserved for content like Help links that should never surface above real actions.

```tsx
<CMDKAction
  id="cmdk:supplementary:help"
  display={{label: t('Help')}}
  resource={helpResource}
/>
```

---

## Splitting Actions Across Components

When a page's action set is complex, split it across multiple components. Child components that register actions **do not need their own slot** — they inherit the slot context from the parent that established it. Just emit `<CMDKAction>` nodes directly:

```tsx
// views/issueDetails/groupPriorityActions.tsx
// No slot here — registers under whatever parent mounts this
function GroupPriorityActions({group}: {group: Group}) {
  return (
    <CMDKAction display={{label: t('Set Priority')}}>
      <CMDKAction display={{label: t('High')}} onAction={() => setPriority('high')} />
      <CMDKAction display={{label: t('Medium')}} onAction={() => setPriority('medium')} />
      <CMDKAction display={{label: t('Low')}} onAction={() => setPriority('low')} />
    </CMDKAction>
  );
}

// views/issueDetails/seerActions.tsx
// Returns a Fragment of siblings — adds actions into the parent group without
// creating an extra nesting level
function SeerActions({group}: {group: Group}) {
  if (!canShowSeer) return null;
  return (
    <Fragment>
      <CMDKAction
        display={{label: t('Fix with Seer'), icon: <IconSeer />}}
        onAction={startAutofix}
      />
    </Fragment>
  );
}

// views/issueDetails/issueCommandPaletteActions.tsx
// Only this component owns the slot
function IssueCommandPaletteActions({group, issue}: Props) {
  return (
    <CommandPaletteSlot name="page">
      <CMDKAction
        display={{
          label: issue.title,
          icon: <ProjectAvatar project={project} size={16} />,
        }}
      >
        <GroupPriorityActions group={group} />
        <SeerActions group={group} />
      </CMDKAction>
    </CommandPaletteSlot>
  );
}
```

Use `<Fragment>` (not a wrapping `<CMDKAction>`) when a child component contributes flat siblings into an existing parent group.

---

## Registering Global Actions

Add to `GlobalCommandPaletteActions` in `commandPaletteGlobalActions.tsx`. Don't create a second `global` slot consumer — there is one slot outlet in the navigation shell, so a second consumer would compete with it rather than extend it. It's a JSX component — just insert a new `CMDKAction` in the relevant group or create a new named group:

```tsx
// Inside GlobalCommandPaletteActions render:
<CMDKAction display={{label: t('Go to')}}>
  {/* existing actions... */}
  <CMDKAction
    display={{label: t('Monitors'), icon: <IconTimer />}}
    to={`/organizations/${organization.slug}/crons/`}
  />
</CMDKAction>
```

---

## Registering Page-Level Actions

Create a component that wraps actions in `<CommandPaletteSlot name="page">` and mount it inside the relevant page component. The actions register and deregister automatically with the page's mount/unmount lifecycle.

```tsx
// views/myFeature/myFeatureCommandPaletteActions.tsx
function MyFeatureCommandPaletteActions({item}: {item: MyItem}) {
  return (
    <CommandPaletteSlot name="page">
      <CMDKAction
        display={{label: t('Archive'), details: item.name}}
        onAction={() => archiveItem(item.id)}
      />
    </CommandPaletteSlot>
  );
}

// views/myFeature/myFeaturePage.tsx
function MyFeaturePage() {
  return (
    <div>
      <MyFeatureCommandPaletteActions item={item} />
      {/* rest of page */}
    </div>
  );
}
```

---

## Feature Flag and Permission Gates

The new palette only activates when the org has the `cmd-k-supercharged` flag. Actions registered via `CMDKAction` are always safe to render — they simply won't be visible to users without the flag.

Gate on additional flags or permissions inline:

```tsx
{
  organization.features.includes('my-feature') && (
    <CMDKAction display={{label: t('My New Action')}} onAction={doThing} />
  );
}

{
  user.isStaff && <CMDKAction display={{label: t('Admin Panel')}} to="/admin/" />;
}
```

**Gate the entire slot when a page is disabled** — don't render individual disabled actions; don't render the slot at all:

```tsx
// ✅ Gate at the slot level
{
  !disabled && (
    <CommandPaletteSlot name="page">
      <CMDKAction display={{label: entity.title}}>{/* all actions */}</CMDKAction>
    </CommandPaletteSlot>
  );
}
```

---

## Capability Config

When an entity type determines which actions are available, derive that from a config object rather than inline conditionals. `getConfigForIssueType(group, project)` returns per-action capability flags:

```tsx
const config = useMemo(() => getConfigForIssueType(group, project), [group, project]);
const {
  actions: {resolve: resolveCap, delete: deleteCap},
} = config;

// Only render actions the issue type supports
{
  resolveCap.enabled && (
    <CMDKAction display={{label: t('Resolve')}} onAction={handleResolve} />
  );
}
```

For new entity types, follow the same pattern: define a config shape that carries capability flags, then gate rendering on those flags rather than scattered `group.type === '...'` checks.

---

## Workflow / Sequential State Machine

When actions represent steps in a multi-stage workflow, show only the _next valid action_ — not all possible steps at once. Gate each step on the previous step being complete and the next not yet started:

```tsx
// Extract state into a dedicated hook in the same file
function useSeerState(group: Group, project: Project) {
  const autofix = useExplorerAutofix(group.id);
  const sections = getOrderedAutofixSections(autofix.runState);

  return {
    autofix,
    completedRootCause: sections.some(
      s => isRootCauseSection(s) && s.status === 'completed'
    ),
    completedSolution: sections.some(
      s => isSolutionSection(s) && s.status === 'completed'
    ),
    completedCodeChanges: sections.some(
      s => isCodeChangesSection(s) && s.status === 'completed'
    ),
    hasPR: sections.some(isPullRequestsSection),
    runId: autofix.runState?.run_id,
    isPolling: autofix.isPolling,
  };
}

function WorkflowActions({group, project}: Props) {
  const {
    autofix,
    completedRootCause,
    completedSolution,
    completedCodeChanges,
    hasPR,
    runId,
    isPolling,
  } = useSeerState(group, project);

  // Guard: can only advance the workflow when not mid-operation and run exists
  const canContinue = !isPolling && defined(runId);

  return (
    <Fragment>
      {(!autofix.runState || autofix.runState.status === 'error') && (
        <CMDKAction display={{label: t('Fix with Seer')}} onAction={startFix} />
      )}
      {canContinue && completedRootCause && !completedSolution && (
        <CMDKAction
          display={{label: t('Generate solution')}}
          onAction={() => nextStep('solution', runId)}
        />
      )}
      {canContinue && completedSolution && !completedCodeChanges && (
        <CMDKAction
          display={{label: t('Generate code changes')}}
          onAction={() => nextStep('code_changes', runId)}
        />
      )}
      {canContinue && completedCodeChanges && !hasPR && (
        <CMDKAction
          display={{label: t('Open pull request')}}
          onAction={() => createPR(runId)}
        />
      )}
    </Fragment>
  );
}
```

Key points:

- Extract the state logic into a dedicated `use*State` hook within the action component file — keeps the JSX clean.
- Use a `canContinue` guard to prevent showing progress actions while an async operation is in flight.
- Return `null` early at the top of the component when the feature isn't applicable:

```tsx
// Guard clause — return null before any hooks if possible, else after
if (!aiConfig.areAiFeaturesAllowed || !isExplorer || !issueTypeSupportsSeer || !event) {
  return null;
}
```

---

## Dynamic Labels

Embed the current value in an action label to give context without requiring the user to drill in first:

```tsx
// Shows who is currently assigned
<CMDKAction
  display={{label: t('Unassign from %s', currentAssigneeName)}}
  onAction={() => handleAssigneeChange(null)}
/>

// Shows the current value being changed
<CMDKAction
  display={{label: t('Change theme: %s', currentTheme)}}
  onAction={openThemePicker}
/>
```

Use `t('... %s', value)` (printf-style) rather than template literals so strings remain translatable.

---

## Checklist

- [ ] Wrap page-level actions in `<CommandPaletteSlot name="page">`; add global actions to `GlobalCommandPaletteActions`
- [ ] Child components that split a page action set do **not** add their own slot — they inherit from the parent
- [ ] All `resource` functions use `cmdkQueryOptions(...)`
- [ ] `resource` functions set `enabled: context.state === 'selected'` to defer fetching (or a query-content check for contextual resources)
- [ ] `select` in resource options returns `CommandPaletteAction[]`
- [ ] `prompt` is set on any drill-target that replaces the search placeholder
- [ ] `limit` is set on resource nodes to avoid overwhelming the list (default 4 only applies when `resource` AND `children` is a render-prop function; auto-render mode has no default)
- [ ] `staleTime: Infinity` for stable lists (projects, nav items); `staleTime: 30_000` for dynamic data
- [ ] `id="cmdk:supplementary:..."` on any section that should always sort last
- [ ] `keywords` added for non-obvious actions to improve search recall
- [ ] Section/group icons use default size; avatar icons (`ProjectAvatar`, `ActorAvatar`, `TeamAvatar`) use `size={16}`
- [ ] State-conditional actions (resolved, archived, etc.) are rendered conditionally rather than disabled
- [ ] `disabled` state gates the entire `<CommandPaletteSlot>`, not individual actions
- [ ] Group icon reflects the current value of the setting it controls (priority, assignee, theme)
- [ ] Dynamic action labels use `t('... %s', value)` not template literals, so strings stay translatable
- [ ] Workflow action components extract state logic into a dedicated `use*State` hook and use a `canContinue` guard
- [ ] Components that are not applicable return `null` early via a guard clause before rendering any JSX
- [ ] Entity capability config (e.g. `getConfigForIssueType`) drives action availability rather than scattered type checks
- [ ] Dynamic list keys use `type-id` format (`member-${id}`, `team-${id}`) to prevent cross-type collisions
