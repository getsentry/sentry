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

### General practices

- Use [core components](./app/components/core/) whenever possible. Use Emotion (styled components) only in edge cases.
- Use Text, Heading, Flex, Grid, Stack, Container and other core typography/layout components whenever possible.
- Add stories whenever possible (\*.stories.mdx).
- Icons should be part of our icon set at static/app/icons and should never be inlined anywhere in the app.
- Images should be placed inside static/app/images and imported via loader

### Design System Primitives

**NEVER introduce new `styled()` components when a design system primitive exists.** Use `Flex`, `Grid`, `Stack`, `Container`, `Text`, `Heading`, `Image`, `Disclosure`, and other core components from `@sentry/scraps/*`. Use the `/design-system` skill for the full API reference and prop documentation.

**Leave files better than you found them**: When modifying a function or component, refactor any `styled()` usage in that code to design system primitives. For `styled()` usage in untouched code within the same file, flag the opportunity to the user rather than auto-refactoring.

Key rules:

- `styled()` is only acceptable when no primitive covers the use case (complex animations, deeply custom layouts)
- Use responsive props (`direction={{xs: 'column', md: 'row'}}`) instead of styled media queries
- Use `gap`/`padding` props instead of margin
- Split layout (`Flex`, `Grid`) from typography (`Text`, `Heading`) — never couple them in one styled component
- Use `<Image>` from `@sentry/scraps/image` — never raw `<img>`. Import images from `sentry-images/` alias.
- Use avatar components (`UserAvatar`, `TeamAvatar`, etc.) from `@sentry/scraps/avatar/*`
- Use `<Disclosure>` — never reimplement expand/collapse with `useState`

### Icons

- All icons live in `static/app/icons` — never inline SVGs
- All images live in `static/app/images` — import via `sentry-images/` alias, never use static paths
- Import icons from `sentry/icons` — never import from relative paths

## React Testing Guidelines

For testing patterns, query priority, fixtures, mocking rules, and async best practices, use the `/frontend-testing` skill.
