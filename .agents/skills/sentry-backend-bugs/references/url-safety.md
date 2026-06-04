# URL Safety and Routing Errors

## Table of Contents

- [Overview](#overview)
- [Real Examples](#real-examples)
- [Root Cause Analysis](#root-cause-analysis)
- [Fix Patterns](#fix-patterns)
- [Detection Checklist](#detection-checklist)

## Overview

**15 issues, 126,318 events, 3,602 affected users.** Redirect URLs that exceed safety limits, missing URL schemes in external URLs, and routing mismatches from URL construction.

Three sub-patterns:

1. **DisallowedRedirect (8 issues, 98,940 events)** -- Redirect URLs exceeding the 2048-character safety limit, all resolved
2. **MissingSchema (5 issues, 25,548 events)** -- External URLs stored without a scheme (`https://`), causing requests library to fail
3. **NoReverseMatch (2 issues, 1,830 events)** -- Django URL routing failures from invalid parameters

## Real Examples

### Example 1: Unsafe redirect exceeding 2048 characters (SENTRY-5D1A) -- resolved

**49,799 events | 897 users**

In-app frames:

```python
# sentry/middleware/access_log.py -- middleware()
# -> sentry/middleware/subdomain.py -- __call__()
# DisallowedRedirect: Unsafe redirect exceeding 2048 characters
```

**Root cause:** Users access Sentry URLs with very long query strings or path segments (often from malformed links, bots, or security scanners). The middleware chain attempts to redirect these requests (e.g., subdomain redirect, customer domain redirect, marketing landing redirect) but the resulting redirect URL exceeds the 2048-character safety limit. The `DisallowedRedirect` exception is thrown by Sentry's redirect safety middleware.

**Fix:**

```python
def safe_redirect(url, max_length=2048):
    if len(url) > max_length:
        # Truncate to base URL without query string
        parsed = urlparse(url)
        base_url = f"{parsed.scheme}://{parsed.netloc}{parsed.path}"
        if len(base_url) > max_length:
            return HttpResponseBadRequest("URL too long")
        return redirect(base_url)
    return redirect(url)
```

**Actual fix:** Resolved -- all 8 DisallowedRedirect issues were fixed. The redirect paths now handle overly long URLs gracefully.

### Example 2: Unsafe redirect in customer domain middleware (SENTRY-5D1G) -- resolved

**29,386 events | 81 users**

In-app frames:

```python
# sentry/middleware/customer_domain.py -- __call__()
# DisallowedRedirect: Unsafe redirect exceeding 2048 characters
```

**Root cause:** The customer domain middleware redirects requests from `org.sentry.io` paths to canonical URLs. When the original URL has a very long path or query string, the redirect URL exceeds 2048 characters.

**Actual fix:** Resolved -- middleware now validates redirect URL length.

### Example 3: MissingSchema on empty external URL (SENTRY-5E3V)

**13,965 events | 95 users** (resolved)

```python
# sentry/net/http.py
# MissingSchema: Invalid URL '': No scheme supplied. Perhaps you meant https://?
```

**Root cause:** An integration or webhook configuration stores an empty string as the target URL. When the code attempts to make an HTTP request to this URL, the `requests` library raises `MissingSchema`.

**Fix:**

```python
if not url or not url.startswith(("http://", "https://")):
    raise ValueError(f"Invalid URL: {url!r}")
```

### Example 4: NoReverseMatch in URL construction (SENTRY-5G3B) -- unresolved

**1,280 events | 120 users**

In-app frames:

```python
# django/urls/resolvers.py
# NoReverseMatch: Reverse for 'sentry-api-0-organization-group-group-events' with
# keyword arguments {'organization_id_or_slug': '...', ...} not found
```

**Root cause:** URL construction uses `reverse()` with keyword arguments that do not match the URL pattern. This can happen when URL patterns are changed but callers are not updated, or when the URL parameter values contain characters that don't match the pattern regex.

**Fix:**

```python
try:
    url = reverse("sentry-api-0-organization-group-group-events", kwargs=kwargs)
except NoReverseMatch:
    logger.warning("url.reverse_failed", extra={"url_name": url_name, "kwargs": kwargs})
    url = None  # Or construct manually
```

## Root Cause Analysis

| Pattern                                 | Frequency | Typical Trigger                                   |
| --------------------------------------- | --------- | ------------------------------------------------- |
| Redirect URL too long                   | Very High | Bots, security scanners, malformed inbound links  |
| Empty URL in integration config         | High      | Unconfigured or partially configured integrations |
| URL without scheme                      | Medium    | User-provided URLs missing `https://` prefix      |
| NoReverseMatch from URL pattern changes | Low       | URL refactoring without updating all callers      |

## Fix Patterns

### Pattern A: Validate redirect URL length

```python
def safe_redirect(request, url, max_length=2048):
    if len(url) > max_length:
        # Strip query string first
        parsed = urlparse(url)
        url = urlunparse(parsed._replace(query="", fragment=""))
        if len(url) > max_length:
            return HttpResponseBadRequest("URL too long")
    return redirect(url)
```

### Pattern B: Validate URLs before HTTP requests

```python
def validate_url(url):
    if not url:
        raise ValueError("Empty URL")
    if not url.startswith(("http://", "https://")):
        raise ValueError(f"Missing URL scheme: {url!r}")
    return url
```

### Pattern C: Safe URL reversal

```python
try:
    url = reverse(url_name, kwargs=kwargs)
except NoReverseMatch:
    logger.warning("url.no_reverse_match", extra={"name": url_name})
    url = fallback_url
```

### Pattern D: Truncate query strings in redirects

```python
def redirect_with_length_check(url):
    if len(url) <= 2048:
        return redirect(url)
    # Try without query string
    parsed = urlparse(url)
    base = f"{parsed.scheme}://{parsed.netloc}{parsed.path}"
    if len(base) <= 2048:
        return redirect(base)
    return HttpResponseBadRequest()
```

## Detection Checklist

Scan the code for these patterns:

- [ ] Any `redirect()` or `HttpResponseRedirect()` -- is the URL length validated?
- [ ] Any middleware that constructs redirect URLs from the request path -- can the path be excessively long?
- [ ] Any HTTP request to a URL stored in the database -- is the URL validated for non-empty and proper scheme?
- [ ] Any `reverse()` call -- is `NoReverseMatch` handled?
- [ ] Any URL construction from user input (org slugs, project slugs) -- are invalid characters handled?
- [ ] Any redirect chain (middleware -> middleware) -- does each step validate the URL?
