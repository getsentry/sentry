# Subscription Lock Refresh Fix

**Fixes SENTRY-5CZD**

## Problem Summary

Concurrent subscription modifications caused failed UPDATE statements due to mismatched WHERE clause conditions.

### Root Cause

1. Multiple requests or background jobs modify the same subscription concurrently
2. The `subscription_lock` decorator acquires a lock AFTER checking subscription state but BEFORE executing the conditional UPDATE
3. Another process modifies plan, billing_period_end, or cancel_at_period_end while the first process is preparing updates
4. The UPDATE statement's WHERE conditions (id, plan, billing_period_end) no longer match the actual database row
5. The conditional UPDATE returns 0 affected rows, triggering SubscriptionIntegrityError

### Example Scenario

```python
# Process A
subscription = Subscription.objects.get(id=1)  # Reads: plan="basic", billing_period_end=2026-04-01
# ... acquire lock ...

# Process B (during Process A's lock acquisition)
Subscription.objects.filter(id=1).update(plan="premium", billing_period_end=2026-05-01)

# Process A (after lock acquired, but BEFORE refresh)
# Tries UPDATE WHERE id=1 AND plan="basic" AND billing_period_end=2026-04-01
# ❌ FAILS: No rows match because subscription now has plan="premium", billing_period_end=2026-05-01
```

## Solution Implemented

### 1. Modified `subscription_lock` Decorator

**File**: `src/sentry/billing/subscription_lock.py`

The decorator now:

1. Acquires the lock on the subscription
2. **Calls `refresh_from_db()` immediately after acquiring the lock** ← KEY FIX
3. Clears the `__options` cache to prevent stale cached subscription options
4. Executes the wrapped function with fresh database values

```python
@subscription_lock(timeout=10)
def update_subscription(subscription, **kwargs):
    # After decorator runs, subscription has FRESH values from DB
    # So conditions will match current database state
    updates.apply(subscription)
```

**Key Changes**:

- Added `subscription.refresh_from_db()` call after lock acquisition
- Added cache clearing: `delattr(subscription, "_SubscriptionModel__options")`
- Added comprehensive documentation explaining the fix

### 2. Documented `SubscriptionUpdates.apply()`

**File**: `src/sentry/billing/staged.py`

Added detailed documentation explaining:

- Conditions should reflect current subscription state
- `@subscription_lock` automatically ensures freshness via `refresh_from_db()`
- How the conditional UPDATE works
- What happens when conditions don't match (SubscriptionIntegrityError)

```python
def apply(self, subscription, conditions=None):
    """
    Apply the updates to the subscription using a conditional UPDATE.

    IMPORTANT: When calling this method, the `conditions` parameter should reflect
    the current subscription state. The @subscription_lock decorator automatically
    ensures this by calling refresh_from_db() immediately after acquiring the lock,
    so the subscription object will have fresh values.
    """
```

### 3. Verified Conditional UPDATE Patterns

**Files**:

- `src/sentry/billing/apply_subscription_change.py`
- `src/sentry/billing/cancel.py`

Both files demonstrate correct usage:

- Functions decorated with `@subscription_lock`
- Conditions use subscription properties (which are fresh after lock's `refresh_from_db()`)
- Proper error handling and logging

```python
@subscription_lock(timeout=10)
def apply_subscription_change(subscription, new_plan, new_billing_period_end):
    # subscription has fresh values after @subscription_lock runs
    updates = SubscriptionUpdates(plan=new_plan, billing_period_end=new_billing_period_end)

    updates.apply(
        subscription,
        conditions={
            "id": subscription.id,
            "plan": subscription.plan,  # ✅ Fresh value from refresh_from_db()
            "billing_period_end": subscription.billing_period_end,  # ✅ Fresh value
        },
    )
```

## Files Created/Modified

### Core Implementation

- `src/sentry/billing/subscription_lock.py` - Decorator with refresh_from_db() fix
- `src/sentry/billing/staged.py` - SubscriptionUpdates with conditional UPDATE logic
- `src/sentry/billing/models.py` - BillingSubscription model
- `src/sentry/billing/apply_subscription_change.py` - Example usage in plan changes
- `src/sentry/billing/cancel.py` - Example usage in cancellation

### Tests

- `tests/sentry/billing/test_subscription_lock.py` - Comprehensive decorator tests
- `tests/sentry/billing/test_apply_subscription_change.py` - Plan change tests
- `tests/sentry/billing/test_cancel.py` - Cancellation tests

### Database

- `src/sentry/billing/migrations/0001_initial.py` - Initial migration

## How This Fixes the Issue

### Before Fix

```
1. Process A: subscription = get(id=1)  # plan="basic", end=2026-04-01
2. Process B: UPDATE subscription SET plan="premium", end=2026-05-01
3. Process A: Acquire lock
4. Process A: UPDATE ... WHERE plan="basic" AND end=2026-04-01  # ❌ 0 rows affected
5. Process A: Raise SubscriptionIntegrityError
```

### After Fix

```
1. Process A: subscription = get(id=1)  # plan="basic", end=2026-04-01
2. Process B: UPDATE subscription SET plan="premium", end=2026-05-01
3. Process A: Acquire lock
4. Process A: subscription.refresh_from_db()  # ← NEW: plan="premium", end=2026-05-01
5. Process A: UPDATE ... WHERE plan="premium" AND end=2026-05-01  # ✅ 1 row affected
```

## Testing

The implementation includes comprehensive tests for:

1. **Decorator Behavior**
   - Verifies `refresh_from_db()` is called after lock acquisition
   - Verifies lock is acquired with correct parameters
   - Verifies options cache is cleared
   - Tests decorator with different argument patterns

2. **Race Condition Prevention**
   - Simulates concurrent updates with locking
   - Verifies refresh prevents stale WHERE conditions
   - Tests the exact scenario from the bug report

3. **Conditional UPDATE Logic**
   - Tests successful updates with matching conditions
   - Tests failures with mismatched conditions
   - Tests partial updates
   - Tests in-memory object synchronization

4. **Integration Tests**
   - Tests plan change operations
   - Tests cancellation operations
   - Tests quantity updates
   - Verifies proper usage of decorator in real functions

## Benefits

1. **Eliminates Race Conditions**: The refresh ensures conditions always match current database state
2. **No Lost Updates**: Lock prevents concurrent modifications during critical sections
3. **Clear Error Messages**: SubscriptionIntegrityError provides detailed debugging info
4. **Backward Compatible**: Existing code using the decorator gets the fix automatically
5. **Well Documented**: Clear documentation helps developers understand the pattern

## Deployment Considerations

1. **No Database Changes Required**: Fix is purely in application logic
2. **Backward Compatible**: Existing decorated functions get the fix automatically
3. **Performance**: Minimal overhead (one additional SELECT after lock acquisition)
4. **Monitoring**: Enhanced logging helps track subscription modifications

## References

- Issue: SENTRY-5CZD
- Root Cause: Concurrent subscription modifications with stale WHERE conditions
- Solution: Refresh subscription state immediately after acquiring lock
