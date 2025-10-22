# Sentry Frontend Development Guide

## Frontend Tech Stack

- **Language**: TypeScript
- **Framework**: React 19
- **Build Tool**: Rspack (Webpack alternative)
- **Package management**: pnpm
- **State Management**: Reflux, React Query (TanStack Query)
- **Styling**: Emotion (CSS-in-JS), Less
- **Testing**: Jest, React Testing Library

## Commands

#### Development Setup

```bash
# Start the development server
pnpm run dev

# Start only the UI development server with hot reload
pnpm run dev-ui
```

#### Testing

```bash
# Run JavaScript tests
pnpm test

# Run specific test file(s)
CI=true pnpm test components/avatar.spec.tsx [...other files]
```

#### Code Quality

```bash
# JavaScript/TypeScript linting
pnpm run lint:js

# Linting for specific file(s)
pnpm run lint:js components/avatar.tsx [...other files]

# Fix linting issues
pnpm run fix
```

## Development

### General Frontend Rules

1. NO new Reflux stores
2. NO class components
3. NO CSS files (use [core components](./app/components/core/) or Emotion in edge cases)
4. ALWAYS use TypeScript
5. ALWAYS colocate tests
6. Lazy load routes: `React.lazy(() => import('...'))`

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

## Design system

### General practices

- Use [core components](./app/components/core/) whenever possible. Use Emotion (styled components) only in edge cases.
- Use Text, Heading, Flex, Grid, Stack, Container and other core typography/layout components whenever possible.
- Add stories whenever possible (\*.stories.tsx).

### Core components

Always use Core components whenever available. Avoid using Emotion (styled components) unless absolutely necessary.

#### Layout

##### Grid

Use <Grid> from `sentry/components/core/layout` for elements that require grid layout as opposed to styled components with `display: grid`

```tsx
import {Grid} from 'sentry/components/core/layout';

// ❌ Do not use styled and create a new styled component
const Component = styled('div')`
  display: flex;
  flex-directon: column;
`;

// ✅ Use the Grid layout primitive
<Grid direction="column"></Grid>;
```

##### Flex

Use <Flex> from `sentry/components/core/layout` for elements that require flex layout as opposed to styled components with `display: flex`.

```tsx
import {Flex} from 'sentry/components/core/layout';

// ❌ Do not use styled and create a new styled component
const Component = styled('div')`
  display: flex;
  flex-directon: column;
`;

// ✅ Use the Flex layout primitive
<Flex direction="column"></Flex>;
```

##### Container

Use using <Container> from `sentry/components/core/layout` over simple elements that require a border or border radius.

```tsx
import {Container} from 'sentry/components/core/layout';

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
import {Flex} from 'sentry/components/core/layout';

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
import {Flex} from 'sentry/components/core/layout';

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

Use <Heading> from `sentry/components/core/text` for headings instead of styled components that style heading typography.

```tsx
import {Heading} from 'sentry/components/core/text';

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
import {Heading} from 'sentry/components/core/text';

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

Use <Text> from `sentry/components/core/text` for text styling instead of styled components that handle typography features like color, overflow, font-size, font-weight.

```tsx
import {Text} from 'sentry/components/core/text';

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
import {Text} from 'sentry/components/core/text';

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

Use the core component <Image/> from `sentry/components/core/image` instead of intrinsic <img />.

```tsx
// ❌ Do not use raw intrinsic elements or static paths
function Component() {
  return (
    <img src="/path/to/image.jpg" />
  );
}

// ✅ Use Image component and src loader
import {Image} from 'sentry/componetn/core/image';
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
// ✅ Use Image component and src loader
import {UserAvatar} from 'sentry/components/core/avatar/userAvatar';
import {useUser} from 'sentry/utils/useUser';

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

function Component() {
  const user = useUser();
  return <UserAvatar user={user} />;
}
```

For lists of avatars, use <AvatarList>.
