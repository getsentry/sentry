---
name: backend-task-framework
description: Guidelines that should be followed when working with Django tasks using Celery and Taskbroker.
---

### "User wants to add a Celery task"

1. Location: `src/sentry/tasks/{category}.py`
2. Use `@instrumented_task` decorator
3. Set appropriate `queue` and `max_retries`
4. Test location: `tests/sentry/tasks/test_{category}.py`

## Critical Patterns (Copy-Paste Ready)

### Celery Task Pattern

```python
# src/sentry/tasks/email.py
from sentry.tasks.base import instrumented_task

@instrumented_task(
    name="sentry.tasks.send_email",
    queue="email",
    max_retries=3,
    default_retry_delay=60,
)
def send_email(user_id: int, subject: str, body: str) -> None:
    from sentry.models import User

    try:
        user = User.objects.get(id=user_id)
        # Send email logic
    except User.DoesNotExist:
        # Don't retry if user doesn't exist
        return
```
