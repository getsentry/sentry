import hashlib
import logging
from collections.abc import Sequence

from django.db import IntegrityError
from django.db.models import TextField
from django.db.models.expressions import Value
from django.db.models.functions import MD5, Coalesce

from sentry.models.project import Project
from sentry.types.actor import Actor
from sentry.uptime.detectors.url_extraction import extract_domain_parts
from sentry.uptime.models import (
    ProjectUptimeSubscription,
    ProjectUptimeSubscriptionMode,
    UptimeSubscription,
    headers_json_encoder,
)
from sentry.uptime.rdap.tasks import fetch_subscription_rdap_info
from sentry.uptime.subscriptions.tasks import (
    create_remote_uptime_subscription,
    delete_remote_uptime_subscription,
)

logger = logging.getLogger(__name__)

UPTIME_SUBSCRIPTION_TYPE = "uptime_monitor"
MAX_AUTO_SUBSCRIPTIONS_PER_ORG = 1
MAX_MANUAL_SUBSCRIPTIONS_PER_ORG = 100
# Default timeout for all subscriptions
DEFAULT_SUBSCRIPTION_TIMEOUT_MS = 10000


class MaxManualUptimeSubscriptionsReached(ValueError):
    pass


def retrieve_uptime_subscription(
    url: str,
    interval_seconds: int,
    method: str,
    headers: Sequence[tuple[str, str]],
    body: str | None,
) -> UptimeSubscription | None:
    try:
        subscription = (
            UptimeSubscription.objects.filter(
                url=url, interval_seconds=interval_seconds, method=method
            )
            .annotate(
                headers_md5=MD5("headers", output_field=TextField()),
                body_md5=Coalesce(MD5("body"), Value(""), output_field=TextField()),
            )
            .filter(
                headers_md5=hashlib.md5(headers_json_encoder(headers).encode("utf-8")).hexdigest(),
                body_md5=hashlib.md5(body.encode("utf-8")).hexdigest() if body else "",
            )
            .get()
        )
    except UptimeSubscription.DoesNotExist:
        subscription = None
    return subscription


def get_or_create_uptime_subscription(
    url: str,
    interval_seconds: int,
    timeout_ms: int = DEFAULT_SUBSCRIPTION_TIMEOUT_MS,
    method: str = "GET",
    headers: Sequence[tuple[str, str]] | None = None,
    body: str | None = None,
) -> UptimeSubscription:
    """
    Creates a new uptime subscription. This creates the row in postgres, and fires a task that will send the config
    to the uptime check system.
    """
    if headers is None:
        headers = []
    # We extract the domain and suffix of the url here. This is used to prevent there being too many checks to a single
    # domain.
    result = extract_domain_parts(url)

    subscription = retrieve_uptime_subscription(url, interval_seconds, method, headers, body)
    created = False

    if subscription is None:
        try:
            subscription = UptimeSubscription.objects.create(
                url=url,
                url_domain=result.domain,
                url_domain_suffix=result.suffix,
                interval_seconds=interval_seconds,
                timeout_ms=timeout_ms,
                status=UptimeSubscription.Status.CREATING.value,
                type=UPTIME_SUBSCRIPTION_TYPE,
                method=method,
                headers=headers,  # type: ignore[misc]
                body=body,
            )
            created = True
        except IntegrityError:
            # Handle race condition where we tried to retrieve an existing subscription while it was being created
            subscription = retrieve_uptime_subscription(
                url, interval_seconds, method, headers, body
            )

    if subscription is None:
        # This shouldn't happen, since we should always be able to fetch or create the subscription.
        logger.error(
            "Unable to create uptime subscription",
            extra={
                "url": url,
                "interval_seconds": interval_seconds,
                "timeout_ms": timeout_ms,
                "method": method,
                "headers": headers,
                "body": body,
            },
        )
        raise ValueError("Unable to create uptime subscription")

    if subscription.status == UptimeSubscription.Status.DELETING.value:
        # This is pretty unlikely to happen, but we should avoid deleting the subscription here and just confirm it
        # exists in the checker.
        subscription.update(status=UptimeSubscription.Status.CREATING.value)
        created = True

    if created:
        create_remote_uptime_subscription.delay(subscription.id)
        fetch_subscription_rdap_info.delay(subscription.id)
    return subscription


def delete_uptime_subscription(uptime_subscription: UptimeSubscription):
    """
    Deletes an existing uptime subscription. This updates the row in postgres, and fires a task that will send the
    deletion to the external system and remove the row once successful.
    """
    uptime_subscription.update(status=UptimeSubscription.Status.DELETING.value)
    delete_remote_uptime_subscription.delay(uptime_subscription.id)


def get_or_create_project_uptime_subscription(
    project: Project,
    url: str,
    interval_seconds: int,
    timeout_ms: int = DEFAULT_SUBSCRIPTION_TIMEOUT_MS,
    method: str = "GET",
    headers: Sequence[tuple[str, str]] | None = None,
    body: str | None = None,
    mode: ProjectUptimeSubscriptionMode = ProjectUptimeSubscriptionMode.MANUAL,
    name: str = "",
    owner: Actor | None = None,
) -> tuple[ProjectUptimeSubscription, bool]:
    """
    Links a project to an uptime subscription so that it can process results.
    """
    if mode == ProjectUptimeSubscriptionMode.MANUAL:
        manual_subscription_count = ProjectUptimeSubscription.objects.filter(
            project__organization=project.organization, mode=ProjectUptimeSubscriptionMode.MANUAL
        ).count()
        if manual_subscription_count >= MAX_MANUAL_SUBSCRIPTIONS_PER_ORG:
            raise MaxManualUptimeSubscriptionsReached

    uptime_subscription = get_or_create_uptime_subscription(
        url, interval_seconds, timeout_ms, method, headers, body
    )
    owner_user_id = None
    owner_team_id = None
    if owner:
        if owner.is_user:
            owner_user_id = owner.id
        if owner.is_team:
            owner_team_id = owner.id
    return ProjectUptimeSubscription.objects.get_or_create(
        project=project,
        uptime_subscription=uptime_subscription,
        mode=mode.value,
        name=name,
        owner_user_id=owner_user_id,
        owner_team_id=owner_team_id,
    )


def update_project_uptime_subscription(
    uptime_monitor: ProjectUptimeSubscription,
    url: str,
    interval_seconds: int,
    method: str,
    headers: Sequence[tuple[str, str]],
    body: str | None,
    name: str,
    owner: Actor | None,
):
    """
    Links a project to an uptime subscription so that it can process results.
    """
    cur_uptime_subscription = uptime_monitor.uptime_subscription
    new_uptime_subscription = get_or_create_uptime_subscription(
        url, interval_seconds, cur_uptime_subscription.timeout_ms, method, headers, body
    )
    updated_subscription = cur_uptime_subscription.id != new_uptime_subscription.id

    mode = uptime_monitor.mode
    if updated_subscription:
        # If the `uptime_subscription` is updated then treat this as a manual subscription
        mode = ProjectUptimeSubscriptionMode.MANUAL

    owner_user_id = uptime_monitor.owner_user_id
    owner_team_id = uptime_monitor.owner_team_id
    if owner:
        if owner.is_user:
            owner_user_id = owner.id
            owner_team_id = None
        if owner.is_team:
            owner_team_id = owner.id
            owner_user_id = None

    uptime_monitor.update(
        uptime_subscription=new_uptime_subscription,
        name=name,
        mode=mode,
        owner_user_id=owner_user_id,
        owner_team_id=owner_team_id,
    )
    # If we changed any fields on the actual subscription we created a new subscription and associated it with this
    # uptime monitor. Check if the old subscription was orphaned due to this.
    if updated_subscription:
        remove_uptime_subscription_if_unused(cur_uptime_subscription)


def delete_uptime_subscriptions_for_project(
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


def delete_project_uptime_subscription(subscription: ProjectUptimeSubscription):
    uptime_subscription = subscription.uptime_subscription
    subscription.delete()
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
