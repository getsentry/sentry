---
name: frontend-data-fetching
description: Fetch data in Sentry's frontend with TanStack Query and apiOptions. Use when adding or editing React code in static/ that calls the API — useQuery/useMutation/useInfiniteQuery, apiOptions, queryOptions/mutationOptions, fetchMutation, reading response headers/pagination, or conditional fetching. Trigger on "fetch data", "add an API call", "useQuery", "useMutation", "apiOptions", "queryFn", "pagination headers", "X-Hits", or "why is my query type wrong".
---

# Frontend Data Fetching (TanStack Query + apiOptions)

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

## TanStack Query Type Inference — NEVER Pass Call-Site Generics

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

## Accessing response headers (pagination, hit counts)

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
