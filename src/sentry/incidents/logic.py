from __future__ import absolute_import

from copy import deepcopy
from datetime import datetime, timedelta
from itertools import chain

import six
from django.db import transaction
from django.db.models.signals import post_save
from django.utils import timezone

from sentry import analytics, quotas
from sentry.api.event_search import get_filter, resolve_field
from sentry.constants import SentryAppInstallationStatus, SentryAppStatus
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
    IncidentSnapshot,
    IncidentTrigger,
    PendingIncidentSnapshot,
    IncidentSeen,
    IncidentStatus,
    IncidentStatusMethod,
    IncidentSubscription,
    TimeSeriesSnapshot,
    TriggerStatus,
)
from sentry.models import Integration, Project, PagerDutyService, SentryApp
from sentry.snuba.dataset import Dataset
from sentry.snuba.models import QueryDatasets
from sentry.snuba.subscriptions import (
    bulk_create_snuba_subscriptions,
    bulk_enable_snuba_subscriptions,
    bulk_disable_snuba_subscriptions,
    bulk_delete_snuba_subscriptions,
    create_snuba_query,
    update_snuba_query,
)
from sentry.snuba.tasks import build_snuba_filter
from sentry.utils.compat import zip
from sentry.utils.dates import to_timestamp
from sentry.utils.snuba import bulk_raw_query, SnubaQueryParams, SnubaTSResult
from sentry.shared_integrations.exceptions import DuplicateDisplayNameError

# We can return an incident as "windowed" which returns a range of points around the start of the incident
# It attempts to center the start of the incident, only showing earlier data if there isn't enough time
# after the incident started to display the correct start date.
WINDOWED_STATS_DATA_POINTS = 200
NOT_SET = object()


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

    with transaction.atomic():
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
            incident, IncidentActivityType.DETECTED, user=user, date_added=date_detected
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
    with transaction.atomic():
        create_incident_activity(
            incident,
            IncidentActivityType.STATUS_CHANGE,
            user=user,
            value=status.value,
            previous_value=incident.status,
            comment=comment,
        )
        if user:
            subscribe_to_incident(incident, user)

        prev_status = incident.status
        kwargs = {"status": status.value, "status_method": status_method.value}
        if status == IncidentStatus.CLOSED:
            kwargs["date_closed"] = date_closed if date_closed else timezone.now()
        elif status == IncidentStatus.OPEN:
            # If we're moving back out of closed status then unset the closed
            # date
            kwargs["date_closed"] = None
            # Remove the snapshot since it's only used after the incident is
            # closed.
            IncidentSnapshot.objects.filter(incident=incident).delete()
            PendingIncidentSnapshot.objects.filter(incident=incident).delete()

        incident.update(**kwargs)

        if status == IncidentStatus.CLOSED:
            create_pending_incident_snapshot(incident)

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
            if incident_project.project.member_set.filter(user=user).exists():
                is_project_member = True
                break

        if is_project_member:
            incident_seen, created = IncidentSeen.objects.create_or_update(
                incident=incident, user=user, values={"last_seen": timezone.now()}
            )
            return incident_seen

    return False


@transaction.atomic
def create_incident_activity(
    incident,
    activity_type,
    user=None,
    value=None,
    previous_value=None,
    comment=None,
    mentioned_user_ids=None,
    date_added=None,
):
    if activity_type == IncidentActivityType.COMMENT and user:
        subscribe_to_incident(incident, user)
    value = six.text_type(value) if value is not None else value
    previous_value = six.text_type(previous_value) if previous_value is not None else previous_value
    kwargs = {}
    if date_added:
        kwargs["date_added"] = date_added
    activity = IncidentActivity.objects.create(
        incident=incident,
        type=activity_type.value,
        user=user,
        value=value,
        previous_value=previous_value,
        comment=comment,
        **kwargs
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
    tasks.send_subscriber_notifications.apply_async(
        kwargs={"activity_id": activity.id}, countdown=10
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


def create_pending_incident_snapshot(incident):
    if PendingIncidentSnapshot.objects.filter(incident=incident).exists():
        PendingIncidentSnapshot.objects.filter(incident=incident).delete()

    time_window = (
        incident.alert_rule.snuba_query.time_window if incident.alert_rule is not None else 60
    )
    target_run_date = incident.current_end_date + min(
        timedelta(seconds=time_window * 10), timedelta(days=10)
    )
    return PendingIncidentSnapshot.objects.create(
        incident=incident, target_run_date=target_run_date
    )


def create_incident_snapshot(incident, windowed_stats=False):
    """
    Creates a snapshot of an incident. This includes the count of unique users
    and total events, plus a time series snapshot of the entire incident.
    """
    assert incident.status == IncidentStatus.CLOSED.value
    if IncidentSnapshot.objects.filter(incident=incident).exists():
        return None

    start, end = calculate_incident_time_range(incident, windowed_stats=windowed_stats)
    if start == end:
        return IncidentSnapshot.objects.create(
            incident=incident,
            event_stats_snapshot=TimeSeriesSnapshot.objects.create(
                start=start, end=end, values=[], period=incident.alert_rule.snuba_query.time_window,
            ),
            unique_users=0,
            total_events=0,
        )

    event_stats_snapshot = create_event_stat_snapshot(incident, windowed_stats=windowed_stats)
    aggregates = get_incident_aggregates(incident)
    return IncidentSnapshot.objects.create(
        incident=incident,
        event_stats_snapshot=event_stats_snapshot,
        unique_users=aggregates["unique_users"],
        total_events=aggregates["count"],
    )


def create_event_stat_snapshot(incident, windowed_stats=False):
    """
    Creates an event stats snapshot for an incident in a given period of time.
    """

    event_stats = get_incident_event_stats(incident, windowed_stats=windowed_stats)
    start, end = calculate_incident_time_range(incident, windowed_stats=windowed_stats)

    return TimeSeriesSnapshot.objects.create(
        start=start,
        end=end,
        values=[[row["time"], row["count"]] for row in event_stats.data["data"]],
        period=event_stats.rollup,
    )


def build_incident_query_params(incident, start=None, end=None, windowed_stats=False):
    params = {}
    params["start"], params["end"] = calculate_incident_time_range(
        incident, start, end, windowed_stats=windowed_stats
    )

    project_ids = list(
        IncidentProject.objects.filter(incident=incident).values_list("project_id", flat=True)
    )
    if project_ids:
        params["project_id"] = project_ids

    snuba_query = incident.alert_rule.snuba_query
    snuba_filter = build_snuba_filter(
        QueryDatasets(snuba_query.dataset),
        snuba_query.query,
        snuba_query.aggregate,
        snuba_query.environment,
        snuba_query.event_types,
        params=params,
    )

    return {
        "dataset": Dataset(snuba_query.dataset),
        "start": snuba_filter.start,
        "end": snuba_filter.end,
        "conditions": snuba_filter.conditions,
        "filter_keys": snuba_filter.filter_keys,
        "having": [],
        "aggregations": snuba_filter.aggregations,
    }


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


def calculate_incident_prewindow(start, end, incident=None):
    # Make the a bit earlier to show more relevant data from before the incident started:
    prewindow = (end - start) / 5
    if incident and incident.alert_rule is not None:
        alert_rule_time_window = timedelta(seconds=incident.alert_rule.snuba_query.time_window)
        prewindow = max(alert_rule_time_window, prewindow)
    return prewindow


def get_incident_event_stats(incident, start=None, end=None, windowed_stats=False):
    """
    Gets event stats for an incident. If start/end are provided, uses that time
    period, otherwise uses the incident start/current_end.
    """
    query_params = build_incident_query_params(
        incident, start=start, end=end, windowed_stats=windowed_stats
    )
    time_window = incident.alert_rule.snuba_query.time_window
    aggregations = query_params.pop("aggregations")[0]
    snuba_params = [
        SnubaQueryParams(
            aggregations=[(aggregations[0], aggregations[1], "count")],
            orderby="time",
            groupby=["time"],
            rollup=time_window,
            limit=10000,
            **query_params
        )
    ]

    # We make extra queries to fetch these buckets
    def build_extra_query_params(bucket_start):
        extra_bucket_query_params = build_incident_query_params(
            incident, start=bucket_start, end=bucket_start + timedelta(seconds=time_window)
        )
        aggregations = extra_bucket_query_params.pop("aggregations")[0]
        return SnubaQueryParams(
            aggregations=[(aggregations[0], aggregations[1], "count")],
            limit=1,
            **extra_bucket_query_params
        )

    # We want to include the specific buckets for the incident start and closed times,
    # so that there's no need to interpolate to show them on the frontend. If they're
    # cleanly divisible by the `time_window` then there's no need to fetch, since
    # they'll be included in the standard results anyway.
    start_query_params = None
    extra_buckets = []
    if int(to_timestamp(incident.date_started)) % time_window:
        start_query_params = build_extra_query_params(incident.date_started)
        snuba_params.append(start_query_params)
        extra_buckets.append(incident.date_started)

    if incident.date_closed:
        date_closed = incident.date_closed.replace(second=0, microsecond=0)
        if int(to_timestamp(date_closed)) % time_window:
            snuba_params.append(build_extra_query_params(date_closed))
            extra_buckets.append(date_closed)

    results = bulk_raw_query(snuba_params, referrer="incidents.get_incident_event_stats")
    # Once we receive the results, if we requested extra buckets we now need to label
    # them with timestamp data, since the query we ran only returns the count.
    for extra_start, result in zip(extra_buckets, results[1:]):
        result["data"][0]["time"] = int(to_timestamp(extra_start))
    merged_data = list(chain(*[r["data"] for r in results]))
    merged_data.sort(key=lambda row: row["time"])
    results[0]["data"] = merged_data
    # When an incident has just been created it's possible for the actual incident start
    # date to be greater than the latest bucket for the query. Get the actual end date
    # here.
    end_date = snuba_params[0].end
    if start_query_params:
        end_date = max(end_date, start_query_params.end)

    return SnubaTSResult(results[0], snuba_params[0].start, end_date, snuba_params[0].rollup)


def get_incident_aggregates(
    incident, start=None, end=None, windowed_stats=False, use_alert_aggregate=False
):
    """
    Calculates aggregate stats across the life of an incident, or the provided range.
    If `use_alert_aggregate` is True, calculates just the aggregate that the alert is
    for, and returns as the `count` key.
    If False, returns two values:
    - count: Total count of events
    - unique_users: Total number of unique users
    """
    query_params = build_incident_query_params(incident, start, end, windowed_stats)
    if not use_alert_aggregate:
        query_params["aggregations"] = [
            ("count()", "", "count"),
            ("uniq", "tags[sentry:user]", "unique_users"),
        ]
    else:
        query_params["aggregations"][0][2] = "count"
    snuba_params_list = [SnubaQueryParams(limit=10000, **query_params)]
    results = bulk_raw_query(snuba_params_list, referrer="incidents.get_incident_aggregates")
    return results[0]["data"][0]


def get_incident_stats(incident, windowed_stats=False):
    """
    Returns stats for an incident. This includes unique user count, total event count
    and event stats.
    Note that even though this function accepts a windowed_stats parameter, it does not
    affect the snapshots. Only the live fetched stats.
    """
    if windowed_stats and incident.status == IncidentStatus.CLOSED.value:
        # At the moment, snapshots are only ever created with windowed_stats as True
        # so if they send False, we need to do a live calculation below.
        try:
            snapshot = IncidentSnapshot.objects.get(incident=incident)
            event_stats = snapshot.event_stats_snapshot
            return {
                "event_stats": SnubaTSResult(
                    event_stats.snuba_values, event_stats.start, event_stats.end, event_stats.period
                ),
                "total_events": snapshot.total_events,
                "unique_users": snapshot.unique_users,
            }
        except IncidentSnapshot.DoesNotExist:
            pass

    event_stats = get_incident_event_stats(incident, windowed_stats=windowed_stats)
    aggregates = get_incident_aggregates(incident)
    return {
        "event_stats": event_stats,
        "total_events": aggregates["count"],
        "unique_users": aggregates["unique_users"],
    }


def subscribe_to_incident(incident, user):
    return IncidentSubscription.objects.get_or_create(incident=incident, user=user)


def unsubscribe_from_incident(incident, user):
    return IncidentSubscription.objects.filter(incident=incident, user=user).delete()


def get_incident_subscribers(incident):
    return IncidentSubscription.objects.filter(incident=incident)


def get_incident_activity(incident):
    return IncidentActivity.objects.filter(incident=incident).select_related("user", "incident")


class AlertRuleNameAlreadyUsedError(Exception):
    pass


DEFAULT_ALERT_RULE_RESOLUTION = 1


def create_alert_rule(
    organization,
    projects,
    name,
    query,
    aggregate,
    time_window,
    threshold_type,
    threshold_period,
    resolve_threshold=None,
    environment=None,
    include_all_projects=False,
    excluded_projects=None,
    dataset=QueryDatasets.EVENTS,
    user=None,
    **kwargs
):
    """
    Creates an alert rule for an organization.

    :param organization:
    :param projects: A list of projects to subscribe to the rule. This will be overriden
    if `include_all_projects` is True
    :param name: Name for the alert rule. This will be used as part of the
    incident name, and must be unique per project
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
    :param dataset: The dataset that this query will be executed on

    :return: The created `AlertRule`
    """
    resolution = DEFAULT_ALERT_RULE_RESOLUTION
    validate_alert_rule_query(query)
    if AlertRule.objects.filter(organization=organization, name=name).exists():
        raise AlertRuleNameAlreadyUsedError()
    with transaction.atomic():
        snuba_query = create_snuba_query(
            dataset,
            query,
            aggregate,
            timedelta(minutes=time_window),
            timedelta(minutes=resolution),
            environment,
        )
        alert_rule = AlertRule.objects.create(
            organization=organization,
            snuba_query=snuba_query,
            name=name,
            threshold_type=threshold_type.value,
            resolve_threshold=resolve_threshold,
            threshold_period=threshold_period,
            include_all_projects=include_all_projects,
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
            alert_rule=alert_rule, user=user, type=AlertRuleActivityType.CREATED.value
        )

    return alert_rule


def snapshot_alert_rule(alert_rule, user=None):
    # Creates an archived alert_rule using the same properties as the passed rule
    # It will also resolve any incidents attached to this rule.
    with transaction.atomic():
        triggers = AlertRuleTrigger.objects.filter(alert_rule=alert_rule)
        incidents = Incident.objects.filter(alert_rule=alert_rule)
        snuba_query_snapshot = deepcopy(alert_rule.snuba_query)
        snuba_query_snapshot.id = None
        snuba_query_snapshot.save()
        alert_rule_snapshot = deepcopy(alert_rule)
        alert_rule_snapshot.id = None
        alert_rule_snapshot.status = AlertRuleStatus.SNAPSHOT.value
        alert_rule_snapshot.snuba_query = snuba_query_snapshot
        alert_rule_snapshot.save()
        AlertRuleActivity.objects.create(
            alert_rule=alert_rule_snapshot,
            previous_alert_rule=alert_rule,
            user=user,
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
    dataset=None,
    projects=None,
    name=None,
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
    **kwargs
):
    """
    Updates an alert rule.

    :param alert_rule: The alert rule to update
    :param excluded_projects: List of projects to subscribe to the rule. Ignored if
    `include_all_projects` is True
    :param name: Name for the alert rule. This will be used as part of the
    incident name, and must be unique per project.
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
    :return: The updated `AlertRule`
    """
    if (
        name
        and alert_rule.name != name
        and AlertRule.objects.filter(organization=alert_rule.organization, name=name).exists()
    ):
        raise AlertRuleNameAlreadyUsedError()

    updated_fields = {}
    updated_query_fields = {}
    if name:
        updated_fields["name"] = name
    if query is not None:
        validate_alert_rule_query(query)
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
    if dataset is not None and dataset.value != alert_rule.snuba_query.dataset:
        updated_query_fields["dataset"] = dataset

    with transaction.atomic():
        incidents = Incident.objects.filter(alert_rule=alert_rule).exists()
        if incidents:
            snapshot_alert_rule(alert_rule, user)
        alert_rule.update(**updated_fields)
        AlertRuleActivity.objects.create(
            alert_rule=alert_rule, user=user, type=AlertRuleActivityType.UPDATED.value
        )

        if updated_query_fields or environment != alert_rule.snuba_query.environment:
            snuba_query = alert_rule.snuba_query
            updated_query_fields.setdefault("dataset", QueryDatasets(snuba_query.dataset))
            updated_query_fields.setdefault("query", snuba_query.query)
            updated_query_fields.setdefault("aggregate", snuba_query.aggregate)
            updated_query_fields.setdefault(
                "time_window", timedelta(seconds=snuba_query.time_window)
            )
            update_snuba_query(
                alert_rule.snuba_query,
                resolution=timedelta(minutes=DEFAULT_ALERT_RULE_RESOLUTION),
                environment=environment,
                **updated_query_fields
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
                    id__in=set([sub.project_id for sub in existing_subs]) | excluded_project_ids
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
    with transaction.atomic():
        alert_rule.update(status=AlertRuleStatus.PENDING.value)
        bulk_enable_snuba_subscriptions(alert_rule.snuba_query.subscriptions.all())


def disable_alert_rule(alert_rule):
    if alert_rule.status != AlertRuleStatus.PENDING.value:
        return
    with transaction.atomic():
        alert_rule.update(status=AlertRuleStatus.DISABLED.value)
        bulk_disable_snuba_subscriptions(alert_rule.snuba_query.subscriptions.all())


def delete_alert_rule(alert_rule, user=None):
    """
    Marks an alert rule as deleted and fires off a task to actually delete it.
    :param alert_rule:
    """
    if alert_rule.status == AlertRuleStatus.SNAPSHOT.value:
        raise AlreadyDeletedError()

    with transaction.atomic():
        incidents = Incident.objects.filter(alert_rule=alert_rule)
        bulk_delete_snuba_subscriptions(list(alert_rule.snuba_query.subscriptions.all()))
        if incidents:
            alert_rule.update(status=AlertRuleStatus.SNAPSHOT.value)
            AlertRuleActivity.objects.create(
                alert_rule=alert_rule, user=user, type=AlertRuleActivityType.DELETED.value
            )
        else:
            alert_rule.delete()

    if alert_rule.id:
        # Change the incident status asynchronously, which could take awhile with many incidents due to snapshot creations.
        tasks.auto_resolve_snapshot_incidents.apply_async(kwargs={"alert_rule_id": alert_rule.id})


def validate_alert_rule_query(query):
    # TODO: We should add more validation here to reject queries that include
    # fields that are invalid in alert rules. For now this will just make sure
    # the query parses correctly.
    get_filter(query)


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

    with transaction.atomic():
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

    with transaction.atomic():
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

    triggers = IncidentTrigger.objects.filter(incident=incident).select_related(
        "alert_rule_trigger"
    )
    for trigger in triggers:
        if trigger.status == TriggerStatus.ACTIVE.value:
            with transaction.atomic():
                method = "resolve"
                for action in AlertRuleTriggerAction.objects.filter(
                    alert_rule_trigger=trigger.alert_rule_trigger
                ):
                    for project in incident.projects.all():
                        transaction.on_commit(
                            handle_trigger_action.s(
                                action_id=action.id,
                                incident_id=incident.id,
                                project_id=project.id,
                                method=method,
                            ).delay
                        )
                trigger.status = TriggerStatus.RESOLVED.value
                trigger.save()


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
        invalid_slugs = set([p.slug for p in projects]) - set(
            [s.project.slug for s in excluded_subscriptions]
        )
        raise ProjectsNotAssociatedWithAlertRuleError(invalid_slugs)
    return excluded_subscriptions


def create_alert_rule_trigger_action(
    trigger,
    type,
    target_type,
    target_identifier=None,
    integration=None,
    sentry_app=None,
    use_async_lookup=False,
):
    """
    Creates an AlertRuleTriggerAction
    :param trigger: The trigger to create the action on
    :param type: Which sort of action to take
    :param target_type: Which type of target to send to
    :param target_identifier: (Optional) The identifier of the target
    :param target_display: (Optional) Human readable name for the target
    :param integration: (Optional) The Integration related to this action.
    :param sentry_app: (Optional) The Sentry App related to this action.
    :return: The created action
    """
    target_display = None
    if type.value in AlertRuleTriggerAction.INTEGRATION_TYPES:
        if target_type != AlertRuleTriggerAction.TargetType.SPECIFIC:
            raise InvalidTriggerActionError("Must specify specific target type")

        target_identifier, target_display = get_target_identifier_display_for_integration(
            type.value,
            target_identifier,
            trigger.alert_rule.organization,
            integration.id,
            use_async_lookup=use_async_lookup,
        )
    elif type == AlertRuleTriggerAction.Type.SENTRY_APP:
        target_identifier, target_display = get_alert_rule_trigger_action_sentry_app(
            trigger.alert_rule.organization, sentry_app.id
        )

    return AlertRuleTriggerAction.objects.create(
        alert_rule_trigger=trigger,
        type=type.value,
        target_type=target_type.value,
        target_identifier=target_identifier,
        target_display=target_display,
        integration=integration,
        sentry_app=sentry_app,
    )


def update_alert_rule_trigger_action(
    trigger_action,
    type=None,
    target_type=None,
    target_identifier=None,
    integration=None,
    sentry_app=None,
    use_async_lookup=False,
):
    """
    Updates values on an AlertRuleTriggerAction
    :param trigger_action: The trigger action to update
    :param type: Which sort of action to take
    :param target_type: Which type of target to send to
    :param target_identifier: The identifier of the target
    :param integration: (Optional) The Integration related to this action.
    :param sentry_app: (Optional) The SentryApp related to this action.
    :return:
    """
    updated_fields = {}
    if type is not None:
        updated_fields["type"] = type.value
    if target_type is not None:
        updated_fields["target_type"] = target_type.value
    if integration is not None:
        updated_fields["integration"] = integration
    if sentry_app is not None:
        updated_fields["sentry_app"] = sentry_app
    if target_identifier is not None:
        type = updated_fields.get("type", trigger_action.type)

        if type in AlertRuleTriggerAction.INTEGRATION_TYPES:
            integration = updated_fields.get("integration", trigger_action.integration)
            organization = trigger_action.alert_rule_trigger.alert_rule.organization

            target_identifier, target_display = get_target_identifier_display_for_integration(
                type,
                target_identifier,
                organization,
                integration.id,
                use_async_lookup=use_async_lookup,
            )
            updated_fields["target_display"] = target_display

        elif type == AlertRuleTriggerAction.Type.SENTRY_APP.value:
            sentry_app = updated_fields.get("sentry_app", trigger_action.sentry_app)
            organization = trigger_action.alert_rule_trigger.alert_rule.organization

            target_identifier, target_display = get_alert_rule_trigger_action_sentry_app(
                organization, sentry_app.id
            )
            updated_fields["target_display"] = target_display

        updated_fields["target_identifier"] = target_identifier
    trigger_action.update(**updated_fields)
    return trigger_action


def get_target_identifier_display_for_integration(type, target_value, *args, **kwargs):
    # target_value is the Slack username or channel name
    if type == AlertRuleTriggerAction.Type.SLACK.value:
        target_identifier = get_alert_rule_trigger_action_slack_channel_id(
            target_value, *args, **kwargs
        )
    # target_value is the MSTeams username or channel name
    elif type == AlertRuleTriggerAction.Type.MSTEAMS.value:
        target_identifier = get_alert_rule_trigger_action_msteams_channel_id(
            target_value, *args, **kwargs
        )
    # target_value is the ID of the PagerDuty service
    elif type == AlertRuleTriggerAction.Type.PAGERDUTY.value:
        target_identifier, target_value = get_alert_rule_trigger_action_pagerduty_service(
            target_value, *args, **kwargs
        )
    else:
        raise Exception("Not implemented")

    return target_identifier, target_value


def get_alert_rule_trigger_action_slack_channel_id(
    name, organization, integration_id, use_async_lookup
):
    from sentry.integrations.slack.utils import get_channel_id

    try:
        integration = Integration.objects.get(id=integration_id)
    except Integration.DoesNotExist:
        raise InvalidTriggerActionError("Slack workspace is a required field.")

    try:
        _prefix, channel_id, timed_out = get_channel_id(
            organization, integration, name, use_async_lookup
        )
    except DuplicateDisplayNameError as e:
        domain = integration.metadata["domain_name"]

        raise InvalidTriggerActionError(
            'Multiple users were found with display name "%s". Please use your username, found at %s/account/settings.'
            % (e.message, domain)
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


def get_alert_rule_trigger_action_msteams_channel_id(
    name, organization, integration_id, use_async_lookup=False
):
    from sentry.integrations.msteams.utils import get_channel_id

    channel_id = get_channel_id(organization, integration_id, name)

    if channel_id is None:
        # no granting access for msteams channels unlike slack
        raise InvalidTriggerActionError("Could not find channel %s." % name)

    return channel_id


def get_alert_rule_trigger_action_pagerduty_service(
    target_value, organization, integration_id, use_async_lookup=False
):
    try:
        service = PagerDutyService.objects.get(id=target_value)
    except PagerDutyService.DoesNotExist:
        raise InvalidTriggerActionError("No PagerDuty service found.")

    return (service.id, service.service_name)


def get_alert_rule_trigger_action_sentry_app(organization, sentry_app_id):
    try:
        sentry_app = SentryApp.objects.get(id=sentry_app_id, owner=organization)
    except SentryApp.DoesNotExist:
        raise InvalidTriggerActionError("No SentryApp found.")

    return sentry_app.id, sentry_app.name


def delete_alert_rule_trigger_action(trigger_action):
    """
    Deletes a AlertRuleTriggerAction
    """
    trigger_action.delete()


def get_actions_for_trigger(trigger):
    return AlertRuleTriggerAction.objects.filter(alert_rule_trigger=trigger)


def get_available_action_integrations_for_org(organization):
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
    return Integration.objects.filter(organizations=organization, provider__in=providers)


def get_alertable_sentry_apps(organization_id, with_metric_alerts=False):
    query = SentryApp.objects.filter(
        installations__organization_id=organization_id,
        is_alertable=True,
        installations__status=SentryAppInstallationStatus.INSTALLED,
        installations__date_deleted=None,
    )

    if with_metric_alerts:
        query = query.exclude(status=SentryAppStatus.PUBLISHED)
    return query.distinct()


def get_pagerduty_services(organization, integration_id):
    return PagerDutyService.objects.filter(
        organization_integration__organization=organization,
        organization_integration__integration_id=integration_id,
    ).values("id", "service_name")


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


def get_column_from_aggregate(aggregate):
    field = resolve_field(aggregate)
    if field[1] is not None:
        column = field[1][0][1]
        return column
    return None


def check_aggregate_column_support(aggregate):
    column = get_column_from_aggregate(aggregate)
    return column is None or column in SUPPORTED_COLUMNS or column in TRANSLATABLE_COLUMNS


def translate_aggregate_field(aggregate, reverse=False):
    column = get_column_from_aggregate(aggregate)
    if not reverse:
        if column in TRANSLATABLE_COLUMNS:
            return aggregate.replace(column, TRANSLATABLE_COLUMNS[column])
    else:
        if column is not None:
            for field, translated_field in TRANSLATABLE_COLUMNS.items():
                if translated_field == column:
                    return aggregate.replace(column, field)
    return aggregate
