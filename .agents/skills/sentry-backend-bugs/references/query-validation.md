# Query and Subscription Validation Errors

## Table of Contents

- [Overview](#overview)
- [Real Examples](#real-examples)
- [Root Cause Analysis](#root-cause-analysis)
- [Fix Patterns](#fix-patterns)
- [Detection Checklist](#detection-checklist)

## Overview

The highest-event-count cluster combining metric subscription errors and search query validation: **170 issues, 5,036,970 events, 2,598 affected users**. Snuba subscriptions and search queries reference tags, fields, or functions that are invalid for the target dataset. These fire continuously -- a single bad subscription generates thousands of events per hour.

Two main sub-patterns:

1. **Metric subscription query errors (113 issues, 3,035,640 events)** -- SubscriptionError when creating or updating alert subscriptions in Snuba with incompatible query parameters
2. **Search query validation errors (57 issues, 2,001,330 events)** -- InvalidSearchQuery from user-provided or subscription-stored query filters referencing invalid values, deleted issues, or unresolved tags

## Real Examples

### Example 1: SubscriptionError -- tag not in metrics dataset (SENTRY-413P) -- resolved

**531,826 events | 0 users**

In-app frames:

```python
# sentry/search/events/builder/metrics.py -- resolve_tag_key()
# IncompatibleMetricsQuery: customerType is not a tag in the metrics dataset

# Wrapped and re-raised as:
# sentry/snuba/tasks.py -- _create_in_snuba()
# SubscriptionError: customerType is not a tag in the metrics dataset
```

**Root cause:** A metric alert subscription uses `customerType` as a filter tag, but this tag does not exist in the metrics dataset. The subscription was created when the events dataset was the default, which allowed arbitrary tag names. After migration to the metrics dataset, only known metric tags are valid.

**Fix:**

```python
def _create_in_snuba(subscription):
    try:
        snuba_query = build_snuba_query(subscription)
        result = _snuba_pool.submit(snuba_query)
    except (IncompatibleMetricsQuery, InvalidSearchQuery) as e:
        logger.warning(
            "subscription.incompatible_query",
            extra={"subscription_id": subscription.id, "error": str(e)},
        )
        subscription.update(status=QuerySubscription.Status.DISABLED.value)
        return  # Disable instead of crash
```

**Actual fix:** Resolved -- subscription creation now handles incompatible queries.

### Example 2: SubscriptionError -- invalid function parameter type (SENTRY-4DAA) -- resolved

**294,145 events | 0 users**

In-app frames:

```python
# sentry/search/eap/resolver.py -- resolve_function()
# InvalidSearchQuery: transaction.duration is invalid for parameter 1 in p95.
# Its a string type field, but it must be one of: ...

# Re-raised as:
# sentry/snuba/tasks.py -- _create_in_snuba()
# SubscriptionError: transaction.duration is invalid for parameter 1 in p95.
```

**Root cause:** An alert subscription uses `p95(transaction.duration)` on the metrics dataset. In the metrics dataset, `transaction.duration` is stored as a string (tag), not a numeric field, making it incompatible with aggregate functions like `p95()`.

**Fix:** Same as Example 1 -- validate function parameter types against the dataset schema before subscription creation.

**Actual fix:** Resolved -- subscription creation validates field types.

### Example 3: SubscriptionError -- apdex threshold incompatibility (SENTRY-413N) -- resolved

**276,062 events | 0 users**

In-app frames:

```python
# sentry/search/events/datasets/metrics.py -- _resolve_apdex_function()
# IncompatibleMetricsQuery: Cannot query apdex with a threshold parameter on the metrics dataset

# Re-raised as:
# sentry/snuba/tasks.py -- _create_in_snuba()
# SubscriptionError: Cannot query apdex with a threshold parameter on the metrics dataset
```

**Root cause:** Old alert rules use `apdex()` with a threshold parameter (e.g., `apdex(300)`). The metrics dataset does not support per-query thresholds for apdex -- it uses the project-level threshold instead.

**Actual fix:** Resolved -- apdex function resolution now handles threshold incompatibility.

### Example 4: InvalidSearchQuery -- deleted issue short ID in subscription (SENTRY-3TYF) -- resolved

**1,221,510 events | 0 users**

In-app frames:

```python
# sentry/search/events/datasets/discover.py -- _issue_filter_converter()
def _issue_filter_converter(search_filter, ...):
    # Resolves short IDs like 'PROJ-ABC' to Group IDs
    groups = Group.objects.by_qualified_short_id_bulk(...)
    # Group.DoesNotExist raised when short ID references a deleted project

# Re-raised as:
# InvalidSearchQuery: Invalid value '['PROJ-ABC']' for 'issue:' filter
```

Called from the subscription consumer:

```python
# sentry/incidents/utils/process_update_helpers.py -- get_aggregation_value()
```

**Root cause:** Metric alert subscriptions stored query strings containing issue short IDs (e.g., `issue:PROJ-ABC`). When the referenced project or issue is deleted, the `_issue_filter_converter` tries to resolve the short ID via `by_qualified_short_id_bulk()`, which calls `Group.objects.get()` and raises `DoesNotExist`. This is wrapped as `InvalidSearchQuery`.

This is the single highest-event resolved issue in the search query cluster at 1.2M events -- the subscription fires continuously because the issue is permanently deleted and the query can never succeed.

**Fix:**

```python
def _issue_filter_converter(search_filter, ...):
    try:
        groups = Group.objects.by_qualified_short_id_bulk(org_id, short_ids)
    except Group.DoesNotExist:
        # Short ID references a deleted project/issue
        return Condition(Column("group_id"), Op.IN, [])  # Empty result set
```

**Actual fix:** Resolved -- issue filter converter now handles deleted short IDs gracefully.

## Root Cause Analysis

| Pattern                                     | Frequency | Typical Trigger                                       |
| ------------------------------------------- | --------- | ----------------------------------------------------- |
| Custom tag not in metrics dataset           | Very High | Subscriptions migrated from events to metrics dataset |
| String field used as numeric in aggregation | Very High | `p95(transaction.duration)` where duration is a tag   |
| Apdex with threshold on metrics dataset     | High      | Old alert rules with per-query thresholds             |
| Deleted issue short ID in subscription      | Very High | Subscriptions referencing deleted projects/issues     |
| Unresolved tag keys in search               | Medium    | Custom tags not registered in the dataset             |
| Invalid filter values                       | Medium    | User-provided values that don't match expected format |

## Fix Patterns

### Pattern A: Validate subscription queries before creation

```python
def create_subscription(query, dataset):
    try:
        # Dry-run the query to validate it
        build_snuba_query(query, dataset=dataset)
    except (IncompatibleMetricsQuery, InvalidSearchQuery) as e:
        raise ValidationError(f"Invalid subscription query: {e}")
```

### Pattern B: Handle incompatible queries at subscription processing time

```python
def process_subscription_update(subscription, update):
    try:
        result = execute_query(subscription.query, dataset=subscription.dataset)
    except (IncompatibleMetricsQuery, InvalidSearchQuery):
        subscription.update(status=QuerySubscription.Status.DISABLED)
        logger.warning("subscription.disabled_incompatible_query", ...)
        return
```

### Pattern C: Graceful DoesNotExist in filter converters

```python
def _issue_filter_converter(search_filter, ...):
    try:
        groups = Group.objects.by_qualified_short_id_bulk(org_id, short_ids)
    except Group.DoesNotExist:
        return Condition(Column("group_id"), Op.IN, [])  # Empty result
```

### Pattern D: Validate tag existence before query

```python
def resolve_tag_key(tag_name, dataset):
    if tag_name not in get_valid_tags(dataset):
        raise InvalidSearchQuery(
            f"'{tag_name}' is not a valid tag for the {dataset} dataset"
        )
```

## Detection Checklist

Scan the code for these patterns:

- [ ] Any `_create_in_snuba` or subscription creation -- does it validate query compatibility with the target dataset?
- [ ] Any `resolve_tag_key()` call -- does it handle tags that don't exist in the dataset?
- [ ] Any `resolve_function()` or `resolve_snql_function()` -- does it validate parameter types?
- [ ] Any `_issue_filter_converter` or `by_qualified_short_id_bulk()` -- does it handle deleted groups?
- [ ] Any alert subscription that stores a raw query string -- is the query re-validated on use?
- [ ] Any `build_snuba_query()` for subscription processing -- does it catch `IncompatibleMetricsQuery`?
- [ ] Any code that passes user-provided filters to Snuba -- are the filter values validated?
- [ ] Any subscription update task -- what happens when the subscription query is no longer valid?
