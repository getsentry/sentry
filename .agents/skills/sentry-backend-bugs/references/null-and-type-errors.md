# Null Reference and Type Errors

## Table of Contents

- [Overview](#overview)
- [Real Examples](#real-examples)
- [Root Cause Analysis](#root-cause-analysis)
- [Fix Patterns](#fix-patterns)
- [Detection Checklist](#detection-checklist)

## Overview

A high-impact bug category spanning **43 issues across TypeError and AttributeError, 767,662 events, 2,919 affected users**. Code assumes a value has a specific type or is non-None, but runtime data violates that assumption. These are particularly insidious because they often only trigger for specific data shapes in production.

Common shapes:

1. **None where dict expected** -- A serializer or function returns None instead of a dict, then caller does `result["key"] = value`
2. **Int where iterable expected** -- A project option or config value is stored as an int but code calls `list(value)` or iterates over it
3. **Missing attribute on request** -- Code accesses `request.auth` on a Django `WSGIRequest` that has not gone through DRF authentication
4. **Non-string dict keys** -- Payload dicts with integer keys passed to JSON serializers that require string keys
5. **Wrong return type from option/config** -- `project.get_option()` returns a different type than expected
6. **Str where object expected** -- Code receives a string ID where it expects a model instance with `.id` attribute

## Real Examples

### Example 1: Dict key must be str in data forwarding (SENTRY-5HY1) -- resolved

**596,437 events | 0 users**

In-app frames:

```python
# sentry/integrations/data_forwarding/amazon_sqs/forwarder.py -- forward_event()
s3_put_object(
    Bucket=s3_bucket,
    Body=orjson.dumps(payload, option=orjson.OPT_UTC_Z).decode(),  # CRASHES HERE
    Key=key,
)
```

**Root cause:** The event payload dict contains non-string keys (likely integer keys from event data). `orjson.dumps()` requires all dict keys to be strings, unlike `json.dumps()` which auto-converts them.

**Fix:**

```python
# Ensure all keys are strings before serialization
def _stringify_keys(obj):
    if isinstance(obj, dict):
        return {str(k): _stringify_keys(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_stringify_keys(item) for item in obj]
    return obj

payload = _stringify_keys(payload)
Body = orjson.dumps(payload, option=orjson.OPT_UTC_Z).decode()
```

**Actual fix:** Resolved -- payload keys are now converted to strings before serialization.

### Example 2: Int object is not iterable in filter config (SENTRY-5JS8) -- unresolved

**60,654 events | 0 users**

In-app frames:

```python
# sentry/relay/config/__init__.py -- _filter_option_to_config_setting()
if setting == "1":
    ret_val["options"] = ["default"]
else:
    # new style filter, per legacy browser type handling
    ret_val["options"] = list(setting)   # CRASHES HERE when setting is an int
```

**Root cause:** `project.get_option("filters:legacy-browsers")` returned an integer value instead of a string. The code calls `list(setting)` which works for strings (produces a list of characters) but throws `TypeError` for ints. This is a data shape assumption -- the option was stored as an int by an older code path.

**Fix:**

```python
if setting == "1" or setting == 1:
    ret_val["options"] = ["default"]
elif isinstance(setting, str):
    ret_val["options"] = list(setting)
elif isinstance(setting, (list, tuple)):
    ret_val["options"] = list(setting)
else:
    ret_val["options"] = ["default"]
```

### Example 3: NoneType item assignment in event response (SENTRY-3Z3P) -- unresolved

**32,246 events | 158 users**

In-app frames:

```python
# sentry/issues/endpoints/project_event_details.py -- wrap_event_response()
event_data["nextEventID"] = next_event_id      # CRASHES HERE
event_data["previousEventID"] = prev_event_id
return event_data
```

**Root cause:** `event_data` is None. The event serializer returned None instead of a dict (likely because the event data was missing or corrupt), but `wrap_event_response` assumes it always gets a dict back.

**Fix:**

```python
event_data = serialize_event(event, ...)
if event_data is None:
    raise NotFound("Event data could not be serialized")

event_data["nextEventID"] = next_event_id
event_data["previousEventID"] = prev_event_id
return event_data
```

### Example 4: WSGIRequest has no attribute 'auth' (SENTRY-3VXH) -- unresolved

**18,241 events | 47 users**

In-app frames:

```python
# sentry/middleware/__init__.py -- is_frontend_request()
return bool(request.COOKIES) and request.auth is None   # CRASHES HERE
```

**Root cause:** `is_frontend_request()` is called from middleware that runs on all requests, including Django views that do not go through DRF authentication. Plain `WSGIRequest` objects do not have an `auth` attribute.

**Fix:**

```python
def is_frontend_request(request):
    return bool(request.COOKIES) and getattr(request, 'auth', None) is None
```

### Example 5: 'str' object has no attribute 'id' in release search (SENTRY-548A / SENTRY-3Z3X)

**5,250 combined events | 283 users** (SENTRY-3Z3X resolved, SENTRY-548A unresolved)

In-app frames:

```python
# sentry/search/utils.py -- _run_latest_release_query()
releases = Release.objects.filter(...)
return [r.id for r in releases]  # Works

# But later in get_latest_release():
return [r.id for r in results]  # CRASHES when results contains strings
```

**Root cause:** The `_run_latest_release_query` function can return a list of strings (release version strings) instead of Release objects in certain code paths. Callers then access `.id` on strings.

**Fix:**

```python
# Ensure consistent return type
results = _run_latest_release_query(...)
if results and isinstance(results[0], str):
    # Convert version strings to Release objects
    releases = Release.objects.filter(version__in=results, ...)
    return [r.id for r in releases]
```

## Root Cause Analysis

| Pattern                                    | Frequency | Trigger                                      |
| ------------------------------------------ | --------- | -------------------------------------------- |
| Non-string dict keys in JSON serialization | Very High | Event payloads with integer keys             |
| Serializer returns None instead of dict    | High      | Corrupt or missing event data                |
| Project option stored as wrong type        | High      | Legacy data, migration gaps                  |
| Missing attribute on request object        | Medium    | Non-DRF views hitting DRF-aware middleware   |
| String where object expected               | Medium    | Inconsistent return types between code paths |
| NoneType iteration or subscript            | Medium    | Optional values used without guards          |
| Config value type mismatch                 | Medium    | Options set by old code paths                |

## Fix Patterns

### Pattern A: Guard before subscript assignment

```python
# Instead of:
data["key"] = value

# Use:
if data is not None:
    data["key"] = value
# Or raise early:
if data is None:
    raise ValueError("Expected dict, got None")
```

### Pattern B: Type-check before iteration

```python
# Instead of:
items = list(value)

# Use:
if isinstance(value, str):
    items = list(value)
elif isinstance(value, (list, tuple)):
    items = list(value)
elif isinstance(value, int):
    items = [str(value)]
else:
    items = []
```

### Pattern C: getattr for optional request attributes

```python
# Instead of:
request.auth

# Use:
getattr(request, 'auth', None)
```

### Pattern D: Ensure consistent return types

```python
# If a function can return different types, normalize at the boundary:
def get_items(query):
    results = _internal_query(query)
    if not results:
        return []
    # Ensure we always return model instances, not strings
    if isinstance(results[0], str):
        return Model.objects.filter(name__in=results)
    return results
```

### Pattern E: Stringify dict keys before JSON serialization

```python
# When using orjson (strict about key types):
def safe_serialize(data):
    if isinstance(data, dict):
        return {str(k): safe_serialize(v) for k, v in data.items()}
    if isinstance(data, list):
        return [safe_serialize(item) for item in data]
    return data
```

## Detection Checklist

Scan the code for these patterns:

- [ ] Any `result["key"] = ...` -- can `result` be None?
- [ ] Any `list(value)` or `for x in value:` -- can `value` be an int, None, or unexpected type?
- [ ] Any `request.auth`, `request.user`, or other DRF-specific attributes -- is this code reachable from non-DRF views?
- [ ] Any `project.get_option()` or `organization.get_option()` return value used without type checking
- [ ] Any function that returns different types (dict or None, str or object) -- do all callers handle both?
- [ ] Any `orjson.dumps()` call -- are all dict keys guaranteed to be strings?
- [ ] Middleware or utility functions called on all request paths -- do they assume DRF request attributes?
- [ ] Any `.id` attribute access on a variable that could be a string instead of a model instance
