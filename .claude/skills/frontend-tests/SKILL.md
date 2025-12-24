---
name: frontend-tests
description: Guidelines for writing tests and running the test suite for the frontend Typescript React project.
---

# Sentry Frontend Tests

## Running Tests

```bash
# Run JavaScript tests (always use CI flag)
CI=true pnpm test <file_path>

# Run specific test file(s)
CI=true pnpm test components/avatar.spec.tsx
```

## React Testing Guidelines

### Testing Philosophy

- **User-centric testing**: Write tests that resemble how users interact with the app.
- **Avoid implementation details**: Focus on behavior, not internal component structure.
- **Do not share state between tests**: Behavior should not be influenced by other tests in the test suite.

### Query Priority (in order of preference)

1. **`getByRole`** - Primary selector for most elements

   ```tsx
   screen.getByRole('button', {name: 'Save'});
   screen.getByRole('textbox', {name: 'Search'});
   ```

2. **`getByLabelText`/`getByPlaceholderText`** - For form elements

   ```tsx
   screen.getByLabelText('Email Address');
   screen.getByPlaceholderText('Enter Search Term');
   ```

3. **`getByText`** - For non-interactive elements

   ```tsx
   screen.getByText('Error Message');
   ```

4. **`getByTestId`** - Last resort only
   ```tsx
   screen.getByTestId('custom-component');
   ```

### Best Practices

#### Avoid mocking hooks, functions, or components

Do not use `jest.mocked()`.

```tsx
// ❌ Don't mock hooks
jest.mocked(useDataFetchingHook)

// ✅ Set the response data
MockApiClient.addMockResponse({
    url: '/data/',
    body: DataFixture(),
})

// ❌ Don't mock contexts
jest.mocked(useOrganization)

// ✅ Use the provided organization config on render()
render(<Component />, {organization: OrganizationFixture({...})})

// ❌ Don't mock router hooks
jest.mocked(useLocation)

// ✅ Use the provided router config
render(<TestComponent />, {
  initialRouterConfig: {
    location: {
      pathname: "/foo/",
    },
  },
});

// ❌ Don't mock page filters hook
jest.mocked(usePageFilters)

// ✅ Update the corresponding data store with your data
PageFiltersStore.onInitializeUrlState(
    PageFiltersFixture({ projects: [1]}),
)
```

#### Use fixtures

Sentry fixtures are located in tests/js/fixtures/ while GetSentry fixtures are located in tests/js/getsentry-test/fixtures/.

```tsx

// ❌ Don't import type and initialize it
import type {Project} from 'sentry/types/project';
const project: Project = {...}

// ✅ Import a fixture instead
import {ProjectFixture} from 'sentry-fixture/project';

const project = ProjectFixture(partialProject)

```

#### Use `screen` instead of destructuring

```tsx
// ❌ Don't do this
const {getByRole} = render(<Component />);

// ✅ Do this
render(<Component />);
const button = screen.getByRole('button');
```

#### Query selection guidelines

- Use `getBy...` for elements that should exist
- Use `queryBy...` ONLY when checking for non-existence
- Use `await findBy...` when waiting for elements to appear

```tsx
// ❌ Wrong
expect(screen.queryByRole('alert')).toBeInTheDocument();

// ✅ Correct
expect(screen.getByRole('alert')).toBeInTheDocument();
expect(screen.queryByRole('button')).not.toBeInTheDocument();
```

#### Async testing

```tsx
// ❌ Don't use waitFor for appearance
await waitFor(() => {
  expect(screen.getByRole('alert')).toBeInTheDocument();
});

// ✅ Use findBy for appearance
expect(await screen.findByRole('alert')).toBeInTheDocument();

// ✅ Use waitForElementToBeRemoved for disappearance
await waitForElementToBeRemoved(() => screen.getByRole('alert'));
```

#### User interactions

```tsx
// ❌ Don't use fireEvent
fireEvent.change(input, {target: {value: 'text'}});

// ✅ Use userEvent
await userEvent.click(input);
await userEvent.keyboard('text');
```

#### Testing routing

```tsx
const {router} = render(<TestComponent />, {
  initialRouterConfig: {
    location: {
      pathname: '/foo/',
      query: {page: '1'},
    },
  },
});
// Uses passes in config to set initial location
expect(router.location.pathname).toBe('/foo');
expect(router.location.query.page).toBe('1');
// Clicking links goes to the correct location
await userEvent.click(screen.getByRole('link', {name: 'Go to /bar/'}));
// Can check current route on the returned router
expect(router.location.pathname).toBe('/bar/');
// Can test manual route changes with router.navigate
router.navigate('/new/path/');
router.navigate(-1); // Simulates clicking the back button
```

If the component uses `useParams()`, the `route` property can be used:

```tsx
function TestComponent() {
  const {id} = useParams();
  return <div>{id}</div>;
}
const {router} = render(<TestComponent />, {
  initialRouterConfig: {
    location: {
      pathname: '/foo/123/',
    },
    route: '/foo/:id/',
  },
});
expect(screen.getByText('123')).toBeInTheDocument();
```

#### Testing components that make network requests

```tsx
// Simple GET request
MockApiClient.addMockResponse({
  url: '/projects/',
  body: [{id: 1, name: 'my project'}],
});

// POST request
MockApiClient.addMockResponse({
  url: '/projects/',
  method: 'POST',
  body: {id: 1, name: 'my project'},
});

// Complex matching with query params and request body
MockApiClient.addMockResponse({
  url: '/projects/',
  method: 'POST',
  body: {id: 2, name: 'other'},
  match: [
    MockApiClient.matchQuery({param: '1'}),
    MockApiClient.matchData({name: 'other'}),
  ],
});

// Error responses
MockApiClient.addMockResponse({
  url: '/projects/',
  body: {
    detail: 'Internal Error',
  },
  statusCode: 500,
});
```

##### Always Await Async Assertions

Network requests are asynchronous. Always use `findBy` queries or properly await assertions:

```tsx
// ❌ Wrong - will fail intermittently
expect(screen.getByText('Loaded Data')).toBeInTheDocument();

// ✅ Correct - waits for element to appear
expect(await screen.findByText('Loaded Data')).toBeInTheDocument();
```

##### Handle Refetches in Mutations

When testing mutations that trigger data refetches, update mocks before the refetch occurs:

```tsx
it('adds item and updates list', async () => {
  // Initial empty state
  MockApiClient.addMockResponse({
    url: '/items/',
    body: [],
  });

  const createRequest = MockApiClient.addMockResponse({
    url: '/items/',
    method: 'POST',
    body: {id: 1, name: 'New Item'},
  });

  render(<ItemList />);

  await userEvent.click(screen.getByRole('button', {name: 'Add Item'}));

  // CRITICAL: Override mock before refetch happens
  MockApiClient.addMockResponse({
    url: '/items/',
    body: [{id: 1, name: 'New Item'}],
  });

  await waitFor(() => expect(createRequest).toHaveBeenCalled());
  expect(await screen.findByText('New Item')).toBeInTheDocument();
});
```
