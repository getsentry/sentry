# Fix for SENTRY-5HAV: Release Value Indexer Lookup Issue

## Problem

When creating alert subscriptions with release filters using the `package@version` format (e.g., `release:application.monitoring.javascript@22.5.5`), the system was raising an `IncompatibleMetricsQuery` error with the message:

```
release value application.monitoring.javascript@22.5.5 in filter not found
```

This occurred because:
1. Alert subscriptions use the metrics query builder which validates filter values by looking them up in the metrics indexer
2. The metrics indexer stores release tag values with only the version part (e.g., `22.5.5`) rather than the full `package@version` string
3. When the query builder tried to resolve `application.monitoring.javascript@22.5.5`, it wasn't found in the indexer

## Root Cause

The `AlertMetricsQueryBuilder.default_filter_converter()` method calls `resolve_tag_value()` to look up tag values in the indexer. For release tags, it was passing the full `package@version` string directly to the indexer, which only has the version portion indexed.

## Solution

Modified the `AlertMetricsQueryBuilder.resolve_tag_value()` method to:

1. Detect when resolving a `release` tag value
2. Extract the version part from `package@version` or `package@version+build` formats using regex
3. Try resolving the version-only string in the indexer first
4. Fall back to trying the full string if version-only lookup fails

This approach handles multiple scenarios:
- Releases with `package@version` format → extracts version and resolves it
- Releases with `package@version+build` format → extracts version (without build) and resolves it  
- Releases with version-only format → resolves directly (no extraction needed)

## Changes Made

### File: `src/sentry/search/events/builder/metrics.py`

1. Added `import re` at the top of the file

2. Modified `resolve_tag_value()` method signature to accept optional `tag_name` parameter:
   ```python
   def resolve_tag_value(self, value: str, tag_name: str | None = None) -> int | str | None:
   ```

3. Added release-specific logic to extract version before indexer lookup:
   ```python
   if tag_name == "release" and "@" in value:
       match = re.match(r"^[^@]+@([^+]+)(?:\+.*)?$", value)
       if match:
           version_only = match.group(1)
           result = self.resolve_metric_index(version_only)
           if result is not None:
               return result
   return self.resolve_metric_index(value)
   ```

4. Updated all calls to `resolve_tag_value()` in `default_filter_converter()` to pass the tag name

### File: `tests/sentry/snuba/test_entity_subscriptions.py`

Added test case `test_get_entity_subscription_for_metrics_dataset_with_release_filter()` to verify that:
- Release filters with `package@version` format are correctly resolved
- The query builder doesn't raise `IncompatibleMetricsQuery` when the version is indexed
- The fix works for the most common use case (sessions/crash rate alerts)

## Testing

The test simulates the scenario where:
1. Only the version part (`22.5.5`) is indexed in the metrics indexer
2. A query is built with the full release string (`application.monitoring.javascript@22.5.5`)
3. The query builder successfully resolves the release filter without errors

## Impact

This fix resolves the subscription creation errors for all alerts using release filters with `package@version` format, including:
- Crash rate alerts filtered by release
- Session-based alerts with release filters
- Any other metrics-based alerts that filter on the `release` tag

## Related Issues

Similar errors were observed for various release formats in production:
- `application.monitoring.javascript@22.5.5`
- `application.monitoring.javascript@22.2.1`
- `com.example.vu.android@2.10.4+43`
- And many others

This fix should resolve all of these cases.
