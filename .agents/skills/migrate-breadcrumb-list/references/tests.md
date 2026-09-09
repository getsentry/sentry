# Specs for a migrated page

The migration moves rendering into two TopBar slots, so a spec that does not mount the bar renders nothing and fails as though the component were broken. Fix the harness first, then the queries.

## Contents

- [Mount the bar](#mount-the-bar)
- [Queries](#queries)
- [Assert the leaf is gone](#assert-the-leaf-is-gone)
- [Menus and pagination](#menus-and-pagination)
- [Stores the new component reads](#stores-the-new-component-reads)
- [What jsdom cannot test](#what-jsdom-cannot-test)

## Mount the bar

The provider alone is not enough — the outlets have to exist.

```tsx
// The header renders into TopBar slots, so the bar has to be mounted alongside
// it for the breadcrumbs and title to appear.
function renderHeader(org = organization) {
  return render(
    <TopBar.Slot.Provider>
      <TopBar />
      <MyHeader {...props} />
    </TopBar.Slot.Provider>,
    {organization: org}
  );
}
```

`import {TopBar} from 'sentry/views/navigation/topBar'`.

**The trap:** a spec that stubs individual outlets instead of mounting `<TopBar />` will usually stub `title`, `actions`, and `feedback` but not `breadcrumbs` — which did not exist before this migration. Parent crumbs then render nowhere and the failure reads "unable to find role link". Either add the missing outlet or switch to `<TopBar />`. Find these before you start:

```bash
grep -rln 'TopBar.Slot.Outlet' static/app --include='*.spec.tsx'
```

A spec that renders a Shape C wrapper standalone with no provider at all cannot work once the wrapper owns two slots. Wrap it or delete it — do not leave it asserting on a component that now renders `null`.

## Queries

Scope to the bar, because the page body often repeats the same words.

```tsx
const topBar = screen.getByRole('banner');
expect(await within(topBar).findByRole('link', {name: 'Monitors'})).toBeInTheDocument();
expect(
  within(topBar).getByRole('heading', {name: 'My Monitor', level: 1})
).toBeInTheDocument();
```

| Target                              | Query                                                                                                                                            |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| The trail                           | `getByRole('list')` — an `<ol>`. There is no `<nav>` and no `aria-label="Breadcrumbs"`                                                           |
| A parent crumb                      | `getByRole('link', {name})`                                                                                                                      |
| The page title, in the TopBar       | `getByRole('heading', {name, level: 1})` — the `<h1>` comes from the outlet                                                                      |
| The page title, rendered standalone | `getByText(name)` — **not** `getByRole('heading')`                                                                                               |
| Overflow trigger                    | `getByRole('button', {name: 'More breadcrumbs'})`                                                                                                |
| Copy action                         | `getByRole('button', {name: <your label>})`                                                                                                      |
| A `type: 'button'` trailing action  | `getByRole('button', ...)` **even when it is a link** — scraps `LinkButton` renders `<a role="button">`, so `getByRole('link')` will not find it |
| Menu trigger                        | `getByRole('button', {name: <triggerLabel>})`                                                                                                    |
| Pagination chevron                  | `getByRole('button', {name: <ariaLabel>})`; disabled has `aria-disabled="true"`                                                                  |
| Editable title                      | `getByText(value)`, click, then `getByRole('textbox', {name: <aria-label>})`                                                                     |
| Project picker                      | `await findByRole('button', {name: 'Selected Project: <slug>'})` — needs `findBy`                                                                |

Of the legacy test ids, only `breadcrumb-link` still exists. `breadcrumb-list` and `breadcrumb-item` are gone — but they appear in no spec today, so there is nothing to sweep. Prefer roles regardless.

## Assert the leaf is gone

The regression this migration is most likely to reintroduce is the page name appearing twice. Assert the negative, not just the positive:

```tsx
const breadcrumbs = await screen.findByRole('list');
expect(within(breadcrumbs).getByRole('link', {name: 'Dashboards'})).toBeInTheDocument();
expect(
  screen.getByRole('heading', {name: 'Custom Errors', level: 1})
).toBeInTheDocument();
expect(within(breadcrumbs).queryByText('Custom Errors')).not.toBeInTheDocument();
```

If the page previously rendered an action you moved into the title menu, assert its old standalone form is absent too — a `queryByRole(...).not.toBeInTheDocument()` alongside the new menu assertion.

## Menus and pagination

Menu items are `menuitemradio`, and submenus open on hover:

```tsx
await userEvent.click(await screen.findByRole('button', {name: 'Monitor Actions'}));
expect(
  await screen.findByRole('menuitemradio', {name: 'Star for Team'})
).toBeInTheDocument();

// Submenus open on hover, not on click.
await userEvent.hover(await screen.findByRole('menuitemradio', {name: 'Star for Team'}));
```

Order is worth asserting when actions were consolidated, since that is the thing reviewers cannot see in a diff:

```tsx
expect(screen.getAllByRole('menuitemradio').map(el => el.textContent?.trim())).toEqual([
  'Copy ID to clipboard',
  'Share',
  'Delete',
]);
```

Grouped sections are `getByRole('group', {name: <section label>})`.

## Stores the new component reads

`leadingGraphic` badges resolve projects and teams through hooks, so a spec that passed with `initializeOrg({projects: []})` may now find nothing. Load the stores directly:

import {ProjectsStore} from 'sentry/stores/projectsStore';
import {TeamStore} from 'sentry/stores/teamStore';

```tsx
ProjectsStore.loadInitialData([project]);
TeamStore.loadInitialData(teams, false, null);
```

If a title action fetches, mock its endpoint. To pin a loading state deliberately, `asyncDelay: new Promise<void>(() => {})` never resolves. And check the fixture actually satisfies whatever condition gates the action — `ReleaseFixture` ships `url: ''`, so an action rendered only when a URL exists is absent by default and a test asserting on it fails correctly. Override the fixture field, not the assertion.

**A green existing spec can prove nothing.** Before trusting it, confirm it actually asserted on the header — a `findByText(name, {exact: false})` often matches body text and stays green through a migration that broke the trail. If the page has no header coverage at all, add a spec: the checklist's leaf-absent assertion cannot hold otherwise. `views/navigation/topBar.spec.tsx` is the canonical harness to copy; its Seer and feedback mocks are only for its own assertions and are not needed to mount the bar.

## What jsdom cannot test

Below 512px the trail collapses into an overflow `…` menu, driven by a container query. **jsdom never evaluates container queries**, so the collapse cannot be exercised in a page spec.

The component's own spec asserts on emitted emotion rules to cover this. Do not copy that into a page spec — it couples the test to generated CSS and breaks on unrelated style edits. The collapse is covered once, in `static/app/components/core/breadcrumbList/breadcrumbList.spec.tsx`; page specs should assert the items they pass in, and leave responsive behavior to that spec and a manual resize check.

That component spec also tolerates exactly one React warning: the core `Container` primitive leaks a `containertype` DOM attribute. If a page spec fails all `console.error`s, expect to allow that one until the primitive is fixed.
