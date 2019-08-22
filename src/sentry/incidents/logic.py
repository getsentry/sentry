from __future__ import absolute_import

import json
import uuid
from collections import defaultdict
from datetime import timedelta
from uuid import uuid4

import pytz
import six
from dateutil.parser import parse as parse_date
from django.db import transaction
from django.utils import timezone

from sentry import analytics
from sentry.api.event_search import get_snuba_query_args
from sentry.incidents.models import (
    AlertRule,
    AlertRuleAggregations,
    AlertRuleStatus,
    Incident,
    IncidentActivity,
    IncidentActivityType,
    IncidentGroup,
    IncidentProject,
    IncidentSnapshot,
    IncidentSeen,
    IncidentStatus,
    IncidentSubscription,
    IncidentType,
    SnubaDatasets,
    TimeSeriesSnapshot,
)
from sentry.models import Commit, Release
from sentry.incidents import tasks
from sentry.utils.committers import get_event_file_committers
from sentry.utils.snuba import (
    _snuba_pool,
    bulk_raw_query,
    raw_query,
    SnubaError,
    SnubaQueryParams,
    SnubaTSResult,
    zerofill,
)

MAX_INITIAL_INCIDENT_PERIOD = timedelta(days=7)
alert_aggregation_to_snuba = {
    AlertRuleAggregations.TOTAL: ("count()", "", "count"),
    AlertRuleAggregations.UNIQUE_USERS: ("uniq", "tags[sentry:user]", "unique_users"),
}


class StatusAlreadyChangedError(Exception):
    pass


class AlreadyDeletedError(Exception):
    pass


def create_incident(
    organization,
    type,
    title,
    query,
    date_started=None,
    date_detected=None,
    detection_uuid=None,
    projects=None,
    groups=None,
    user=None,
):
    if groups:
        group_projects = [g.project for g in groups]
        if projects is None:
            projects = []
        projects = list(set(projects + group_projects))

    if date_started is None:
        date_started = calculate_incident_start(query, projects, groups)

    if date_detected is None:
        date_detected = date_started

    with transaction.atomic():
        incident = Incident.objects.create(
            organization=organization,
            detection_uuid=detection_uuid,
            status=IncidentStatus.OPEN.value,
            type=type.value,
            title=title,
            query=query,
            date_started=date_started,
            date_detected=date_detected,
        )
        if projects:
            IncidentProject.objects.bulk_create(
                [IncidentProject(incident=incident, project=project) for project in projects]
            )
        if groups:
            IncidentGroup.objects.bulk_create(
                [IncidentGroup(incident=incident, group=group) for group in groups]
            )

        if type == IncidentType.CREATED:
            activity_status = IncidentActivityType.CREATED
        else:
            activity_status = IncidentActivityType.DETECTED

        event_stats_snapshot = create_initial_event_stats_snapshot(incident)
        create_incident_activity(
            incident, activity_status, event_stats_snapshot=event_stats_snapshot, user=user
        )
        analytics.record(
            "incident.created",
            incident_id=incident.id,
            organization_id=incident.organization_id,
            incident_type=type.value,
        )

    tasks.calculate_incident_suspects.apply_async(kwargs={"incident_id": incident.id})
    return incident


INCIDENT_START_PERIOD = timedelta(days=14)
INCIDENT_START_ROLLUP = timedelta(minutes=15)


def calculate_incident_start(query, projects, groups):
    """
    Attempts to automatically calculate the date that an incident began at based
    on the events related to the incident.
    """
    params = {}
    if groups:
        params["issue.id"] = [g.id for g in groups]
        end = max(g.last_seen for g in groups) + timedelta(seconds=1)
    else:
        end = timezone.now()

    params["start"] = end - INCIDENT_START_PERIOD
    params["end"] = end

    if projects:
        params["project_id"] = [p.id for p in projects]

    query_args = get_snuba_query_args(query, params)
    rollup = int(INCIDENT_START_ROLLUP.total_seconds())

    result = raw_query(
        aggregations=[("count()", "", "count"), ("min", "timestamp", "first_seen")],
        orderby="time",
        groupby=["time"],
        rollup=rollup,
        referrer="incidents.calculate_incident_start",
        limit=10000,
        **query_args
    )["data"]
    # TODO: Start could be the period before the first period we find
    result = zerofill(result, params["start"], params["end"], rollup, "time")

    # We want to linearly scale scores from 100% value at the most recent to
    # 50% at the oldest. This gives a bias towards newer results.
    negative_weight = (1.0 / len(result)) / 2
    multiplier = 1.0
    cur_spike_max_count = -1
    cur_spike_start = None
    cur_spike_end = None
    max_height = 0
    incident_start = None
    cur_height = 0
    prev_count = 0

    def get_row_first_seen(row, default=None):
        first_seen = default
        if "first_seen" in row:
            first_seen = parse_date(row["first_seen"]).replace(tzinfo=pytz.utc)
        return first_seen

    def calculate_start(spike_start, spike_end):
        """
        We arbitrarily choose a date about 1/3 into the incident period. We
        could potentially improve this if we want by analyzing the period in
        more detail and choosing a date that most closely fits with being 1/3
        up the spike.
        """
        spike_length = spike_end - spike_start
        return spike_start + (spike_length / 3)

    for row in reversed(result):
        cur_count = row.get("count", 0)
        if cur_count < prev_count or cur_count > 0 and cur_count == prev_count:
            cur_height = cur_spike_max_count - cur_count
        elif cur_count > 0 or prev_count > 0 or cur_height > 0:
            # Now we've got the height of the current spike, compare it to the
            # current max. We decrease the value by `multiplier` so that we
            # favour newer results
            cur_height *= multiplier
            if cur_height > max_height:
                # If we detect that we have a new highest peak, then set a new
                # incident start date
                incident_start = calculate_start(cur_spike_start, cur_spike_end)
                max_height = cur_height

            cur_height = 0
            cur_spike_max_count = cur_count
            cur_spike_end = get_row_first_seen(row)

        # We attempt to get the first_seen value from the row here. If the row
        # doesn't have it (because it's a zerofilled row), then just use the
        # previous value. This allows us to have the start of a spike always be
        # a bucket that contains at least one element.
        cur_spike_start = get_row_first_seen(row, cur_spike_start)
        prev_count = cur_count
        multiplier -= negative_weight

    if (cur_height > max_height or not incident_start) and cur_spike_start:
        incident_start = calculate_start(cur_spike_start, cur_spike_end)

    if not incident_start:
        incident_start = timezone.now()

    return incident_start


def update_incident_status(incident, status, user=None, comment=None):
    """
    Updates the status of an Incident and write an IncidentActivity row to log
    the change. When the status is CLOSED we also set the date closed to the
    current time and take a snapshot of the current incident state.
    """
    if incident.status == status.value:
        # If the status isn't actually changing just no-op.
        raise StatusAlreadyChangedError()
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

        kwargs = {"status": status.value}
        if status == IncidentStatus.CLOSED:
            kwargs["date_closed"] = timezone.now()
        elif status == IncidentStatus.OPEN:
            # If we're moving back out of closed status then unset the closed
            # date
            kwargs["date_closed"] = None
            # Remove the snapshot since it's only used after the incident is
            # closed.
            IncidentSnapshot.objects.filter(incident=incident).delete()

        incident.update(**kwargs)

        if status == IncidentStatus.CLOSED:
            create_incident_snapshot(incident)

        analytics.record(
            "incident.status_change",
            incident_id=incident.id,
            organization_id=incident.organization_id,
            incident_type=incident.type,
            prev_status=prev_status,
            status=incident.status,
        )
        return incident


def set_incident_seen(incident, user=None):
    """
    Updates the incident to be seen
    """
    incident_seen, created = IncidentSeen.objects.create_or_update(
        incident=incident, user=user, values={"last_seen": timezone.now()}
    )

    return incident_seen


def create_initial_event_stats_snapshot(incident):
    """
    Creates an event snapshot representing the state at the beginning of
    an incident. It's intended to capture the history of the events involved in
    the incident, the spike and a short period of time after that.
    """
    initial_period_length = min(timezone.now() - incident.date_started, MAX_INITIAL_INCIDENT_PERIOD)
    end = incident.date_started + initial_period_length
    start = end - (initial_period_length * 4)
    return create_event_stat_snapshot(incident, start, end)


@transaction.atomic
def create_incident_activity(
    incident,
    activity_type,
    user=None,
    value=None,
    previous_value=None,
    comment=None,
    event_stats_snapshot=None,
    mentioned_user_ids=None,
):
    if activity_type == IncidentActivityType.COMMENT and user:
        subscribe_to_incident(incident, user)
    value = six.text_type(value) if value is not None else value
    previous_value = six.text_type(previous_value) if previous_value is not None else previous_value
    activity = IncidentActivity.objects.create(
        incident=incident,
        type=activity_type.value,
        user=user,
        value=value,
        previous_value=previous_value,
        comment=comment,
        event_stats_snapshot=event_stats_snapshot,
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


def create_incident_snapshot(incident):
    """
    Creates a snapshot of an incident. This includes the count of unique users
    and total events, plus a time series snapshot of the entire incident.
    """
    assert incident.status == IncidentStatus.CLOSED.value
    event_stats_snapshot = create_event_stat_snapshot(
        incident, incident.date_started, incident.date_closed
    )
    aggregates = get_incident_aggregates(incident)
    return IncidentSnapshot.objects.create(
        incident=incident,
        event_stats_snapshot=event_stats_snapshot,
        unique_users=aggregates["unique_users"],
        total_events=aggregates["count"],
    )


def create_event_stat_snapshot(incident, start, end):
    """
    Creates an event stats snapshot for an incident in a given period of time.
    """
    event_stats = get_incident_event_stats(incident, start, end)
    return TimeSeriesSnapshot.objects.create(
        start=start,
        end=end,
        values=[[row["time"], row["count"]] for row in event_stats.data["data"]],
        period=event_stats.rollup,
    )


def build_incident_query_params(incident, start=None, end=None):
    return bulk_build_incident_query_params([incident], start=start, end=end)[0]


def bulk_build_incident_query_params(incidents, start=None, end=None):
    incident_groups = defaultdict(list)
    for incident_id, group_id in IncidentGroup.objects.filter(incident__in=incidents).values_list(
        "incident_id", "group_id"
    ):
        incident_groups[incident_id].append(group_id)
    incident_projects = defaultdict(list)
    for incident_id, project_id in IncidentProject.objects.filter(
        incident__in=incidents
    ).values_list("incident_id", "project_id"):
        incident_projects[incident_id].append(project_id)

    query_args_list = []
    for incident in incidents:
        params = {
            "start": incident.date_started if start is None else start,
            "end": incident.current_end_date if end is None else end,
        }
        group_ids = incident_groups[incident.id]
        if group_ids:
            params["issue.id"] = group_ids
        project_ids = incident_projects[incident.id]
        if project_ids:
            params["project_id"] = project_ids
        query_args_list.append(get_snuba_query_args(incident.query, params))

    return query_args_list


def get_incident_event_stats(incident, start=None, end=None, data_points=50):
    """
    Gets event stats for an incident. If start/end are provided, uses that time
    period, otherwise uses the incident start/current_end.
    """
    query_params = bulk_build_incident_query_params([incident], start=start, end=end)
    return bulk_get_incident_event_stats([incident], query_params, data_points=data_points)[0]


def bulk_get_incident_event_stats(incidents, query_params_list, data_points=50):
    snuba_params_list = [
        SnubaQueryParams(
            aggregations=[("count()", "", "count")],
            orderby="time",
            groupby=["time"],
            rollup=max(int(incident.duration.total_seconds() / data_points), 1),
            limit=10000,
            **query_param
        )
        for incident, query_param in zip(incidents, query_params_list)
    ]
    results = bulk_raw_query(snuba_params_list, referrer="incidents.get_incident_event_stats")
    return [
        SnubaTSResult(result, snuba_params.start, snuba_params.end, snuba_params.rollup)
        for snuba_params, result in zip(snuba_params_list, results)
    ]


def get_incident_aggregates(incident):
    """
    Calculates aggregate stats across the life of an incident.
    - count: Total count of events
    - unique_users: Total number of unique users
    """
    query_params = build_incident_query_params(incident)
    return bulk_get_incident_aggregates([query_params])[0]


def bulk_get_incident_aggregates(query_params_list):
    snuba_params_list = [
        SnubaQueryParams(
            aggregations=[("count()", "", "count"), ("uniq", "tags[sentry:user]", "unique_users")],
            limit=10000,
            **query_param
        )
        for query_param in query_params_list
    ]
    results = bulk_raw_query(snuba_params_list, referrer="incidents.get_incident_aggregates")
    return [result["data"][0] for result in results]


def bulk_get_incident_stats(incidents):
    """
    Returns bulk stats for a list of incidents. This includes unique user count,
    total event count and event stats.
    """
    closed = [i for i in incidents if i.status == IncidentStatus.CLOSED.value]
    incident_stats = {}
    snapshots = IncidentSnapshot.objects.filter(incident__in=closed)
    for snapshot in snapshots:
        event_stats = snapshot.event_stats_snapshot
        incident_stats[snapshot.incident_id] = {
            "event_stats": SnubaTSResult(
                event_stats.snuba_values, event_stats.start, event_stats.end, event_stats.period
            ),
            "total_events": snapshot.total_events,
            "unique_users": snapshot.unique_users,
        }

    to_fetch = [i for i in incidents if i.id not in incident_stats]
    if to_fetch:
        query_params_list = bulk_build_incident_query_params(to_fetch)
        all_event_stats = bulk_get_incident_event_stats(to_fetch, query_params_list)
        all_aggregates = bulk_get_incident_aggregates(query_params_list)
        for incident, event_stats, aggregates in zip(to_fetch, all_event_stats, all_aggregates):
            incident_stats[incident.id] = {
                "event_stats": event_stats,
                "total_events": aggregates["count"],
                "unique_users": aggregates["unique_users"],
            }

    return [incident_stats[incident.id] for incident in incidents]


def subscribe_to_incident(incident, user):
    return IncidentSubscription.objects.get_or_create(incident=incident, user=user)


def unsubscribe_from_incident(incident, user):
    return IncidentSubscription.objects.filter(incident=incident, user=user).delete()


def get_incident_subscribers(incident):
    return IncidentSubscription.objects.filter(incident=incident)


def get_incident_activity(incident):
    return IncidentActivity.objects.filter(incident=incident).select_related(
        "user", "event_stats_snapshot", "incident"
    )


def get_incident_suspects(incident, projects):
    return Commit.objects.filter(
        incidentsuspectcommit__incident=incident, releasecommit__release__projects__in=projects
    ).distinct()


def get_incident_suspect_commits(incident):
    groups = list(incident.groups.all())
    # For now, we want to track whether we've seen a commit before to avoid
    # duplicates. We'll probably use a commit being seen across multiple groups
    # as a way to increase score in the future.
    seen = set()
    for group in groups:
        event = group.get_latest_event_for_environments()
        try:
            committers = get_event_file_committers(group.project, event)
        except (Release.DoesNotExist, Commit.DoesNotExist):
            continue

        for committer in committers:
            for (commit, _) in committer["commits"]:
                if commit.id in seen:
                    continue
                seen.add(commit.id)
                yield commit.id


class AlertRuleNameAlreadyUsedError(Exception):
    pass


DEFAULT_ALERT_RULE_RESOLUTION = 1


def create_alert_rule(
    project,
    name,
    threshold_type,
    query,
    aggregations,
    time_window,
    alert_threshold,
    resolve_threshold,
    threshold_period,
):
    """
    Creates an alert rule for a project.

    :param project:
    :param name: Name for the alert rule. This will be used as part of the
    incident name, and must be unique per project.
    :param threshold_type: An AlertRuleThresholdType
    :param query: An event search query to subscribe to and monitor for alerts
    :param aggregations: A list of AlertRuleAggregations that we want to fetch
    for this alert rule
    :param time_window: Time period to aggregate over, in minutes.
    :param alert_threshold: Value that the subscription needs to reach to
    trigger the alert
    :param resolve_threshold: Value that the subscription needs to reach to
    resolve the alert
    :param threshold_period: How many update periods the value of the
    subscription needs to exceed the threshold before triggering
    :return: The created `AlertRule`
    """
    subscription_id = None
    dataset = SnubaDatasets.EVENTS
    resolution = DEFAULT_ALERT_RULE_RESOLUTION
    validate_alert_rule_query(query)
    if AlertRule.objects.filter(project=project, name=name).exists():
        raise AlertRuleNameAlreadyUsedError()
    try:
        subscription_id = create_snuba_subscription(
            project, dataset, query, aggregations, time_window, resolution
        )
        alert_rule = AlertRule.objects.create(
            project=project,
            name=name,
            subscription_id=subscription_id,
            threshold_type=threshold_type.value,
            dataset=SnubaDatasets.EVENTS.value,
            query=query,
            aggregations=[agg.value for agg in aggregations],
            time_window=time_window,
            resolution=resolution,
            alert_threshold=alert_threshold,
            resolve_threshold=resolve_threshold,
            threshold_period=threshold_period,
        )
    except Exception:
        # If we error for some reason and have a valid subscription_id then
        # attempt to delete from snuba to avoid orphaned subscriptions.
        if subscription_id:
            delete_snuba_subscription(subscription_id)
        raise
    return alert_rule


def update_alert_rule(
    alert_rule,
    name=None,
    threshold_type=None,
    query=None,
    aggregations=None,
    time_window=None,
    alert_threshold=None,
    resolve_threshold=None,
    threshold_period=None,
):
    """
    Updates an alert rule.

    :param alert_rule: The alert rule to update
    :param name: Name for the alert rule. This will be used as part of the
    incident name, and must be unique per project.
    :param threshold_type: An AlertRuleThresholdType
    :param query: An event search query to subscribe to and monitor for alerts
    :param aggregations: A list of AlertRuleAggregations that we want to fetch
    for this alert rule
    :param time_window: Time period to aggregate over, in minutes.
    :param alert_threshold: Value that the subscription needs to reach to
    trigger the alert
    :param resolve_threshold: Value that the subscription needs to reach to
    resolve the alert
    :param threshold_period: How many update periods the value of the
    subscription needs to exceed the threshold before triggering
    :return: The updated `AlertRule`
    """
    if (
        name
        and alert_rule.name != name
        and AlertRule.objects.filter(project=alert_rule.project, name=name).exists()
    ):
        raise AlertRuleNameAlreadyUsedError()

    old_subscription_id = None
    subscription_id = None
    updated_fields = {}
    if name:
        updated_fields["name"] = name
    if threshold_type:
        updated_fields["threshold_type"] = threshold_type.value
    if query is not None:
        validate_alert_rule_query(query)
        updated_fields["query"] = query
    if aggregations:
        updated_fields["aggregations"] = [a.value for a in aggregations]
    if time_window:
        updated_fields["time_window"] = time_window
    if alert_threshold:
        updated_fields["alert_threshold"] = alert_threshold
    if resolve_threshold:
        updated_fields["resolve_threshold"] = resolve_threshold
    if threshold_period:
        updated_fields["threshold_period"] = threshold_period

    if query or aggregations or time_window:
        old_subscription_id = alert_rule.subscription_id
        # If updating any details of the query, create a new subscription
        subscription_id = create_snuba_subscription(
            alert_rule.project,
            SnubaDatasets(alert_rule.dataset),
            query if query is not None else alert_rule.query,
            aggregations
            if aggregations
            else [AlertRuleAggregations(agg) for agg in alert_rule.aggregations],
            time_window if time_window else alert_rule.time_window,
            DEFAULT_ALERT_RULE_RESOLUTION,
        )
        updated_fields["subscription_id"] = subscription_id

    try:
        alert_rule.update(**updated_fields)
    except Exception:
        # If we error for some reason and have a valid subscription_id then
        # attempt to delete from snuba to avoid orphaned subscriptions.
        if subscription_id:
            delete_snuba_subscription(subscription_id)
        raise

    if old_subscription_id:
        # Once we're set up correctly, remove the previous subscription id.
        delete_snuba_subscription(old_subscription_id)

    return alert_rule


def delete_alert_rule(alert_rule):
    """
    Marks an alert rule as deleted and fires off a task to actually delete it.
    :param alert_rule:
    """
    if alert_rule.status in (
        AlertRuleStatus.PENDING_DELETION.value,
        AlertRuleStatus.DELETION_IN_PROGRESS.value,
    ):
        raise AlreadyDeletedError()

    alert_rule.update(
        # Randomize the name here so that we don't get unique constraint issues
        # while waiting for the deletion to process
        name=uuid4().get_hex(),
        status=AlertRuleStatus.PENDING_DELETION.value,
    )
    tasks.delete_alert_rule.apply_async(kwargs={"alert_rule_id": alert_rule.id})
    delete_snuba_subscription(alert_rule.subscription_id)


def validate_alert_rule_query(query):
    # TODO: We should add more validation here to reject queries that include
    # fields that are invalid in alert rules. For now this will just make sure
    # the query parses correctly.
    get_snuba_query_args(query)


def create_snuba_subscription(project, dataset, query, aggregations, time_window, resolution):
    """
    Creates a subscription to a snuba query.

    :param project: The project we're applying the query to
    :param dataset: The snuba dataset to query and aggregate over
    :param query: An event search query that we can parse and convert into a
    set of Snuba conditions
    :param aggregations: A list of aggregations to calculate over the time
    window
    :param time_window: The time window to aggregate over
    :param resolution: How often to receive updates/bucket size
    :return: A uuid representing the subscription id.
    """
    # TODO: Might make sense to move this into snuba if we have wider use for
    # it.
    response = _snuba_pool.urlopen(
        "POST",
        "/subscriptions",
        body=json.dumps(
            {
                "project_id": project.id,
                "dataset": dataset.value,
                # We only care about conditions here. Filter keys only matter for
                # filtering to project and groups. Projects are handled with an
                # explicit param, and groups can't be queried here.
                "conditions": get_snuba_query_args(query)["conditions"],
                "aggregates": [alert_aggregation_to_snuba[agg] for agg in aggregations],
                "time_window": time_window,
                "resolution": resolution,
            }
        ),
        retries=False,
    )
    if response.status != 202:
        raise SnubaError("HTTP %s response from Snuba!" % response.status)

    return uuid.UUID(json.loads(response.data)["subscription_id"])


def delete_snuba_subscription(subscription_id):
    """
    Deletes a subscription to a snuba query.
    :param subscription_id: The uuid of the subscription to delete
    :return:
    """
    response = _snuba_pool.urlopen("DELETE", "/subscriptions/%s" % subscription_id, retries=False)
    if response.status != 202:
        raise SnubaError("HTTP %s response from Snuba!" % response.status)
