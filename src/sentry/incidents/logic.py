from __future__ import annotations

import bisect
from collections.abc import Collection
from datetime import datetime, timedelta
from re import Match
from typing import Any
from uuid import UUID

import sentry_sdk
from django.db import router, transaction
from django.db.models.signals import post_save
from django.utils import timezone as django_timezone

from sentry import analytics
from sentry.constants import ObjectStatus
from sentry.db.models.manager.base_query_set import BaseQuerySet
from sentry.discover.arithmetic import is_equation, parse_arithmetic, strip_equation
from sentry.incidents.events import IncidentCreatedEvent, IncidentStatusUpdatedEvent
from sentry.incidents.models.alert_rule import AlertRule
from sentry.incidents.models.incident import (
    Incident,
    IncidentProject,
    IncidentStatus,
    IncidentStatusMethod,
    IncidentType,
)
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.search.events.constants import (
    METRICS_LAYER_UNSUPPORTED_TRANSACTION_METRICS_FUNCTIONS,
    SPANS_METRICS_FUNCTIONS,
)
from sentry.search.events.fields import is_function, resolve_field
from sentry.snuba.dataset import Dataset
from sentry.snuba.metrics.naming_layer.mri import get_available_operations, is_mri, parse_mri
from sentry.snuba.models import QuerySubscription, SnubaQuery
from sentry.snuba.subscriptions import (
    bulk_disable_snuba_subscriptions,
    bulk_enable_snuba_subscriptions,
)
from sentry.users.services.user import RpcUser
from sentry.utils.snuba import is_measurement
from sentry.workflow_engine.models.detector import Detector


def create_incident(
    organization: Organization,
    incident_type: IncidentType,
    title: str,
    date_started: datetime,
    date_detected: datetime | None = None,
    detection_uuid: UUID | None = None,  # TODO: Probably remove detection_uuid?
    projects: Collection[Project] = (),
    user: RpcUser | None = None,
    alert_rule: AlertRule | None = None,
    subscription: QuerySubscription | None = None,
) -> Incident:
    if date_detected is None:
        date_detected = date_started

    with transaction.atomic(router.db_for_write(Incident)):
        incident = Incident.objects.create(
            organization=organization,
            detection_uuid=detection_uuid,
            status=IncidentStatus.OPEN.value,
            type=incident_type.value,
            title=title,
            date_started=date_started,
            date_detected=date_detected,
            alert_rule=alert_rule,
            subscription=subscription,
        )
        if projects:
            incident_projects = [
                IncidentProject(incident=incident, project=project) for project in projects
            ]
            IncidentProject.objects.bulk_create(incident_projects)
            # `bulk_create` doesn't send `post_save` signals, so we manually fire them here.
            for incident_project in incident_projects:
                post_save.send_robust(
                    sender=type(incident_project),
                    instance=incident_project,
                    created=True,
                )

        try:
            analytics.record(
                IncidentCreatedEvent(
                    incident_id=incident.id,
                    organization_id=incident.organization_id,
                    incident_type=incident_type.value,
                )
            )
        except Exception as e:
            sentry_sdk.capture_exception(e)

    return incident


def update_incident_status(
    incident: Incident,
    status: IncidentStatus,
    status_method: IncidentStatusMethod = IncidentStatusMethod.RULE_TRIGGERED,
    date_closed: datetime | None = None,
) -> Incident:
    """
    Updates the status of an Incident and records the status change in analytics.
    Closing sets the date closed; reopening clears it.
    """
    if incident.status == status.value:
        # If the status isn't actually changing just no-op.
        return incident
    with transaction.atomic(router.db_for_write(Incident)):
        prev_status = incident.status
        kwargs: dict[str, Any] = {
            "status": status.value,
            "status_method": status_method.value,
        }
        if status == IncidentStatus.CLOSED:
            kwargs["date_closed"] = date_closed if date_closed else django_timezone.now()
        elif status == IncidentStatus.OPEN:
            # If we're moving back out of closed status then unset the closed
            # date
            kwargs["date_closed"] = None

        incident.update(**kwargs)

        try:
            analytics.record(
                IncidentStatusUpdatedEvent(
                    incident_id=incident.id,
                    organization_id=incident.organization_id,
                    incident_type=incident.type,
                    prev_status=prev_status,
                    status=incident.status,
                )
            )
        except Exception as e:
            sentry_sdk.capture_exception(e)

        return incident


# Default values for `SnubaQuery.resolution`, in minutes.
DEFAULT_ALERT_RULE_RESOLUTION = 1
# Comparison alerts query twice (current + comparison window), so we scale
# resolution down to compensate for the increased query load.
DEFAULT_CMP_ALERT_RULE_RESOLUTION_MULTIPLIER = 2
DEFAULT_ALERT_RULE_WINDOW_TO_RESOLUTION = {
    30: 2,
    60: 3,
    90: 3,
    120: 3,
    240: 5,
    720: 5,
    1440: 15,
}
SORTED_TIMEWINDOWS = sorted(DEFAULT_ALERT_RULE_WINDOW_TO_RESOLUTION.keys())

# Temporary mapping of `Dataset` to `AlertRule.Type`. In the future, `Performance` will be
# able to be run on `METRICS` as well.
query_datasets_to_type = {
    Dataset.Events: SnubaQuery.Type.ERROR,
    Dataset.Transactions: SnubaQuery.Type.PERFORMANCE,
    Dataset.PerformanceMetrics: SnubaQuery.Type.PERFORMANCE,
    Dataset.Metrics: SnubaQuery.Type.CRASH_RATE,
    Dataset.EventsAnalyticsPlatform: SnubaQuery.Type.PERFORMANCE,
}


def get_alert_resolution(time_window: int, organization: Organization) -> timedelta:
    """
    Return the Snuba subscription evaluation interval for a given alert time window.

    Larger time windows don't need fine-grained resolution, so we map them to
    coarser buckets to reduce query load. See DEFAULT_ALERT_RULE_WINDOW_TO_RESOLUTION.

    :param time_window: The alert's aggregation window, in minutes.
    :param organization: The organization (reserved for future per-org overrides).
    :return: The evaluation interval as a timedelta.
    """
    index = bisect.bisect_right(SORTED_TIMEWINDOWS, time_window)

    if index == 0:
        minutes = DEFAULT_ALERT_RULE_RESOLUTION
    else:
        minutes = DEFAULT_ALERT_RULE_WINDOW_TO_RESOLUTION[SORTED_TIMEWINDOWS[index - 1]]

    return timedelta(minutes=minutes)


def enable_disable_subscriptions(
    query_subscriptions: BaseQuerySet[QuerySubscription], enabled: bool
) -> None:
    if enabled:
        bulk_enable_snuba_subscriptions(query_subscriptions)
    else:
        bulk_disable_snuba_subscriptions(query_subscriptions)


def update_detector_status(detector: Detector, enabled: bool) -> None:
    """
    Updates the status of a detector and the associated query subscriptions.

    This is used to toggle whether a metric Detector is allowed for the owning
    organization, and manages the associated subscription state.

    This is separate from Detector.enabled, which is for snoozing.
    """
    with transaction.atomic(router.db_for_write(Detector)):
        target_status = ObjectStatus.ACTIVE if enabled else ObjectStatus.DISABLED
        detector.update(status=target_status)

        query_subscriptions = QuerySubscription.objects.filter(
            id__in=[data_source.source_id for data_source in detector.data_sources.all()]
        )
        if query_subscriptions:
            enable_disable_subscriptions(query_subscriptions, enabled)
        # TODO: Determine whether there was work to be done, and return the result
        # as a boolean.


def update_detector(detector: Detector, enabled: bool) -> None:
    """
    Temporary alias for update_detector_status to ease cross-repo changes.
    """
    update_detector_status(detector, enabled)


# TODO: This is temporarily needed to support back and forth translations for snuba / frontend.
# Uses a function from discover to break the aggregate down into parts, and then compare the "field"
# to a list of accepted fields, or a list of fields we need to translate.
# This can be dropped once snuba can handle this aliasing.
SUPPORTED_COLUMNS = [
    "tags[sentry:user]",
    "tags[sentry:dist]",
    "tags[sentry:release]",
    "transaction.duration",
]
TRANSLATABLE_COLUMNS = {
    "user": "tags[sentry:user]",
    "dist": "tags[sentry:dist]",
    "release": "tags[sentry:release]",
}
INSIGHTS_FUNCTION_VALID_ARGS_MAP = {
    "http_response_rate": ["3", "4", "5"],
    "performance_score": [
        "measurements.score.lcp",
        "measurements.score.fcp",
        "measurements.score.inp",
        "measurements.score.cls",
        "measurements.score.ttfb",
        "measurements.score.total",
    ],
}
EAP_FUNCTIONS = [
    "count",
    "count_unique",
    "avg",
    "p50",
    "p75",
    "p90",
    "p95",
    "p99",
    "p100",
    "max",
    "min",
    "sum",
    "epm",
    "failure_count",
    "failure_rate",
    "eps",
    "apdex",
    "user_misery",
]


def get_column_from_aggregate(
    aggregate: str,
    allow_mri: bool,
    allow_eap: bool = False,
    match: Match[str] | None = None,
) -> str | None:
    # These functions exist as SnQLFunction definitions and are not supported in the older
    # logic for resolving functions. We parse these using `fields.is_function`, otherwise
    # they will fail using the old resolve_field logic.
    match = is_function(aggregate) if match is None else match
    if match and (
        match.group("function") in SPANS_METRICS_FUNCTIONS
        or match.group("function") in METRICS_LAYER_UNSUPPORTED_TRANSACTION_METRICS_FUNCTIONS
    ):
        return None if match.group("columns") == "" else match.group("columns")

    # Skip additional validation for EAP queries. They don't exist in the old logic.
    if match and match.group("function") in EAP_FUNCTIONS and allow_eap:
        return match.group("columns")

    if allow_mri:
        mri_column = _get_column_from_aggregate_with_mri(aggregate)
        # Only if the column was allowed, we return it, otherwise we fallback to the old logic.
        if mri_column:
            return mri_column

    function = resolve_field(aggregate)
    if function.aggregate is not None:
        return function.aggregate[1]

    return None


def _get_column_from_aggregate_with_mri(aggregate: str) -> str | None:
    match = is_function(aggregate)
    if match is None:
        return None

    function = match.group("function")
    columns = match.group("columns")

    parsed_mri = parse_mri(columns)
    if parsed_mri is None:
        return None

    available_ops = set(get_available_operations(parsed_mri))
    if function not in available_ops:
        return None

    return columns


def check_aggregate_column_support(
    aggregate: str, allow_mri: bool = False, allow_eap: bool = False
) -> bool:
    # TODO(ddm): remove `allow_mri` once the experimental feature flag is removed.
    if is_equation(aggregate):
        _, _, terms = parse_arithmetic(strip_equation(aggregate))
    else:
        terms = [aggregate]

    for term in terms:
        match = is_function(term)
        column = get_column_from_aggregate(term, allow_mri, allow_eap, match)
        function = match.group("function") if match else None
        if not (
            column is None
            or is_measurement(column)
            or column in SUPPORTED_COLUMNS
            or column in TRANSLATABLE_COLUMNS
            or (is_mri(column) and allow_mri)
            or (
                isinstance(function, str)
                and column in INSIGHTS_FUNCTION_VALID_ARGS_MAP.get(function, [])
            )
            or allow_eap
        ):
            return False
    return True


def translate_aggregate_field(
    aggregate: str,
    reverse: bool = False,
    allow_mri: bool = False,
    allow_eap: bool = False,
) -> str:
    column = get_column_from_aggregate(aggregate, allow_mri, allow_eap)
    if not reverse:
        if column in TRANSLATABLE_COLUMNS:
            return aggregate.replace(column, TRANSLATABLE_COLUMNS[column])
    else:
        if column is not None:
            for field, translated_field in TRANSLATABLE_COLUMNS.items():
                if translated_field == column:
                    return aggregate.replace(column, field)
    return aggregate
