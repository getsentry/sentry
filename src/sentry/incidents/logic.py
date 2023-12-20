from __future__ import annotations

import logging
from copy import deepcopy
from dataclasses import replace
from datetime import datetime, timedelta
from typing import Any, Dict, List, Mapping, Optional, Sequence, Tuple, Union
from uuid import uuid4

from django.db import router, transaction
from django.db.models.signals import post_save
from django.forms import ValidationError
from django.utils import timezone
from snuba_sdk import Column, Condition, Limit, Op

from sentry import analytics, audit_log, features, quotas
from sentry.auth.access import SystemAccess
from sentry.constants import CRASH_RATE_ALERT_AGGREGATE_ALIAS, ObjectStatus
from sentry.incidents import tasks
from sentry.incidents.models import (
    AlertRule,
    AlertRuleActivity,
    AlertRuleActivityType,
    AlertRuleExcludedProjects,
    AlertRuleStatus,
    AlertRuleTrigger,
    AlertRuleTriggerAction,
    AlertRuleTriggerExclusion,
    Incident,
    IncidentActivity,
    IncidentActivityType,
    IncidentProject,
    IncidentSeen,
    IncidentStatus,
    IncidentStatusMethod,
    IncidentSubscription,
    IncidentTrigger,
    TriggerStatus,
)
from sentry.models.actor import Actor
from sentry.models.notificationaction import ActionService, ActionTarget
from sentry.models.project import Project
from sentry.relay.config.metric_extraction import on_demand_metrics_feature_flags
from sentry.search.events.builder import QueryBuilder
from sentry.search.events.fields import is_function, resolve_field
from sentry.services.hybrid_cloud.app import RpcSentryAppInstallation, app_service
from sentry.services.hybrid_cloud.integration import RpcIntegration, integration_service
from sentry.services.hybrid_cloud.integration.model import RpcOrganizationIntegration
from sentry.shared_integrations.exceptions import (
    ApiError,
    ApiTimeoutError,
    DuplicateDisplayNameError,
    IntegrationError,
)
from sentry.snuba.dataset import Dataset
from sentry.snuba.entity_subscription import (
    ENTITY_TIME_COLUMNS,
    EntitySubscription,
    get_entity_key_from_query_builder,
    get_entity_subscription_from_snuba_query,
)
from sentry.snuba.metrics.extraction import should_use_on_demand_metrics
from sentry.snuba.metrics.naming_layer.mri import get_available_operations, is_mri, parse_mri
from sentry.snuba.models import SnubaQuery
from sentry.snuba.subscriptions import (
    bulk_create_snuba_subscriptions,
    bulk_delete_snuba_subscriptions,
    bulk_disable_snuba_subscriptions,
    bulk_enable_snuba_subscriptions,
    create_snuba_query,
    update_snuba_query,
)
from sentry.snuba.tasks import build_query_builder
from sentry.tasks.relay import schedule_invalidate_project_config
from sentry.utils import metrics
from sentry.utils.audit import create_audit_entry_from_user
from sentry.utils.snuba import is_measurement

# We can return an incident as "windowed" which returns a range of points around the start of the incident
# It attempts to center the start of the incident, only showing earlier data if there isn't enough time
# after the incident started to display the correct start date.
WINDOWED_STATS_DATA_POINTS = 200
NOT_SET = object()

CRITICAL_TRIGGER_LABEL = "critical"
WARNING_TRIGGER_LABEL = "warning"

logger = logging.getLogger(__name__)


class AlreadyDeletedError(Exception):
    pass


class InvalidTriggerActionError(Exception):
    pass


class ChannelLookupTimeoutError(Exception):
    pass


def create_incident(
    organization,
    type_,
    title,
    date_started,
    date_detected=None,
    # TODO: Probably remove detection_uuid?
    detection_uuid=None,
    projects=None,
    user=None,
    alert_rule=None,
):
    if date_detected is None:
        date_detected = date_started

    with transaction.atomic(router.db_for_write(Incident)):
        incident = Incident.objects.create(
            organization=organization,
            detection_uuid=detection_uuid,
            status=IncidentStatus.OPEN.value,
            type=type_.value,
            title=title,
            date_started=date_started,
            date_detected=date_detected,
            alert_rule=alert_rule,
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
            incident_type=type_.value,
        )

    return incident


def update_incident_status(
    incident,
    status,
    user=None,
    comment=None,
    status_method=IncidentStatusMethod.RULE_TRIGGERED,
    date_closed=None,
):
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
            user=user,
            value=status.value,
            previous_value=incident.status,
            comment=comment,
        )
        if user:
            subscribe_to_incident(incident, user.id)

        prev_status = incident.status
        kwargs = {"status": status.value, "status_method": status_method.value}
        if status == IncidentStatus.CLOSED:
            kwargs["date_closed"] = date_closed if date_closed else timezone.now()
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
            trigger_incident_triggers(incident)

        return incident


def set_incident_seen(incident, user=None):
    """
    Updates the incident to be seen
    """

    is_org_member = incident.organization.has_access(user)

    if is_org_member:
        is_project_member = False
        for incident_project in IncidentProject.objects.filter(incident=incident).select_related(
            "project"
        ):
            if incident_project.project.member_set.filter(
                user_id=user.id if user else None
            ).exists():
                is_project_member = True
                break

        if is_project_member:
            incident_seen, created = IncidentSeen.objects.create_or_update(
                incident=incident,
                user_id=user.id if user else None,
                values={"last_seen": timezone.now()},
            )
            return incident_seen

    return False


@transaction.atomic(router.db_for_write(Incident))
def create_incident_activity(
    incident,
    activity_type,
    user=None,
    value=None,
    previous_value=None,
    comment=None,
    mentioned_user_ids=None,
    date_added=None,
) -> IncidentActivity:
    if activity_type == IncidentActivityType.COMMENT and user:
        subscribe_to_incident(incident, user.id)
    value = str(value) if value is not None else value
    previous_value = str(previous_value) if previous_value is not None else previous_value
    kwargs = {}
    if date_added:
        kwargs["date_added"] = date_added
    activity = IncidentActivity.objects.create(
        incident=incident,
        type=activity_type.value,
        user_id=user.id if user else None,
        value=value,
        previous_value=previous_value,
        comment=comment,
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
    transaction.on_commit(
        lambda: tasks.send_subscriber_notifications.apply_async(
            kwargs={"activity_id": activity.id}, countdown=10
        ),
        router.db_for_write(IncidentSubscription),
    )
    if activity_type == IncidentActivityType.COMMENT:
        analytics.record(
            "incident.comment",
            incident_id=incident.id,
            organization_id=incident.organization_id,
            incident_type=incident.type,
            user_id=user.id if user else None,
            activity_id=activity.id,
        )

    return activity


def update_comment(activity, comment):
    """
    Specifically updates an IncidentActivity with type IncidentActivityType.COMMENT
    """

    return activity.update(comment=comment)


def delete_comment(activity):
    """
    Specifically deletes an IncidentActivity with type IncidentActivityType.COMMENT
    """

    return activity.delete()


def build_incident_query_builder(
    incident: Incident,
    entity_subscription: EntitySubscription,
    start: Optional[datetime] = None,
    end: Optional[datetime] = None,
    windowed_stats: bool = False,
) -> QueryBuilder:
    snuba_query = incident.alert_rule.snuba_query
    start, end = calculate_incident_time_range(incident, start, end, windowed_stats=windowed_stats)
    project_ids = list(
        IncidentProject.objects.filter(incident=incident).values_list("project_id", flat=True)
    )
    query_builder = build_query_builder(
        entity_subscription,
        snuba_query.query,
        project_ids,
        snuba_query.environment,
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
    time_col = ENTITY_TIME_COLUMNS[get_entity_key_from_query_builder(query_builder)]
    query_builder.add_conditions(
        [
            Condition(Column(time_col), Op.GTE, start),
            Condition(Column(time_col), Op.LT, end),
        ]
    )
    query_builder.limit = Limit(10000)
    return query_builder


def calculate_incident_time_range(incident, start=None, end=None, windowed_stats=False):
    time_window = (
        incident.alert_rule.snuba_query.time_window if incident.alert_rule is not None else 60
    )
    time_window_delta = timedelta(seconds=time_window)
    start = incident.date_started - time_window_delta if start is None else start
    end = incident.current_end_date + time_window_delta if end is None else end
    if windowed_stats:
        now = timezone.now()
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

    retention = quotas.get_event_retention(organization=incident.organization) or 90
    start = max(
        start.replace(tzinfo=timezone.utc),
        datetime.utcnow().replace(tzinfo=timezone.utc) - timedelta(days=retention),
    )
    end = max(start, end.replace(tzinfo=timezone.utc))

    return start, end


def get_incident_aggregates(
    incident: Incident,
    start: Optional[datetime] = None,
    end: Optional[datetime] = None,
    windowed_stats: bool = False,
) -> Dict[str, Union[float, int]]:
    """
    Calculates aggregate stats across the life of an incident, or the provided range.
    """
    snuba_query = incident.alert_rule.snuba_query
    entity_subscription = get_entity_subscription_from_snuba_query(
        snuba_query,
        incident.organization_id,
    )
    query_builder = build_incident_query_builder(
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


def subscribe_to_incident(incident, user_id):
    return IncidentSubscription.objects.get_or_create(incident=incident, user_id=user_id)


def unsubscribe_from_incident(incident, user_id):
    return IncidentSubscription.objects.filter(incident=incident, user_id=user_id).delete()


def get_incident_subscribers(incident):
    return IncidentSubscription.objects.filter(incident=incident)


def get_incident_activity(incident):
    return IncidentActivity.objects.filter(incident=incident).select_related("incident")


class AlertRuleNameAlreadyUsedError(Exception):
    pass


# Default values for `SnubaQuery.resolution`, in minutes.
DEFAULT_ALERT_RULE_RESOLUTION = 1
DEFAULT_CMP_ALERT_RULE_RESOLUTION = 2

# Temporary mapping of `Dataset` to `AlertRule.Type`. In the future, `Performance` will be
# able to be run on `METRICS` as well.
query_datasets_to_type = {
    Dataset.Events: SnubaQuery.Type.ERROR,
    Dataset.Transactions: SnubaQuery.Type.PERFORMANCE,
    Dataset.PerformanceMetrics: SnubaQuery.Type.PERFORMANCE,
    Dataset.Sessions: SnubaQuery.Type.CRASH_RATE,
    Dataset.Metrics: SnubaQuery.Type.CRASH_RATE,
}


def create_alert_rule(
    organization,
    projects,
    name,
    query,
    aggregate,
    time_window,
    threshold_type,
    threshold_period,
    owner=None,
    resolve_threshold=None,
    environment=None,
    include_all_projects=False,
    excluded_projects=None,
    query_type: SnubaQuery.Type = SnubaQuery.Type.ERROR,
    dataset=Dataset.Events,
    user=None,
    event_types=None,
    comparison_delta: Optional[int] = None,
    **kwargs,
):
    """
    Creates an alert rule for an organization.

    :param organization:
    :param projects: A list of projects to subscribe to the rule. This will be overridden
    if `include_all_projects` is True
    :param name: Name for the alert rule. This will be used as part of the
    incident name, and must be unique per project
    :param owner: ActorTuple (sentry.models.actor.ActorTuple) or None
    :param query: An event search query to subscribe to and monitor for alerts
    :param aggregate: A string representing the aggregate used in this alert rule
    :param time_window: Time period to aggregate over, in minutes
    :param environment: An optional environment that this rule applies to
    :param threshold_type: An AlertRuleThresholdType
    :param threshold_period: How many update periods the value of the
    subscription needs to exceed the threshold before triggering
    :param resolve_threshold: Optional value that the subscription needs to reach to
    resolve the alert
    :param include_all_projects: Whether to include all current and future projects
    from this organization
    :param excluded_projects: List of projects to exclude if we're using
    `include_all_projects`.
    :param query_type: The SnubaQuery.Type of the query
    :param dataset: The dataset that this query will be executed on
    :param event_types: List of `EventType` that this alert will be related to
    :param comparison_delta: An optional int representing the time delta to use to determine the
    comparison period. In minutes.

    :return: The created `AlertRule`
    """
    resolution = DEFAULT_ALERT_RULE_RESOLUTION
    if comparison_delta is not None:
        # Since comparison alerts make twice as many queries, run the queries less frequently.
        resolution = DEFAULT_CMP_ALERT_RULE_RESOLUTION
        comparison_delta = int(timedelta(minutes=comparison_delta).total_seconds())
    if dataset == Dataset.Sessions and features.has(
        "organizations:alert-crash-free-metrics", organization, actor=user
    ):
        dataset = Dataset.Metrics

    actor = None
    if owner and not isinstance(owner, Actor):
        actor = owner.resolve_to_actor()
    elif owner and isinstance(owner, Actor):
        actor = owner

    with transaction.atomic(router.db_for_write(SnubaQuery)):
        snuba_query = create_snuba_query(
            query_type,
            dataset,
            query,
            aggregate,
            timedelta(minutes=time_window),
            timedelta(minutes=resolution),
            environment,
            event_types=event_types,
        )

        alert_rule = AlertRule.objects.create(
            organization=organization,
            snuba_query=snuba_query,
            name=name,
            threshold_type=threshold_type.value,
            resolve_threshold=resolve_threshold,
            threshold_period=threshold_period,
            include_all_projects=include_all_projects,
            owner=actor,
            comparison_delta=comparison_delta,
            user_id=actor.user_id if actor else None,
            team_id=actor.team_id if actor else None,
        )

        if user:
            create_audit_entry_from_user(
                user,
                ip_address=kwargs.get("ip_address") if kwargs else None,
                organization_id=organization.id,
                target_object=alert_rule.id,
                data=alert_rule.get_audit_log_data(),
                event=audit_log.get_event_id("ALERT_RULE_ADD"),
            )

        if include_all_projects:
            excluded_projects = excluded_projects if excluded_projects else []
            projects = Project.objects.filter(organization=organization).exclude(
                id__in=[p.id for p in excluded_projects]
            )
            exclusions = [
                AlertRuleExcludedProjects(alert_rule=alert_rule, project=project)
                for project in excluded_projects
            ]
            AlertRuleExcludedProjects.objects.bulk_create(exclusions)

        subscribe_projects_to_alert_rule(alert_rule, projects)

        AlertRuleActivity.objects.create(
            alert_rule=alert_rule,
            user_id=user.id if user else None,
            type=AlertRuleActivityType.CREATED.value,
        )

    schedule_update_project_config(alert_rule, projects)

    return alert_rule


def snapshot_alert_rule(alert_rule, user=None):
    # Creates an archived alert_rule using the same properties as the passed rule
    # It will also resolve any incidents attached to this rule.
    with transaction.atomic(router.db_for_write(AlertRuleActivity)):
        triggers = AlertRuleTrigger.objects.filter(alert_rule=alert_rule)
        incidents = Incident.objects.filter(alert_rule=alert_rule)
        snuba_query_snapshot = deepcopy(alert_rule.snuba_query)
        snuba_query_snapshot.id = None
        snuba_query_snapshot.save()
        alert_rule_snapshot = deepcopy(alert_rule)
        alert_rule_snapshot.id = None
        alert_rule_snapshot.status = AlertRuleStatus.SNAPSHOT.value
        alert_rule_snapshot.snuba_query = snuba_query_snapshot
        if alert_rule.owner:
            alert_rule_snapshot.user_id = alert_rule.owner.user_id
            alert_rule_snapshot.team_id = alert_rule.owner.team_id
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
            trigger.id = None
            trigger.alert_rule = alert_rule_snapshot
            trigger.save()
            for action in actions:
                action.id = None
                action.alert_rule_trigger = trigger
                action.save()

    # Change the incident status asynchronously, which could take awhile with many incidents due to snapshot creations.
    tasks.auto_resolve_snapshot_incidents.apply_async(
        kwargs={"alert_rule_id": alert_rule_snapshot.id}, countdown=3
    )


def update_alert_rule(
    alert_rule,
    query_type=None,
    dataset=None,
    projects=None,
    name=None,
    owner=NOT_SET,
    query=None,
    aggregate=None,
    time_window=None,
    environment=None,
    threshold_type=None,
    threshold_period=None,
    resolve_threshold=NOT_SET,
    include_all_projects=None,
    excluded_projects=None,
    user=None,
    event_types=None,
    comparison_delta=NOT_SET,
    **kwargs,
):
    """
    Updates an alert rule.

    :param alert_rule: The alert rule to update
    :param excluded_projects: List of projects to subscribe to the rule. Ignored if
    `include_all_projects` is True
    :param name: Name for the alert rule. This will be used as part of the
    incident name, and must be unique per project.
    :param owner: ActorTuple (sentry.models.actor.ActorTuple) or None
    :param query: An event search query to subscribe to and monitor for alerts
    :param aggregate: A string representing the aggregate used in this alert rule
    :param time_window: Time period to aggregate over, in minutes.
    :param environment: An optional environment that this rule applies to
    :param threshold_type: An AlertRuleThresholdType
    :param threshold_period: How many update periods the value of the
    subscription needs to exceed the threshold before triggering
    :param resolve_threshold: Optional value that the subscription needs to reach to
    resolve the alert
    :param include_all_projects: Whether to include all current and future projects
    from this organization
    :param excluded_projects: List of projects to exclude if we're using
    `include_all_projects`. Ignored otherwise.
    :param event_types: List of `EventType` that this alert will be related to
    :param comparison_delta: An optional int representing the time delta to use to determine the
    comparison period. In minutes.
    :return: The updated `AlertRule`
    """
    updated_fields = {"date_modified": timezone.now()}
    updated_query_fields = {}
    if name:
        updated_fields["name"] = name
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
    if include_all_projects is not None:
        updated_fields["include_all_projects"] = include_all_projects
    if dataset is not None:
        if dataset == Dataset.Sessions and features.has(
            "organizations:alert-crash-free-metrics", alert_rule.organization, actor=user
        ):
            dataset = Dataset.Metrics

        if dataset.value != alert_rule.snuba_query.dataset:
            updated_query_fields["dataset"] = dataset
    if query_type is not None:
        updated_query_fields["query_type"] = query_type
    if event_types is not None:
        updated_query_fields["event_types"] = event_types
    if owner is not NOT_SET:
        if owner is not None and not isinstance(owner, Actor):
            owner = owner.resolve_to_actor()
        updated_fields["owner"] = owner
        updated_fields["team_id"] = owner.team_id if owner else None
        updated_fields["user_id"] = owner.user_id if owner else None
    if comparison_delta is not NOT_SET:
        resolution = DEFAULT_ALERT_RULE_RESOLUTION
        if comparison_delta is not None:
            # Since comparison alerts make twice as many queries, run the queries less frequently.
            resolution = DEFAULT_CMP_ALERT_RULE_RESOLUTION
            comparison_delta = int(timedelta(minutes=comparison_delta).total_seconds())

        updated_query_fields["resolution"] = timedelta(minutes=resolution)
        updated_fields["comparison_delta"] = comparison_delta

    with transaction.atomic(router.db_for_write(AlertRuleActivity)):
        incidents = Incident.objects.filter(alert_rule=alert_rule).exists()
        if incidents:
            snapshot_alert_rule(alert_rule, user)
        alert_rule.update(**updated_fields)
        AlertRuleActivity.objects.create(
            alert_rule=alert_rule,
            user_id=user.id if user else None,
            type=AlertRuleActivityType.UPDATED.value,
        )

        if updated_query_fields or environment != alert_rule.snuba_query.environment:
            snuba_query = alert_rule.snuba_query
            updated_query_fields.setdefault("query_type", SnubaQuery.Type(snuba_query.type))
            updated_query_fields.setdefault("dataset", Dataset(snuba_query.dataset))
            updated_query_fields.setdefault("query", snuba_query.query)
            updated_query_fields.setdefault("aggregate", snuba_query.aggregate)
            updated_query_fields.setdefault(
                "time_window", timedelta(seconds=snuba_query.time_window)
            )
            updated_query_fields.setdefault("event_types", None)
            updated_query_fields.setdefault("resolution", timedelta(seconds=snuba_query.resolution))
            update_snuba_query(
                alert_rule.snuba_query,
                environment=environment,
                **updated_query_fields,
            )

        existing_subs = []
        if (
            query is not None
            or aggregate is not None
            or time_window is not None
            or projects is not None
            or include_all_projects is not None
            or excluded_projects is not None
        ):
            existing_subs = alert_rule.snuba_query.subscriptions.all().select_related("project")

        new_projects = []
        deleted_subs = []

        if not alert_rule.include_all_projects:
            # We don't want to have any exclusion rows present if we're not in
            # `include_all_projects` mode
            get_excluded_projects_for_alert_rule(alert_rule).delete()

        if alert_rule.include_all_projects:
            if include_all_projects or excluded_projects is not None:
                # If we're in `include_all_projects` mode, we want to just fetch
                # projects that aren't already subscribed, and haven't been excluded so
                # we can add them.
                excluded_project_ids = (
                    {p.id for p in excluded_projects} if excluded_projects else set()
                )
                project_exclusions = get_excluded_projects_for_alert_rule(alert_rule)
                project_exclusions.exclude(project_id__in=excluded_project_ids).delete()
                existing_excluded_project_ids = {pe.project_id for pe in project_exclusions}
                new_exclusions = [
                    AlertRuleExcludedProjects(alert_rule=alert_rule, project_id=project_id)
                    for project_id in excluded_project_ids
                    if project_id not in existing_excluded_project_ids
                ]
                AlertRuleExcludedProjects.objects.bulk_create(new_exclusions)

                new_projects = Project.objects.filter(organization=alert_rule.organization).exclude(
                    id__in={sub.project_id for sub in existing_subs} | excluded_project_ids
                )
                # If we're subscribed to any of the excluded projects then we want to
                # remove those subscriptions
                deleted_subs = [
                    sub for sub in existing_subs if sub.project_id in excluded_project_ids
                ]
        elif projects is not None:
            existing_project_slugs = {sub.project.slug for sub in existing_subs}
            # Determine whether we've added any new projects as part of this update
            new_projects = [
                project for project in projects if project.slug not in existing_project_slugs
            ]
            updated_project_slugs = {project.slug for project in projects}
            # Find any subscriptions that were removed as part of this update
            deleted_subs = [
                sub for sub in existing_subs if sub.project.slug not in updated_project_slugs
            ]

        if new_projects:
            subscribe_projects_to_alert_rule(alert_rule, new_projects)

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


def subscribe_projects_to_alert_rule(alert_rule, projects):
    """
    Subscribes a list of projects to an alert rule
    :return: The list of created subscriptions
    """
    return bulk_create_snuba_subscriptions(
        projects, tasks.INCIDENTS_SNUBA_SUBSCRIPTION_TYPE, alert_rule.snuba_query
    )


def enable_alert_rule(alert_rule):
    if alert_rule.status != AlertRuleStatus.DISABLED.value:
        return
    with transaction.atomic(router.db_for_write(AlertRule)):
        alert_rule.update(status=AlertRuleStatus.PENDING.value)
        bulk_enable_snuba_subscriptions(alert_rule.snuba_query.subscriptions.all())


def disable_alert_rule(alert_rule):
    if alert_rule.status != AlertRuleStatus.PENDING.value:
        return
    with transaction.atomic(router.db_for_write(AlertRule)):
        alert_rule.update(status=AlertRuleStatus.DISABLED.value)
        bulk_disable_snuba_subscriptions(alert_rule.snuba_query.subscriptions.all())


def delete_alert_rule(alert_rule, user=None, ip_address=None):
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

        subscriptions = alert_rule.snuba_query.subscriptions.all()
        bulk_delete_snuba_subscriptions(subscriptions)

        schedule_update_project_config(alert_rule, [sub.project for sub in subscriptions])

        incidents = Incident.objects.filter(alert_rule=alert_rule)
        if incidents.exists():
            alert_rule.update(status=AlertRuleStatus.SNAPSHOT.value)
            AlertRuleActivity.objects.create(
                alert_rule=alert_rule,
                user_id=user.id if user else None,
                type=AlertRuleActivityType.DELETED.value,
            )
        else:
            alert_rule.delete()

    if alert_rule.id:
        # Change the incident status asynchronously, which could take awhile with many incidents due to snapshot creations.
        tasks.auto_resolve_snapshot_incidents.apply_async(kwargs={"alert_rule_id": alert_rule.id})


def get_excluded_projects_for_alert_rule(alert_rule):
    return AlertRuleExcludedProjects.objects.filter(alert_rule=alert_rule)


class AlertRuleTriggerLabelAlreadyUsedError(Exception):
    pass


class ProjectsNotAssociatedWithAlertRuleError(Exception):
    def __init__(self, project_slugs):
        self.project_slugs = project_slugs


def create_alert_rule_trigger(alert_rule, label, alert_threshold, excluded_projects=None):
    """
    Creates a new AlertRuleTrigger
    :param alert_rule: The alert rule to create the trigger for
    :param label: A description of the trigger
    :param alert_threshold: Value that the subscription needs to reach to trigger the
    alert rule
    :param excluded_projects: A list of Projects that should be excluded from this
    trigger. These projects must be associate with the alert rule already
    :return: The created AlertRuleTrigger
    """
    if AlertRuleTrigger.objects.filter(alert_rule=alert_rule, label=label).exists():
        raise AlertRuleTriggerLabelAlreadyUsedError()

    excluded_subs = []
    if excluded_projects:
        excluded_subs = get_subscriptions_from_alert_rule(alert_rule, excluded_projects)

    with transaction.atomic(router.db_for_write(AlertRuleTrigger)):
        trigger = AlertRuleTrigger.objects.create(
            alert_rule=alert_rule, label=label, alert_threshold=alert_threshold
        )
        if excluded_subs:
            new_exclusions = [
                AlertRuleTriggerExclusion(alert_rule_trigger=trigger, query_subscription=sub)
                for sub in excluded_subs
            ]
            AlertRuleTriggerExclusion.objects.bulk_create(new_exclusions)

    return trigger


def update_alert_rule_trigger(trigger, label=None, alert_threshold=None, excluded_projects=None):
    """
    :param trigger: The AlertRuleTrigger to update
    :param label: A description of the trigger
    :param alert_threshold: Value that the subscription needs to reach to trigger the
    alert rule
    :param excluded_projects: A list of Projects that should be excluded from this
    trigger. These projects must be associate with the alert rule already
    :return: The updated AlertRuleTrigger
    """

    if (
        AlertRuleTrigger.objects.filter(alert_rule=trigger.alert_rule, label=label)
        .exclude(id=trigger.id)
        .exists()
    ):
        raise AlertRuleTriggerLabelAlreadyUsedError()

    updated_fields = {}
    if label is not None:
        updated_fields["label"] = label
    if alert_threshold is not None:
        updated_fields["alert_threshold"] = alert_threshold

    deleted_exclusion_ids = []
    new_subs = []

    if excluded_projects:
        # We link projects to exclusions via QuerySubscriptions. Calculate which
        # exclusions need to be deleted, and which need to be created.
        excluded_subs = get_subscriptions_from_alert_rule(trigger.alert_rule, excluded_projects)
        existing_exclusions = AlertRuleTriggerExclusion.objects.filter(alert_rule_trigger=trigger)
        new_sub_ids = {sub.id for sub in excluded_subs}
        existing_sub_ids = {exclusion.query_subscription_id for exclusion in existing_exclusions}

        deleted_exclusion_ids = [
            e.id for e in existing_exclusions if e.query_subscription_id not in new_sub_ids
        ]
        new_subs = [sub for sub in excluded_subs if sub.id not in existing_sub_ids]

    with transaction.atomic(router.db_for_write(AlertRuleTrigger)):
        if updated_fields:
            trigger.update(**updated_fields)

        if deleted_exclusion_ids:
            AlertRuleTriggerExclusion.objects.filter(id__in=deleted_exclusion_ids).delete()

        if new_subs:
            new_exclusions = [
                AlertRuleTriggerExclusion(alert_rule_trigger=trigger, query_subscription=sub)
                for sub in new_subs
            ]
            AlertRuleTriggerExclusion.objects.bulk_create(new_exclusions)

    return trigger


def delete_alert_rule_trigger(trigger):
    """
    Deletes an AlertRuleTrigger
    """
    trigger.delete()


def get_triggers_for_alert_rule(alert_rule):
    return AlertRuleTrigger.objects.filter(alert_rule=alert_rule)


def trigger_incident_triggers(incident):
    from sentry.incidents.tasks import handle_trigger_action

    incident_triggers = IncidentTrigger.objects.filter(incident=incident)
    triggers = get_triggers_for_alert_rule(incident.alert_rule)
    actions = deduplicate_trigger_actions(triggers=triggers)
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


def sort_by_priority_list(triggers: list[AlertRuleTrigger]) -> list[AlertRuleTrigger]:
    priority_dict = {
        WARNING_TRIGGER_LABEL: 0,
        CRITICAL_TRIGGER_LABEL: 1,
    }
    return sorted(
        triggers,
        key=lambda t: priority_dict.get(t.label, len(triggers) + t.id),
    )


def prioritize_actions(triggers: list[AlertRuleTrigger]) -> list[AlertRuleTriggerAction]:
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

    triggers = sort_by_priority_list(triggers=triggers)
    triggers_dict = {t.id: idx for idx, t in enumerate(triggers)}

    sorted_actions = sorted(
        actions,
        key=lambda action: triggers_dict.get(
            action.alert_rule_trigger.id, len(actions) + action.id
        ),
    )
    return sorted_actions


def deduplicate_trigger_actions(triggers: list[AlertRuleTrigger]) -> list[AlertRuleTriggerAction]:
    """
    Given a list of alert rule triggers, we fetch actions, this returns a list of actions that is
    unique on (type, target_type, target_identifier, integration_id, sentry_app_id). If there are
    duplicate actions, we'll prefer the action from a warning trigger over a critical
    trigger. If there are duplicate actions on a single trigger, we'll just choose
    one arbitrarily.
    :param triggers: A list of `AlertRuleTrigger` instances from the same `AlertRule`
    :return: A list of deduplicated `AlertRuleTriggerAction` instances.
    """
    actions = prioritize_actions(triggers=triggers)

    deduped = {}
    for action in actions:
        deduped.setdefault(
            (
                action.type,
                action.target_type,
                action.target_identifier,
                action.integration_id,
                action.sentry_app_id,
            ),
            action,
        )
    return list(deduped.values())


def get_subscriptions_from_alert_rule(alert_rule, projects):
    """
    Fetches subscriptions associated with an alert rule filtered by a list of projects.
    Raises `ProjectsNotAssociatedWithAlertRuleError` if Projects aren't associated with
    the AlertRule
    :param alert_rule: The AlertRule to fetch subscriptions for
    :param projects: The Project we want subscriptions for
    :return: A list of QuerySubscriptions
    """
    excluded_subscriptions = alert_rule.snuba_query.subscriptions.filter(project__in=projects)
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
    input_channel_id=None,
    sentry_app_config=None,
    installations: List[RpcSentryAppInstallation] | None = None,
    integrations: List[RpcIntegration] | None = None,
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
    target_display = None
    if type.value in AlertRuleTriggerAction.EXEMPT_SERVICES:
        raise InvalidTriggerActionError("Selected notification service is exempt from alert rules")

    if type.value in AlertRuleTriggerAction.INTEGRATION_TYPES:
        if target_type != AlertRuleTriggerAction.TargetType.SPECIFIC:
            raise InvalidTriggerActionError("Must specify specific target type")

        target_identifier, target_display = get_target_identifier_display_for_integration(
            type.value,
            target_identifier,
            trigger.alert_rule.organization,
            integration_id,
            use_async_lookup=use_async_lookup,
            input_channel_id=input_channel_id,
            integrations=integrations,
        )

    elif type == AlertRuleTriggerAction.Type.SENTRY_APP:
        target_identifier, target_display = get_alert_rule_trigger_action_sentry_app(
            trigger.alert_rule.organization, sentry_app_id, installations
        )

    return AlertRuleTriggerAction.objects.create(
        alert_rule_trigger=trigger,
        type=type.value,
        target_type=target_type.value,
        target_identifier=target_identifier,
        target_display=target_display,
        integration_id=integration_id,
        sentry_app_id=sentry_app_id,
        sentry_app_config=sentry_app_config,
    )


def update_alert_rule_trigger_action(
    trigger_action: AlertRuleTriggerAction,
    type: ActionService | None = None,
    target_type: ActionTarget | None = None,
    target_identifier: Optional[str] = None,
    integration_id: int | None = None,
    sentry_app_id: int | None = None,
    use_async_lookup: bool = False,
    input_channel_id=None,
    sentry_app_config=None,
    installations: List[RpcSentryAppInstallation] | None = None,
    integrations: List[RpcIntegration] | None = None,
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
    updated_fields = {}
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
            organization = trigger_action.alert_rule_trigger.alert_rule.organization

            target_identifier, target_display = get_target_identifier_display_for_integration(
                type,
                target_identifier,
                organization,
                integration_id,
                use_async_lookup=use_async_lookup,
                input_channel_id=input_channel_id,
                integrations=integrations,
            )
            updated_fields["target_display"] = target_display

        elif type == AlertRuleTriggerAction.Type.SENTRY_APP.value:
            sentry_app_id = updated_fields.get("sentry_app_id", trigger_action.sentry_app_id)
            organization = trigger_action.alert_rule_trigger.alert_rule.organization

            target_identifier, target_display = get_alert_rule_trigger_action_sentry_app(
                organization, sentry_app_id, installations
            )
            updated_fields["target_display"] = target_display

        updated_fields["target_identifier"] = target_identifier
    trigger_action.update(**updated_fields)
    return trigger_action


def get_target_identifier_display_for_integration(type, target_value, *args, **kwargs):
    # target_value is the Slack username or channel name
    if type == AlertRuleTriggerAction.Type.SLACK.value:
        # if we have a value for input_channel_id, just set target_identifier to that
        target_identifier = kwargs.pop("input_channel_id")
        if target_identifier is not None:
            return (
                target_identifier,
                target_value,
            )
        target_identifier = get_alert_rule_trigger_action_slack_channel_id(
            target_value, *args, **kwargs
        )
    # target_value is the MSTeams username or channel name
    elif type == AlertRuleTriggerAction.Type.MSTEAMS.value:
        target_identifier = get_alert_rule_trigger_action_msteams_channel_id(
            target_value, *args, **kwargs
        )

    elif type == AlertRuleTriggerAction.Type.DISCORD.value:
        target_identifier = get_alert_rule_trigger_action_discord_channel_id(
            target_value, *args, **kwargs
        )

    # target_value is the ID of the PagerDuty service
    elif type == AlertRuleTriggerAction.Type.PAGERDUTY.value:
        target_identifier, target_value = get_alert_rule_trigger_action_pagerduty_service(
            target_value, *args, **kwargs
        )
    elif type == AlertRuleTriggerAction.Type.OPSGENIE.value:
        target_identifier, target_value = get_alert_rule_trigger_action_opsgenie_team(
            target_value, *args, **kwargs
        )
    else:
        raise Exception("Not implemented")

    return target_identifier, target_value


def get_alert_rule_trigger_action_slack_channel_id(
    name, organization, integration_id, use_async_lookup, integrations
):
    from sentry.integrations.slack.utils import get_channel_id

    if integrations is not None:
        try:
            integration = next(i for i in integrations if i.id == integration_id)
        except StopIteration:
            integration = None
    else:
        integration = integration_service.get_integration(integration_id=integration_id)
    if integration is None:
        raise InvalidTriggerActionError("Slack workspace is a required field.")

    try:
        _prefix, channel_id, timed_out = get_channel_id(
            organization, integration, name, use_async_lookup
        )
    except DuplicateDisplayNameError as e:
        domain = integration.metadata["domain_name"]

        raise InvalidTriggerActionError(
            'Multiple users were found with display name "%s". Please use your username, found at %s/account/settings.'
            % (e, domain)
        )

    if timed_out:
        raise ChannelLookupTimeoutError(
            "Could not find channel %s. We have timed out trying to look for it." % name
        )

    if channel_id is None:
        raise InvalidTriggerActionError(
            "Could not find channel %s. Channel may not exist, or Sentry may not "
            "have been granted permission to access it" % name
        )

    return channel_id


def get_alert_rule_trigger_action_discord_channel_id(
    name,
    organization,
    integration_id,
    use_async_lookup=False,
    input_channel_id=None,
    integrations=None,
):
    from sentry.integrations.discord.utils.channel import validate_channel_id

    integration = integration_service.get_integration(integration_id=integration_id)
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


def get_alert_rule_trigger_action_msteams_channel_id(
    name,
    organization,
    integration_id,
    use_async_lookup=False,
    input_channel_id=None,
    integrations=None,
):
    from sentry.integrations.msteams.utils import get_channel_id

    channel_id = get_channel_id(organization, integration_id, name)

    if channel_id is None:
        # no granting access for msteams channels unlike slack
        raise InvalidTriggerActionError("Could not find channel %s." % name)

    return channel_id


def get_alert_rule_trigger_action_pagerduty_service(
    target_value,
    organization,
    integration_id,
    use_async_lookup=False,
    input_channel_id=None,
    integrations=None,
):
    from sentry.integrations.pagerduty.utils import get_service

    org_integration = integration_service.get_organization_integration(
        integration_id=integration_id, organization_id=organization.id
    )
    service = get_service(org_integration, target_value)
    if not service:
        raise InvalidTriggerActionError("No PagerDuty service found.")

    return service["id"], service["service_name"]


def get_alert_rule_trigger_action_opsgenie_team(
    target_value: Optional[str],
    organization: RpcOrganizationIntegration,
    integration_id: int,
    use_async_lookup=False,
    input_channel_id=None,
    integrations=None,
) -> tuple[str, str]:
    from sentry.integrations.opsgenie.client import OpsgenieClient
    from sentry.integrations.opsgenie.utils import get_team

    oi = integration_service.get_organization_integration(
        integration_id=integration_id, organization_id=organization.id
    )
    team = get_team(target_value, oi)
    if not team:
        raise InvalidTriggerActionError("No Opsgenie team found.")

    integration_key = team["integration_key"]
    integration = integration_service.get_integration(integration_id=integration_id)
    if integration is None:
        raise InvalidTriggerActionError("Opsgenie integration not found.")
    client = OpsgenieClient(
        integration=integration,
        integration_key=integration_key,
        org_integration_id=oi.id,
        keyid=team["id"],
    )
    try:
        client.authorize_integration(type="sentry")
    except ApiError as e:
        logger.info("opsgenie.authorization_error", extra={"error": str(e)})
        raise InvalidTriggerActionError("Invalid integration key.")
    return team["id"], team["team"]


def get_alert_rule_trigger_action_sentry_app(organization, sentry_app_id, installations):
    from sentry.services.hybrid_cloud.app import app_service

    if installations is None:
        # TODO(hybrid-cloud): this rpc invocation is fairly deeply buried within this transaction
        # https://github.com/getsentry/sentry/blob/2b7077a785ea394c70f4e7f12de11a039ef6634e/src/sentry/incidents/serializers/alert_rule.py#L424
        # which we would like to avoid. We should refactor to obviate the need for this watermark
        installations = app_service.get_installed_for_organization(organization_id=organization.id)

    for installation in installations:
        if installation.sentry_app.id == sentry_app_id:
            return sentry_app_id, installation.sentry_app.name

    raise InvalidTriggerActionError("No SentryApp found.")


def delete_alert_rule_trigger_action(trigger_action):
    """
    Deletes a AlertRuleTriggerAction
    """
    trigger_action.delete()


def get_actions_for_trigger(trigger):
    return AlertRuleTriggerAction.objects.filter(alert_rule_trigger=trigger)


def get_available_action_integrations_for_org(organization) -> List[RpcIntegration]:
    """
    Returns a list of integrations that the organization has installed. Integrations are
    filtered by the list of registered providers.
    :param organization:
    """

    providers = [
        registration.integration_provider
        for registration in AlertRuleTriggerAction.get_registered_types()
        if registration.integration_provider is not None
    ]
    return integration_service.get_integrations(
        status=ObjectStatus.ACTIVE,
        org_integration_status=ObjectStatus.ACTIVE,
        organization_id=organization.id,
        providers=providers,
    )


def get_pagerduty_services(organization_id, integration_id) -> List[Tuple[int, str]]:
    from sentry.integrations.pagerduty.utils import get_services

    org_int = integration_service.get_organization_integration(
        organization_id=organization_id, integration_id=integration_id
    )
    services = get_services(org_int)
    return [(s["id"], s["service_name"]) for s in services]


def get_opsgenie_teams(organization_id, integration_id) -> list[Tuple[str, str]]:
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


def get_column_from_aggregate(aggregate, allow_mri):
    if allow_mri:
        mri_column = get_column_from_aggregate_with_mri(aggregate)
        # Only if the column was allowed, we return it, otherwise we fallback to the old logic.
        if mri_column:
            return mri_column

    function = resolve_field(aggregate)
    if function.aggregate is not None:
        return function.aggregate[1]

    return None


def get_column_from_aggregate_with_mri(aggregate):
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


def check_aggregate_column_support(aggregate, allow_mri=False):
    # TODO(ddm): remove `allow_mri` once the experimental feature flag is removed.
    column = get_column_from_aggregate(aggregate, allow_mri)
    return (
        column is None
        or is_measurement(column)
        or column in SUPPORTED_COLUMNS
        or column in TRANSLATABLE_COLUMNS
        or (is_mri(column) and allow_mri)
    )


def translate_aggregate_field(aggregate, reverse=False, allow_mri=False):
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
def get_slack_actions_with_async_lookups(organization, user, data):
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
                        "installations": app_service.get_installed_for_organization(
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
        return {}


def get_slack_channel_ids(organization, user, data):
    slack_actions = get_slack_actions_with_async_lookups(organization, user, data)
    mapped_slack_channels = {}
    for action in slack_actions:
        if not action["target_identifier"] in mapped_slack_channels:
            (
                mapped_slack_channels[action["target_identifier"]],
                _,
            ) = get_target_identifier_display_for_integration(
                action["type"].value,
                action["target_identifier"],
                organization,
                action["integration_id"],
                use_async_lookup=True,
                input_channel_id=None,
                integrations=None,
            )
    return mapped_slack_channels


def rewrite_trigger_action_fields(action_data):
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
):
    from sentry.incidents.serializers import STRING_TO_ACTION_TYPE

    return [
        rewrite_trigger_action_fields(action)
        for trigger in alert_rule_data.get("triggers", [])
        for action in trigger.get("actions", [])
        if STRING_TO_ACTION_TYPE.get(action.get("type")) == action_type
    ]


def schedule_update_project_config(alert_rule: AlertRule, projects: Sequence[Project]):
    enabled_features = on_demand_metrics_feature_flags(alert_rule.organization)
    prefilling = "organizations:on-demand-metrics-prefill" in enabled_features

    if not projects or not (
        "organizations:on-demand-metrics-extraction" in enabled_features or prefilling
    ):
        return

    alert_snuba_query = alert_rule.snuba_query
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
