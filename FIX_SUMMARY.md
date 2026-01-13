# Fix for ProcessingDeadlineExceeded in send_resource_change_webhook

## Problem

The `send_resource_change_webhook` task was exceeding its 5-second processing deadline, causing the following error:

```
ProcessingDeadlineExceeded: execution deadline of 5 seconds exceeded by 
sentry.sentry_apps.tasks.sentry_apps.send_resource_change_webhook
```

## Root Cause

The issue occurred due to Redis cluster lazy initialization happening during task execution:

1. The task has a strict 5-second processing deadline
2. The webhook HTTP request completes successfully (typically in < 1 second)
3. After the webhook is sent, the code attempts to log the request to a Redis buffer
4. The Redis client is wrapped in a `SimpleLazyObject` that defers initialization
5. When `buffer.add_request()` is called, it triggers `self.client.pipeline()`
6. This forces the lazy object to initialize, which performs expensive Redis cluster slot discovery
7. The slot discovery can take several seconds, causing the total task time to exceed 5 seconds
8. The task fails even though the webhook was sent successfully

## Solution

Wrap all `buffer.add_request()` calls in a safe wrapper function that:

1. Attempts to add the request to the buffer normally
2. Catches any exceptions (including Redis timeouts and ProcessingDeadlineExceeded)
3. Logs a warning with details about the failure
4. Does NOT re-raise the exception, allowing the task to complete successfully

### Key Insight

Since the webhook has already been sent successfully by the time we try to log it, it's better to lose the request log than to fail the entire task. The webhook delivery is the critical operation; the logging is just for observability.

## Changes Made

### 1. Added `_safe_add_request_to_buffer()` function in `webhooks.py`

```python
def _safe_add_request_to_buffer(
    buffer: SentryAppWebhookRequestsBuffer, **kwargs: Any
) -> None:
    """
    Safely add a webhook request to the buffer, catching any errors that might occur
    during Redis cluster initialization or other buffer operations.
    """
    try:
        buffer.add_request(**kwargs)
    except Exception as e:
        logger.warning(
            "sentry_app.webhook.buffer_add_request_failed",
            extra={
                "error": str(e),
                "error_type": type(e).__name__,
                "event": kwargs.get("event"),
                "org_id": kwargs.get("org_id"),
                "response_code": kwargs.get("response_code"),
            },
            exc_info=True,
        )
```

### 2. Updated `send_and_save_webhook_request()` in `webhooks.py`

Replaced both `buffer.add_request()` calls with `_safe_add_request_to_buffer()`:
- One in the timeout/connection error handler (line 148)
- One in the success path (line 171)

### 3. Updated `send_and_save_sentry_app_request()` in `external_requests/utils.py`

Replaced both `buffer.add_request()` calls with `_safe_add_request_to_buffer()`:
- One in the timeout/connection error handler (line 92)
- One in the success path (line 105)

### 4. Added comprehensive tests

Created `test_webhooks_safe_buffer.py` with tests for:
- Successful buffer operations
- Redis error handling
- ProcessingDeadlineExceeded handling
- End-to-end webhook sending with buffer failures

## Impact

### Positive
- Tasks no longer fail after successfully sending webhooks
- Better observability through warning logs when buffer operations fail
- Webhook delivery success rate improves

### Neutral
- Some webhook request logs may be lost if Redis is slow/unavailable
- This is acceptable because the webhook itself was delivered successfully
- Warning logs provide visibility into when this happens

### No Breaking Changes
- Existing functionality is preserved
- Only adds error handling, doesn't change behavior in success cases

## Testing

The fix includes comprehensive unit tests that verify:
1. Normal operation continues to work
2. Redis errors are caught and logged
3. ProcessingDeadlineExceeded errors are handled
4. Webhooks complete successfully even when buffer fails

## Monitoring

To monitor the effectiveness of this fix:

1. Watch for decrease in `ProcessingDeadlineExceeded` errors for `send_resource_change_webhook`
2. Monitor new warning logs: `sentry_app.webhook.buffer_add_request_failed`
3. Track webhook delivery success rates

If `buffer_add_request_failed` warnings are frequent, it indicates:
- Redis cluster is slow/overloaded
- May need to increase Redis capacity or optimize cluster configuration
- Consider pre-warming Redis connections or using connection pooling
