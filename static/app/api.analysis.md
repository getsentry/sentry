# `static/app/api.tsx` — Complete API Reference

Sentry's core HTTP client. Used throughout the frontend to communicate with the backend REST API.

This document also covers the Jest mock at `static/app/__mocks__/api.tsx`.

---

## Module-level: `apiNavigate` + `setApiNavigate` (lines 29–33)

**`apiNavigate`** — module-private `ReactRouter3Navigate | null`, initially `null`. Holds a React Router navigate function so this non-React module can do client-side redirects.

**`setApiNavigate(navigate)`** — exported setter. Called once at app bootstrap. All usages are guarded with `?.`, so if never set, redirects silently no-op.

Edge case: calling it twice silently overwrites.

---

## `Request` class (lines 35–61)

| Property         | Type                | Description                                                  |
| ---------------- | ------------------- | ------------------------------------------------------------ |
| `alive`          | `boolean`           | `true` until `.cancel()` is called                           |
| `requestPromise` | `Promise<Response>` | The underlying fetch promise                                 |
| `aborter`        | `AbortController?`  | Undefined if browser doesn't support it or `skipAbort: true` |

**`constructor(requestPromise, aborter?)`** — stores both, sets `alive = true`.

**`cancel()`** — sets `alive = false`, calls `aborter?.abort()`, emits `metric('app.api.request-abort', 1)`. If the request already settled, the abort is a no-op.

---

## `ApiResult<Data>` type (lines 63–67)

```ts
[data: Data, statusText: string | undefined, resp: ResponseMeta | undefined]
```

The "full" resolution type when `requestPromise` is called with `includeAllArgs: true`.

---

## `ResponseMeta<R>` type (lines 69–90)

| Property            | Type                                 |
| ------------------- | ------------------------------------ |
| `status`            | `Response['status']`                 |
| `statusText`        | `Response['statusText']`             |
| `responseJSON`      | `R`                                  |
| `responseText`      | `string`                             |
| `getResponseHeader` | `(header: string) => string \| null` |

Pure data shape wrapping the response for the jQuery-compat callback API.

---

## `csrfSafeMethod(method?)` — internal (lines 95–98)

Returns `true` for `GET|HEAD|OPTIONS|TRACE`. Used to decide whether to attach `X-CSRFToken`. Pure function; `undefined` input returns `false`.

---

## `isSimilarOrigin(target, origin)` — exported (lines 105–126)

Checks if two URLs share an ancestor domain (parent-child or sibling subdomains).

**Behavior:**

1. Parses both with `new URL`. Relative `target` is resolved against `origin`.
2. Returns `true` if either hostname `.endsWith()` the other (parent-child or exact match).
3. Otherwise strips one subdomain level from each and compares the remainder (sibling check). Returns `false` if either has < 2 segments after stripping.

**Edge cases:** Relative paths always return `true`. Bare `localhost` returns `false` in the sibling check. `new URL()` throws if `origin` is invalid.

---

## `ALLOWED_ANON_PAGES` — internal (lines 129–135)

Array of `RegExp` for paths that don't trigger auth redirects on 401: `/accept/`, `/share/`, `/auth/login/`, `/join-request/`, `/unsubscribe/`.

---

## `globalErrorHandlers` — internal (lines 140–142)

```ts
Array<(resp: ResponseMeta, options: RequestOptions) => boolean>;
```

Chain-of-responsibility registry. Handlers return `true` to suppress the per-request error callback. Populated by `initApiClientErrorHandling`.

---

## `initApiClientErrorHandling()` — exported (lines 144–196)

Pushes a 401 handler into `globalErrorHandlers`. Should be called exactly once at bootstrap (no duplicate guard).

**The handler's logic on every non-2xx response:**

1. Skip if `resp.status !== 401` or page is in `ALLOWED_ANON_PAGES`.
2. Skip if `options.allowAuthError` is `true`.
3. Skip if `code` is `sudo-required`, `ignore`, `2fa-required`, or `app-connect-authentication-error`.
4. `sso-required` → `window.location.assign(extra.loginUrl)`. Returns `true`.
5. `member-disabled-over-limit` → `apiNavigate?.(extra.next, {replace: true})`. Returns `true`.
6. Otherwise: sets `session_expired` cookie (unless demo mode), then either navigates to `/auth/login/` (SPA) or `window.location.reload()`. Returns `true`.

Returns `true` = skip per-request error callback. Returns `false` = let it through.

**Side effects:** May set `session_expired` cookie, hard-redirect the browser, or trigger SPA navigation.

**Edge cases:**

- Called multiple times → duplicate handlers accumulate.
- `apiNavigate` not set → SPA navigation silently no-ops.
- `extra.loginUrl` or `extra.next` accessed without null-checking → `TypeError` if `extra` is `undefined`.

---

## `buildRequestUrl(baseUrl, path, options)` — internal (lines 201–226)

1. Serializes `options.query` via `qs.stringify`. On failure, captures to Sentry and re-throws.
2. Prepends `baseUrl` if `path` doesn't already contain it.
3. Calls `resolveHostname(fullUrl, options.host)` for multi-region routing.
4. Appends query string with `?` or `&` as needed.

---

## `hasProjectBeenRenamed(response)` — exported (lines 234–249)

Checks `response.responseJSON.detail.code === PROJECT_MOVED`. If so, calls `redirectToProject(slug)` and returns `true`. Otherwise returns `false`.

Historical note: this may never fire in practice because browsers auto-follow 302 redirects.

---

## `RequestCallbacks` type (lines 252–267)

| Callback    | Signature                                                       |
| ----------- | --------------------------------------------------------------- |
| `success?`  | `(data: any, textStatus?: string, resp?: ResponseMeta) => void` |
| `error?`    | `(...args: any[]) => void` (loosely typed)                      |
| `complete?` | `(resp: ResponseMeta, textStatus: string) => void`              |

---

## `RequestOptions` type (lines 269–308)

Extends `RequestCallbacks` with:

| Property         | Type                                   | Default | Description                                              |
| ---------------- | -------------------------------------- | ------- | -------------------------------------------------------- |
| `allowAuthError` | `boolean`                              | `false` | Opt out of global 401 redirect handling                  |
| `data`           | `any`                                  | —       | Body payload. JSON-stringified for non-GET, non-FormData |
| `headers`        | `Record<string, string>`               | —       | Extra headers merged over client defaults                |
| `host`           | `string`                               | —       | Hostname override for hybrid-cloud routing               |
| `method`         | `'DELETE' \| 'GET' \| 'POST' \| 'PUT'` | —       | HTTP verb                                                |
| `preservedError` | `Error`                                | —       | Pre-constructed error for stack trace coalescence        |
| `query`          | `Record<string, any>`                  | —       | Query parameters serialized onto the URL                 |
| `skipAbort`      | `boolean`                              | `false` | Exclude from bulk cancellation via `client.clear()`      |

---

## `ClientOptions` type — internal (lines 310–323)

| Property      | Type                 | Default (in constructor) |
| ------------- | -------------------- | ------------------------ |
| `baseUrl`     | `string`             | `'/api/0'`               |
| `credentials` | `RequestCredentials` | `'include'`              |
| `headers`     | `HeadersInit`        | `Client.JSON_HEADERS`    |

---

## `HandleRequestErrorOptions` type — internal (lines 325–329)

| Property         | Type                       | Description                          |
| ---------------- | -------------------------- | ------------------------------------ |
| `id`             | `string`                   | Unique request ID                    |
| `path`           | `string`                   | Original API path                    |
| `requestOptions` | `Readonly<RequestOptions>` | Original options for potential retry |

---

## `Client` class (lines 336–723)

### Static: `Client.JSON_HEADERS` (lines 342–345)

```ts
{ Accept: 'application/json; charset=utf-8', 'Content-Type': 'application/json' }
```

### Constructor (`options: ClientOptions = {}`) (lines 347–352)

| Property         | Default               |
| ---------------- | --------------------- |
| `baseUrl`        | `'/api/0'`            |
| `headers`        | `Client.JSON_HEADERS` |
| `credentials`    | `'include'`           |
| `activeRequests` | `{}`                  |

### `wrapCallback<T>(id, func, cleanup = false)` (lines 354–379)

Returns a closure that:

1. Looks up `activeRequests[id]`.
2. If `cleanup = true`, deletes the entry from `activeRequests`.
3. If `req` is missing or `alive === false`, returns early (callback suppressed).
4. If `hasProjectBeenRenamed(...args)` returns `true`, returns early (redirect handled).
5. Calls `func?.apply(req, args)`.

**Edge cases:**

- `func = undefined` → `func?.apply()` is a no-op.
- Called twice with `cleanup = true` → second call finds `req = undefined`, returns early. Idempotent.
- `@ts-expect-error` on line 372 suppresses a tuple-spread type error for `hasProjectBeenRenamed`.

### `clear()` (lines 384–387)

Calls `.cancel()` on every `Request` in `activeRequests`. Does **not** remove entries (they remain as dead references; the complete handler cleans up).

**Side effects:** Sets `alive = false` on all requests, sends abort signals, emits `app.api.request-abort` per request.

### `handleRequestError({id, path, requestOptions}, response, textStatus, errorThrown)` (lines 389–426)

1. Reads `response.responseJSON.detail.code`.
2. **Sudo/superuser flow** (`SUDO_REQUIRED` or `SUPERUSER_REQUIRED`):
   - Opens sudo modal via `openSudo()`.
   - Modal's `retryRequest`: re-issues request via `this.requestPromise()`. On success calls `options.success`, on failure calls `options.error`.
   - Modal's `onClose`: calls `options.error(response)` if retry didn't succeed.
   - Returns early — per-request error callback is not called via `wrapCallback`.
3. **Normal error flow**: Wraps `options.error` via `wrapCallback` (no cleanup) and calls it with `(response, textStatus, errorThrown)`.

**Edge cases:**

- In the sudo retry path, callbacks bypass `wrapCallback` guards (no alive-check or project-rename check).
- Timing issue: if `onClose` fires between `requestPromise` resolving and `success` completing, `didSuccessfullyRetry` may still be `false`.

### `request(path, options)` (lines 434–675) — **the core method**

**Deprecated.** Use `useApiQuery` or `useMutation` with `apiOptions` instead.

Returns a `Request` instance.

#### Phase 1 — URL + body (lines 435–454)

- Method defaults to `POST` if `data` exists, else `GET`.
- Calls `buildRequestUrl()` for full URL construction.
- `JSON.stringify(data)` unless GET or FormData.
- GET with data: appends as query string (jQuery compat).

#### Phase 2 — Metrics + closures (lines 456–513)

- `metric.mark('api-request-start-<id>')` at start.
- `successHandler`: `metric.measure('app.api.request-success')` + `wrapCallback(id, options.success)`.
- `errorHandler`: `metric.measure('app.api.request-error')` + `handleRequestError(...)`.
- `completeHandler`: `wrapCallback(id, options.complete, true)` — the `true` deletes from `activeRequests`.

#### Phase 3 — Fetch construction (lines 516–538)

- `AbortController` created unless `skipAbort` or unsupported.
- Headers: `this.headers` merged with `options.headers`.
- `X-CSRFToken` added for non-safe methods to similar origins.
- `fetch(fullUrl, { method, body, headers, credentials, signal })`.

#### Phase 4 — Response parsing (lines 543–616)

- `response.text()` always attempted first. Failure → `ok = false`.
- JSON parse skipped for 204 and 3xx. Parse failure handling:
  - AbortError → error path.
  - MIME is JSON + SyntaxError → error path (`'JSON parse error'`).
  - Expected JSON + non-empty non-JSON → error path (`'JSON parse error. Possibly returned HTML'`).
  - Empty body on 201 → silently succeeds with `responseJSON = undefined`.
- `responseData` is `responseJSON` if content-type includes `json`, else `responseText`.

#### Phase 5 — Dispatch (lines 618–669)

- `ok = true` → `successHandler(resp, statusText, responseData)`.
- `ok = false` + `status === 200` → Sentry capture with fingerprint `'200 treated as error'`, tagged with endpoint and error reason (diagnostic).
- `ok = false` → runs all `globalErrorHandlers`. If any returns `true`, the per-request error callback is skipped. Otherwise `errorHandler(resp, statusText, errorReason)`.
- Always → `completeHandler(resp, statusText)`.

#### Fetch rejection handler (line 657)

Network failures and cancelled requests are silently swallowed by a no-op `() => {}`.

#### `.catch` handler (lines 662–669)

Logs to `console.error`. Captures to Sentry unless `error.name === 'AbortError'` or `error.message === 'Response is undefined'`.

#### Side effects summary

| Side Effect                                 | When                                              |
| ------------------------------------------- | ------------------------------------------------- |
| `metric.mark`                               | Request start                                     |
| `metric.measure('app.api.request-success')` | On success                                        |
| `metric.measure('app.api.request-error')`   | On error                                          |
| `metric('app.api.request-abort', 1)`        | On cancel                                         |
| `activeRequests[id] = request`              | After fetch                                       |
| `delete activeRequests[id]`                 | In complete handler                               |
| `Sentry.captureException`                   | 200-treated-as-error, unexpected throws           |
| `openSudo` modal                            | On sudo/superuser required                        |
| `window.location.assign`                    | On 401 sso-required                               |
| `apiNavigate`                               | On 401 member-disabled, or session expired in SPA |
| `Cookies.set('session_expired')`            | On 401 (non-demo)                                 |

#### Edge cases

- **AbortError**: suppressed in `.catch`, does not go to Sentry.
- **Undefined response**: `new Error('Response is undefined')` thrown, logged, not sent to Sentry.
- **FormData body**: not JSON-stringified; passed to fetch directly. Note: default `Content-Type: application/json` header is still set from `this.headers` — callers should override.
- **GET with data**: data appended as query string, body is `undefined`.
- **`skipAbort: true`**: no `AbortController` created, but `cancel()` still sets `alive = false` (suppressing callbacks).
- **`wrapCallback` alive check**: all callbacks are suppressed if request was cancelled before response arrives.
- **`completeHandler` cleanup**: deletes from `activeRequests` even if request is dead.

### `requestPromise<IncludeAllArgsType>(path, options)` (lines 683–723)

**Deprecated.** Promise wrapper around `request()`.

- Creates `preservedError = new Error('API Request Error')` synchronously for stack trace coalescence.
- Overrides `success` and `error` callbacks to resolve/reject the Promise.
- `includeAllArgs: true` → resolves with `[data, textStatus, resp]` (`ApiResult`).
- `includeAllArgs: false` (default) → resolves with just `data`.
- Rejects with `new RequestError(method, path, preservedError, resp)`.

**Edge cases:**

- Caller-provided `success`/`error` callbacks are silently ignored (overwritten).
- Unhandled rejections may be captured by Sentry's global handler.

---

## `resolveHostname(path, hostname?)` — exported (lines 726–773)

Routes requests to the correct silo in multi-region deployments.

1. Reads `configLinks` (`regionUrl`, `sentryUrl`) and `systemFeatures` from `ConfigStore`.
2. If no explicit `hostname` and `system:multi-region` is enabled:
   - `/_admin/` pages: skip routing (control silo handles region resolution).
   - Control silo paths (via `detectControlSiloPath`): route to `sentryUrl`.
   - Everything else: route to `regionUrl`.
3. **Dev-UI mode** (`window.__SENTRY_DEV_UI`):
   - If hostname equals `sentryUrl`, drop it (same-origin).
   - Otherwise extract subdomain from `*.sentry.io` and rewrite path to `/region/<subdomain>/...` for webpack proxy routing.
4. If hostname is still set, prepend it to path.

**Edge cases:**

- Non-`*.sentry.io` hostnames in dev-ui mode are prepended directly without subdomain extraction.
- `/_admin/` bypass means admin requests always go through control silo proxy.
- If `regionUrl`/`sentryUrl` are not populated, multi-region logic is a no-op.

---

## `detectControlSiloPath(path)` — internal (lines 775–787)

1. Parses `path` with `new URL(path, 'https://sentry.io')` to strip query strings.
2. Strips leading `/` from pathname.
3. Tests against 253 compiled `RegExp` patterns from `controlsiloUrlPatterns`.

**Patterns cover:** auth, OAuth, SAML, admin, integrations, webhooks, user management, avatars, API tokens, broadcasts, Sentry Apps, and third-party provisioning (Heroku, Vercel, Stripe, etc.).

All patterns are anchored at `^` without a leading slash, matching the stripped pathname.

---

---

# `static/app/__mocks__/api.tsx` — Mock API Client Reference

Jest mock that replaces `sentry/api` in tests. Provides a mock `Client` class that intercepts `request()` calls and resolves them against a registry of mock responses instead of making real HTTP requests.

---

## Re-exports from real module (lines 6–9)

```ts
export const initApiClientErrorHandling = RealApi.initApiClientErrorHandling;
export const hasProjectBeenRenamed = RealApi.hasProjectBeenRenamed;
```

These two are passed through from the real `api.tsx` via `jest.requireActual`. Tests get the real global error handling and project-rename logic even when using the mock client.

---

## `respond(asyncDelay, fn, ...args)` — internal helper (lines 11–26)

| Parameter    | Type                            | Description                                                          |
| ------------ | ------------------------------- | -------------------------------------------------------------------- |
| `asyncDelay` | `undefined \| number`           | Delay in ms before calling the callback. `undefined` = synchronous.  |
| `fn`         | `FunctionCallback \| undefined` | The callback to invoke. If `undefined`, returns immediately (no-op). |
| `...args`    | `any[]`                         | Arguments forwarded to `fn`.                                         |

**Behavior:**

1. If `fn` is falsy, returns immediately.
2. If `asyncDelay` is a `number`, wraps the call in `setTimeout(() => fn(...args), asyncDelay)`.
3. If `asyncDelay` is `undefined`, calls `fn(...args)` synchronously.

**Purpose:** Controls whether mock responses resolve synchronously (default) or asynchronously (to test loading states, race conditions, etc.).

---

## `MatchCallable` type (line 33)

```ts
type MatchCallable = (url: string, options: ApiNamespace.RequestOptions) => boolean;
```

A predicate function that receives the request URL and options and returns `true` if the request matches. Used in `ResponseType.match` arrays and by the `matchQuery`/`matchData` factories.

---

## `ResponseType` interface (lines 36–55)

Extends `ApiNamespace.ResponseMeta` with mock-specific fields:

| Property            | Type                     | Default (from `addMockResponse`) | Description                                                                                                       |
| ------------------- | ------------------------ | -------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `body`              | `any`                    | `''`                             | The mock response body. Can be a **value** or a **function** `(url, options) => any` for dynamic responses.       |
| `callCount`         | `0`                      | `0`                              | Incremented each time the mock is matched. Tracks how many times a mock was hit.                                  |
| `headers`           | `Record<string, string>` | `{}`                             | Response headers. Used by `getResponseHeader`.                                                                    |
| `host`              | `string`                 | `''`                             | If non-empty, the mock only matches when `options.host` equals this value.                                        |
| `match`             | `MatchCallable[]`        | `[]`                             | Array of predicates that **all** must return `true` for the mock to match.                                        |
| `method`            | `string`                 | `'GET'`                          | HTTP method to match against.                                                                                     |
| `statusCode`        | `number`                 | `200`                            | The mock response status code. `>= 300` triggers the error path.                                                  |
| `url`               | `string`                 | `''`                             | The URL path to match against (exact string equality).                                                            |
| `asyncDelay?`       | `undefined \| number`    | `Client.asyncDelay`              | Per-response override for async delay.                                                                            |
| `query?`            | `Record<string, ...>`    | —                                | Not used by matching logic directly; informational. Query matching is done via `matchQuery` in the `match` array. |
| `status`            | (inherited)              | `200`                            | Maps to `ResponseMeta.status`.                                                                                    |
| `statusCode`        | (own)                    | `200`                            | The actual field used for status branching in `request()`.                                                        |
| `statusText`        | (inherited)              | `'OK'`                           | Maps to `ResponseMeta.statusText`.                                                                                |
| `responseText`      | (inherited)              | `''`                             |                                                                                                                   |
| `responseJSON`      | (inherited)              | `''`                             |                                                                                                                   |
| `getResponseHeader` | (inherited)              | key lookup into `headers`        | Constructed by `addMockResponse`.                                                                                 |

---

## `compareRecord(want, check)` — internal (lines 62–70)

**Inputs:** Two `Record<string, any>` objects.

**Behavior:** Iterates over every key/value pair in `want`. Uses `lodash/isEqual` (deep equality) to compare each against the corresponding key in `check`. Returns `false` on the first mismatch. Returns `true` if all entries match.

**Key detail:** Only checks keys present in `want` — extra keys in `check` are ignored. This means `matchQuery({page: '1'})` will pass even if `options.query` also has `{per_page: 25, cursor: 'abc'}`.

---

## `afterEach` cleanup hook (lines 72–85)

Runs after **every** test automatically:

1. Checks `Client.errors` (accumulated unmocked-request errors). If any exist, logs each via `console.error`, then clears the map.
2. Calls `Client.clearMockResponses()` to reset the mock registry.

This ensures:

- Unmocked API calls produce visible test output (even though the error can't be thrown from within the mock).
- Mock responses don't leak between tests.

---

## Mock `Client` class (lines 87–314)

Implements `ApiNamespace.Client`. Replaces the real `Client` in all test files.

### Instance properties

| Property         | Value                                  | Description                                                                             |
| ---------------- | -------------------------------------- | --------------------------------------------------------------------------------------- |
| `activeRequests` | `{}`                                   | Empty record — mirrors real client interface.                                           |
| `baseUrl`        | `''`                                   | Empty string (real client defaults to `'/api/0'`).                                      |
| `headers`        | `{ Accept: ..., 'Content-Type': ... }` | Copy/paste of `Client.JSON_HEADERS` (can't import real one due to circular dependency). |

### Static properties

| Property        | Type                    | Initial     | Description                                                                              |
| --------------- | ----------------------- | ----------- | ---------------------------------------------------------------------------------------- |
| `mockResponses` | `MockResponse[]`        | `[]`        | Registry of `[ResponseType, jest.Mock]` tuples. Searched in order by `findMockResponse`. |
| `asyncDelay`    | `undefined \| number`   | `undefined` | Global default async delay. `undefined` = synchronous.                                   |
| `errors`        | `Record<string, Error>` | `{}`        | Accumulates errors for unmocked requests. Logged and cleared in `afterEach`.             |

---

### `Client.clearMockResponses()` — static (line 109)

Resets `Client.mockResponses` to `[]`. Called in `afterEach`.

---

### `Client.matchQuery(query)` — static (lines 118–124)

**Input:** `query: Record<string, any>` — the expected query parameters.

**Returns:** `MatchCallable` — a predicate `(_url, options) => boolean`.

**Behavior:** Calls `compareRecord(query, options.query ?? {})`. Returns `true` if every key/value in `query` exists and deeply equals the same key in `options.query`. Extra keys in `options.query` are ignored.

**Usage in tests:**

```ts
MockApiClient.addMockResponse({
  url: '/api/0/issues/',
  match: [MockApiClient.matchQuery({page: '1', per_page: '25'})],
  body: [...],
});
```

---

### `Client.matchData(data)` — static (lines 131–137)

**Input:** `data: Record<string, any>` — the expected request body fields.

**Returns:** `MatchCallable` — a predicate `(_url, options) => boolean`.

**Behavior:** Calls `compareRecord(data, options.data ?? {})`. Same partial-match semantics as `matchQuery` but against `options.data`.

**Usage in tests:**

```ts
MockApiClient.addMockResponse({
  url: '/api/0/issues/',
  method: 'POST',
  match: [MockApiClient.matchData({status: 'resolved'})],
  body: {...},
});
```

---

### `Client.addMockResponse(response)` — static (lines 140–165)

**Input:** `Partial<ResponseType>` — any subset of mock response fields. All have defaults.

**Returns:** `jest.Mock` — the mock function that records calls. Can be asserted on with `expect(mock).toHaveBeenCalledWith(url, options)`.

**Behavior:**

1. Creates a fresh `jest.fn()`.
2. Builds a complete `ResponseType` by merging defaults with the provided `response`:
   - `host: ''`, `url: ''`, `status: 200`, `statusCode: 200`, `statusText: 'OK'`
   - `responseText: ''`, `responseJSON: ''`, `body: ''`, `method: 'GET'`
   - `callCount: 0`, `match: []`
   - `asyncDelay`: falls back to `response.asyncDelay ?? Client.asyncDelay`
   - `headers`: falls back to `response.headers ?? {}`
   - `getResponseHeader`: closure that reads from `response.headers`
3. **Unshifts** (prepends) the `[ResponseType, mock]` tuple to `Client.mockResponses`.

**Important: Insertion order.** New mocks are prepended, so the **most recently added** mock is checked first. This means you can override a general mock with a more specific one added later — the later mock will match first.

**Edge case:** `status` and `statusCode` are both set to `200` by default, but the branching logic in `request()` only reads `statusCode`. If a caller sets `status: 500` but not `statusCode`, the request will still be treated as successful.

---

### `Client.findMockResponse(url, options)` — static (lines 167–180)

**Inputs:**

- `url: string` — the request URL path.
- `options: Readonly<RequestOptions>` — the request options.

**Returns:** `MockResponse | undefined` — the first matching `[ResponseType, jest.Mock]` tuple, or `undefined`.

**Matching algorithm (evaluated in order, short-circuits on first match):**

For each registered mock response:

1. **Host check:** If `response.host` is non-empty and `options.host || ''` does not equal it → skip.
2. **URL check:** If `url !== response.url` → skip. **Exact string equality** — no pattern matching, no query string stripping, no normalization.
3. **Method check:** If `(options.method || 'GET') !== response.method` → skip.
4. **Custom matchers:** `response.match.every(matcher => matcher(url, options))` — all `MatchCallable` predicates must return `true`.

If all four checks pass, the mock is returned.

**Key behaviors:**

- URL matching is **exact**. `/api/0/issues/` does not match `/api/0/issues` (trailing slash matters).
- Method defaults to `'GET'` if `options.method` is undefined.
- Host defaults to `''` if `options.host` is undefined.
- If `response.match` is `[]` (the default), `[].every(...)` returns `true` — no custom matchers needed.
- Because mocks are unshifted (prepended), newer mocks take priority.

---

### `client.uniqueId()` — instance (line 182)

Returns the hardcoded string `'123'`. Simplifies assertions by making request IDs deterministic.

---

### `client.clear()` — instance (lines 190–192)

Same as real client: calls `.cancel()` on all `activeRequests`. In practice, `activeRequests` is always empty in the mock because `request()` doesn't populate it.

---

### `client.wrapCallback(id, func, cleanup)` — instance (lines 194–207)

Simplified version of the real `wrapCallback`:

1. Captures `Client.asyncDelay` at wrap time.
2. Returns a closure that:
   a. Calls `RealApi.hasProjectBeenRenamed(...args)` — the **real** implementation. If it returns `true`, returns early (project-rename redirect).
   b. Otherwise, calls `respond(asyncDelay, func, ...args)`.

**Differences from real:**

- No alive-check (no `activeRequests[id]` lookup).
- No cleanup (does not delete from `activeRequests`).
- Uses the module-level `asyncDelay` at wrap time, not at call time.

---

### `client.requestPromise(path, options)` — instance (lines 209–228)

Promise wrapper around `this.request()`, mirroring the real implementation:

- `includeAllArgs: true` → resolves with `[data, ...args]`.
- `includeAllArgs: false` → resolves with `data`.
- On error → rejects with the error object directly (no `RequestError` wrapping like the real client).

**Difference from real:** The real client wraps errors in `new RequestError(method, path, preservedError, resp)`. The mock rejects with the raw error response.

---

### `client.request(url, options)` — instance (lines 233–309)

The core method. Replaces real HTTP with mock response lookup.

**Step-by-step behavior:**

1. **Find mock:** Calls `Client.findMockResponse(url, options)`.

2. **No mock found** (lines 238–254):
   - Creates `new Error('No mocked response found for request: METHOD /url')`.
   - **Stack trace manipulation:** Finds the first `.spec.` frame in the stack trace and trims everything above it. This makes the error point at the test file, not the mock internals.
   - **Does NOT throw.** Instead, stores the error in `Client.errors[methodAndUrl]`. The `afterEach` hook will `console.error` it later.
   - Why: Throwing would be caught by the component's own error handling (which shows user-friendly messages), making the missing-mock error invisible to the test author. The deferred logging approach ensures it's always visible.

3. **Mock found — record the call** (line 259):
   - Calls `mock(url, options)` — records the call on the `jest.fn()` so tests can assert `expect(mock).toHaveBeenCalledWith(...)`.

4. **Resolve body** (lines 261–262):
   - If `response.body` is a **function**, calls `response.body(url, options)` to compute the body dynamically.
   - Otherwise uses `response.body` as-is.

5. **Error path** (`response.statusCode >= 300`, lines 264–291):
   - Increments `response.callCount`.
   - Constructs an error object by creating a `RequestError` and then using `Object.assign` to bolt on extra fields:
     - `status`, `responseText` (JSON-stringified body), `responseJSON` (raw body).
     - Stub methods: `overrideMimeType`, `abort`, `then`, `error` — all no-ops. Remnants of the old jQuery XHR interface.
   - Calls `this.handleRequestError(...)` which is the **real** `Client.prototype.handleRequestError` (line 311). This means:
     - `SUDO_REQUIRED` / `SUPERUSER_REQUIRED` responses trigger the real sudo modal flow.
     - Other errors are routed through `wrapCallback` → `options.error`.

6. **Success path** (`statusCode < 300`, lines 292–305):
   - Increments `response.callCount`.
   - Calls `respond(response.asyncDelay, options.success, body, {}, responseMeta)`.
   - The `responseMeta` passed to success is a minimal object: `{ getResponseHeader, statusCode, status }`. Notably missing: `statusText`, `responseText`, `responseJSON` — tests relying on these fields from the success callback's third argument will get `undefined`.

7. **Complete callback** (line 308):
   - Always called: `respond(response?.asyncDelay, options.complete)`.
   - Called with **no arguments** (the real client passes `(resp, textStatus)`). Tests that rely on complete callback arguments will get `undefined`.

**Differences from real `Client.request()`:**

| Aspect                     | Real                                      | Mock                                                 |
| -------------------------- | ----------------------------------------- | ---------------------------------------------------- |
| HTTP                       | `fetch()` call                            | Mock response lookup                                 |
| URL construction           | `buildRequestUrl` + `resolveHostname`     | Exact string match on `url`                          |
| CSRF                       | Attaches `X-CSRFToken` header             | Not applicable                                       |
| AbortController            | Created unless `skipAbort`                | Not created                                          |
| `activeRequests` tracking  | Populated and cleaned up                  | Never populated                                      |
| `wrapCallback` alive check | Yes                                       | No                                                   |
| Success callback args      | `(body, statusText, fullResponseMeta)`    | `(body, {}, minimalMeta)`                            |
| Complete callback args     | `(responseMeta, statusText)`              | None                                                 |
| Error wrapping             | Goes through full parse/dispatch pipeline | Directly constructs `RequestError` + `Object.assign` |
| `handleRequestError`       | Own implementation                        | Delegates to **real** implementation                 |
| Metrics                    | `metric.mark`, `metric.measure`           | None                                                 |
| Sentry captures            | On 200-as-error, unexpected throws        | None                                                 |
| `preservedError`           | Created in `requestPromise`               | Not created                                          |
| Unmocked requests          | N/A                                       | Deferred `console.error` via `Client.errors`         |

---

### `client.handleRequestError` — instance (line 311)

```ts
handleRequestError = RealApi.Client.prototype.handleRequestError;
```

Directly assigned from the real client's prototype. This means the mock uses the **real** sudo/superuser retry logic, including `openSudo()` modal and `requestPromise` retry.

**Implication:** If a test returns a mock with `statusCode: 403` and `responseJSON.detail.code === 'sudo-required'`, the real sudo modal will be triggered. Tests must mock `openSudo` separately if they don't want this.

---

## How matching works end-to-end

When test code triggers a component that calls `api.request('/api/0/issues/', {method: 'GET', query: {page: '1'}})`:

1. `Client.findMockResponse` iterates `mockResponses` (newest first).
2. For each, checks: host match → URL exact match → method match → all custom matchers.
3. Custom matchers like `matchQuery({page: '1'})` call `compareRecord({page: '1'}, options.query)` which uses `lodash/isEqual` per key.
4. First full match wins.
5. If no match: error stored in `Client.errors`, logged after test.

**Matching pitfalls:**

- URL must be exact — `/api/0/issues` vs `/api/0/issues/` will not match.
- Method defaults to `'GET'` in both the mock and the lookup, so omitting `method` works for GET requests.
- `matchQuery` and `matchData` are **partial** matchers — they only check keys you specify. To assert **no** extra keys, you'd need a custom `MatchCallable`.
- Multiple mocks for the same URL+method: the **last one added** (first in the array) wins. Override by adding a more specific mock after a general one.
- `response.body` as a function is resolved **after** matching, so the function receives the actual `(url, options)` and can return different bodies per call.

---

## Error handling differences: real vs mock

| Scenario             | Real Client                                                     | Mock Client                                                           |
| -------------------- | --------------------------------------------------------------- | --------------------------------------------------------------------- |
| Unmocked endpoint    | N/A                                                             | Error stored in `Client.errors`, logged after test                    |
| Status >= 300        | Full response parsing, global handlers, `handleRequestError`    | Constructs `RequestError`, delegates to **real** `handleRequestError` |
| Sudo required        | `openSudo` modal, retry via `requestPromise`                    | Same (uses real `handleRequestError`)                                 |
| Status < 300         | `wrapCallback` → alive check → project-rename check → `success` | `respond(asyncDelay, options.success, ...)` directly                  |
| Network failure      | Silently swallowed                                              | N/A (no network)                                                      |
| AbortError           | Suppressed, not sent to Sentry                                  | N/A (no abort support)                                                |
| `complete` callback  | Called with `(responseMeta, statusText)`                        | Called with **no arguments**                                          |
| 200 treated as error | Sentry capture + error path                                     | N/A (no response parsing)                                             |
