# Kafka Consumer Timeout and Database Connection Fixes

## Issues Fixed

### 1. Kafka Consumer Timeout Issue

**Problem:**
The `test_resolving_does_not_fail_when_no_module_or_function` test was failing with:
```
arroyo.errors.ConsumerError: KafkaError{code=_MAX_POLL_EXCEEDED,val=-147,str="Application maximum poll interval (300000ms) exceeded by 226ms"}
```

**Root Cause:**
The default `max.poll.interval.ms` for Kafka consumers is 300000ms (5 minutes). The test was taking 300226ms (just 226ms over the limit), causing the consumer to be kicked out of the consumer group.

**Solution:**
1. **Increased `max_poll_interval_ms` for test consumer** in `src/sentry/testutils/pytest/kafka.py`:
   - Changed from default 300000ms to 600000ms (10 minutes) for tests
   - Added the parameter to the `get_stream_processor` call in the test Kafka consumer setup

2. **Increased test timeout** in `src/sentry/testutils/pytest/kafka.py`:
   - Changed `MAX_SECONDS_WAITING_FOR_EVENT` from 16 to 30 seconds
   - This gives tests more time to complete processing

### 2. Database Connection Cleanup Issue

**Problem:**
```
psycopg2.errors.ObjectInUse: database "test_region" is being accessed by other users
DETAIL: There is 1 other session using the database.
```

**Root Cause:**
Lingering database connections during test teardown were preventing proper database cleanup.

**Solution:**
Added connection cleanup in the test fixture in `tests/relay_integration/lang/java/test_plugin.py`:
- Added `django.db.connections.close_all()` to the test fixture teardown
- This ensures all database connections are closed after each test

## Files Modified

1. `src/sentry/testutils/pytest/kafka.py`
   - Increased `max_poll_interval_ms` to 600000ms for test consumers
   - Increased `MAX_SECONDS_WAITING_FOR_EVENT` to 30 seconds

2. `tests/relay_integration/lang/java/test_plugin.py`
   - Added database connection cleanup in test fixture

## Expected Results

- The Kafka consumer timeout should no longer occur as tests now have 10 minutes to process instead of 5 minutes
- Database connection issues during test teardown should be resolved due to explicit connection cleanup
- Tests should be more stable and less prone to timing-related failures

## Technical Details

The `max.poll.interval.ms` parameter controls the maximum delay between invocations of `poll()` when using consumer group management. If `poll()` is not called before this timeout expires, the consumer is considered failed and the group will rebalance. By increasing this timeout for tests, we provide more time for symbolicator processing which can sometimes take longer than expected.

The database connection cleanup ensures that transaction tests don't leave lingering connections that can interfere with test database teardown.
