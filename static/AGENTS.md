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

Use `apiOptions` with `useQuery` from TanStack Query; **never** use the deprecated `useApiQuery`/`getApiQueryData`/`setApiQueryData`. `staleTime` is required. For the full guide (conditional fetching, no call-site generics, response headers/pagination) → use the **`frontend-data-fetching`** skill.

## General Frontend Rules

1. NO new Reflux stores
2. NO class components
3. NO CSS files (use [core components](./app/components/core/) or Emotion in edge cases)
4. ALWAYS use TypeScript
5. ALWAYS colocate tests
6. Lazy load routes: `React.lazy(() => import('...'))`

## Refs

**NEVER read from or write to a ref (`ref.current`) during render.** This breaks the rules of React — render must be pure, and refs are mutable state that React does not track. Reading a ref during render can return stale values across concurrent renders; writing one is a side effect that makes render impure.

- Read and write `ref.current` **only** inside effects (`useEffect`, `useLayoutEffect`) or event handlers/callbacks — never in the render body.
- If you need a value during render, derive it as a `const` from props/state, or lift it into `useState`/`useMemo`. Reach for a ref only for values that must persist across renders **without** triggering one (DOM nodes, timers, previous-value tracking read later in an effect).

```tsx
// ❌ Reading/writing a ref during render
function Component({value}: Props) {
  renderCountRef.current += 1; // side effect during render
  const previous = prevValueRef.current; // stale under concurrent rendering
  prevValueRef.current = value; // write during render
  return <div>{previous}</div>;
}

// ✅ Mutate refs in effects; derive render values
function Component({value}: Props) {
  const prevValueRef = useRef(value);
  useEffect(() => {
    prevValueRef.current = value; // write in an effect
  }, [value]);
  return <div>{value}</div>;
}
```

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

## React Testing

Writing or editing frontend tests (`*.spec.tsx`, RTL, `MockApiClient`, routing/network tests) → use the **`react-testing`** skill for the full guide (query priority, no hook mocking, fixtures, async assertions, mocking network requests).
