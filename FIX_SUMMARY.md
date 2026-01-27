# Fix Summary: SubscriptionError - customerType is not a tag in the metrics dataset

**Issue ID**: SENTRY-5HAQ

## Problem

Alert rules were being created with queries containing invalid metric tags (e.g., `customerType`, `http.url`, `sdk.name`) that are not part of the `DEFAULT_METRIC_TAGS` set when the `organizations:mep-use-default-tags` feature flag is enabled. The validation only occurred asynchronously during subscription creation in Snuba, causing `SubscriptionError` to be raised in background tasks instead of at rule creation time.

## Root Cause

The `create_alert_rule` and `update_alert_rule` functions in `src/sentry/incidents/logic.py` did not validate the query string against the metrics dataset and feature flag configuration before persisting the alert rule to the database. This allowed invalid queries to be saved, which later failed when the background task `create_subscription_in_snuba` attempted to build the query for Snuba.

## Solution

Added upfront validation to prevent invalid alert rules from being created or updated:

### 1. New Validation Function

Added `validate_alert_rule_query()` function in `src/sentry/incidents/logic.py`:

```python
def validate_alert_rule_query(
    organization: Organization,
    projects: Sequence[Project],
    query: str,
    aggregate: str,
    time_window: int,
    environment: Environment | None,
    query_type: SnubaQuery.Type,
    dataset: Dataset,
) -> None:
```

This function:
- Creates a temporary entity subscription based on the alert rule parameters
- Attempts to build a query builder, which triggers the same validation that would occur in the background task
- Catches `IncompatibleMetricsQuery` and `InvalidSearchQuery` exceptions and re-raises them as `ValidationError`
- Provides immediate feedback to users at rule creation/update time

### 2. Integration Points

**In `create_alert_rule()`:**
- Validation is called after all parameter processing but before the database transaction
- Ensures no invalid alert rules are persisted

**In `update_alert_rule()`:**
- Validation is called when query, aggregate, or time_window parameters are being updated
- Uses the current values from the existing rule if new values aren't provided
- Prevents updates that would make a valid rule invalid

### 3. Test Coverage

Added comprehensive tests in `tests/sentry/incidents/test_logic.py`:

**For `create_alert_rule`:**
- `test_create_alert_rule_invalid_metric_tag`: Verifies that creating a rule with an invalid tag raises `ValidationError`
- `test_create_alert_rule_valid_metric_tag`: Verifies that creating a rule with a valid tag succeeds

**For `update_alert_rule`:**
- `test_update_alert_rule_invalid_metric_tag`: Verifies that updating a rule with an invalid tag raises `ValidationError` and doesn't modify the rule

All tests use the `@with_feature("organizations:mep-use-default-tags")` decorator to simulate the production environment where the issue occurs.

## Impact

### Before the Fix
- Users could create alert rules with invalid metric tags
- Errors occurred asynchronously in background tasks
- Poor user experience with no immediate feedback
- Alert rules would fail silently during subscription creation

### After the Fix
- Invalid metric tags are caught immediately at rule creation/update time
- Users receive clear error messages: "customerType is not a tag in the metrics dataset"
- No invalid alert rules are persisted to the database
- No failed background tasks due to invalid queries
- Better user experience with immediate validation feedback

## Files Changed

1. `src/sentry/incidents/logic.py`:
   - Added import for `IncompatibleMetricsQuery` and `InvalidSearchQuery`
   - Added `validate_alert_rule_query()` function
   - Modified `create_alert_rule()` to call validation before creating the rule
   - Modified `update_alert_rule()` to call validation when query parameters are updated

2. `tests/sentry/incidents/test_logic.py`:
   - Added `test_create_alert_rule_invalid_metric_tag()`
   - Added `test_create_alert_rule_valid_metric_tag()`
   - Added `test_update_alert_rule_invalid_metric_tag()`

## Verification

The fix can be verified by:

1. Creating an alert rule with an invalid metric tag (e.g., `customerType:enterprise`)
2. Confirming that a `ValidationError` is raised immediately
3. Verifying that no alert rule or subscription is created in the database
4. Creating an alert rule with a valid metric tag (e.g., `environment:production`)
5. Confirming that the alert rule is created successfully

## Related Issues

This fix addresses multiple error patterns in production:
- "customerType is not a tag in the metrics dataset"
- "http.url is not a tag in the metrics dataset"
- "sdk.name is not a tag in the metrics dataset"
- "se is not a tag in the metrics dataset"
- And other similar tag validation errors

All of these will now be caught at rule creation/update time instead of failing asynchronously.
