# Tests for a migrated page

Use the repository's `react-testing` skill when editing tests. Verify the changed behavior; do not retain a test only to assert that a deliberately removed decoration is absent.

## TopBar test setup

`render` from `sentry-test/reactTestingLibrary` already mounts `TopBar.Slot.Provider` and outlets for breadcrumbs, title, search, actions, and feedback. The title item supplies its own `<h1>`; the outlet uses a plain wrapper. Most page tests need no extra provider or `<TopBar />`.

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

| Target                            | Query                                                                                |
| --------------------------------- | ------------------------------------------------------------------------------------ |
| Parent trail                      | `getByRole('list')`; the component has no `<nav>`                                    |
| Parent link                       | `getByRole('link', {name})`                                                          |
| Title rendered through TopBar     | `getByRole('heading', {name, level: 1})`                                             |
| Standalone `BreadcrumbList.Title` | `getByRole('heading', {name, level: 1})`                                             |
| Overflow trigger                  | `getByRole('button', {name: 'More breadcrumbs'})`                                    |
| Copy or menu trigger              | `getByRole('button', {name: actionLabel})`                                           |
| Button or LinkButton action       | `getByRole('button', {name})`; LinkButton uses this role too                         |
| Feature badge                     | `getByLabelText('new')`, `'alpha'`, or `'beta'`                                      |
| Pagination                        | `getByRole('button', {name: ariaLabel})`; disabled links have `aria-disabled="true"` |
| Parent project selector           | `findByRole('button', {name: 'Switch <slug>'})`                                      |

For `labelTooltip`, hover or focus the title text, then assert the description or documentation link. Do not query the removed separate info icon.

For editable titles, click the heading to start editing. A labelled textbox replaces the heading and must not be inside an `h1`. Saving or cancelling restores the heading. Clicking outside saves the draft; Escape cancels it.

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

Scope queries to the heading, trail, or banner when body content repeats the same text. For both title types, the heading contains only the displayed label. Query graphics, pagination, and trailing actions outside the heading.

## Actions and data

Menu items use `menuitemradio`; submenus open on hover. Selector options use `option`. Exercise selection and navigation instead of asserting only that a trigger exists.

Preserve meaningful existing tests for enrollment, saving, navigation, and analytics. If a fixture gates an action, set the relevant fixture field rather than weakening the assertion. Mock endpoints with `MockApiClient`; load `ProjectsStore` or `TeamStore` if the component needs their data. Do not add hook mocks to bypass the behavior being tested.

## Responsive behavior

jsdom does not evaluate container queries. The component's own tests cover emitted collapse rules. Do not duplicate generated-CSS assertions in page tests; verify their item content and use a browser resize check when the responsive layout changes.

Parent selectors use a separate `Switch <label>` icon button. Test opening it with a click and selecting an option. The label is plain text and does not navigate or open the menu on hover. The final Settings crumb remains a plain title even when alternatives exist.
