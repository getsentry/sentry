# Tests for a migrated page

Use the repository's `react-testing` skill when editing tests. Verify the changed behavior; do not retain a test only to assert that a deliberately removed decoration is absent.

## TopBar test setup

`render` from `sentry-test/reactTestingLibrary` already mounts `TopBar.Slot.Provider` and outlets for breadcrumbs, title, search, actions, and feedback. Its title outlet renders an `<h1>`. Most page tests need no extra provider or `<TopBar />`.

```tsx
render(<MyHeader {...props} />);
expect(
  await screen.findByRole('heading', {name: 'My Monitor', level: 1})
).toBeInTheDocument();
expect(screen.getByRole('link', {name: 'Monitors'})).toBeInTheDocument();
```

For tests of the real bar layout or its banner, mount a separate provider and bar as in `static/app/views/navigation/topBar.spec.tsx`:

```tsx
render(
  <TopBar.Slot.Provider>
    <TopBar />
    <MyHeader {...props} />
  </TopBar.Slot.Provider>
);
```

If a custom harness supplies its own outlets, it needs both the internal `breadcrumbs` and `title` outlets. This internal title outlet does not permit a public `<TopBar.Slot name="title">` caller.

## Queries

| Target                                         | Query                                                                                |
| ---------------------------------------------- | ------------------------------------------------------------------------------------ |
| Parent trail                                   | `getByRole('list')`; the component has no `<nav>`                                    |
| Parent link                                    | `getByRole('link', {name})`                                                          |
| Title rendered through TopBar                  | `getByRole('heading', {name, level: 1})`                                             |
| Standalone `BreadcrumbList.Title`              | `getByText(name)`; it supplies no heading                                            |
| Overflow trigger                               | `getByRole('button', {name: 'More breadcrumbs'})`                                    |
| Copy or menu trigger                           | `getByRole('button', {name: actionLabel})`                                           |
| Button or LinkButton action                    | `getByRole('button', {name})`; LinkButton uses this role too                         |
| Feature badge                                  | `getByLabelText('new')`, `'alpha'`, or `'beta'`                                      |
| Pagination                                     | `getByRole('button', {name: ariaLabel})`; disabled links have `aria-disabled="true"` |
| Selector title                                 | `findByRole('button', {name: label})`                                                |
| Parent project selector without explicit label | `findByRole('button', {name: 'Selected Project: <slug>'})`                           |

For `labelTooltip`, hover or focus the title text, then assert the description or documentation link. Do not query the removed separate info icon.

For editable titles, click the text unless `editOnDoubleClick` is enabled; then double-click or use the edit button. Verify blur cancellation only for callers that request `cancelOnBlur`.

## Keep the leaf out of the parent trail

When the migration changes the trail, assert that the heading appears once and that the current page is not also a parent:

```tsx
const breadcrumbs = await screen.findByRole('list');
expect(within(breadcrumbs).getByRole('link', {name: 'Dashboards'})).toBeInTheDocument();
expect(
  screen.getByRole('heading', {name: 'Custom Errors', level: 1})
).toBeInTheDocument();
expect(within(breadcrumbs).queryByText('Custom Errors')).not.toBeInTheDocument();
```

Scope queries to the heading, trail, or banner when body content repeats the same text. Feature badges can contribute to the heading's accessible name; inspect the rendered result when choosing a name query.

## Actions and data

Menu items use `menuitemradio`; submenus open on hover. Selector options use `option`. Exercise selection and navigation instead of asserting only that a trigger exists.

Preserve meaningful existing tests for enrollment, saving, navigation, and analytics. If a fixture gates an action, set the relevant fixture field rather than weakening the assertion. Mock endpoints with `MockApiClient`; load `ProjectsStore` or `TeamStore` if the component needs their data. Do not add hook mocks to bypass the behavior being tested.

## Responsive behavior

jsdom does not evaluate container queries. The component's own tests cover emitted collapse rules. Do not duplicate generated-CSS assertions in page tests; verify their item content and use a browser resize check when the responsive layout changes.
