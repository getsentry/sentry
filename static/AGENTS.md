# Frontend Development Guide

> For critical commands and testing rules, see the "Command Execution Guide" section in `/AGENTS.md` in the repository root.

## Frontend Tech Stack

- **Language**: TypeScript
- **Framework**: React 19
- **Build Tool**: Rspack (Webpack alternative)
- **Package management**: pnpm
- **State Management**: Reflux, React Query (TanStack Query)
- **Styling**: Emotion (CSS-in-JS), Less
- **Testing**: Jest, React Testing Library

## Important Files and Directories

- `package.json`: Node.js dependencies and scripts
- `rspack.config.ts`: Frontend build configuration
- `tsconfig.json`: TypeScript configuration
- `eslint.config.ts`: ESLint configuration
- `stylelint.config.js`: CSS/styling linting
- **Components**: `static/app/components/{component}/`
- **Views**: `static/app/views/{area}/{page}.tsx`
- **Stores**: `static/app/stores/{store}Store.tsx`
- **Actions**: `static/app/actionCreators/{resource}.tsx`
- **Utils**: `static/app/utils/{utility}.tsx`
- **Types**: `static/app/types/{area}.tsx`
- **API Client**: `static/app/api.tsx`

### Routing

- Routes defined in `static/app/routes.tsx`
- Use React Router v6 patterns
- Lazy load route components when possible

### Frontend API Calls

Use `apiOptions` with `useQuery` from TanStack Query. **Do not use `useApiQuery`, `getApiQueryData`, or `setApiQueryData`** — they are deprecated.

```typescript
import {skipToken, useQuery} from '@tanstack/react-query';
import {apiOptions} from 'sentry/utils/api/apiOptions';

// Basic usage
const query = useQuery(
  apiOptions.as<ResponseType>()('/organizations/$organizationIdOrSlug/endpoint/', {
    path: {organizationIdOrSlug: organization.slug},
    staleTime: 30_000,
  })
);

// Conditional fetching — pass skipToken as path to disable the query
const query = useQuery(
  apiOptions.as<ResponseType>()('/organizations/$organizationIdOrSlug/items/$itemId/', {
    path: itemId ? {organizationIdOrSlug: organization.slug, itemId} : skipToken,
    staleTime: 30_000,
  })
);
```

Key rules:

- **`staleTime` is required** — you must choose a value (`0`, a number in ms, `Infinity`, or `'static'`).
- **Build abstractions over `apiOptions`**, not over `useQuery`. Return the options object so consumers can pass it to `useQuery`, `useQueries`, `prefetchQuery`, etc.
- **Cache stores `{json, headers}`**, not just the body. `apiOptions` uses `select` to extract `.json` by default, but `getQueryData`, `setQueryData`, `retry` functions, and `predicate` callbacks all receive the raw `ApiResponse<T>` shape.
- **never** use `api.requestPromise` for a Query - it returns the wrong structure. If you must make a manual `queryFn`, use `apiFetch`.

### TanStack Query Type Inference — NEVER Pass Call-Site Generics

**CRITICAL**: Never pass type parameters to `useQuery`, `useMutation`, `mutationOptions`, `queryOptions`, or any TanStack Query function at the call site. Let TypeScript infer types from your `queryFn`/`mutationFn` and callbacks. Passing call-site generics defeats inference, hides bugs, and creates maintenance burden.

```typescript
// ❌ NEVER pass generics to useQuery, useMutation, mutationOptions, etc.
useMutation<ResponseType, RequestError, Variables, Context>({...})
mutationOptions<ResponseType, RequestError, Variables, Context>({...})
useQuery<ResponseType, RequestError>({...})

// ✅ Let types be inferred — annotate the mutationFn/queryFn instead
useMutation({
  mutationFn: (variables: MyVariables) =>
    fetchMutation<MyResponse>({...}),
})
```

Specific rules:

1. **Type the `mutationFn` parameters**, not the hook/function generics. The variables type flows from the `mutationFn` signature.
2. **Use `fetchMutation<T>`** to type the return value — the generic on `fetchMutation` is correct because it types the API response.
3. **Never type the error generic as `RequestError`** — that's a type assertion in disguise. The error is `Error` by default. Use runtime narrowing (`if (error instanceof RequestError)`) when you need `RequestError`-specific properties.
4. **Never explicitly type the context** — it is inferred from what `onMutate` returns. Creating a separate `type FooContext = {...}` and passing it as a generic is unnecessary.
5. **Same rule applies to queries** — `useQuery`, `queryOptions`, `useInfiniteQuery`, etc. Types flow from `queryFn` and `select`.

```typescript
// ❌ Explicit context type + error assertion
type MyContext = {previousData: Item[]};

mutationOptions<Item, RequestError, UpdateItemVars, MyContext>({
  mutationFn: variables => fetchMutation({...}),
  onMutate: async () => {
    const previousData = queryClient.getQueryData(itemQueryOptions);
    return {previousData};
  },
  onError: (_error, _variables, context) => {
    queryClient.setQueryData(key, context?.previousData);
  },
})

// ✅ Everything is inferred
mutationOptions({
  mutationFn: (variables: UpdateItemVars) =>
    fetchMutation<Item>({...}),
  onMutate: async () => {
    const previousData = queryClient.getQueryData(itemQueryOptions);
    return {previousData};
  },
  onError: (_error, _variables, context) => {
    // context type is inferred from onMutate return
    queryClient.setQueryData(key, context?.previousData);
  },
})
```

#### Accessing response headers (pagination, hit counts)

By default, `apiOptions` selects only the JSON body from the response. If you need response headers (e.g., `Link` for pagination or `X-Hits` / `X-Max-Hits` for total counts), override `select` with `selectJsonWithHeaders`:

```typescript
import {useQuery} from '@tanstack/react-query';
import {apiOptions, selectJsonWithHeaders} from 'sentry/utils/api/apiOptions';

const {data} = useQuery({
  ...apiOptions.as<Item[]>()('/organizations/$organizationIdOrSlug/items/', {
    path: {organizationIdOrSlug: organization.slug},
    query: {cursor, per_page: 25},
    staleTime: 0,
  }),
  select: selectJsonWithHeaders,
});

// data is ApiResponse<Item[]> — an object with `json` and `headers`
const items = data?.json ?? [];
const pageLinks = data?.headers.Link; // string | undefined
const totalHits = data?.headers['X-Hits']; // number | undefined
const maxHits = data?.headers['X-Max-Hits']; // number | undefined
```

Note that `X-Hits` and `X-Max-Hits` are already parsed to `number | undefined` — no `parseInt` needed.

## General Frontend Rules

1. NO new Reflux stores
2. NO class components
3. NO CSS files (use [core components](./app/components/core/) or Emotion in edge cases)
4. ALWAYS use TypeScript
5. ALWAYS colocate tests
6. Lazy load routes: `React.lazy(() => import('...'))`

## UI Patterns

- When implementing advanced copy to clipboard functionality like markdown or JSON, avoid using separate buttons to copy different formats and prefer using sentry/components/copyAsDropdown and provide the different format options.

## Design System

Use core primitives from `@sentry/scraps` instead of hand-rolling styled components for layout and typography. **For the full prop/token reference and worked examples, use the `design-system` skill.**

- **Layout**: use `Flex`, `Grid`, `Stack`, `Container` — never styled `display: flex/grid`.
- **Typography**: use `Text` and `Heading` — never raw `<p>`, `<span>`, `<div>`, or `<h1>`–`<h6>`.
- Prefer component props over the `style` attribute; use `gap`/padding over `margin`.
- Use responsive props (e.g. `{xs: 'column', md: 'row'}`) instead of styled media queries.
- Split layout from typography — compose `Flex`/`Grid` with `Text`/`Heading`; don't couple them in one styled component.
- Prefer `InfoTip`/`InfoText` over a raw `Tooltip`.
- Add `*.stories.mdx` stories for new components.
- Use [core components](./app/components/core/) whenever available; reserve Emotion for genuine edge cases.

### Avatars

Use the core avatar components (<UserAvatar/>, <TeamAvatar/>, <ProjectAvatar/>, <OrganizationAvatar/>, <SentryAppAvatar/>, <DocIntegrationAvatar/>) from `static/app/components/core/avatar` for avatars.

```tsx
// ✅ Use Avatar component and useUser
import {UserAvatar} from '@sentry/scraps/avatar/userAvatar';
import {useUser} from 'sentry/utils/useUser';

<UserAvatar user={user}>

// ❌ Do not use raw intrinsic elements or static paths
function Component() {
  return (
    <img
      src="/path/to/image.jpg"
      style={{
        border,
        width: 20,
        height: 20,
        borderRadius: '50%',
        objectFit: 'cover',
        display: 'inline-block',
      }}
    />
  );
}
```

For lists of avatars, use <AvatarList>.

### Disclosure

Use the core disclosure component instead of building

```tsx
// ✅ Use Disclosure component
<Disclosure>
  <Disclosure.Title>Title</Disclosure.Title>
  <Disclosure.Content>Content that is toggled based on expanded state</Disclosure.Content>
</Disclosure>;

// ❌ Do not reimplement disclosure pattern manually
function Component() {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div>
      <Button
        onClick={() => setIsExpanded(!isExpanded)}
        icon={<IconChevron direction={isExpanded ? 'down' : 'right'} />}
      >
        Title
      </Button>
      {isExpanded && (
        <Container>Content that is toggled based on expanded state</Container>
      )}
    </div>
  );
}
```

### Images and Icons

Place all icons in the static/app/icons folder. Never inline SVGs or add them to any other folder. Optimize SVGs using svgo or svgomg

```tsx
// ❌ Never inline SVGs
function Component(){
  return (
    <Button icon={
      <svg viewbox="0 0 16 16>"}>
        // ❌ paths have excessive precision, optimize them with SVGO
        <circle cx="8.00134" cy="8.4314" r="5.751412" />
        <circle cx="8.00134" cy="8.4314" r="12.751412" />
        <line x1="8.41334" y1="5.255361" x2="8" y2="8.255421" />
      </svg>
    </Button>
  )
}

// ❌ Never place SVGs outside of icons folder.
import {CustomIcon} from "./customIcon"

// ✅ Import icon from our icon set
import {IconExclamation} from "sentry/icons"
```

```tsx
// ❌ All images belong inside static/app/images

// ✅ Images are imported from sentry-images alias
import image from 'sentry-images/example.png';

import image from './image.png';

function Component() {
  return <Image src={image} />;
}

// ❌ All images need to be imported usign the webpack loader!
function Component() {
  return <Image src="/path/to/image.png" />;
}

function Component() {
  return <Image src={image} />;
}
```

## React Testing Guidelines

### Testing Philosophy

- **User-centric testing**: Write tests that resemble how users interact with the app.
- **Avoid implementation details**: Focus on behavior, not internal component structure.
- **Do not share state between tests**: Behavior should not be influenced by other tests in the test suite.

### Imports

**Always** import from `sentry-test/reactTestingLibrary`, not directly from `@testing-library/react`:

```tsx
import {
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';
```

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

// ❌ Don't recreate the basic context providers
renderHook(useNavigate, {
  wrapper: (children) => (<AllTheProviders>{children}</AllTheProviders>),
})

// ✅ Use the provided helpers that mock everything
renderHookWithProviders(useNavigate)
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

#### Avoid waiting for loading indicators

Do not use `findBy` with `.not.toBeInTheDocument()` for loading indicators. `findBy` will error if the element is not found, but we're asserting it should NOT exist. Loading indicators are also flakey since they appear on screen for only a few ticks.

```tsx
// ❌ Wrong - findBy errors if element not found, and loading indicators are flakey
expect(await screen.findByTestId('loading-indicator')).not.toBeInTheDocument();

// ✅ Correct - wait for the actual content you care about
await waitFor(() => {
  expect(screen.getByRole('button', {name: 'Submit'})).toBeInTheDocument();
});

// ✅ Also correct - use findBy on the content that appears after loading
expect(await screen.findByRole('button', {name: 'Submit'})).toBeInTheDocument();
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
