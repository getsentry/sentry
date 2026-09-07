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
- `oxlint.config.ts`: Oxlint configuration
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

### Other core components

- **Avatars**: use `<UserAvatar/>`/`<TeamAvatar/>`/`<ProjectAvatar/>`/etc. from `static/app/components/core/avatar` (and `<AvatarList>` for lists) — never raw `<img>`.
- **Disclosure**: use the core `<Disclosure>` component — don't hand-roll expand/collapse.
- **Icons**: import from `sentry/icons`; keep icons in `static/app/icons`, never inline SVGs. Optimize with svgo/svgomg.
- **Images**: import via the `sentry-images` alias (webpack loader); keep them in `static/app/images`, never reference by static path.

For worked examples of all of the above, use the **`design-system`** skill.

## React Testing

Writing or editing frontend tests (`*.spec.tsx`, RTL, `MockApiClient`, routing/network tests) → use the **`react-testing`** skill for the full guide (query priority, no hook mocking, fixtures, async assertions, mocking network requests).

## Sentry SDK Instrumentation

Before inventing a key for `Sentry.setTag`/`setContext`, or a span's `setAttribute`, check whether OTel or Sentry already has a standard name for it in `@sentry/conventions`. Reusing a convention name keeps the attribute queryable and consistent with what other producers (SDKs, Relay) already emit for the same concept — a bespoke name fragments the same data across two keys. This mirrors the Python-side rule in the **`backend-conventions`** skill; the two must stay in sync since a frontend and backend span can describe the same request.

The individual name constants (e.g. `USER_AGENT_ORIGINAL`) live at the `/attributes` subpath, not the package root — the root only re-exports the metadata tables: `ATTRIBUTE_METADATA` (the full per-attribute record — brief, type, aliases, deprecation) and `ATTRIBUTE_SEARCH_METADATA` (the descriptions the search-field UI renders, see `static/app/utils/fields/`). Both are a separate concern from the name itself.

```tsx
import {USER_AGENT_ORIGINAL} from '@sentry/conventions/attributes';

// WRONG: inventing a name for a concept the conventions already cover
span.setAttribute('request_user_agent', navigator.userAgent);

// RIGHT: use the existing convention name
span.setAttribute(USER_AGENT_ORIGINAL, navigator.userAgent);
```

These are generated from the OTel semantic conventions plus Sentry's own model — grep `node_modules/@sentry/conventions/dist/attributes.d.ts` for candidate keywords before adding a new one.
