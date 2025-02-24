import hashlib
import logging
from collections.abc import Sequence

from django.db import IntegrityError
from django.db.models import TextField
from django.db.models.expressions import Value
from django.db.models.functions import MD5, Coalesce

from sentry import quotas
from sentry.constants import DataCategory, ObjectStatus
from sentry.models.environment import Environment
from sentry.models.project import Project
from sentry.quotas.base import SeatAssignmentResult
from sentry.types.actor import Actor
from sentry.uptime.detectors.url_extraction import extract_domain_parts
from sentry.uptime.models import (
    ProjectUptimeSubscription,
    ProjectUptimeSubscriptionMode,
    UptimeSubscription,
    UptimeSubscriptionRegion,
    headers_json_encoder,
)
from sentry.uptime.rdap.tasks import fetch_subscription_rdap_info
from sentry.uptime.subscriptions.regions import get_active_regions
from sentry.uptime.subscriptions.tasks import (
    create_remote_uptime_subscription,
    delete_remote_uptime_subscription,
)
from sentry.utils.outcomes import Outcome

logger = logging.getLogger(__name__)

UPTIME_SUBSCRIPTION_TYPE = "uptime_monitor"
MAX_AUTO_SUBSCRIPTIONS_PER_ORG = 1
MAX_MANUAL_SUBSCRIPTIONS_PER_ORG = 100


class MaxManualUptimeSubscriptionsReached(ValueError):
    pass


class UptimeMonitorNoSeatAvailable(Exception):
    """
    Indicates that the quotes system is unable to allocate a seat for the new
    uptime monitor.
    """

    result: SeatAssignmentResult | None
    """
    The assignment result. In rare cases may be None when there is a race
    condition and seat assignment is not accepted after passing the assignment
    check.
    """

    def __init__(self, result: SeatAssignmentResult | None) -> None:
        super().__init__()
        self.result = result


def retrieve_uptime_subscription(
    url: str,
    interval_seconds: int,
    timeout_ms: int,
    method: str,
    headers: Sequence[tuple[str, str]],
    body: str | None,
    trace_sampling: bool,
) -> UptimeSubscription | None:
    try:
        subscription = (
            UptimeSubscription.objects.filter(
                url=url,
                interval_seconds=interval_seconds,
                timeout_ms=timeout_ms,
                method=method,
                trace_sampling=trace_sampling,
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
    timeout_ms: int,
    method: str = "GET",
    headers: Sequence[tuple[str, str]] | None = None,
    body: str | None = None,
    trace_sampling: bool = False,
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

    subscription = retrieve_uptime_subscription(
        url, interval_seconds, timeout_ms, method, headers, body, trace_sampling
    )
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
                trace_sampling=trace_sampling,
            )
            created = True
        except IntegrityError:
            # Handle race condition where we tried to retrieve an existing subscription while it was being created
            subscription = retrieve_uptime_subscription(
                url, interval_seconds, timeout_ms, method, headers, body, trace_sampling
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
        created = True

    # Associate active regions with this subscription
    for region in get_active_regions():
        # If we add a region here we need to resend the subscriptions
        created |= UptimeSubscriptionRegion.objects.update_or_create(
            uptime_subscription=subscription,
            region_slug=region.slug,
            defaults={"mode": region.mode},
        )[1]

    if created:
        subscription.update(status=UptimeSubscription.Status.CREATING.value)
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
    environment: Environment | None,
    url: str,
    interval_seconds: int,
    timeout_ms: int,
    method: str = "GET",
    headers: Sequence[tuple[str, str]] | None = None,
    body: str | None = None,
    mode: ProjectUptimeSubscriptionMode = ProjectUptimeSubscriptionMode.MANUAL,
    status: int = ObjectStatus.ACTIVE,
    name: str = "",
    owner: Actor | None = None,
    trace_sampling: bool = False,
    override_manual_org_limit: bool = False,
) -> tuple[ProjectUptimeSubscription, bool]:
    """
    Links a project to an uptime subscription so that it can process results.
    """
    if mode == ProjectUptimeSubscriptionMode.MANUAL:
        manual_subscription_count = ProjectUptimeSubscription.objects.filter(
            project__organization=project.organization, mode=ProjectUptimeSubscriptionMode.MANUAL
        ).count()
        if (
            not override_manual_org_limit
            and manual_subscription_count >= MAX_MANUAL_SUBSCRIPTIONS_PER_ORG
        ):
            raise MaxManualUptimeSubscriptionsReached

    uptime_subscription = get_or_create_uptime_subscription(
        url=url,
        interval_seconds=interval_seconds,
        timeout_ms=timeout_ms,
        method=method,
        headers=headers,
        body=body,
        trace_sampling=trace_sampling,
    )
    owner_user_id = None
    owner_team_id = None
    if owner:
        if owner.is_user:
            owner_user_id = owner.id
        if owner.is_team:
            owner_team_id = owner.id
    uptime_monitor, created = ProjectUptimeSubscription.objects.get_or_create(
        project=project,
        environment=environment,
        uptime_subscription=uptime_subscription,
        mode=mode.value,
        name=name,
        owner_user_id=owner_user_id,
        owner_team_id=owner_team_id,
    )

    # Update status. This may have the side effect of removing or creating a
    # remote subscription. When a new monitor is created we will ensure seat
    # assignment, which may cause the monitor to be disabled if there are no
    # available seat assignments.
    match status:
        case ObjectStatus.ACTIVE:
            try:
                enable_project_uptime_subscription(uptime_monitor, ensure_assignment=created)
            except UptimeMonitorNoSeatAvailable:
                # No need to do anything if we failed to handle seat
                # assignment. The monitor will be created, but not enabled
                pass
        case ObjectStatus.DISABLED:
            disable_project_uptime_subscription(uptime_monitor)

    return uptime_monitor, created


def update_project_uptime_subscription(
    uptime_monitor: ProjectUptimeSubscription,
    environment: Environment | None,
    url: str,
    interval_seconds: int,
    timeout_ms: int,
    method: str,
    headers: Sequence[tuple[str, str]],
    body: str | None,
    name: str,
    owner: Actor | None,
    trace_sampling: bool,
    status: int = ObjectStatus.ACTIVE,
):
    """
    Links a project to an uptime subscription so that it can process results.
    """
    cur_uptime_subscription = uptime_monitor.uptime_subscription
    new_uptime_subscription = get_or_create_uptime_subscription(
        url=url,
        interval_seconds=interval_seconds,
        timeout_ms=timeout_ms,
        method=method,
        headers=headers,
        body=body,
        trace_sampling=trace_sampling,
    )

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
        environment=environment,
        uptime_subscription=new_uptime_subscription,
        name=name,
        # After an update, we always convert a subscription to manual mode
        mode=ProjectUptimeSubscriptionMode.MANUAL,
        owner_user_id=owner_user_id,
        owner_team_id=owner_team_id,
    )
    # If we changed any fields on the actual subscription we created a new subscription and associated it with this
    # uptime monitor. Check if the old subscription was orphaned due to this.
    remove_uptime_subscription_if_unused(cur_uptime_subscription)

    # Update status. This may have the side effect of removing or creating a
    # remote subscription. Will raise a UptimeMonitorNoSeatAvailable if seat
    # assignment fails.
    match status:
        case ObjectStatus.DISABLED:
            disable_project_uptime_subscription(uptime_monitor)
        case ObjectStatus.ACTIVE:
            enable_project_uptime_subscription(uptime_monitor)


def disable_project_uptime_subscription(uptime_monitor: ProjectUptimeSubscription):
    """
    Disables a project uptime subscription. If the uptime subscription no
    longer has any active project subscriptions the subscription itself will
    also be disabled.
    """
    if uptime_monitor.status == ObjectStatus.DISABLED:
        return

    uptime_monitor.update(status=ObjectStatus.DISABLED)
    quotas.backend.disable_seat(DataCategory.UPTIME, uptime_monitor)

    uptime_subscription = uptime_monitor.uptime_subscription

    # Are there any other project subscriptions associated to the subscription
    # that are NOT disabled?
    has_active_subscription = uptime_subscription.projectuptimesubscription_set.exclude(
        status=ObjectStatus.DISABLED
    ).exists()

    # All project subscriptions are disabled, we can disable the subscription
    # and remove the remote subscription.
    if not has_active_subscription:
        uptime_subscription.update(status=UptimeSubscription.Status.DISABLED.value)
        delete_remote_uptime_subscription.delay(uptime_subscription.id)


def enable_project_uptime_subscription(
    uptime_monitor: ProjectUptimeSubscription, ensure_assignment: bool = False
):
    """
    Enable a project uptime subscription. If the uptime subscription was
    also disabled it will be re-activated and the remote subscription will be
    published.

    This method will attempt seat assignment via the quotas system. If There
    are no available seats the monitor will be disabled and a
    `UptimeMonitorNoSeatAvailable` will be raised.

    By default if the monitor is already marked as ACTIVE this function is a
    no-op. Pass `ensure_assignment=True` to force seat assignment.
    """
    if not ensure_assignment and uptime_monitor.status != ObjectStatus.DISABLED:
        return

    seat_assignment = quotas.backend.check_assign_seat(DataCategory.UPTIME, uptime_monitor)
    if not seat_assignment.assignable:
        disable_project_uptime_subscription(uptime_monitor)
        raise UptimeMonitorNoSeatAvailable(seat_assignment)

    outcome = quotas.backend.assign_seat(DataCategory.UPTIME, uptime_monitor)
    if outcome != Outcome.ACCEPTED:
        # Race condition, we were unable to assign the seat even though the
        # earlier assignment check indicated assignability
        disable_project_uptime_subscription(uptime_monitor)
        raise UptimeMonitorNoSeatAvailable(None)

    uptime_monitor.update(status=ObjectStatus.ACTIVE)
    uptime_subscription = uptime_monitor.uptime_subscription

    # The subscription was disabled, it can be re-activated now
    if uptime_subscription.status == UptimeSubscription.Status.DISABLED.value:
        uptime_subscription.update(status=UptimeSubscription.Status.CREATING.value)
        create_remote_uptime_subscription.delay(uptime_subscription.id)


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
    quotas.backend.disable_seat(DataCategory.UPTIME, subscription)
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
