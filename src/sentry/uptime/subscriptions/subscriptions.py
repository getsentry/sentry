import logging
from collections.abc import Sequence

from django.db import router, transaction
from sentry_kafka_schemas.schema_types.uptime_results_v1 import (
    CHECKSTATUS_FAILURE,
    CHECKSTATUS_SUCCESS,
)

from sentry import quotas
from sentry.constants import ObjectStatus
from sentry.deletions.models.scheduleddeletion import RegionScheduledDeletion
from sentry.issues.producer import PayloadType, produce_occurrence_to_kafka
from sentry.issues.status_change_message import StatusChangeMessage
from sentry.models.environment import Environment
from sentry.models.group import GroupStatus
from sentry.models.project import Project
from sentry.quotas.base import SeatAssignmentResult
from sentry.types.actor import Actor
from sentry.uptime.autodetect.url_extraction import extract_domain_parts
from sentry.uptime.models import (
    UptimeSubscription,
    UptimeSubscriptionRegion,
    get_uptime_subscription,
    load_regions_for_uptime_subscription,
)
from sentry.uptime.rdap.tasks import fetch_subscription_rdap_info
from sentry.uptime.subscriptions.regions import UptimeRegionWithMode, get_active_regions
from sentry.uptime.subscriptions.tasks import (
    create_remote_uptime_subscription,
    delete_remote_uptime_subscription,
    send_uptime_config_deletion,
    update_remote_uptime_subscription,
)
from sentry.uptime.types import (
    DATA_SOURCE_UPTIME_SUBSCRIPTION,
    DEFAULT_DOWNTIME_THRESHOLD,
    DEFAULT_RECOVERY_THRESHOLD,
    GROUP_TYPE_UPTIME_DOMAIN_CHECK_FAILURE,
    UptimeMonitorMode,
)
from sentry.uptime.utils import build_fingerprint, build_last_update_key, get_cluster
from sentry.utils.db import atomic_transaction
from sentry.utils.not_set import NOT_SET, NotSet, default_if_not_set
from sentry.utils.outcomes import Outcome
from sentry.workflow_engine.models import DataSource, DataSourceDetector, Detector
from sentry.workflow_engine.models.data_condition import Condition, DataCondition
from sentry.workflow_engine.models.data_condition_group import DataConditionGroup
from sentry.workflow_engine.types import DetectorPriorityLevel

logger = logging.getLogger(__name__)


UPTIME_SUBSCRIPTION_TYPE = "uptime_monitor"
MAX_AUTO_SUBSCRIPTIONS_PER_ORG = 1
MAX_MANUAL_SUBSCRIPTIONS_PER_ORG = 100
MAX_MONITORS_PER_DOMAIN = 100


def resolve_uptime_issue(detector: Detector) -> None:
    """
    Sends an update to the issue platform to resolve the uptime issue for this
    monitor.
    """
    status_change = StatusChangeMessage(
        fingerprint=build_fingerprint(detector),
        project_id=detector.project_id,
        new_status=GroupStatus.RESOLVED,
        new_substatus=None,
    )
    produce_occurrence_to_kafka(
        payload_type=PayloadType.STATUS_CHANGE,
        status_change=status_change,
    )


class MaxManualUptimeSubscriptionsReached(ValueError):
    pass


def check_uptime_subscription_limit(organization_id: int) -> None:
    """
    Check if adding a new manual uptime monitor would exceed the organization's limit.
    Raises MaxManualUptimeSubscriptionsReached if the limit would be exceeded.
    """
    manual_subscription_count = Detector.objects.filter(
        status=ObjectStatus.ACTIVE,
        enabled=True,
        type=GROUP_TYPE_UPTIME_DOMAIN_CHECK_FAILURE,
        project__organization_id=organization_id,
        config__mode=UptimeMonitorMode.MANUAL,
    ).count()

    if manual_subscription_count >= MAX_MANUAL_SUBSCRIPTIONS_PER_ORG:
        raise MaxManualUptimeSubscriptionsReached


class UptimeMonitorNoSeatAvailable(Exception):
    """
    Indicates that the quotes system is unable to allocate a seat for the new
    uptime monitor.
    """

    result: SeatAssignmentResult

    def __init__(self, result: SeatAssignmentResult) -> None:
        super().__init__()
        self.result = result


def create_uptime_subscription(
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

    # Associate active regions with this subscription
    for region_config in get_active_regions():
        UptimeSubscriptionRegion.objects.create(
            uptime_subscription=subscription,
            region_slug=region_config.slug,
            mode=region_config.mode,
        )

    def commit_tasks():
        create_remote_uptime_subscription.delay(subscription.id)
        fetch_subscription_rdap_info.delay(subscription.id)

    transaction.on_commit(commit_tasks, using=router.db_for_write(UptimeSubscription))
    return subscription


def update_uptime_subscription(
    subscription: UptimeSubscription,
    url: str | NotSet = NOT_SET,
    interval_seconds: int | NotSet = NOT_SET,
    timeout_ms: int | NotSet = NOT_SET,
    method: str | NotSet = NOT_SET,
    headers: Sequence[tuple[str, str]] | None | NotSet = NOT_SET,
    body: str | None | NotSet = NOT_SET,
    trace_sampling: bool | NotSet = NOT_SET,
):
    """
    Updates an existing uptime subscription. This updates the row in postgres, and fires a task that will send the
    config to the uptime check system.
    """
    url = default_if_not_set(subscription.url, url)
    # We extract the domain and suffix of the url here. This is used to prevent there being too many checks to a single
    # domain.
    result = extract_domain_parts(url)
    headers = default_if_not_set(subscription.headers, headers)
    if headers is None:
        headers = []

    subscription.update(
        status=UptimeSubscription.Status.UPDATING.value,
        url=url,
        url_domain=result.domain,
        url_domain_suffix=result.suffix,
        interval_seconds=default_if_not_set(subscription.interval_seconds, interval_seconds),
        timeout_ms=default_if_not_set(subscription.timeout_ms, timeout_ms),
        method=default_if_not_set(subscription.method, method),
        headers=headers,
        body=default_if_not_set(subscription.body, body),
        trace_sampling=default_if_not_set(subscription.trace_sampling, trace_sampling),
    )

    # Associate active regions with this subscription
    check_and_update_regions(subscription, load_regions_for_uptime_subscription(subscription.id))

    def commit_tasks():
        update_remote_uptime_subscription.delay(subscription.id)
        fetch_subscription_rdap_info.delay(subscription.id)

    transaction.on_commit(commit_tasks, using=router.db_for_write(UptimeSubscription))


def delete_uptime_subscription(uptime_subscription: UptimeSubscription):
    """
    Deletes an existing uptime subscription. This updates the row in postgres, and fires a task that will send the
    deletion to the external system and remove the row once successful.
    """
    uptime_subscription.update(status=UptimeSubscription.Status.DELETING.value)
    transaction.on_commit(
        lambda: delete_remote_uptime_subscription.delay(uptime_subscription.id),
        using=router.db_for_write(UptimeSubscription),
    )


def create_uptime_detector(
    project: Project,
    environment: Environment | None,
    url: str,
    interval_seconds: int,
    timeout_ms: int,
    method: str = "GET",
    headers: Sequence[tuple[str, str]] | None = None,
    body: str | None = None,
    mode: UptimeMonitorMode = UptimeMonitorMode.MANUAL,
    status: int = ObjectStatus.ACTIVE,
    name: str = "",
    owner: Actor | None = None,
    trace_sampling: bool = False,
    override_manual_org_limit: bool = False,
    recovery_threshold: int = DEFAULT_RECOVERY_THRESHOLD,
    downtime_threshold: int = DEFAULT_DOWNTIME_THRESHOLD,
) -> Detector:
    """
    Creates an UptimeSubscription and associated Detector
    """
    if mode == UptimeMonitorMode.MANUAL:
        # Once a user has created a subscription manually, make sure we disable all autodetection, and remove any
        # onboarding monitors
        if project.organization.get_option("sentry:uptime_autodetection", False):
            project.organization.update_option("sentry:uptime_autodetection", False)
            for detector in get_auto_monitored_detectors_for_project(
                project, modes=[UptimeMonitorMode.AUTO_DETECTED_ONBOARDING]
            ):
                delete_uptime_detector(detector)

        if not override_manual_org_limit:
            check_uptime_subscription_limit(project.organization_id)

    with atomic_transaction(
        using=(
            router.db_for_write(UptimeSubscription),
            router.db_for_write(DataSource),
            router.db_for_write(DataCondition),
            router.db_for_write(DataConditionGroup),
            router.db_for_write(DataSourceDetector),
            router.db_for_write(Detector),
        )
    ):
        uptime_subscription = create_uptime_subscription(
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

        data_source = DataSource.objects.create(
            type=DATA_SOURCE_UPTIME_SUBSCRIPTION,
            organization=project.organization,
            source_id=str(uptime_subscription.id),
        )
        condition_group = DataConditionGroup.objects.create(
            organization=project.organization,
        )
        DataCondition.objects.create(
            comparison=CHECKSTATUS_FAILURE,
            type=Condition.EQUAL,
            condition_result=DetectorPriorityLevel.HIGH,
            condition_group=condition_group,
        )
        DataCondition.objects.create(
            comparison=CHECKSTATUS_SUCCESS,
            type=Condition.EQUAL,
            condition_result=DetectorPriorityLevel.OK,
            condition_group=condition_group,
        )
        env = environment.name if environment else None
        detector = Detector.objects.create(
            type=GROUP_TYPE_UPTIME_DOMAIN_CHECK_FAILURE,
            project=project,
            name=name,
            owner_user_id=owner_user_id,
            owner_team_id=owner_team_id,
            config={
                "environment": env,
                "mode": mode,
                "recovery_threshold": recovery_threshold,
                "downtime_threshold": downtime_threshold,
            },
            workflow_condition_group=condition_group,
        )
        DataSourceDetector.objects.create(data_source=data_source, detector=detector)

        # Don't consume a seat if we're still in onboarding mode
        if mode != UptimeMonitorMode.AUTO_DETECTED_ONBOARDING:
            # Update status. This may have the side effect of removing or creating a
            # remote subscription. When a new monitor is created we will ensure seat
            # assignment, which may cause the monitor to be disabled if there are no
            # available seat assignments.
            match status:
                case ObjectStatus.ACTIVE:
                    try:
                        enable_uptime_detector(detector, ensure_assignment=True)
                    except UptimeMonitorNoSeatAvailable:
                        # No need to do anything if we failed to handle seat
                        # assignment. The monitor will be created, but not enabled
                        pass
                case ObjectStatus.DISABLED:
                    disable_uptime_detector(detector)

    # Detector may have been updated as part of
    # {enable,disable}_uptime_detector
    detector.refresh_from_db()

    return detector


def update_uptime_detector(
    detector: Detector,
    environment: Environment | None | NotSet = NOT_SET,
    url: str | NotSet = NOT_SET,
    interval_seconds: int | NotSet = NOT_SET,
    timeout_ms: int | NotSet = NOT_SET,
    method: str | NotSet = NOT_SET,
    headers: Sequence[tuple[str, str]] | NotSet = NOT_SET,
    body: str | None | NotSet = NOT_SET,
    name: str | NotSet = NOT_SET,
    owner: Actor | None | NotSet = NOT_SET,
    trace_sampling: bool | NotSet = NOT_SET,
    status: int = ObjectStatus.ACTIVE,
    mode: UptimeMonitorMode = UptimeMonitorMode.MANUAL,
    ensure_assignment: bool = False,
    recovery_threshold: int | NotSet = NOT_SET,
    downtime_threshold: int | NotSet = NOT_SET,
):
    """
    Updates a uptime detector and its associated uptime subscription.
    """

    with atomic_transaction(
        using=(
            router.db_for_write(UptimeSubscription),
            router.db_for_write(Detector),
        )
    ):
        uptime_subscription = get_uptime_subscription(detector)
        update_uptime_subscription(
            uptime_subscription,
            url=url,
            interval_seconds=interval_seconds,
            timeout_ms=timeout_ms,
            method=method,
            headers=headers,
            body=body,
            trace_sampling=trace_sampling,
        )

        owner_user_id = detector.owner_user_id
        owner_team_id = detector.owner_team_id
        if owner and owner is not NOT_SET:
            if owner.is_user:
                owner_user_id = owner.id
                owner_team_id = None
            if owner.is_team:
                owner_team_id = owner.id
                owner_user_id = None

        current_env = detector.config.get("environment")
        if current_env:
            current_env_obj = Environment.get_or_create(detector.project, current_env)
        else:
            current_env_obj = None
        env = default_if_not_set(current_env_obj, environment)

        detector.update(
            name=default_if_not_set(detector.name, name),
            owner_user_id=owner_user_id,
            owner_team_id=owner_team_id,
            config={
                "mode": mode,
                "environment": env.name if env else None,
                "recovery_threshold": default_if_not_set(
                    detector.config["recovery_threshold"],
                    recovery_threshold,
                ),
                "downtime_threshold": default_if_not_set(
                    detector.config["downtime_threshold"],
                    downtime_threshold,
                ),
            },
        )

        # Don't consume a seat if we're still in onboarding mode
        if mode != UptimeMonitorMode.AUTO_DETECTED_ONBOARDING:
            # Update status. This may have the side effect of removing or creating a
            # remote subscription. Will raise a UptimeMonitorNoSeatAvailable if seat
            # assignment fails.
            match status:
                case ObjectStatus.DISABLED:
                    disable_uptime_detector(detector)
                case ObjectStatus.ACTIVE:
                    enable_uptime_detector(detector, ensure_assignment=ensure_assignment)

    # Detector may have been updated as part of
    # {enable,disable}_uptime_detector
    detector.refresh_from_db()


def disable_uptime_detector(detector: Detector, skip_quotas: bool = False):
    """
    Disables a uptime detector. If the UptimeSubscription no longer has any active
    detectors, it will also be disabled.
    """
    with atomic_transaction(
        using=(
            router.db_for_write(UptimeSubscription),
            router.db_for_write(Detector),
        )
    ):
        uptime_subscription: UptimeSubscription = get_uptime_subscription(detector)

        if not detector.enabled:
            return

        detector_state = detector.detectorstate_set.first()
        if detector_state and detector_state.is_triggered:
            # Resolve the issue so that we don't see it in the ui anymore
            resolve_uptime_issue(detector)

            # We set the status back to ok here so that if we re-enable we'll
            # start from a good state
            detector_state.update(state=DetectorPriorityLevel.OK, is_triggered=False)

        cluster = get_cluster()
        last_update_key = build_last_update_key(detector)
        cluster.delete(last_update_key)

        detector.update(enabled=False)

        if not skip_quotas:
            quotas.backend.disable_seat(seat_object=detector)

        # Are there any other detectors associated to the subscription
        # that are still enabled?
        has_active_subscription = Detector.objects.filter(
            data_sources__source_id=str(uptime_subscription.id),
            enabled=True,
            status=ObjectStatus.ACTIVE,
        ).exists()

        # All project subscriptions are disabled, we can disable the subscription
        # and remove the remote subscription.
        if not has_active_subscription:
            uptime_subscription.update(status=UptimeSubscription.Status.DISABLED.value)
            delete_remote_uptime_subscription.delay(uptime_subscription.id)


def ensure_uptime_seat(detector: Detector) -> None:
    """
    Ensures that a billing seat is assigned for the uptime detector.

    Raises UptimeMonitorNoSeatAvailable if no seats are available.
    """
    outcome = quotas.backend.assign_seat(seat_object=detector)
    if outcome != Outcome.ACCEPTED:
        result = quotas.backend.check_assign_seat(seat_object=detector)
        raise UptimeMonitorNoSeatAvailable(result)


def enable_uptime_detector(
    detector: Detector, ensure_assignment: bool = False, skip_quotas: bool = False
):
    """
    Enable a uptime detector. If the uptime subscription was also disabled it
    will be re-activated and the remote subscription will be published.

    This method will attempt seat assignment via the quotas system. If There
    are no available seats the monitor will be disabled and a
    `UptimeMonitorNoSeatAvailable` will be raised.

    By default if the detector is already marked as enabled this function is a
    no-op. Pass `ensure_assignment=True` to force seat assignment.
    """
    if not ensure_assignment and detector.enabled:
        return

    if not skip_quotas:
        try:
            ensure_uptime_seat(detector)
        except UptimeMonitorNoSeatAvailable:
            disable_uptime_detector(detector, skip_quotas=True)
            raise

    uptime_subscription: UptimeSubscription = get_uptime_subscription(detector)
    detector.update(enabled=True)

    # The subscription was disabled, it can be re-activated now
    if uptime_subscription.status == UptimeSubscription.Status.DISABLED.value:
        uptime_subscription.update(status=UptimeSubscription.Status.CREATING.value)

        transaction.on_commit(
            lambda: create_remote_uptime_subscription.delay(uptime_subscription.id),
            using=router.db_for_write(UptimeSubscription),
        )


def remove_uptime_seat(detector: Detector):
    quotas.backend.remove_seat(seat_object=detector)


def delete_uptime_detector(detector: Detector):
    uptime_subscription = get_uptime_subscription(detector)

    remove_uptime_seat(detector)
    detector.update(status=ObjectStatus.PENDING_DELETION)
    RegionScheduledDeletion.schedule(detector, days=0)
    delete_uptime_subscription(uptime_subscription)


def is_url_auto_monitored_for_project(project: Project, url: str) -> bool:
    auto_detected_subscription_ids = list(
        Detector.objects.filter(
            status=ObjectStatus.ACTIVE,
            type=GROUP_TYPE_UPTIME_DOMAIN_CHECK_FAILURE,
            project=project,
            config__mode__in=(
                UptimeMonitorMode.AUTO_DETECTED_ONBOARDING.value,
                UptimeMonitorMode.AUTO_DETECTED_ACTIVE.value,
            ),
        )
        .select_related("data_sources")
        .values_list("data_sources__source_id", flat=True)
    )

    return UptimeSubscription.objects.filter(
        id__in=auto_detected_subscription_ids,
        url=url,
    ).exists()


def get_auto_monitored_detectors_for_project(
    project: Project,
    modes: Sequence[UptimeMonitorMode] | None = None,
) -> list[Detector]:
    if modes is None:
        modes = [
            UptimeMonitorMode.AUTO_DETECTED_ONBOARDING,
            UptimeMonitorMode.AUTO_DETECTED_ACTIVE,
        ]
    return list(
        Detector.objects.filter(
            type=GROUP_TYPE_UPTIME_DOMAIN_CHECK_FAILURE, project=project, config__mode__in=modes
        )
    )


def check_and_update_regions(
    subscription: UptimeSubscription,
    regions: list[UptimeSubscriptionRegion],
) -> bool:
    """
    This method will check if regions have been added or removed from our region configuration,
    and updates regions associated with this uptime subscription to reflect the new state.
    """
    subscription_region_modes = {
        UptimeRegionWithMode(r.region_slug, UptimeSubscriptionRegion.RegionMode(r.mode))
        for r in regions
    }
    active_regions = set(get_active_regions())
    if subscription_region_modes == active_regions:
        # Regions haven't changed, exit early.
        return False

    new_or_updated_regions = active_regions - subscription_region_modes
    removed_regions = {srm.slug for srm in subscription_region_modes} - {
        ar.slug for ar in active_regions
    }
    for region in new_or_updated_regions:
        UptimeSubscriptionRegion.objects.update_or_create(
            uptime_subscription=subscription,
            region_slug=region.slug,
            defaults={"mode": region.mode},
        )

    if removed_regions:
        for deleted_region in UptimeSubscriptionRegion.objects.filter(
            uptime_subscription=subscription, region_slug__in=removed_regions
        ):
            if subscription.subscription_id:
                # We need to explicitly send deletes here before we remove the region
                send_uptime_config_deletion(
                    deleted_region.region_slug, subscription.subscription_id
                )
            deleted_region.delete()
    return True


class MaxUrlsForDomainReachedException(Exception):
    def __init__(self, domain, suffix, max_urls):
        self.domain = domain
        self.suffix = suffix
        self.max_urls = max_urls


def check_url_limits(url):
    """
    Determines if a URL's domain has reached the global maximum (MAX_MONITORS_PER_DOMAIN).
    In the case that it has a `MaxUrlsForDomainReachedException` will be raised.
    """
    url_parts = extract_domain_parts(url)
    existing_count = UptimeSubscription.objects.filter(
        url_domain=url_parts.domain,
        url_domain_suffix=url_parts.suffix,
    ).count()

    if existing_count >= MAX_MONITORS_PER_DOMAIN:
        raise MaxUrlsForDomainReachedException(
            url_parts.domain, url_parts.suffix, MAX_MONITORS_PER_DOMAIN
        )
