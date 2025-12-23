# Frontend Development Guide

> For critical commands and testing rules, see `/AGENTS.md` in the repository root.

## Frontend Tech Stack

- **Language**: TypeScript
- **Framework**: React 19
- **Build Tool**: Rspack (Webpack alternative)
- **Package management**: pnpm
- **State Management**: Reflux, React Query (TanStack Query)
- **Styling**: Emotion (CSS-in-JS), Less
- **Testing**: Jest, React Testing Library

## Commands

### Development Setup

```bash
# Start the development server
pnpm run dev

# Start only the UI development server with hot reload
pnpm run dev-ui
```

### Linting

```bash
# JavaScript/TypeScript linting
pnpm run lint:js

# Linting for specific file(s)
pnpm run lint:js components/avatar.tsx [...other files]

# Fix linting issues
pnpm run fix
```

### Testing

```bash
# Run JavaScript tests (always use CI flag)
CI=true pnpm test <file_path>

# Run specific test file(s)
CI=true pnpm test components/avatar.spec.tsx
```

### Important Files and Directories

- `package.json`: Node.js dependencies and scripts
- `rspack.config.ts`: Frontend build configuration
- `tsconfig.json`: TypeScript configuration
- `eslint.config.mjs`: ESLint configuration
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

```typescript
import {useApiQuery, type UseApiQueryResult} from 'sentry/utils/queryClient';

const appSizeQuery: UseApiQueryResult<ResponseType, RequestError> = useApiQuery<ResponseType>(
  [`/projects/${organization.slug}/pull-requests/size-analysis/${selectedBuildId}/`],
  {
    staleTime: <int>, // Optional, amount of time before data is considered stale (in ms)
    enabled: <enabled criteria>, // Optional, whether the query is enabled
  }
);
```

## General Frontend Rules

1. NO new Reflux stores
2. NO class components
3. NO CSS files (use [core components](./app/components/core/) or Emotion in edge cases)
4. ALWAYS use TypeScript
5. ALWAYS colocate tests
6. Lazy load routes: `React.lazy(() => import('...'))`

## Design system

### General practices

- Use [core components](./app/components/core/) whenever possible. Use Emotion (styled components) only in edge cases.
- Use Text, Heading, Flex, Grid, Stack, Container and other core typography/layout components whenever possible.
- Add stories whenever possible (\*.stories.tsx).
- Icons should be part of our icon set at static/app/icons and never inlined
- Images should be placed inside static/app/images and imported via loader

### Core components

Always use Core components whenever available. Avoid using Emotion (styled components) unless absolutely necessary.

#### Layout

##### Grid

Use <Grid> from `@sentry/scraps/layout` for elements that require grid layout as opposed to styled components with `display: grid`

```tsx
import {Grid} from '@sentry/scraps/layout';

// ❌ Do not use styled and create a new styled component
const Component = styled('div')`
  display: flex;
  flex-directon: column;
`;

// ✅ Use the Grid layout primitive
<Grid direction="column"></Grid>;
```

##### Flex

Use <Flex> from `@sentry/scraps/layout` for elements that require flex layout as opposed to styled components with `display: flex`.

```tsx
import {Flex} from '@sentry/scraps/layout';

// ❌ Do not use styled and create a new styled component
const Component = styled('div')`
  display: flex;
  flex-directon: column;
`;

// ✅ Use the Flex layout primitive
<Flex direction="column"></Flex>;
```

##### Container

Use using <Container> from `@sentry/scraps/layout` over simple elements that require a border or border radius.

```tsx
import {Container} from '@sentry/scraps/layout';

// ❌ Do not use styled and create a new styled component
const Component = styled('div')`
  padding: space(2);
  border: 1px solid ${p => p.theme.tokens.border.primary};
`;

// ✅ Use the Container primitive
<Container padding="md" border="primary"></Container>;
```

##### General Guidelines

Use responsive props instead of styled media queries for Flex, Grid and Container.

```tsx
import {Flex} from '@sentry/scraps/layout';

// ❌ Do not use styled and create a new styled component
const Component = styled('div')`
  display: flex;
  flex-directon: column;

  @media screen and (min-width: ${p => p.theme.breakpoints.md}) {
    flex-direction: row;
  }
`;

// ✅ Use the responsive prop signature
<Flex direction={{xs: 'column', md: 'row'}}></Flex>;
```

Prefer the use of gap or padding over margin.

```tsx
import {Flex} from '@sentry/scraps/layout';

// ❌ Do not use styled and create a new styled component
const Component = styled('div')`
  display: flex;
  flex-directon: column;
  gap: ${p => p.theme.spacing.lg};
`;

// ✅ Use the responsive prop signature
<Flex gap="lg">
  <Child1 />
  <Child2 />
</Flex>;
```

#### Typography

##### Heading

Use <Heading> from `@sentry/scraps/text` for headings instead of styled components that style heading typography.

```tsx
import {Heading} from '@sentry/scraps/text';

// ❌ Do not use styled and create a new styled component
const Title = styled('h2')`
  font-size: ${p => p.theme.fontSize.md};
  font-weight: bold;
`;

// ✅ Use the Heading typography primitive
<Heading as="h2">Heading</Heading>;
```

Do not use or style h1, h2, h3, h4, h5, h6 intrinsic elements. Prefer using <Heading as="h1...h6">title</Heading> component instead

```tsx
import {Heading} from '@sentry/scraps/text';

// ❌ Do not use styled and create a new styled component
const Title = styled('h4')`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizes.small};
`;

// ❌ Do not use intrinsic heading elements directly
function Component(){
  return <h4>Title<h4>
}

// ✅ Use the Heading typography primitive
<Heading as="h4">Title</Heading>;

// ✅ Use the Heading typography primitive
function Component(){
  return <Heading as="h4">Title</Heading>
}
```

##### Text

Use <Text> from `@sentry/scraps/text` for text styling instead of styled components that handle typography features like color, overflow, font-size, font-weight.

```tsx
import {Text} from '@sentry/scraps/text';

// ❌ Do not use styled and create a new styled component
const Label = styled('span')`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizes.small};
`;

// ✅ Use the Text typography primitive
<Text variant="muted" size="sm">
  Text
</Text>;
```

Do not use or style intrinsic elements like. Prefer using <Text as="p | span | div">text...</Text> component instead

```tsx
import {Text} from '@sentry/scraps/text';

// ❌ Do not style intrinsic elements directly
const Paragraph = styled('p')`
  color: ${p => p.theme.subText};
  line-height: 1.5;
`;

const Label = styled('span')`
  font-weight: bold;
  text-transform: uppercase;
`;

// ❌ Do not use raw intrinsic elements
function Content() {
  return (
    <div>
      <p>This is a paragraph of content</p>
      <span>Status: Active</span>
      <div>Container content</div>
    </div>
  );
}

// ✅ Use Text component with semantic HTML via 'as' prop
function Content() {
  return (
    <div>
      <Text as="p" variant="muted" density="comfortable">
        This is a paragraph of content
      </Text>
      <Text as="span" bold uppercase>
        Status: Active
      </Text>
      <Text as="div">Container content</Text>
    </div>
  );
}
```

##### Splitting layout and typography

- Split Layout from Typography by directly using Flex, Grid, Stack or Container and Text or Heading components

```tsx
// ❌ Do not couple typography with layout
const Component = styled('div')`
  display: flex;
  flex-directon: column;
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSize.lg};
`;

// ✅ Use the Layout primitives and Text component
<Flex direction="column">
  <Text muted size="lg">...</Text>
<Flex>
```

#### Assets

##### Image

Use the core component <Image/> from `@sentry/scraps/image` instead of intrinsic <img />.

```tsx
// ❌ Do not use raw intrinsic elements or static paths
function Component() {
  return (
    <img src="/path/to/image.jpg" />
  );
}

// ✅ Use Image component and src loader
import {Image} from '@sentry/scraps/image';
import image from 'sentry-images/example.jpg';

function Component() {
  return (
    <Image src={imagePath} alt="Descriptive Alt Attribute">
  );
}
```

##### Avatars

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

##### Disclosure

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
