from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import notifications_tasks
from sentry.utils.sdk import bind_organization_context

logger = logging.getLogger(__name__)

if TYPE_CHECKING:
    from sentry.models.activity import Activity


def _send_legacy_activity_notification(activity: Activity) -> None:
    from sentry.mail import mail_adapter

    mail_adapter.notify_about_activity(activity)


@instrumented_task(
    name="sentry.tasks.activity.send_activity_notifications",
    namespace=notifications_tasks,
    processing_deadline_duration=180,
    silo_mode=SiloMode.CELL,
)
def send_activity_notifications(activity_id: int) -> None:
    from sentry.models.activity import Activity
    from sentry.models.organization import Organization
    from sentry.notifications.platform.service import NotificationService
    from sentry.notifications.platform.strategies.issue_subscribers import (
        IssueSubscribersActivityStrategy,
    )
    from sentry.notifications.platform.templates.activity.base import (
        ACTIVITY_TYPE_TO_SOURCE,
        ActivityNotificationData,
        build_activity_notification_data,
    )

    try:
        activity = Activity.objects.get(pk=activity_id)
    except Activity.DoesNotExist:
        return

    organization = Organization.objects.get_from_cache(pk=activity.project.organization_id)
    bind_organization_context(organization)

    source = ACTIVITY_TYPE_TO_SOURCE.get(activity.type)
    if not source:
        _send_legacy_activity_notification(activity=activity)
        return

    if not NotificationService.has_access(organization=organization, source=source):
        _send_legacy_activity_notification(activity=activity)
        return

    data = build_activity_notification_data(activity=activity)
    strategy = IssueSubscribersActivityStrategy(activity=activity)
    NotificationService[ActivityNotificationData](data=data).notify_sync(strategy=strategy)
