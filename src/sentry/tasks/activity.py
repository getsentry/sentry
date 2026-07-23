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
    from sentry.models.organization import Organization


def _send_legacy_activity_notification(activity: Activity) -> None:
    from sentry.mail import mail_adapter

    mail_adapter.notify_about_activity(activity)


def _send_deploy_activity_notification(activity: Activity, organization: Organization) -> None:
    from sentry.notifications.platform.service import NotificationService
    from sentry.notifications.platform.strategies.deploy_release import DeployReleaseStrategy
    from sentry.notifications.platform.templates.deploy import (
        DeployReleaseData,
        build_deploy_release_data,
        filter_deploy_data,
    )
    from sentry.notifications.platform.types import NotificationSource
    from sentry.notifications.utils import get_deploy, get_release

    if not NotificationService.has_access(
        organization=organization, source=NotificationSource.DEPLOY_RELEASE
    ):
        _send_legacy_activity_notification(activity=activity)
        return

    deploy = get_deploy(activity)
    release = get_release(activity, organization)

    if not deploy or not release:
        _send_legacy_activity_notification(activity=activity)
        return

    result = build_deploy_release_data(deploy=deploy, release=release)
    strategy = DeployReleaseStrategy(
        projects=frozenset(result["projects"]),
        organization=organization,
        committer_user_ids=frozenset(result["committer_user_ids"]),
    )
    targets = strategy.get_targets()

    for target in targets:
        user_id = target.specific_data.get("user_id") if target.specific_data else None
        data = filter_deploy_data(data=result["data"], user_id=user_id, organization=organization)
        NotificationService[DeployReleaseData](data=data).notify_target(target=target)


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
    from sentry.types.activity import ActivityType

    try:
        activity = Activity.objects.get(pk=activity_id)
    except Activity.DoesNotExist:
        return

    organization = Organization.objects.get_from_cache(pk=activity.project.organization_id)
    bind_organization_context(organization)

    if activity.type == ActivityType.DEPLOY.value:
        _send_deploy_activity_notification(activity=activity, organization=organization)
        return

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
