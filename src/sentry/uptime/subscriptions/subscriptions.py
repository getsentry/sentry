import logging

from sentry.models.project import Project
from sentry.uptime.models import (
    ProjectUptimeSubscription,
    ProjectUptimeSubscriptionMode,
    UptimeSubscription,
)
from sentry.uptime.subscriptions.tasks import (
    create_remote_uptime_subscription,
    delete_remote_uptime_subscription,
)

logger = logging.getLogger(__name__)

UPTIME_SUBSCRIPTION_TYPE = "uptime_monitor"


def create_uptime_subscription(
    url: str, interval_seconds: int, timeout_ms: int
) -> UptimeSubscription:
    """
    Creates a new uptime subscription. This creates the row in postgres, and fires a task that will send the config
    to the uptime check system.
    """
    subscription, created = UptimeSubscription.objects.get_or_create(
        url=url,
        interval_seconds=interval_seconds,
        defaults={
            "status": UptimeSubscription.Status.CREATING.value,
            "type": UPTIME_SUBSCRIPTION_TYPE,
            "timeout_ms": timeout_ms,
        },
    )
    if subscription.status == UptimeSubscription.Status.DELETING.value:
        # This is pretty unlikely to happen, but we should avoid deleting the subscription here and just confirm it
        # exists in the checker.
        subscription.update(status=UptimeSubscription.Status.CREATING.value)
        created = True

    if created:
        create_remote_uptime_subscription.delay(subscription.id)
    return subscription


def delete_uptime_subscription(uptime_subscription: UptimeSubscription):
    """
    Deletes an existing uptime subscription. This updates the row in postgres, and fires a task that will send the
    deletion to the external system and remove the row once successful.
    """
    uptime_subscription.update(status=UptimeSubscription.Status.DELETING.value)
    delete_remote_uptime_subscription.delay(uptime_subscription.id)


def create_project_uptime_subscription(
    project: Project,
    uptime_subscription: UptimeSubscription,
    mode: ProjectUptimeSubscriptionMode,
) -> ProjectUptimeSubscription:
    """
    Links a project to an uptime subscription so that it can process results.
    """
    return ProjectUptimeSubscription.objects.get_or_create(
        project=project,
        uptime_subscription=uptime_subscription,
        mode=mode.value,
    )[0]


def delete_project_uptime_subscription(
    project: Project,
    uptime_subscription: UptimeSubscription,
    modes: list[ProjectUptimeSubscriptionMode],
):
    """
    Deletes the link from a project to an `UptimeSubscription`. Also checks to see if the subscription
    has been orphaned, and if so removes it as well.
    """
    for uptime_project_subscription in ProjectUptimeSubscription.objects.filter(
        project=project,
        uptime_subscription=uptime_subscription,
        mode__in=modes,
    ):
        uptime_project_subscription.delete()

    remove_uptime_subscription_if_unused(uptime_subscription)


def remove_uptime_subscription_if_unused(uptime_subscription: UptimeSubscription):
    """
    Determines if an uptime subscription is no longer used by any `ProjectUptimeSubscriptions` and removes it if so
    """
    # If the uptime subscription is no longer used, we also remove it.
    if not uptime_subscription.projectuptimesubscription_set.exists():
        delete_uptime_subscription(uptime_subscription)


def is_url_auto_monitored_for_project(project: Project, url: str) -> bool:
    return ProjectUptimeSubscription.objects.filter(
        project=project,
        mode__in=(
            ProjectUptimeSubscriptionMode.AUTO_DETECTED_ONBOARDING.value,
            ProjectUptimeSubscriptionMode.AUTO_DETECTED_ACTIVE.value,
        ),
        uptime_subscription__url=url,
    ).exists()


def get_auto_monitored_subscriptions_for_project(
    project: Project,
) -> list[ProjectUptimeSubscription]:
    return list(
        ProjectUptimeSubscription.objects.filter(
            project=project,
            mode__in=(
                ProjectUptimeSubscriptionMode.AUTO_DETECTED_ONBOARDING.value,
                ProjectUptimeSubscriptionMode.AUTO_DETECTED_ACTIVE.value,
            ),
        ).select_related("uptime_subscription")
    )
