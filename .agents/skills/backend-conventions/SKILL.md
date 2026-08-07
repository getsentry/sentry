---
name: backend-conventions
description: Sentry backend conventions for logging, tracing/spans, metrics tags, and the options system. Use when adding or editing Python in src/ that logs (logger.info/exception), records metrics (metrics.incr/timing with tags), instruments spans/transactions, or reads registered options with options.get(). Trigger on "add logging", "log an error", "add a metric", "add a span", "instrument tracing", "read an option", "LOG005", "LOG011", or metrics tag cardinality questions.
---

# Backend Conventions: Logging, Tracing, Metrics, Options

## Options System

Sentry uses a centralized options system where all options are registered in `src/sentry/options/defaults.py` with required default values.

```python
# CORRECT: options.get() without default - registered default is used
from sentry import options

batch_size = options.get("deletions.group-hash-metadata.batch-size")

# WRONG: Redundant default value
batch_size = options.get("deletions.group-hash-metadata.batch-size", 1000)
```

**Important**: Never add a default value to `options.get()` calls. All options are registered via `register()` in `defaults.py` which requires a default value. The options system always returns the registered default if no value is set, making a second default parameter redundant and potentially inconsistent.

## Logging Pattern

```python
import logging
from sentry import analytics
from sentry.analytics.events.feature_used import FeatureUsedEvent  # does not exist, only for demonstration purposes

logger = logging.getLogger(__name__)

# Structured logging
logger.info(
    "user.action.complete",
    extra={
        "user_id": user.id,
        "action": "login",
        "ip_address": request.META.get("REMOTE_ADDR"),
    }
)

# IMPORTANT: LOG005 use exception() within an exception handler
# WRONG: Calling logger.error() when capturing exception
try:
    risky_operation()
except ValidationError as e:
    logger.error("error.invalid_payload")

# RIGHT: Use logger.exception() with a message when capturing an exception
try:
    risky_operation()
except ValidationError:
    logger.exception("error.invalid_payload")

# IMPORTANT: Avoid LOG011 - Never pre-format log messages with f-strings or .format()
# WRONG: Pre-formatting evaluates before logger call, even if logging is disabled
logger.info(f"User {user.id} completed {action}")
logger.info("User {} completed {}".format(user.id, action))

# RIGHT: Use logger's %-formatting for lazy evaluation
logger.info("%s.user.action.complete", PREFIX)

# ALSO RIGHT: Use structured logging with extra parameters only
logger.info(
    "user.action.complete", extra={"user_id": user.id}
)

# Analytics event
analytics.record(
    FeatureUsedEvent(
        user_id=user.id,
        organization_id=org.id,
        feature="new-dashboard",
    )
)
```

## Tracing / Spans

Use the wrappers in `sentry.utils.tracing` instead of calling the SDK directly. This is required while we dogfood the streaming trace lifecycle (Span First rollout).

| Instead of                       | Use                                              |
| -------------------------------- | ------------------------------------------------ |
| `sentry_sdk.start_span()`        | `start_span(name=..., op=...)`                   |
| `sentry_sdk.start_transaction()` | `start_span(name=..., op=..., transaction=True)` |
| `span.set_tag(key, value)`       | `set_span_tag(span, key, value)`                 |
| `span.set_data(key, value)`      | `set_span_data(span, key, value)`                |

```python
from sentry.utils.tracing import start_span, set_span_tag, set_span_data

# Child span — no need to capture the span when you don't set tags/data
with start_span(name="event_manager.save", op="save"):
    do_work()

# Child span with tags/data — capture via `as span`
with start_span(name="event_manager.save", op="save") as span:
    set_span_tag(span, "platform", platform)
    set_span_data(span, "rows_count", len(rows))

# Transaction root (replaces sentry_sdk.start_transaction)
with start_span(name="monitors.consumer", op="process", transaction=True):
    process_batch()
```

## Metrics Tags

Every distinct tag-value combination is a separate time series, so keep tags **low-cardinality, meaningful, and minimal**:

- Add a tag only if you'll actually filter or group by it. Fewer is better.
- Tag values must be bounded/enumerable (e.g. `status`, `platform`, `reason`) — never unbounded identifiers (IDs, emails, URLs, free text).

The middleware (`src/sentry/metrics/middleware.py`) enforces this by denylisting tag keys that **end in `_id`** or that are exactly **`event`/`project`/`group`**. Such tags **will not work**: they're silently stripped by default, and raise `BadMetricTags` when `SENTRY_METRICS_DISALLOW_BAD_TAGS` is on (e.g. CI) — so a metric that looks fine locally can fail elsewhere.

```python
metrics.incr("my.metric", tags={"project_id": project.id})   # WRONG: stripped / raises
metrics.incr("my.metric", tags={"platform": project.platform})  # RIGHT: bounded values
```

A few keys are allowlisted despite the rule (see `_NOT_BAD_TAGS`); don't expand it to work around the constraint — pick a low-cardinality tag instead.
