from __future__ import annotations

import bisect
import logging
from collections.abc import Collection, Iterable, Mapping, Sequence
from copy import deepcopy
from dataclasses import dataclass, replace
from datetime import datetime, timedelta, timezone
from enum import Enum, auto
from typing import TYPE_CHECKING, Any, TypedDict
from uuid import UUID, uuid4

from django.db import router, transaction
from django.db.models import QuerySet
from django.db.models.signals import post_save
from django.forms import ValidationError
from django.utils import timezone as django_timezone
from snuba_sdk import Column, Condition, Limit, Op

from sentry import analytics, audit_log, features, quotas
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.auth.access import SystemAccess
from sentry.constants import CRASH_RATE_ALERT_AGGREGATE_ALIAS, ObjectStatus
from sentry.db.models import Model
from sentry.deletions.models.scheduleddeletion import RegionScheduledDeletion
from sentry.incidents import tasks
from sentry.incidents.models.alert_rule import (
    AlertRule,
    AlertRuleActivity,
    AlertRuleActivityType,
    AlertRuleDetectionType,
    AlertRuleMonitorTypeInt,
    AlertRuleProjects,
    AlertRuleSeasonality,
    AlertRuleSensitivity,
    AlertRuleStatus,
    AlertRuleThresholdType,
    AlertRuleTrigger,
    AlertRuleTriggerAction,
)
from sentry.incidents.models.alert_rule_activations import (
    AlertRuleActivationCondition,
    AlertRuleActivations,
)
from sentry.incidents.models.incident import (
    Incident,
    IncidentActivity,
    IncidentActivityType,
    IncidentProject,
    IncidentStatus,
    IncidentStatusMethod,
    IncidentSubscription,
    IncidentTrigger,
    IncidentType,
    TriggerStatus,
)
from sentry.integrations.services.integration import RpcIntegration, integration_service
from sentry.models.environment import Environment
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.notifications.models.notificationaction import ActionService, ActionTarget
from sentry.relay.config.metric_extraction import on_demand_metrics_feature_flags
from sentry.search.eap.types import SearchResolverConfig
from sentry.search.events.builder.base import BaseQueryBuilder
from sentry.search.events.constants import (
    METRICS_LAYER_UNSUPPORTED_TRANSACTION_METRICS_FUNCTIONS,
    SPANS_METRICS_FUNCTIONS,
)
from sentry.search.events.fields import is_function, resolve_field
from sentry.search.events.types import SnubaParams
from sentry.seer.anomaly_detection.delete_rule import delete_rule_in_seer
from sentry.seer.anomaly_detection.store_data import send_new_rule_data, update_rule_data
from sentry.sentry_apps.services.app import RpcSentryAppInstallation, app_service
from sentry.shared_integrations.exceptions import (
    ApiTimeoutError,
    DuplicateDisplayNameError,
    IntegrationError,
)
from sentry.snuba import spans_rpc
from sentry.snuba.dataset import Dataset, EntityKey
from sentry.snuba.entity_subscription import (
    ENTITY_TIME_COLUMNS,
    EntitySubscription,
    get_entity_from_query_builder,
    get_entity_key_from_query_builder,
    get_entity_subscription_from_snuba_query,
)
from sentry.snuba.metrics.extraction import should_use_on_demand_metrics
from sentry.snuba.metrics.naming_layer.mri import get_available_operations, is_mri, parse_mri
from sentry.snuba.models import QuerySubscription, SnubaQuery, SnubaQueryEventType
from sentry.snuba.referrer import Referrer
from sentry.snuba.subscriptions import (
    bulk_delete_snuba_subscriptions,
    bulk_disable_snuba_subscriptions,
    bulk_enable_snuba_subscriptions,
    create_snuba_query,
    update_snuba_query,
)
from sentry.tasks.relay import schedule_invalidate_project_config
from sentry.types.actor import Actor
from sentry.users.models.user import User
from sentry.users.services.user import RpcUser
from sentry.utils import metrics
from sentry.utils.audit import create_audit_entry_from_user
from sentry.utils.snuba import is_measurement

if TYPE_CHECKING:
    from sentry.incidents.utils.types import AlertRuleActivationConditionType


# We can return an incident as "windowed" which returns a range of points around the start of the incident
# It attempts to center the start of the incident, only showing earlier data if there isn't enough time
# after the incident started to display the correct start date.
WINDOWED_STATS_DATA_POINTS = 200


class NotSet(Enum):
    TOKEN = auto()


NOT_SET = NotSet.TOKEN

CRITICAL_TRIGGER_LABEL = "critical"
WARNING_TRIGGER_LABEL = "warning"
DYNAMIC_TIME_WINDOWS = {5, 15, 30, 60}
DYNAMIC_TIME_WINDOWS_SECONDS = {window * 60 for window in DYNAMIC_TIME_WINDOWS}
INVALID_TIME_WINDOW = f"Invalid time window for dynamic alert (valid windows are {', '.join(map(str, DYNAMIC_TIME_WINDOWS))} minutes)"
INVALID_ALERT_THRESHOLD = "Dynamic alerts cannot have a nonzero alert threshold"

logger = logging.getLogger(__name__)


class AlreadyDeletedError(Exception):
    pass


class InvalidTriggerActionError(Exception):
    pass


class ChannelLookupTimeoutError(Exception):
    pass


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
    activation: AlertRuleActivations | None = None,
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
            activation=activation,
            subscription=subscription,
        )
        if projects:
            incident_projects = [
                IncidentProject(incident=incident, project=project) for project in projects
            ]
            IncidentProject.objects.bulk_create(incident_projects)
            # `bulk_create` doesn't send `post_save` signals, so we manually fire them here.
            for incident_project in incident_projects:
                post_save.send(
                    sender=type(incident_project), instance=incident_project, created=True
                )

        create_incident_activity(
            incident, IncidentActivityType.DETECTED, user=user, date_added=date_started
        )
        create_incident_activity(incident, IncidentActivityType.CREATED, user=user)
        analytics.record(
            "incident.created",
            incident_id=incident.id,
            organization_id=incident.organization_id,
            incident_type=incident_type.value,
        )

    return incident


def update_incident_status(
    incident: Incident,
    status: IncidentStatus,
    status_method: IncidentStatusMethod = IncidentStatusMethod.RULE_TRIGGERED,
    date_closed: datetime | None = None,
) -> Incident:
    """
    Updates the status of an Incident and write an IncidentActivity row to log
    the change. When the status is CLOSED we also set the date closed to the
    current time and take a snapshot of the current incident state.
    """
    if incident.status == status.value:
        # If the status isn't actually changing just no-op.
        return incident
    with transaction.atomic(router.db_for_write(Incident)):
        create_incident_activity(
            incident,
            IncidentActivityType.STATUS_CHANGE,
            value=status.value,
            previous_value=incident.status,
        )

        prev_status = incident.status
        kwargs: dict[str, Any] = {"status": status.value, "status_method": status_method.value}
        if status == IncidentStatus.CLOSED:
            kwargs["date_closed"] = date_closed if date_closed else django_timezone.now()
        elif status == IncidentStatus.OPEN:
            # If we're moving back out of closed status then unset the closed
            # date
            kwargs["date_closed"] = None

        incident.update(**kwargs)

        analytics.record(
            "incident.status_change",
            incident_id=incident.id,
            organization_id=incident.organization_id,
            incident_type=incident.type,
            prev_status=prev_status,
            status=incident.status,
        )

        if status == IncidentStatus.CLOSED and (
            status_method == IncidentStatusMethod.MANUAL
            or status_method == IncidentStatusMethod.RULE_UPDATED
        ):
            _trigger_incident_triggers(incident)

        return incident


@transaction.atomic(router.db_for_write(Incident))
def create_incident_activity(
    incident: Incident,
    activity_type: IncidentActivityType,
    user: RpcUser | User | None = None,
    value: str | int | None = None,
    previous_value: str | int | None = None,
    mentioned_user_ids: Collection[int] = (),
    date_added: datetime | None = None,
) -> IncidentActivity:
    value = str(value) if value is not None else None
    previous_value = str(previous_value) if previous_value is not None else None
    kwargs = {}
    if date_added:
        kwargs["date_added"] = date_added
    activity = IncidentActivity.objects.create(
        incident=incident,
        type=activity_type.value,
        user_id=user.id if user else None,
        value=value,
        previous_value=previous_value,
        notification_uuid=uuid4(),
        **kwargs,
    )

    if mentioned_user_ids:
        user_ids_to_subscribe = set(mentioned_user_ids) - set(
            IncidentSubscription.objects.filter(
                incident=incident, user_id__in=mentioned_user_ids
            ).values_list("user_id", flat=True)
        )
        if user_ids_to_subscribe:
            IncidentSubscription.objects.bulk_create(
                [
                    IncidentSubscription(incident=incident, user_id=mentioned_user_id)
                    for mentioned_user_id in user_ids_to_subscribe
                ]
            )
    return activity


def _unpack_snuba_query(alert_rule: AlertRule) -> SnubaQuery:
    snuba_query = alert_rule.snuba_query
    if snuba_query is None:
        raise ValueError("The alert rule must have a non-null snuba_query")
    return snuba_query


def _unpack_organization(alert_rule: AlertRule) -> Organization:
    organization = alert_rule.organization
    if organization is None:
        raise ValueError("The alert rule must have a non-null organization")
    return organization


def _build_incident_query_builder(
    incident: Incident,
    entity_subscription: EntitySubscription,
    start: datetime | None = None,
    end: datetime | None = None,
    windowed_stats: bool = False,
) -> BaseQueryBuilder:
    snuba_query = _unpack_snuba_query(incident.alert_rule)
    start, end = _calculate_incident_time_range(incident, start, end, windowed_stats=windowed_stats)
    project_ids = list(
        IncidentProject.objects.filter(incident=incident).values_list("project_id", flat=True)
    )
    query_builder = entity_subscription.build_query_builder(
        query=snuba_query.query,
        project_ids=project_ids,
        environment=snuba_query.environment,
        params={
            "organization_id": incident.organization_id,
            "project_id": project_ids,
            "start": start,
            "end": end,
        },
    )
    for i, column in enumerate(query_builder.columns):
        if column.alias == CRASH_RATE_ALERT_AGGREGATE_ALIAS:
            query_builder.columns[i] = replace(column, alias="count")
    entity_key = get_entity_key_from_query_builder(query_builder)
    time_col = ENTITY_TIME_COLUMNS[entity_key]
    entity = get_entity_from_query_builder(query_builder)
    query_builder.add_conditions(
        [
            Condition(Column(time_col, entity=entity), Op.GTE, start),
            Condition(Column(time_col, entity=entity), Op.LT, end),
        ]
    )
    query_builder.limit = Limit(10000)
    return query_builder


def _calculate_incident_time_range(
    incident: Incident,
    start_arg: datetime | None = None,
    end_arg: datetime | None = None,
    windowed_stats: bool = False,
) -> tuple[datetime, datetime]:
    snuba_query = _unpack_snuba_query(incident.alert_rule)
    time_window = snuba_query.time_window if incident.alert_rule is not None else 60
    time_window_delta = timedelta(seconds=time_window)
    start = (incident.date_started - time_window_delta) if start_arg is None else start_arg
    end = (incident.current_end_date + time_window_delta) if end_arg is None else end_arg
    if windowed_stats:
        now = django_timezone.now()
        end = start + timedelta(seconds=time_window * (WINDOWED_STATS_DATA_POINTS / 2))
        start = start - timedelta(seconds=time_window * (WINDOWED_STATS_DATA_POINTS / 2))
        if end > now:
            end = now

            # If the incident ended already, 'now' could be greater than we'd like
            # which would result in showing too many data points after an incident ended.
            # This depends on when the task to process snapshots runs.
            # To resolve that, we ensure that the end is never greater than the date
            # an incident ended + the smaller of time_window*10 or 10 days.
            latest_end_date = incident.current_end_date + min(
                timedelta(seconds=time_window * 10), timedelta(days=10)
            )
            end = min(end, latest_end_date)

            start = end - timedelta(seconds=time_window * WINDOWED_STATS_DATA_POINTS)

    retention = quotas.backend.get_event_retention(organization=incident.organization) or 90
    start = max(
        start.replace(tzinfo=timezone.utc),
        datetime.now(timezone.utc) - timedelta(days=retention),
    )
    end = max(start, end.replace(tzinfo=timezone.utc))

    return start, end


def get_incident_aggregates(
    incident: Incident,
    start: datetime | None = None,
    end: datetime | None = None,
    windowed_stats: bool = False,
) -> dict[str, float | int]:
    """
    Calculates aggregate stats across the life of an incident, or the provided range.
    """
    snuba_query = _unpack_snuba_query(incident.alert_rule)
    entity_subscription = get_entity_subscription_from_snuba_query(
        snuba_query,
        incident.organization_id,
    )
    if entity_subscription.dataset == Dataset.EventsAnalyticsPlatform:
        start, end = _calculate_incident_time_range(
            incident, start, end, windowed_stats=windowed_stats
        )

        project_ids = list(
            IncidentProject.objects.filter(incident=incident).values_list("project_id", flat=True)
        )

        params = SnubaParams(
            environments=[snuba_query.environment],
            projects=[Project.objects.get_from_cache(id=project_id) for project_id in project_ids],
            organization=Organization.objects.get_from_cache(id=incident.organization_id),
            start=start,
            end=end,
        )

        try:
            results = spans_rpc.run_table_query(
                params,
                query_string=snuba_query.query,
                selected_columns=[entity_subscription.aggregate],
                orderby=None,
                offset=0,
                limit=1,
                referrer=Referrer.API_ALERTS_ALERT_RULE_CHART.value,
                config=SearchResolverConfig(
                    auto_fields=True,
                ),
            )

        except Exception:
            metrics.incr(
                "incidents.get_incident_aggregates.snql.query.error",
                tags={
                    "dataset": snuba_query.dataset,
                    "entity": EntityKey.EAPSpans.value,
                },
            )
            raise
    else:
        query_builder = _build_incident_query_builder(
            incident, entity_subscription, start, end, windowed_stats
        )
        try:
            results = query_builder.run_query(referrer="incidents.get_incident_aggregates")
        except Exception:
            metrics.incr(
                "incidents.get_incident_aggregates.snql.query.error",
                tags={
                    "dataset": snuba_query.dataset,
                    "entity": get_entity_key_from_query_builder(query_builder).value,
                },
            )
            raise

    aggregated_result = entity_subscription.aggregate_query_results(results["data"], alias="count")
    return aggregated_result[0]


def unsubscribe_from_incident(incident: Incident, user_id: int) -> None:
    IncidentSubscription.objects.filter(incident=incident, user_id=user_id).delete()


def get_incident_subscribers(incident: Incident) -> Iterable[IncidentSubscription]:
    return IncidentSubscription.objects.filter(incident=incident)


def get_incident_activity(incident: Incident) -> Iterable[IncidentActivity]:
    return IncidentActivity.objects.filter(incident=incident).select_related("incident")


class AlertRuleNameAlreadyUsedError(Exception):
    pass


# Default values for `SnubaQuery.resolution`, in minutes.
DEFAULT_ALERT_RULE_RESOLUTION = 1
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


def get_alert_resolution(time_window: int, organization: Organization) -> int:
    index = bisect.bisect_right(SORTED_TIMEWINDOWS, time_window)

    if index == 0:
        return DEFAULT_ALERT_RULE_RESOLUTION

    return DEFAULT_ALERT_RULE_WINDOW_TO_RESOLUTION[SORTED_TIMEWINDOWS[index - 1]]


class _OwnerKwargs(TypedDict):
    user_id: int | None
    team_id: int | None


def _owner_kwargs_from_actor(actor: Actor | None) -> _OwnerKwargs:
    if actor and actor.is_user:
        return _OwnerKwargs(user_id=actor.id, team_id=None)
    if actor and actor.is_team:
        return _OwnerKwargs(team_id=actor.id, user_id=None)
    return _OwnerKwargs(user_id=None, team_id=None)


def create_alert_rule(
    organization: Organization,
    projects: Sequence[Project],
    name: str,
    query: str,
    aggregate: str,
    time_window: int,
    threshold_type: AlertRuleThresholdType,
    threshold_period: int,
    owner: Actor | None = None,
    resolve_threshold: int | float | None = None,
    environment: Environment | None = None,
    query_type: SnubaQuery.Type = SnubaQuery.Type.ERROR,
    dataset: Dataset = Dataset.Events,
    user: RpcUser | None = None,
    event_types: Collection[SnubaQueryEventType.EventType] = (),
    comparison_delta: int | None = None,
    monitor_type: AlertRuleMonitorTypeInt = AlertRuleMonitorTypeInt.CONTINUOUS,
    activation_condition: AlertRuleActivationConditionType | None = None,
    description: str | None = None,
    sensitivity: AlertRuleSensitivity | None = None,
    seasonality: AlertRuleSeasonality | None = None,
    detection_type: AlertRuleDetectionType = AlertRuleDetectionType.STATIC,
    **kwargs: Any,
) -> AlertRule:
    """
    Creates an alert rule for an organization.

    :param organization:
    :param projects: A list of projects to subscribe to the rule
    :param name: Name for the alert rule. This will be used as part of the
    incident name, and must be unique per project
    :param owner: Actor (sentry.types.actor.Actor) or None
    :param query: An event search query to subscribe to and monitor for alerts
    :param aggregate: A string representing the aggregate used in this alert rule
    :param time_window: Time period to aggregate over, in minutes
    :param environment: An optional environment that this rule applies to
    :param threshold_type: An AlertRuleThresholdType
    :param threshold_period: How many update periods the value of the
    subscription needs to exceed the threshold before triggering
    :param resolve_threshold: Optional value that the subscription needs to reach to
    resolve the alert
    :param query_type: The SnubaQuery.Type of the query
    :param dataset: The dataset that this query will be executed on
    :param event_types: List of `EventType` that this alert will be related to
    :param comparison_delta: An optional int representing the time delta to use to determine the
    comparison period. In minutes.
    :param sensitivity: An AlertRuleSensitivity that specifies sensitivity of anomaly detection alerts
    :param seasonality: An AlertRuleSeasonality that specifies seasonality of anomaly detection alerts
    :param detection_type: the type of metric alert; defaults to AlertRuleDetectionType.STATIC

    :return: The created `AlertRule`
    """
    has_anomaly_detection = features.has(
        "organizations:anomaly-detection-alerts", organization
    ) and features.has("organizations:anomaly-detection-rollout", organization)

    if detection_type == AlertRuleDetectionType.DYNAMIC.value and not has_anomaly_detection:
        raise ResourceDoesNotExist("Your organization does not have access to this feature.")

    if monitor_type == AlertRuleMonitorTypeInt.ACTIVATED and not activation_condition:
        raise ValidationError("Activation condition required for activated alert rule")

    if detection_type == AlertRuleDetectionType.DYNAMIC:
        resolution = time_window
        # NOTE: we hardcode seasonality for EA
        seasonality = AlertRuleSeasonality.AUTO
        if not sensitivity:
            raise ValidationError("Dynamic alerts require a sensitivity level")
        if time_window not in DYNAMIC_TIME_WINDOWS:
            raise ValidationError(INVALID_TIME_WINDOW)
        if "is:unresolved" in query:
            raise ValidationError("Dynamic alerts do not support 'is:unresolved' queries")
    else:
        resolution = get_alert_resolution(time_window, organization)
        seasonality = None
        if sensitivity:
            raise ValidationError("Sensitivity is not a valid field for this alert type")
        if threshold_type == AlertRuleThresholdType.ABOVE_AND_BELOW:
            raise ValidationError(
                "Above and below is not a valid threshold type for this alert type"
            )

    if detection_type == AlertRuleDetectionType.PERCENT:
        if comparison_delta is None:
            raise ValidationError("Percentage-based alerts require a comparison delta")
    else:
        if comparison_delta is not None:
            if not (sensitivity or seasonality):
                # this is a user setting up a percent-based metric alert who doesn't know about the new field
                detection_type = AlertRuleDetectionType.PERCENT
            else:
                # this is an incorrect field selection
                raise ValidationError("Comparison delta is not a valid field for this alert type")

    if comparison_delta is not None:
        # Since comparison alerts make twice as many queries, run the queries less frequently.
        resolution = resolution * DEFAULT_CMP_ALERT_RULE_RESOLUTION_MULTIPLIER
        comparison_delta = int(timedelta(minutes=comparison_delta).total_seconds())

    with transaction.atomic(router.db_for_write(SnubaQuery)):
        # NOTE: `create_snuba_query` constructs the postgres representation of the snuba query
        snuba_query = create_snuba_query(
            query_type=query_type,
            dataset=dataset,
            query=query,
            aggregate=aggregate,
            time_window=timedelta(minutes=time_window),
            resolution=timedelta(minutes=resolution),
            environment=environment,
            event_types=event_types,
        )

        alert_rule = AlertRule.objects.create(
            organization=organization,
            snuba_query=snuba_query,
            name=name,
            threshold_type=threshold_type.value,
            resolve_threshold=resolve_threshold,
            threshold_period=threshold_period,
            comparison_delta=comparison_delta,
            monitor_type=monitor_type,
            description=description,
            sensitivity=sensitivity,
            seasonality=seasonality,
            detection_type=detection_type,
            **_owner_kwargs_from_actor(owner),
        )

        if alert_rule.detection_type == AlertRuleDetectionType.DYNAMIC.value:
            # NOTE: if adding a new metric alert type, take care to check that it's handled here
            send_new_rule_data(alert_rule, projects[0], snuba_query)

        if user:
            create_audit_entry_from_user(
                user,
                ip_address=kwargs.get("ip_address") if kwargs else None,
                organization_id=organization.id,
                target_object=alert_rule.id,
                data=alert_rule.get_audit_log_data(),
                event=audit_log.get_event_id("ALERT_RULE_ADD"),
            )

        if monitor_type == AlertRuleMonitorTypeInt.ACTIVATED and activation_condition:
            # NOTE: if monitor_type is activated, activation_condition is required
            AlertRuleActivationCondition.objects.create(
                alert_rule=alert_rule, condition_type=activation_condition.value
            )

        # initialize projects join table for alert rules
        arps = [AlertRuleProjects(alert_rule=alert_rule, project=project) for project in projects]
        AlertRuleProjects.objects.bulk_create(arps)

        # NOTE: This constructs the query in snuba
        # NOTE: Will only subscribe if AlertRule.monitor_type === 'CONTINUOUS'
        alert_rule.subscribe_projects(projects=projects)

        # Activity is an audit log of what's happened with this alert rule
        AlertRuleActivity.objects.create(
            alert_rule=alert_rule,
            user_id=user.id if user else None,
            type=AlertRuleActivityType.CREATED.value,
        )

    schedule_update_project_config(alert_rule, projects)
    return alert_rule


def snapshot_alert_rule(alert_rule: AlertRule, user: RpcUser | User | None = None) -> None:
    def nullify_id(model: Model) -> None:
        """Set the id field to null.

        This coerces the `save` method to create a new object.

        TODO: Refactor to not violate the type system
        """
        model.id = None  # type: ignore[assignment]

    # Creates an archived alert_rule using the same properties as the passed rule
    # It will also resolve any incidents attached to this rule.
    with transaction.atomic(router.db_for_write(AlertRuleActivity)):
        triggers = AlertRuleTrigger.objects.filter(alert_rule=alert_rule)
        incidents = Incident.objects.filter(alert_rule=alert_rule)
        snuba_query_snapshot: SnubaQuery = deepcopy(_unpack_snuba_query(alert_rule))
        nullify_id(snuba_query_snapshot)
        snuba_query_snapshot.save()
        alert_rule_snapshot = deepcopy(alert_rule)
        nullify_id(alert_rule_snapshot)
        alert_rule_snapshot.status = AlertRuleStatus.SNAPSHOT.value
        alert_rule_snapshot.snuba_query = snuba_query_snapshot
        if alert_rule.user_id or alert_rule.team_id:
            alert_rule_snapshot.user_id = alert_rule.user_id
            alert_rule_snapshot.team_id = alert_rule.team_id
        alert_rule_snapshot.save()
        AlertRuleActivity.objects.create(
            alert_rule=alert_rule_snapshot,
            previous_alert_rule=alert_rule,
            user_id=user.id if user else None,
            type=AlertRuleActivityType.SNAPSHOT.value,
        )

        incidents.update(alert_rule=alert_rule_snapshot)

        for trigger in triggers:
            actions = AlertRuleTriggerAction.objects.filter(alert_rule_trigger=trigger)
            nullify_id(trigger)
            trigger.alert_rule = alert_rule_snapshot
            trigger.save()
            for action in actions:
                nullify_id(action)
                action.alert_rule_trigger = trigger
                action.save()

    # Change the incident status asynchronously, which could take awhile with many incidents due to snapshot creations.
    tasks.auto_resolve_snapshot_incidents.apply_async(
        kwargs={"alert_rule_id": alert_rule_snapshot.id}, countdown=3
    )


def update_alert_rule(
    alert_rule: AlertRule,
    query_type: SnubaQuery.Type | None = None,
    dataset: Dataset | None = None,
    projects: Sequence[Project] | None = None,
    name: str | None = None,
    owner: Actor | None | NotSet = NOT_SET,
    query: str | None = None,
    aggregate: str | None = None,
    time_window: int | None = None,
    environment: Environment | None = None,
    threshold_type: AlertRuleThresholdType | None = None,
    threshold_period: int | None = None,
    resolve_threshold: int | float | NotSet = NOT_SET,
    user: RpcUser | None = None,
    event_types: Collection[SnubaQueryEventType.EventType] | None = None,
    comparison_delta: int | None | NotSet = NOT_SET,
    monitor_type: AlertRuleMonitorTypeInt | None = None,
    description: str | None = None,
    sensitivity: AlertRuleSensitivity | None | NotSet = NOT_SET,
    seasonality: AlertRuleSeasonality | None | NotSet = NOT_SET,
    detection_type: AlertRuleDetectionType | None = None,
    **kwargs: Any,
) -> AlertRule:
    """
    Updates an alert rule.

    :param alert_rule: The alert rule to update
    :param name: Name for the alert rule. This will be used as part of the
    incident name, and must be unique per project.
    :param owner: Actor (sentry.types.actor.Actor) or None
    :param query: An event search query to subscribe to and monitor for alerts
    :param aggregate: A string representing the aggregate used in this alert rule
    :param time_window: Time period to aggregate over, in minutes.
    :param environment: An optional environment that this rule applies to
    :param threshold_type: An AlertRuleThresholdType
    :param threshold_period: How many update periods the value of the
    subscription needs to exceed the threshold before triggering
    :param resolve_threshold: Optional value that the subscription needs to reach to
    resolve the alert
    :param event_types: List of `EventType` that this alert will be related to
    :param comparison_delta: An optional int representing the time delta to use to determine the
    comparison period. In minutes.
    :param description: An optional str that will be rendered in the notification
    :param sensitivity: An AlertRuleSensitivity that specifies sensitivity of anomaly detection alerts
    :param seasonality: An AlertRuleSeasonality that specifies seasonality of anomaly detection alerts
    :param detection_type: the type of metric alert; defaults to AlertRuleDetectionType.STATIC
    :return: The updated `AlertRule`
    """
    snuba_query = _unpack_snuba_query(alert_rule)
    organization = _unpack_organization(alert_rule)

    updated_fields: dict[str, Any] = {"date_modified": django_timezone.now()}
    updated_query_fields: dict[str, Any] = {}
    if name:
        updated_fields["name"] = name
    if description:
        updated_fields["description"] = description
    if sensitivity is not NOT_SET:
        updated_fields["sensitivity"] = sensitivity
    if seasonality is not NOT_SET:
        updated_fields["seasonality"] = seasonality
    if query is not None:
        updated_query_fields["query"] = query
    if aggregate is not None:
        updated_query_fields["aggregate"] = aggregate
    if time_window:
        updated_query_fields["time_window"] = timedelta(minutes=time_window)
    if threshold_type:
        updated_fields["threshold_type"] = threshold_type.value
    if resolve_threshold is not NOT_SET:
        updated_fields["resolve_threshold"] = resolve_threshold
    if threshold_period:
        updated_fields["threshold_period"] = threshold_period
    if dataset is not None:
        if dataset.value != snuba_query.dataset:
            updated_query_fields["dataset"] = dataset
    if query_type is not None:
        updated_query_fields["query_type"] = query_type
    if monitor_type is not None:
        # TODO: determine how to convert activated alert into continuous alert and vice versa
        pass
    if event_types is not None:
        updated_query_fields["event_types"] = event_types
    if owner is not NOT_SET:
        updated_fields["owner"] = owner
    if comparison_delta is not NOT_SET:
        if comparison_delta is not None:
            # Since comparison alerts make twice as many queries, run the queries less frequently.
            comparison_delta = int(timedelta(minutes=comparison_delta).total_seconds())

        updated_fields["comparison_delta"] = comparison_delta
    if detection_type is None:
        if "comparison_delta" in updated_fields:  # some value changed -> update type if necessary
            if comparison_delta is not None:
                detection_type = AlertRuleDetectionType.PERCENT
            else:
                detection_type = AlertRuleDetectionType.STATIC

    # if we modified the comparison_delta or the time_window, we should update the resolution accordingly
    if "comparison_delta" in updated_fields or "time_window" in updated_query_fields:
        window = int(
            updated_query_fields.get(
                "time_window", timedelta(seconds=snuba_query.time_window)
            ).total_seconds()
            / 60
        )

        resolution = get_alert_resolution(window, organization=organization)
        resolution_comparison_delta = updated_fields.get(
            "comparison_delta", alert_rule.comparison_delta
        )

        if resolution_comparison_delta is not None:
            updated_query_fields["resolution"] = timedelta(
                minutes=(resolution * DEFAULT_CMP_ALERT_RULE_RESOLUTION_MULTIPLIER)
            )
        else:
            updated_query_fields["resolution"] = timedelta(minutes=resolution)

    if detection_type:
        updated_fields["detection_type"] = detection_type
        # make sure we clear the incorrect fields for each detection type
        if detection_type == AlertRuleDetectionType.STATIC:
            updated_fields["sensitivity"] = None
            updated_fields["seasonality"] = None
            updated_fields["comparison_delta"] = None
        elif detection_type == AlertRuleDetectionType.PERCENT:
            updated_fields["sensitivity"] = None
            updated_fields["seasonality"] = None
        elif detection_type == AlertRuleDetectionType.DYNAMIC:
            # NOTE: we set seasonality for EA
            updated_query_fields["resolution"] = timedelta(
                minutes=time_window if time_window is not None else snuba_query.time_window
            )
            updated_fields["seasonality"] = AlertRuleSeasonality.AUTO
            updated_fields["comparison_delta"] = None
            if (
                (time_window not in DYNAMIC_TIME_WINDOWS)
                if time_window is not None
                else (snuba_query.time_window not in DYNAMIC_TIME_WINDOWS_SECONDS)
            ):
                raise ValidationError(INVALID_TIME_WINDOW)

    with transaction.atomic(router.db_for_write(AlertRuleActivity)):
        incidents = Incident.objects.filter(alert_rule=alert_rule).exists()
        if incidents:
            snapshot_alert_rule(alert_rule, user)

        if "owner" in updated_fields:
            alert_rule.owner = updated_fields.pop("owner", None)
            # This is clunky but Model.update() uses QuerySet.update()
            # and doesn't persist other dirty attributes in the model
            updated_fields["user_id"] = alert_rule.user_id
            updated_fields["team_id"] = alert_rule.team_id

        if detection_type == AlertRuleDetectionType.DYNAMIC:
            if not features.has(
                "organizations:anomaly-detection-alerts", organization
            ) and not features.has("organizations:anomaly-detection-rollout", organization):
                raise ResourceDoesNotExist(
                    "Your organization does not have access to this feature."
                )
            if query and "is:unresolved" in query:
                raise ValidationError("Dynamic alerts do not support 'is:unresolved' queries")
            # NOTE: if adding a new metric alert type, take care to check that it's handled here
            project = projects[0] if projects else alert_rule.projects.get()
            update_rule_data(alert_rule, project, snuba_query, updated_fields, updated_query_fields)
        else:
            # if this was a dynamic rule, delete the data in Seer
            if alert_rule.detection_type == AlertRuleDetectionType.DYNAMIC:
                success = delete_rule_in_seer(
                    alert_rule=alert_rule,
                )
                if not success:
                    logger.error(
                        "Call to delete rule data in Seer failed",
                        extra={
                            "rule_id": alert_rule.id,
                        },
                    )
            # if this alert was previously a dynamic alert, then we should update the rule to be ready
            if alert_rule.status == AlertRuleStatus.NOT_ENOUGH_DATA.value:
                alert_rule.update(status=AlertRuleStatus.PENDING.value)

        alert_rule.update(**updated_fields)
        AlertRuleActivity.objects.create(
            alert_rule=alert_rule,
            user_id=user.id if user else None,
            type=AlertRuleActivityType.UPDATED.value,
        )

        if updated_query_fields or environment != snuba_query.environment:
            updated_query_fields.setdefault("query_type", SnubaQuery.Type(snuba_query.type))
            updated_query_fields.setdefault("dataset", Dataset(snuba_query.dataset))
            updated_query_fields.setdefault("query", snuba_query.query)
            updated_query_fields.setdefault("aggregate", snuba_query.aggregate)
            updated_query_fields.setdefault(
                "time_window", timedelta(seconds=snuba_query.time_window)
            )
            updated_query_fields.setdefault("event_types", None)
            if (
                detection_type == AlertRuleDetectionType.DYNAMIC
                and alert_rule.detection_type == AlertRuleDetectionType.DYNAMIC
            ):
                updated_query_fields.setdefault("resolution", snuba_query.resolution)
            else:
                updated_query_fields.setdefault(
                    "resolution", timedelta(seconds=snuba_query.resolution)
                )
            update_snuba_query(snuba_query, environment=environment, **updated_query_fields)

        existing_subs: Iterable[QuerySubscription] = ()
        if (
            query is not None
            or aggregate is not None
            or time_window is not None
            or projects is not None
        ):
            existing_subs = snuba_query.subscriptions.all().select_related("project")

        new_projects: Iterable[Project] = ()
        deleted_subs: Iterable[QuerySubscription] = ()

        if projects is not None:
            # All project slugs that currently exist for the alert rule
            existing_project_slugs = {sub.project.slug for sub in existing_subs}

            # All project slugs being provided as part of the update
            updated_project_slugs = {project.slug for project in projects}

            # Set of projects provided in the update, but don't already exist
            new_projects = [
                project for project in projects if project.slug not in existing_project_slugs
            ]

            # Delete any projects for the alert rule that were removed as part of this update
            AlertRuleProjects.objects.filter(
                alert_rule_id=alert_rule.id,  # for the alert rule
                project__slug__in=existing_project_slugs,  # that are in the existing project slugs
            ).exclude(
                project__slug__in=updated_project_slugs  # but not included with the updated project slugs
            ).delete()

            # Add any new projects to the alert rule
            for project in new_projects:
                alert_rule.projects.add(project)
            # Find any subscriptions that were removed as part of this update
            deleted_subs = [
                sub for sub in existing_subs if sub.project.slug not in updated_project_slugs
            ]

        if new_projects:
            alert_rule.subscribe_projects(projects=new_projects)

        if deleted_subs:
            bulk_delete_snuba_subscriptions(deleted_subs)

    if user:
        create_audit_entry_from_user(
            user,
            ip_address=kwargs.get("ip_address") if kwargs else None,
            organization_id=alert_rule.organization_id,
            target_object=alert_rule.id,
            data=alert_rule.get_audit_log_data(),
            event=audit_log.get_event_id("ALERT_RULE_EDIT"),
        )

    schedule_update_project_config(alert_rule, projects)

    return alert_rule


def enable_alert_rule(alert_rule: AlertRule) -> None:
    if alert_rule.status != AlertRuleStatus.DISABLED.value:
        return
    with transaction.atomic(router.db_for_write(AlertRule)):
        alert_rule.update(status=AlertRuleStatus.PENDING.value)
        bulk_enable_snuba_subscriptions(_unpack_snuba_query(alert_rule).subscriptions.all())


def disable_alert_rule(alert_rule: AlertRule) -> None:
    if alert_rule.status != AlertRuleStatus.PENDING.value:
        return
    with transaction.atomic(router.db_for_write(AlertRule)):
        alert_rule.update(status=AlertRuleStatus.DISABLED.value)
        bulk_disable_snuba_subscriptions(_unpack_snuba_query(alert_rule).subscriptions.all())


def delete_alert_rule(
    alert_rule: AlertRule, user: RpcUser | None = None, ip_address: str | None = None
) -> None:
    """
    Marks an alert rule as deleted and fires off a task to actually delete it.
    :param alert_rule:
    """
    if alert_rule.status == AlertRuleStatus.SNAPSHOT.value:
        raise AlreadyDeletedError()

    with transaction.atomic(router.db_for_write(AlertRuleActivity)):
        if user:
            create_audit_entry_from_user(
                user,
                ip_address=ip_address,
                organization_id=alert_rule.organization_id,
                target_object=alert_rule.id,
                data=alert_rule.get_audit_log_data(),
                event=audit_log.get_event_id("ALERT_RULE_REMOVE"),
            )

        subscriptions = _unpack_snuba_query(alert_rule).subscriptions.all()
        bulk_delete_snuba_subscriptions(subscriptions)

        schedule_update_project_config(alert_rule, [sub.project for sub in subscriptions])

        incidents = Incident.objects.filter(alert_rule=alert_rule)
        if incidents.exists():
            # if this was a dynamic rule, delete the data in Seer
            if alert_rule.detection_type == AlertRuleDetectionType.DYNAMIC:
                success = delete_rule_in_seer(
                    alert_rule=alert_rule,
                )
                if not success:
                    logger.error(
                        "Call to delete rule data in Seer failed",
                        extra={
                            "rule_id": alert_rule.id,
                        },
                    )
            AlertRuleActivity.objects.create(
                alert_rule=alert_rule,
                user_id=user.id if user else None,
                type=AlertRuleActivityType.DELETED.value,
            )
        else:
            RegionScheduledDeletion.schedule(instance=alert_rule, days=0, actor=user)

        alert_rule.update(status=AlertRuleStatus.SNAPSHOT.value)

    if alert_rule.id:
        # Change the incident status asynchronously, which could take awhile with many incidents due to snapshot creations.
        tasks.auto_resolve_snapshot_incidents.apply_async(kwargs={"alert_rule_id": alert_rule.id})


class AlertRuleTriggerLabelAlreadyUsedError(Exception):
    pass


class AlertRuleActivationConditionLabelAlreadyUsedError(Exception):
    pass


class ProjectsNotAssociatedWithAlertRuleError(Exception):
    def __init__(self, project_slugs: Collection[str]) -> None:
        self.project_slugs = project_slugs


def create_alert_rule_trigger(
    alert_rule: AlertRule,
    label: str,
    alert_threshold: int | float,
) -> AlertRuleTrigger:
    """
    Creates a new AlertRuleTrigger
    :param alert_rule: The alert rule to create the trigger for
    :param label: A description of the trigger
    :param alert_threshold: Value that the subscription needs to reach to trigger the
    alert rule
    trigger. These projects must be associate with the alert rule already
    :return: The created AlertRuleTrigger
    """
    if AlertRuleTrigger.objects.filter(alert_rule=alert_rule, label=label).exists():
        raise AlertRuleTriggerLabelAlreadyUsedError()

    if alert_rule.detection_type == AlertRuleDetectionType.DYNAMIC and alert_threshold != 0:
        raise ValidationError(INVALID_ALERT_THRESHOLD)

    with transaction.atomic(router.db_for_write(AlertRuleTrigger)):
        trigger = AlertRuleTrigger.objects.create(
            alert_rule=alert_rule, label=label, alert_threshold=alert_threshold
        )
    return trigger


def update_alert_rule_trigger(
    trigger: AlertRuleTrigger,
    label: str | None = None,
    alert_threshold: int | float | None = None,
) -> AlertRuleTrigger:
    """
    :param trigger: The AlertRuleTrigger to update
    :param label: A description of the trigger
    :param alert_threshold: Value that the subscription needs to reach to trigger the
    alert rule
    :return: The updated AlertRuleTrigger
    """

    if (
        AlertRuleTrigger.objects.filter(alert_rule=trigger.alert_rule, label=label)
        .exclude(id=trigger.id)
        .exists()
    ):
        raise AlertRuleTriggerLabelAlreadyUsedError()

    if trigger.alert_rule.detection_type == AlertRuleDetectionType.DYNAMIC and alert_threshold != 0:
        raise ValidationError(INVALID_ALERT_THRESHOLD)

    updated_fields: dict[str, Any] = {}
    if label is not None:
        updated_fields["label"] = label
    if alert_threshold is not None:
        updated_fields["alert_threshold"] = alert_threshold

    with transaction.atomic(router.db_for_write(AlertRuleTrigger)):
        if updated_fields:
            trigger.update(**updated_fields)

    return trigger


def delete_alert_rule_trigger(trigger: AlertRuleTrigger) -> None:
    """
    Deletes an AlertRuleTrigger
    """
    trigger.delete()


def get_triggers_for_alert_rule(alert_rule: AlertRule) -> QuerySet[AlertRuleTrigger]:
    return AlertRuleTrigger.objects.filter(alert_rule=alert_rule)


def _trigger_incident_triggers(incident: Incident) -> None:
    from sentry.incidents.tasks import handle_trigger_action

    incident_triggers = IncidentTrigger.objects.filter(incident=incident)
    triggers = get_triggers_for_alert_rule(incident.alert_rule)
    actions = deduplicate_trigger_actions(triggers=list(triggers))
    with transaction.atomic(router.db_for_write(AlertRuleTrigger)):
        for trigger in incident_triggers:
            trigger.status = TriggerStatus.RESOLVED.value
            trigger.save()

        for action in actions:
            for project in incident.projects.all():
                transaction.on_commit(
                    handle_trigger_action.s(
                        action_id=action.id,
                        incident_id=incident.id,
                        project_id=project.id,
                        method="resolve",
                        new_status=IncidentStatus.CLOSED.value,
                    ).delay,
                    router.db_for_write(AlertRuleTrigger),
                )


def _sort_by_priority_list(triggers: Collection[AlertRuleTrigger]) -> list[AlertRuleTrigger]:
    priority_dict = {
        WARNING_TRIGGER_LABEL: 0,
        CRITICAL_TRIGGER_LABEL: 1,
    }
    return sorted(
        triggers,
        key=lambda t: priority_dict.get(t.label, len(triggers) + t.id),
    )


def _prioritize_actions(triggers: Collection[AlertRuleTrigger]) -> list[AlertRuleTriggerAction]:
    """
    Function that given an input array of AlertRuleTriggers, prioritizes those triggers
    based on their label, and then re-orders actions based on that ordering
    Inputs:
        * triggers: Array of instances of `AlertRuleTrigger`
    Returns:
        List of instances of `AlertRuleTriggerAction` that are ordered according to the ordering
        of related prioritized instances of `AlertRuleTrigger`
    """
    actions = list(
        AlertRuleTriggerAction.objects.filter(alert_rule_trigger__in=triggers).select_related(
            "alert_rule_trigger"
        )
    )

    triggers = _sort_by_priority_list(triggers=triggers)
    triggers_dict = {t.id: idx for idx, t in enumerate(triggers)}

    sorted_actions = sorted(
        actions,
        key=lambda action: triggers_dict.get(
            action.alert_rule_trigger.id, len(actions) + action.id
        ),
    )
    return sorted_actions


def deduplicate_trigger_actions(
    triggers: Collection[AlertRuleTrigger],
) -> list[AlertRuleTriggerAction]:
    """
    Given a list of alert rule triggers, we fetch actions, this returns a list of actions that is
    unique on (type, target_type, target_identifier, integration_id, sentry_app_id). If there are
    duplicate actions, we'll prefer the action from a warning trigger over a critical
    trigger. If there are duplicate actions on a single trigger, we'll just choose
    one arbitrarily.
    :param triggers: A list of `AlertRuleTrigger` instances from the same `AlertRule`
    :return: A list of deduplicated `AlertRuleTriggerAction` instances.
    """
    actions = _prioritize_actions(triggers=triggers)

    deduped: dict[tuple[int, int, str | None, int | None, int | None], AlertRuleTriggerAction] = {}
    for action in actions:
        key = (
            action.type,
            action.target_type,
            action.target_identifier,
            action.integration_id,
            action.sentry_app_id,
        )
        deduped.setdefault(key, action)
    return list(deduped.values())


def _get_subscriptions_from_alert_rule(
    alert_rule: AlertRule, projects: Collection[Project]
) -> Iterable[QuerySubscription]:
    """
    Fetches subscriptions associated with an alert rule filtered by a list of projects.
    Raises `ProjectsNotAssociatedWithAlertRuleError` if Projects aren't associated with
    the AlertRule
    :param alert_rule: The AlertRule to fetch subscriptions for
    :param projects: The Project we want subscriptions for
    :return: A list of QuerySubscriptions
    """
    excluded_subscriptions = _unpack_snuba_query(alert_rule).subscriptions.filter(
        project__in=projects
    )
    if len(excluded_subscriptions) != len(projects):
        invalid_slugs = {p.slug for p in projects} - {
            s.project.slug for s in excluded_subscriptions
        }
        raise ProjectsNotAssociatedWithAlertRuleError(invalid_slugs)
    return excluded_subscriptions


def create_alert_rule_trigger_action(
    trigger: AlertRuleTrigger,
    type: ActionService,
    target_type: ActionTarget,
    target_identifier: str | None = None,
    integration_id: int | None = None,
    sentry_app_id: int | None = None,
    use_async_lookup: bool = False,
    input_channel_id: str | None = None,
    sentry_app_config: dict[str, Any] | None = None,
    installations: list[RpcSentryAppInstallation] | None = None,
    integrations: list[RpcIntegration] | None = None,
    priority: str | None = None,
) -> AlertRuleTriggerAction:
    """
    Creates an AlertRuleTriggerAction
    :param trigger: The trigger to create the action on
    :param type: Which sort of action to take
    :param target_type: Which type of target to send to
    :param target_identifier: (Optional) The identifier of the target
    :param integration_id: (Optional) The Integration related to this action.
    :param sentry_app_id: (Optional) The Sentry App related to this action.
    :param use_async_lookup: (Optional) Longer lookup for the Slack channel async job
    :param input_channel_id: (Optional) Slack channel ID. If provided skips lookup
    :return: The created action
    """
    target_display: str | None = None
    if type.value in AlertRuleTriggerAction.EXEMPT_SERVICES:
        raise InvalidTriggerActionError("Selected notification service is exempt from alert rules")

    if type.value in AlertRuleTriggerAction.INTEGRATION_TYPES:
        if target_type != AlertRuleTriggerAction.TargetType.SPECIFIC:
            raise InvalidTriggerActionError("Must specify specific target type")

        target = get_target_identifier_display_for_integration(
            type,
            target_identifier,
            _unpack_organization(trigger.alert_rule),
            integration_id,
            use_async_lookup=use_async_lookup,
            input_channel_id=input_channel_id,
            integrations=integrations,
        )

    elif type == AlertRuleTriggerAction.Type.SENTRY_APP:
        target = _get_alert_rule_trigger_action_sentry_app(
            _unpack_organization(trigger.alert_rule), sentry_app_id, installations
        )

    else:
        target = AlertTarget(target_identifier, target_display)

    # store priority in the json sentry_app_config
    if priority is not None and type in [ActionService.PAGERDUTY, ActionService.OPSGENIE]:
        if sentry_app_config:
            sentry_app_config.update({"priority": priority})
        else:
            sentry_app_config = {"priority": priority}

    return AlertRuleTriggerAction.objects.create(
        alert_rule_trigger=trigger,
        type=type.value,
        target_type=target_type.value,
        target_identifier=str(target.identifier) if target.identifier is not None else None,
        target_display=target.display,
        integration_id=integration_id,
        sentry_app_id=sentry_app_id,
        sentry_app_config=sentry_app_config,
    )


def update_alert_rule_trigger_action(
    trigger_action: AlertRuleTriggerAction,
    type: ActionService | None = None,
    target_type: ActionTarget | None = None,
    target_identifier: str | None = None,
    integration_id: int | None = None,
    sentry_app_id: int | None = None,
    use_async_lookup: bool = False,
    input_channel_id=None,
    sentry_app_config=None,
    installations: list[RpcSentryAppInstallation] | None = None,
    integrations: list[RpcIntegration] | None = None,
    priority: str | None = None,
) -> AlertRuleTriggerAction:
    """
    Updates values on an AlertRuleTriggerAction
    :param trigger_action: The trigger action to update
    :param type: Which sort of action to take
    :param target_type: Which type of target to send to
    :param target_identifier: The identifier of the target
    :param integration_id: (Optional) The ID of the Integration related to this action.
    :param sentry_app_id: (Optional) The ID of the SentryApp related to this action.
    :param use_async_lookup: (Optional) Longer lookup for the Slack channel async job
    :param input_channel_id: (Optional) Slack channel ID. If provided skips lookup
    :return:
    """
    updated_fields: dict[str, Any] = {}
    if type is not None:
        updated_fields["type"] = type.value
    if target_type is not None:
        updated_fields["target_type"] = target_type.value
    if integration_id is not None:
        updated_fields["integration_id"] = integration_id
    if sentry_app_id is not None:
        updated_fields["sentry_app_id"] = sentry_app_id
    if sentry_app_config is not None:
        updated_fields["sentry_app_config"] = sentry_app_config
    if target_identifier is not None:
        type = updated_fields.get("type", trigger_action.type)

        if type in AlertRuleTriggerAction.INTEGRATION_TYPES:
            integration_id = updated_fields.get("integration_id", trigger_action.integration_id)
            organization = _unpack_organization(trigger_action.alert_rule_trigger.alert_rule)

            target = get_target_identifier_display_for_integration(
                type,
                target_identifier,
                organization,
                integration_id,
                use_async_lookup=use_async_lookup,
                input_channel_id=input_channel_id,
                integrations=integrations,
            )
            updated_fields["target_display"] = target.display

        elif type == AlertRuleTriggerAction.Type.SENTRY_APP.value:
            sentry_app_id = updated_fields.get("sentry_app_id", trigger_action.sentry_app_id)
            organization = _unpack_organization(trigger_action.alert_rule_trigger.alert_rule)

            target = _get_alert_rule_trigger_action_sentry_app(
                organization, sentry_app_id, installations
            )
            updated_fields["target_display"] = target.display

        else:
            target = AlertTarget(target_identifier, None)

        updated_fields["target_identifier"] = target.identifier

    # store priority in the json sentry_app_config
    if priority is not None and type in [ActionService.PAGERDUTY, ActionService.OPSGENIE]:
        if updated_fields.get("sentry_app_config"):
            updated_fields["sentry_app_config"].update({"priority": priority})
        else:
            updated_fields["sentry_app_config"] = {"priority": priority}

    trigger_action.update(**updated_fields)
    return trigger_action


@dataclass(frozen=True, eq=True)
class AlertTarget:
    identifier: str | int | None
    display: str | None


def get_target_identifier_display_for_integration(
    action_type: ActionService,
    target_value: str | None,
    organization: Organization,
    integration_id: int | None,
    use_async_lookup: bool = True,
    input_channel_id: str | None = None,
    integrations: Collection[RpcIntegration] | None = None,
) -> AlertTarget:
    if action_type == AlertRuleTriggerAction.Type.SLACK.value:
        return _get_target_identifier_display_for_slack(
            target_value, integration_id, use_async_lookup, input_channel_id, integrations
        )

    if target_value is None:
        raise InvalidTriggerActionError(f"{action_type.name} requires non-null target_value")
    return _get_target_identifier_display_from_target_value(
        action_type, target_value, organization, integration_id
    )


def _get_target_identifier_display_for_slack(
    target_value: str | None,
    integration_id: int | None,
    use_async_lookup: bool = True,
    input_channel_id: str | None = None,
    integrations: Iterable[RpcIntegration] | None = None,
) -> AlertTarget:
    # target_value is the Slack username or channel name
    if input_channel_id is not None:
        # if we have a value for input_channel_id, just set target identifier to that
        return AlertTarget(input_channel_id, target_value)

    if target_value is None:
        raise InvalidTriggerActionError(
            "Slack requires target_value if input_channel_id is not present"
        )
    if integration_id is None:
        raise InvalidTriggerActionError(
            "Slack requires integration_id if input_channel_id is not present"
        )
    target_identifier = _get_alert_rule_trigger_action_slack_channel_id(
        target_value, integration_id, use_async_lookup, integrations
    )
    return AlertTarget(target_identifier, target_value)


def _get_target_identifier_display_from_target_value(
    action_type: ActionService,
    target_value: str,
    organization: Organization,
    integration_id: int | None,
) -> AlertTarget:
    if action_type == AlertRuleTriggerAction.Type.SLACK.value:
        raise ValueError("Call _get_target_identifier_display_for_slack")

    elif action_type == AlertRuleTriggerAction.Type.MSTEAMS.value:
        # target_value is the MSTeams username or channel name
        if integration_id is None:
            raise InvalidTriggerActionError("MSTEAMS requires non-null integration_id")
        return AlertTarget(
            _get_alert_rule_trigger_action_msteams_channel_id(
                target_value, organization, integration_id
            ),
            target_value,
        )

    elif action_type == AlertRuleTriggerAction.Type.DISCORD.value:
        if integration_id is None:
            raise InvalidTriggerActionError("DISCORD requires non-null integration_id")
        return AlertTarget(
            _get_alert_rule_trigger_action_discord_channel_id(target_value, integration_id),
            target_value,
        )

    elif action_type == AlertRuleTriggerAction.Type.PAGERDUTY.value:
        # target_value is the ID of the PagerDuty service
        return _get_alert_rule_trigger_action_pagerduty_service(
            target_value, organization, integration_id
        )
    elif action_type == AlertRuleTriggerAction.Type.OPSGENIE.value:
        return get_alert_rule_trigger_action_opsgenie_team(
            target_value, organization, integration_id
        )
    else:
        raise Exception("Not implemented")


def _get_alert_rule_trigger_action_slack_channel_id(
    name: str,
    integration_id: int,
    use_async_lookup: bool = True,
    integrations: Iterable[RpcIntegration] | None = None,
) -> str:
    from sentry.integrations.slack.utils.channel import get_channel_id

    if integrations is not None:
        try:
            integration = next(i for i in integrations if i.id == integration_id)
        except StopIteration:
            integration = None
    else:
        integration = integration_service.get_integration(
            integration_id=integration_id, status=ObjectStatus.ACTIVE
        )
    if integration is None:
        raise InvalidTriggerActionError("Slack workspace is a required field.")

    try:
        channel_data = get_channel_id(integration, name, use_async_lookup)
    except DuplicateDisplayNameError as e:
        domain = integration.metadata["domain_name"]

        raise InvalidTriggerActionError(
            'Multiple users were found with display name "%s". Please use your username, found at %s/account/settings.'
            % (e, domain)
        )

    if channel_data.timed_out:
        raise ChannelLookupTimeoutError(
            "Could not find channel %s. We have timed out trying to look for it." % name
        )

    if channel_data.channel_id is None:
        raise InvalidTriggerActionError(
            "Could not find channel %s. Channel may not exist, or Sentry may not "
            "have been granted permission to access it" % name
        )

    return channel_data.channel_id


def _get_alert_rule_trigger_action_discord_channel_id(name: str, integration_id: int) -> str | None:
    from sentry.integrations.discord.utils.channel import validate_channel_id

    integration = integration_service.get_integration(
        integration_id=integration_id, status=ObjectStatus.ACTIVE
    )
    if integration is None:
        raise InvalidTriggerActionError("Discord integration not found.")
    try:
        validate_channel_id(
            channel_id=name,
            guild_id=integration.external_id,
            guild_name=integration.name,
        )
    except ValidationError as e:
        raise InvalidTriggerActionError(e.message)
    except IntegrationError:
        raise InvalidTriggerActionError("Bad response from Discord channel lookup")
    except ApiTimeoutError:
        raise ChannelLookupTimeoutError(
            "Could not find channel %s. We have timed out trying to look for it." % name
        )

    return name


def _get_alert_rule_trigger_action_msteams_channel_id(
    name: str, organization: Organization, integration_id: int
) -> str:
    from sentry.integrations.msteams.utils import get_channel_id

    channel_id = get_channel_id(organization, integration_id, name)

    if channel_id is None:
        # no granting access for msteams channels unlike slack
        raise InvalidTriggerActionError("Could not find channel %s." % name)

    return channel_id


def _get_alert_rule_trigger_action_pagerduty_service(
    target_value: str, organization: Organization, integration_id: int | None
) -> AlertTarget:
    from sentry.integrations.pagerduty.utils import get_service

    org_integration = integration_service.get_organization_integration(
        integration_id=integration_id, organization_id=organization.id
    )
    service = get_service(org_integration, target_value)
    if not service:
        raise InvalidTriggerActionError("No PagerDuty service found.")

    return AlertTarget(service["id"], service["service_name"])


def get_alert_rule_trigger_action_opsgenie_team(
    target_value: str | None, organization: Organization, integration_id: int | None
) -> AlertTarget:
    from sentry.integrations.opsgenie.utils import get_team

    result = integration_service.organization_context(
        organization_id=organization.id, integration_id=integration_id
    )
    integration = result.integration
    oi = result.organization_integration
    if integration is None or oi is None:
        raise InvalidTriggerActionError("Opsgenie integration not found.")

    team = get_team(target_value, oi)
    if not team:
        raise InvalidTriggerActionError("No Opsgenie team found.")

    return AlertTarget(team["id"], team["team"])


def _get_alert_rule_trigger_action_sentry_app(
    organization: Organization,
    sentry_app_id: int | None,
    installations: Collection[RpcSentryAppInstallation] | None,
) -> AlertTarget:
    from sentry.sentry_apps.services.app import app_service

    if installations is None:
        installations = app_service.installations_for_organization(organization_id=organization.id)

    for installation in installations:
        if installation.sentry_app.id == sentry_app_id:
            return AlertTarget(sentry_app_id, installation.sentry_app.name)

    raise InvalidTriggerActionError("No SentryApp found.")


def delete_alert_rule_trigger_action(trigger_action: AlertRuleTriggerAction) -> None:
    """
    Schedules a deletion for a AlertRuleTriggerAction, and marks it as pending deletion.
    Marking it as pending deletion should filter out the object through the manager when querying.
    """
    RegionScheduledDeletion.schedule(instance=trigger_action, days=0)
    trigger_action.update(status=ObjectStatus.PENDING_DELETION)


def get_actions_for_trigger(trigger: AlertRuleTrigger) -> QuerySet[AlertRuleTriggerAction]:
    return AlertRuleTriggerAction.objects.filter(alert_rule_trigger=trigger)


def get_available_action_integrations_for_org(organization: Organization) -> list[RpcIntegration]:
    """
    Returns a list of integrations that the organization has installed. Integrations are
    filtered by the list of registered providers.
    :param organization:
    """

    providers = [
        registration.integration_provider
        for registration in AlertRuleTriggerAction.get_registered_factories()
        if registration.integration_provider is not None
    ]
    return integration_service.get_integrations(
        status=ObjectStatus.ACTIVE,
        org_integration_status=ObjectStatus.ACTIVE,
        organization_id=organization.id,
        providers=providers,
    )


def get_pagerduty_services(organization_id: int, integration_id: int) -> list[tuple[int, str]]:
    from sentry.integrations.pagerduty.utils import get_services

    org_int = integration_service.get_organization_integration(
        organization_id=organization_id, integration_id=integration_id
    )
    services = get_services(org_int)
    return [(s["id"], s["service_name"]) for s in services]


def get_opsgenie_teams(organization_id: int, integration_id: int) -> list[tuple[str, str]]:
    org_int = integration_service.get_organization_integration(
        organization_id=organization_id, integration_id=integration_id
    )
    if org_int is None:
        return []
    teams = []
    team_table = org_int.config.get("team_table")
    if team_table:
        teams = [(team["id"], team["team"]) for team in team_table]
    return teams


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
EAP_COLUMNS = [
    "span.duration",
    "span.self_time",
]
EAP_FUNCTIONS = [
    "count",
    "avg",
    "p50",
    "p75",
    "p90",
    "p95",
    "p99",
    "p100",
    "max",
    "min",
]


def get_column_from_aggregate(aggregate: str, allow_mri: bool) -> str | None:
    # These functions exist as SnQLFunction definitions and are not supported in the older
    # logic for resolving functions. We parse these using `fields.is_function`, otherwise
    # they will fail using the old resolve_field logic.
    match = is_function(aggregate)
    if match and (
        match.group("function") in SPANS_METRICS_FUNCTIONS
        or match.group("function") in METRICS_LAYER_UNSUPPORTED_TRANSACTION_METRICS_FUNCTIONS
    ):
        return None if match.group("columns") == "" else match.group("columns")

    # Skip additional validation for EAP queries. They don't exist in the old logic.
    if match and match.group("function") in EAP_FUNCTIONS and match.group("columns") in EAP_COLUMNS:
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
    column = get_column_from_aggregate(aggregate, allow_mri)
    match = is_function(aggregate)
    function = match.group("function") if match else None
    return (
        column is None
        or is_measurement(column)
        or column in SUPPORTED_COLUMNS
        or column in TRANSLATABLE_COLUMNS
        or (is_mri(column) and allow_mri)
        or (
            isinstance(function, str)
            and column in INSIGHTS_FUNCTION_VALID_ARGS_MAP.get(function, [])
        )
        or (column in EAP_COLUMNS and allow_eap)
    )


def translate_aggregate_field(
    aggregate: str, reverse: bool = False, allow_mri: bool = False
) -> str:
    column = get_column_from_aggregate(aggregate, allow_mri)
    if not reverse:
        if column in TRANSLATABLE_COLUMNS:
            return aggregate.replace(column, TRANSLATABLE_COLUMNS[column])
    else:
        if column is not None:
            for field, translated_field in TRANSLATABLE_COLUMNS.items():
                if translated_field == column:
                    return aggregate.replace(column, field)
    return aggregate


# TODO(Ecosystem): Convert to using get_filtered_actions
def get_slack_actions_with_async_lookups(
    organization: Organization,
    user: RpcUser | None,
    data: Mapping[str, Any],
) -> list[Mapping[str, Any]]:
    """Return Slack trigger actions that require async lookup"""
    try:
        from sentry.incidents.serializers import AlertRuleTriggerActionSerializer

        slack_actions = []
        for trigger in data["triggers"]:
            for action in trigger["actions"]:
                action = rewrite_trigger_action_fields(action)
                a_s = AlertRuleTriggerActionSerializer(
                    context={
                        "organization": organization,
                        "access": SystemAccess(),
                        "user": user,
                        "input_channel_id": action.get("inputChannelId"),
                        "installations": app_service.installations_for_organization(
                            organization_id=organization.id
                        ),
                    },
                    data=action,
                )
                # If a channel does not have a channel ID we should use an async look up to find it
                # The calling function will receive a list of channels in need of this look up and schedule it
                if a_s.is_valid():
                    if (
                        a_s.validated_data["type"].value == AlertRuleTriggerAction.Type.SLACK.value
                        and not a_s.validated_data["input_channel_id"]
                    ):
                        slack_actions.append(a_s.validated_data)
        return slack_actions
    except KeyError:
        # If we have any KeyErrors reading the data, we can just return nothing
        # This will cause the endpoint to try creating the rule synchronously
        # which will capture the error properly.
        return []


def get_slack_channel_ids(
    organization: Organization,
    user: RpcUser | None,
    data: Mapping[str, Any],
) -> Mapping[str, Any]:
    slack_actions = get_slack_actions_with_async_lookups(organization, user, data)
    mapped_slack_channels = {}
    for action in slack_actions:
        if not action["target_identifier"] in mapped_slack_channels:
            target = get_target_identifier_display_for_integration(
                action["type"].value,
                action["target_identifier"],
                organization,
                action["integration_id"],
            )
            mapped_slack_channels[action["target_identifier"]] = target.identifier
    return mapped_slack_channels


def rewrite_trigger_action_fields(action_data: dict[str, Any]) -> dict[str, Any]:
    if "integration_id" in action_data:
        action_data["integration"] = action_data.pop("integration_id")
    elif "integrationId" in action_data:
        action_data["integration"] = action_data.pop("integrationId")

    if "sentry_app_id" in action_data:
        action_data["sentry_app"] = action_data.pop("sentry_app_id")
    elif "sentryAppId" in action_data:
        action_data["sentry_app"] = action_data.pop("sentryAppId")

    if "settings" in action_data:
        action_data["sentry_app_config"] = action_data.pop("settings")
    return action_data


def get_filtered_actions(
    alert_rule_data: Mapping[str, Any],
    action_type: ActionService,
) -> list[dict[str, Any]]:
    def is_included(action: Mapping[str, Any]) -> bool:
        type_slug = action.get("type")
        if type_slug is None or not isinstance(type_slug, str):
            return False
        factory = AlertRuleTriggerAction.look_up_factory_by_slug(type_slug)
        return factory is not None and factory.service_type == action_type

    return [
        rewrite_trigger_action_fields(action)
        for trigger in alert_rule_data.get("triggers", [])
        for action in trigger.get("actions", [])
        if is_included(action)
    ]


def schedule_update_project_config(
    alert_rule: AlertRule, projects: Iterable[Project] | None
) -> None:
    """
    If `should_use_on_demand`, then invalidate the project configs
    """
    enabled_features = on_demand_metrics_feature_flags(_unpack_organization(alert_rule))
    prefilling = "organizations:on-demand-metrics-prefill" in enabled_features
    if (
        not projects
        or "organizations:on-demand-metrics-extraction" not in enabled_features
        and not prefilling
    ):
        return

    alert_snuba_query = _unpack_snuba_query(alert_rule)
    should_use_on_demand = should_use_on_demand_metrics(
        alert_snuba_query.dataset,
        alert_snuba_query.aggregate,
        alert_snuba_query.query,
        None,
        prefilling,
    )
    if should_use_on_demand:
        for project in projects:
            schedule_invalidate_project_config(
                trigger="alerts:create-on-demand-metric", project_id=project.id
            )
