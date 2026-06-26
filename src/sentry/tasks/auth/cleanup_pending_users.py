from __future__ import annotations

from django.utils import timezone

from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import auth_control_tasks
from sentry.users.models.pending_user import PendingUser


@instrumented_task(
    name="sentry.tasks.auth.cleanup_pending_users",
    namespace=auth_control_tasks,
    silo_mode=SiloMode.CONTROL,
    processing_deadline_duration=90,
)
def cleanup_pending_users(**kwargs) -> None:
    PendingUser.objects.filter(expires_at__lte=timezone.now()).delete()
