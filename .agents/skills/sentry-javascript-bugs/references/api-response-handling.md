# API Response Handling Patterns

## Contents

- Overview
- Real examples
- Detection checklist

## Overview

API response handling errors account for 31 issues and 24,019 events. The Sentry frontend API client makes assumptions about response shapes that break in edge cases: 200 responses with empty bodies, unexpected 4xx status codes, and undefined response bodies from endpoints that return no content.

Key sub-patterns:

1. **200 treated as error** (12K events): API returns 200 with empty body, client throws
2. **UndefinedResponseBodyError** (9.5K events): Response has no parseable body
3. **Unhandled 4xx codes** (1.5K events): 402, 409 not caught in mutation flows

## Real Examples

### [JAVASCRIPT-2M6Q]: 200 treated as error: GET /customers/{orgSlug}/ (ignored)

**Sentry**: https://sentry.io/issues/4290456281/
**Events**: 12,331 | **Users**: 168

**Root cause:** The API client receives a 200 response from `/customers/{orgSlug}/` but the body is empty or unparseable. The response handler treats this as an error because it expects a JSON body. The endpoint returns 200 with no body when the customer record exists but has no data to return.

**Fix pattern:** Handle empty 200 responses as valid in the API client or response wrapper.

```typescript
if (response.ok && !response.body) {
  return null;
}
```

### [JAVASCRIPT-2MF5]: UndefinedResponseBodyError: GET /assistant/ 200 (ignored)

**Sentry**: https://sentry.io/issues/4302193574/
**Events**: 9,017 | **Users**: 706

**Root cause:** Same pattern as above. The `/assistant/` endpoint returns 200 with no body. The `UndefinedResponseBodyError` is thrown by the API client when it cannot parse the response.

**Fix pattern:** The API endpoint should return 204 No Content when there is no data. On the frontend, handle undefined response bodies without throwing.

### [JAVASCRIPT-33RM]: RequestError: PUT subscription 402 (unresolved)

**Sentry**: https://sentry.io/issues/6861277461/
**Events**: 1,283 | **Users**: 678

**Root cause:** The subscription update endpoint returns 402 (Payment Required) but the frontend does not handle this status code. The error propagates as an unhandled `RequestError`.

**Fix pattern:** Handle 402 specifically in subscription mutation flows.

```typescript
try {
  await api.requestPromise(`/customers/${orgSlug}/subscription/`, {method: 'PUT', data});
} catch (error) {
  if (error.status === 402) {
    addErrorMessage(t('Payment is required to make this change.'));
    return;
  }
  throw error;
}
```

## Detection Checklist

- [ ] Does the API client handle 200 responses with empty bodies?
- [ ] Are mutation endpoints (PUT, POST, DELETE) handling 402, 409, 422 status codes?
- [ ] Is `UndefinedResponseBodyError` caught and handled gracefully?
- [ ] Do async component data loaders provide error states?
- [ ] Are gateway timeout (504) and service unavailable (503) errors shown as user-friendly messages?
- [ ] Do SelectAsync/autocomplete components handle failed option fetches?
