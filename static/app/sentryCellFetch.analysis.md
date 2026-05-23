# `sentryCellFetch` vs `api.requestPromise` — Behavioral Comparison

## The Key Difference: What Happens When an Error Handler Suppresses an Error

When a registered error handler (auth redirect, SSO, project rename, etc.) handles a non-2xx response and signals "I handled this," the two systems diverge:

### `api.requestPromise()` — Promise Hangs Forever

In `api.tsx` line 646–653, when a `globalErrorHandler` returns `true`:

```
ok = false path:
  1. successHandler is NOT called (we're in the error branch)
  2. globalErrorHandlers run — one returns true → shouldSkipErrorHandler = true
  3. errorHandler is NOT called (skipped by the guard)
  4. completeHandler IS called (but requestPromise doesn't use it)
```

Since `requestPromise` wraps `request()` by overriding only `success` (→ resolve) and `error` (→ reject), and neither callback fires, **the returned Promise never settles**. It hangs indefinitely.

In practice this is "fine" because the handler is doing a hard redirect (`window.location.assign`, `window.location.reload`, or SPA navigate to `/auth/login/`), so the hanging promise is abandoned when the page navigates away.

### `sentryCellFetch()` — Promise Resolves with `{json: undefined}`

In `sentryCellFetch.tsx` `handleErrorResponse()` (line 192–238), when a handler suppresses an error it **returns** a value:

```ts
// e.g., onAuthError returns true
if (responseMeta.status === 401 && errorHandlers?.onAuthError?.(responseMeta, options)) {
  return {headers: buildResponseHeaders(response), json: undefined as unknown};
}
```

The promise **resolves successfully** with `{headers: {...}, json: undefined}`.

## Why This Matters

| Scenario            | `requestPromise`                   | `sentryCellFetch`                      |
| ------------------- | ---------------------------------- | -------------------------------------- |
| Auth redirect (401) | Promise hangs; page navigates away | Promise resolves with `undefined` data |
| SSO required        | Promise hangs; browser redirects   | Promise resolves with `undefined` data |
| Project renamed     | Promise hangs; redirect happens    | Promise resolves with `undefined` data |
| Member over limit   | Promise hangs; SPA navigates       | Promise resolves with `undefined` data |

### Consequences for React Query

With `sentryCellFetch` as a `queryFn`, a suppressed error means React Query sees a **successful** query that returned `undefined`. This means:

1. **Caching**: React Query caches `undefined` as valid data. If the redirect doesn't complete before a re-render, or if the user navigates back, the cached `undefined` may be served.
2. **Loading states**: The query transitions from `pending` → `success` with `data: undefined`, so components render their "data loaded" state with no data instead of showing a loading spinner.
3. **Retries**: React Query won't retry because the query "succeeded."
4. **`onSuccess` callbacks**: Any configured `onSuccess` or dependent queries will fire with `undefined` input.

With `requestPromise`, none of these happen because the promise never settles — React Query stays in `pending` state (showing a loading spinner) until the page navigates away.

## Other Differences

| Aspect          | `api.requestPromise()`                                          | `sentryCellFetch()`                                                                |
| --------------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Error type      | `RequestError(method, path, preservedError, resp)`              | `RequestError(method, fullUrl, new Error('Request failed'), resp)`                 |
| Stack trace     | `preservedError` created before async call — captures call site | `new Error('Request failed')` created at throw time — captures internal stack only |
| Network failure | Silently swallowed (fetch rejection handler is `() => {}`)      | Propagates as thrown error                                                         |

## Request Cancellation: `Client.clear()` vs TanStack Query's `AbortSignal`

### `api.requestPromise` — Manual cancellation via `Client.clear()`

The old `Client` class tracks every in-flight request in an `activeRequests` map. `Client.clear()` iterates that map and aborts all of them. Callers use this in three patterns:

1. **Unmount cleanup** — `useApi()` calls `api.clear()` in its `useEffect` cleanup (unless `persistInFlight` is set). Legacy class components (`DeprecatedAsyncComponent`, `PluginComponentBase`, `SelectAsyncControl`) call it in `componentWillUnmount()`.
2. **"Cancel previous before new search"** — Hooks like `useTeams`, `useProjects`, and `SearchBar` call `api.clear()` before issuing a new search request, preventing race conditions where a slow earlier response overwrites a fast later one.
3. **"Cancel previous before new data fetch"** — Chart/table components (`EventsRequest`, `ReleaseSeries`, `DiscoverQuery`, etc.) clear before re-fetching.

There is also a per-request `Request.cancel()` used only by `CursorPoller.disable()` for surgical cancellation of a single polling request.

### `sentryCellFetch` — No equivalent needed

`sentryCellFetch` does not maintain an `activeRequests` map and has no `clear()` or `cancel()` method. TanStack Query handles all three patterns natively:

| Pattern                   | Old path (`Client`)                       | New path (TanStack Query)                                                                                           |
| ------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Unmount cleanup           | `useApi()` effect cleanup → `api.clear()` | Query is automatically cancelled when the component unmounts and no other observers remain                          |
| Cancel stale search       | Manual `api.clear()` before new fetch     | Changing the `queryKey` (e.g., search term) automatically cancels the previous in-flight query and starts a new one |
| Cancel stale data fetch   | Manual `api.clear()` before re-fetch      | Same — `queryKey` change triggers automatic cancellation via the `AbortSignal` passed to `queryFn`                  |
| Surgical cancel (polling) | `request.cancel()` on a single `Request`  | `queryClient.cancelQueries({queryKey})` or disabling the query                                                      |

The `AbortSignal` that TanStack Query passes into `queryFn` (and which `sentryCellFetch` forwards to `fetch()`) is the mechanism that makes this work. When React Query decides a request is no longer needed, it aborts the signal, and the browser cancels the underlying fetch. No manual bookkeeping required.

### Test coverage implication

`api.spec.tsx` tests `Client.clear()` aborting active requests. The parity spec (`fetchParity.spec.tsx`) intentionally does not cover this because `sentryCellFetch` has no equivalent — the responsibility belongs to TanStack Query, not the fetch function.

## Error Handler Registration

### `api.requestPromise` — `initApiClientErrorHandling()`

Pushes a single handler into `globalErrorHandlers` array. The handler covers:

- 401 + `sso-required` → `window.location.assign(loginUrl)`
- 401 + `member-disabled-over-limit` → SPA navigate to `extra.next`
- 401 (other) → set `session_expired` cookie, reload or navigate to `/auth/login/`

Handlers return `boolean` — `true` to suppress the per-request error callback.

### `sentryCellFetch` — `configureSentryCellFetch()` + `createDefaultErrorHandlers()`

Error handlers are injected via config, with named hooks:

- `onSudoRequired` → opens sudo modal, returns `Promise<ApiResponse>` (owns the retry)
- `onProjectRenamed` → calls `redirectToProject(slug)`, returns `true`
- `onAuthError` → same logic as the old handler (anon pages, SSO, member limit, session expired)
- `onError` → generic catch-all

Key structural difference: sudo/superuser handling lives **inside** `handleRequestError` in the old client (part of `Client` class), but is a pluggable `onSudoRequired` handler in `sentryCellFetch`.
