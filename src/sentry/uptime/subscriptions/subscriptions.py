import logging

from sentry.models.project import Project
from sentry.snuba.models import QuerySubscription
from sentry.uptime.models import ProjectUptimeSubscription, UptimeSubscription
from sentry.uptime.subscriptions.tasks import (
    create_remote_uptime_subscription,
    delete_remote_uptime_subscription,
    update_remote_uptime_subscription,
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

    subscription = UptimeSubscription.objects.create(
        status=UptimeSubscription.Status.CREATING.value,
        type=UPTIME_SUBSCRIPTION_TYPE,
        url=url,
        interval_seconds=interval_seconds,
        timeout_ms=timeout_ms,
    )
    create_remote_uptime_subscription.delay(subscription.id)
    return subscription


def update_uptime_subscription(
    uptime_subscription: UptimeSubscription,
    url: str,
    interval_seconds: int,
    timeout_ms: int,
) -> UptimeSubscription:
    """
    Updates an existing uptime subscription. This updates the row in postgres, and fires a task that will send the
    config update to the uptime check system.
    """
    uptime_subscription.update(
        status=UptimeSubscription.Status.UPDATING.value,
        url=url,
        interval_seconds=interval_seconds,
        timeout_ms=timeout_ms,
    )
    update_remote_uptime_subscription.delay(uptime_subscription.id)
    return uptime_subscription


def delete_uptime_subscription(uptime_subscription: UptimeSubscription):
    """
    Deletes an existing uptime subscription. This updates the row in postgres, and fires a task that will send the
    deletion to the external system and remove the row once successful.
    """
    uptime_subscription.update(status=QuerySubscription.Status.DELETING.value)
    delete_remote_uptime_subscription.delay(uptime_subscription.id)


def create_project_uptime_subscription(
    project: Project, uptime_subscription: UptimeSubscription
) -> ProjectUptimeSubscription:
    """
    Links a project to an uptime subscription so that it can process results.
    """
    return ProjectUptimeSubscription.objects.get_or_create(
        project=project, uptime_subscription=uptime_subscription
    )[0]


def delete_project_uptime_subscription(project: Project, uptime_subscription: UptimeSubscription):
    """
    Deletes the link from a project to an `UptimeSubscription`. Also checks to see if the subscription
    has been orphaned, and if so removes it as well.
    """
    try:
        uptime_project_subscription = ProjectUptimeSubscription.objects.get(
            project=project, uptime_subscription=uptime_subscription
        )
    except ProjectUptimeSubscription.DoesNotExist:
        pass
    else:
        uptime_project_subscription.delete()

    # If the uptime subscription is no longer used, we also remove it.
    if not uptime_subscription.projectuptimesubscription_set.exists():
        delete_uptime_subscription(uptime_subscription)
