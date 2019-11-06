from __future__ import absolute_import

from collections import defaultdict
from datetime import timedelta
from uuid import uuid4

import pytz
import six
from dateutil.parser import parse as parse_date
from django.db import transaction
from django.utils import timezone

from sentry import analytics
from sentry.api.event_search import get_filter
from sentry.models import Commit, Project, Release
from sentry.incidents import tasks
from sentry.incidents.models import (
    AlertRule,
    AlertRuleExcludedProjects,
    AlertRuleQuerySubscription,
    AlertRuleStatus,
    AlertRuleTrigger,
    AlertRuleTriggerAction,
    AlertRuleTriggerExclusion,
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
    TimeSeriesSnapshot,
)
from sentry.snuba.models import QueryAggregations, QueryDatasets
from sentry.snuba.subscriptions import (
    bulk_create_snuba_subscriptions,
    bulk_delete_snuba_subscriptions,
    bulk_update_snuba_subscriptions,
    query_aggregation_to_snuba,
)
from sentry.utils.committers import get_event_file_committers
from sentry.utils.snuba import bulk_raw_query, raw_query, SnubaQueryParams, SnubaTSResult, zerofill

MAX_INITIAL_INCIDENT_PERIOD = timedelta(days=7)


class StatusAlreadyChangedError(Exception):
    pass


class AlreadyDeletedError(Exception):
    pass


class InvalidTriggerActionError(Exception):
    pass


def create_incident(
    organization,
    type,
    title,
    query,
    aggregation,
    date_started=None,
    date_detected=None,
    # TODO: Probably remove detection_uuid?
    detection_uuid=None,
    projects=None,
    groups=None,
    user=None,
    alert_rule=None,
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
            aggregation=aggregation.value,
            date_started=date_started,
            date_detected=date_detected,
            alert_rule=alert_rule,
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
        params["group_ids"] = [g.id for g in groups]
        end = max(g.last_seen for g in groups) + timedelta(seconds=1)
    else:
        end = timezone.now()

    params["start"] = end - INCIDENT_START_PERIOD
    params["end"] = end

    if projects:
        params["project_id"] = [p.id for p in projects]

    filter = get_filter(query, params)
    rollup = int(INCIDENT_START_ROLLUP.total_seconds())

    result = raw_query(
        aggregations=[("count()", "", "count"), ("min", "timestamp", "first_seen")],
        orderby="time",
        groupby=["time"],
        rollup=rollup,
        referrer="incidents.calculate_incident_start",
        limit=10000,
        start=filter.start,
        end=filter.end,
        conditions=filter.conditions,
        filter_keys=filter.filter_keys,
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
            params["group_ids"] = group_ids
        project_ids = incident_projects[incident.id]
        if project_ids:
            params["project_id"] = project_ids

        filter = get_filter(incident.query, params)

        query_args_list.append(
            {
                "start": filter.start,
                "end": filter.end,
                "conditions": filter.conditions,
                "filter_keys": filter.filter_keys,
            }
        )

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
            aggregations=[
                (
                    query_aggregation_to_snuba[QueryAggregations(incident.aggregation)][0],
                    query_aggregation_to_snuba[QueryAggregations(incident.aggregation)][1],
                    "count",
                )
            ],
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
    organization,
    projects,
    name,
    query,
    aggregation,
    time_window,
    threshold_period,
    include_all_projects=False,
    excluded_projects=None,
):
    """
    Creates an alert rule for an organization.

    :param organization:
    :param projects: A list of projects to subscribe to the rule. This will be overriden
    if `include_all_projects` is True
    :param name: Name for the alert rule. This will be used as part of the
    incident name, and must be unique per project
    :param query: An event search query to subscribe to and monitor for alerts
    :param aggregation: A QueryAggregation to fetch for this alert rule
    :param time_window: Time period to aggregate over, in minutes
    :param threshold_period: How many update periods the value of the
    subscription needs to exceed the threshold before triggering
    :param include_all_projects: Whether to include all current and future projects
    from this organization
    :param excluded_projects: List of projects to exclude if we're using
    `include_all_projects`.
    :return: The created `AlertRule`
    """
    dataset = QueryDatasets.EVENTS
    resolution = DEFAULT_ALERT_RULE_RESOLUTION
    validate_alert_rule_query(query)
    if AlertRule.objects.filter(organization=organization, name=name).exists():
        raise AlertRuleNameAlreadyUsedError()
    with transaction.atomic():
        alert_rule = AlertRule.objects.create(
            organization=organization,
            name=name,
            dataset=dataset.value,
            query=query,
            aggregation=aggregation.value,
            time_window=time_window,
            resolution=resolution,
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
    return alert_rule


def update_alert_rule(
    alert_rule,
    projects=None,
    name=None,
    query=None,
    aggregation=None,
    time_window=None,
    threshold_period=None,
    include_all_projects=None,
    excluded_projects=None,
):
    """
    Updates an alert rule.

    :param alert_rule: The alert rule to update
    :param excluded_projects: List of projects to subscribe to the rule. Ignored if
    `include_all_projects` is True
    :param name: Name for the alert rule. This will be used as part of the
    incident name, and must be unique per project.
    :param query: An event search query to subscribe to and monitor for alerts
    :param aggregation: An AlertRuleAggregation that we want to fetch for this alert rule
    :param time_window: Time period to aggregate over, in minutes.
    :param threshold_period: How many update periods the value of the
    subscription needs to exceed the threshold before triggering
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
    if name:
        updated_fields["name"] = name
    if query is not None:
        validate_alert_rule_query(query)
        updated_fields["query"] = query
    if aggregation is not None:
        updated_fields["aggregation"] = aggregation.value
    if time_window:
        updated_fields["time_window"] = time_window
    if threshold_period:
        updated_fields["threshold_period"] = threshold_period
    if include_all_projects is not None:
        updated_fields["include_all_projects"] = include_all_projects

    with transaction.atomic():
        alert_rule.update(**updated_fields)
        existing_subs = []
        if (
            query is not None
            or aggregation is not None
            or time_window is not None
            or projects is not None
            or include_all_projects is not None
            or excluded_projects is not None
        ):
            existing_subs = alert_rule.query_subscriptions.all().select_related("project")

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
            # Remove any deleted subscriptions from `existing_subscriptions`, so that
            # if we need to update any subscriptions we don't end up doing it twice. We
            # don't add new subscriptions here since they'll already have the updated
            # values
            existing_subs = [sub for sub in existing_subs if sub.id]

        if existing_subs and (
            query is not None or aggregation is not None or time_window is not None
        ):
            # If updating any subscription details, update related Snuba subscriptions
            # too
            bulk_update_snuba_subscriptions(
                existing_subs,
                alert_rule.query,
                QueryAggregations(alert_rule.aggregation),
                alert_rule.time_window,
                DEFAULT_ALERT_RULE_RESOLUTION,
            )

    return alert_rule


def subscribe_projects_to_alert_rule(alert_rule, projects):
    """
    Subscribes a list of projects to an alert rule
    :return: The list of created subscriptions
    """
    subscriptions = bulk_create_snuba_subscriptions(
        projects,
        tasks.INCIDENTS_SNUBA_SUBSCRIPTION_TYPE,
        QueryDatasets(alert_rule.dataset),
        alert_rule.query,
        QueryAggregations(alert_rule.aggregation),
        alert_rule.time_window,
        alert_rule.resolution,
    )
    subscription_links = [
        AlertRuleQuerySubscription(query_subscription=subscription, alert_rule=alert_rule)
        for subscription in subscriptions
    ]
    AlertRuleQuerySubscription.objects.bulk_create(subscription_links)
    return subscriptions


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

    with transaction.atomic():
        alert_rule.update(
            # Randomize the name here so that we don't get unique constraint issues
            # while waiting for the deletion to process
            name=uuid4().get_hex(),
            status=AlertRuleStatus.PENDING_DELETION.value,
        )
        bulk_delete_snuba_subscriptions(list(alert_rule.query_subscriptions.all()))
    tasks.delete_alert_rule.apply_async(kwargs={"alert_rule_id": alert_rule.id})


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


def create_alert_rule_trigger(
    alert_rule,
    label,
    threshold_type,
    alert_threshold,
    resolve_threshold=None,
    excluded_projects=None,
):
    """
    Creates a new AlertRuleTrigger
    :param alert_rule: The alert rule to create the trigger for
    :param label: A description of the trigger
    :param threshold_type: An AlertRuleThresholdType
    :param alert_threshold: Value that the subscription needs to reach to trigger the
    alert rule
    :param resolve_threshold: Optional value that the subscription needs to reach to
    resolve the alert
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
            alert_rule=alert_rule,
            label=label,
            threshold_type=threshold_type.value,
            alert_threshold=alert_threshold,
            resolve_threshold=resolve_threshold,
        )
        if excluded_subs:
            new_exclusions = [
                AlertRuleTriggerExclusion(alert_rule_trigger=trigger, query_subscription=sub)
                for sub in excluded_subs
            ]
            AlertRuleTriggerExclusion.objects.bulk_create(new_exclusions)
    return trigger


def update_alert_rule_trigger(
    trigger,
    label=None,
    threshold_type=None,
    alert_threshold=None,
    resolve_threshold=None,
    excluded_projects=None,
):
    """
    :param trigger: The AlertRuleTrigger to update
    :param label: A description of the trigger
    :param threshold_type: An AlertRuleThresholdType
    :param alert_threshold: Value that the subscription needs to reach to trigger the
    alert rule
    :param resolve_threshold: Optional value that the subscription needs to reach to
    resolve the alert
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
    if threshold_type is not None:
        updated_fields["threshold_type"] = threshold_type.value
    if alert_threshold is not None:
        updated_fields["alert_threshold"] = alert_threshold
    if resolve_threshold is not None:
        updated_fields["resolve_threshold"] = resolve_threshold

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


def get_subscriptions_from_alert_rule(alert_rule, projects):
    """
    Fetches subscriptions associated with an alert rule filtered by a list of projects.
    Raises `ProjectsNotAssociatedWithAlertRuleError` if Projects aren't associated with
    the AlertRule
    :param alert_rule: The AlertRule to fetch subscriptions for
    :param projects: The Project we want subscriptions for
    :return: A list of QuerySubscriptions
    """
    excluded_subscriptions = alert_rule.query_subscriptions.filter(project__in=projects)
    if len(excluded_subscriptions) != len(projects):
        invalid_slugs = set([p.slug for p in projects]) - set(
            [s.project.slug for s in excluded_subscriptions]
        )
        raise ProjectsNotAssociatedWithAlertRuleError(invalid_slugs)
    return excluded_subscriptions


def create_alert_rule_trigger_action(
    trigger, type, target_type, target_identifier=None, integration=None
):
    """
    Creates an AlertRuleTriggerAction
    :param trigger: The trigger to create the action on
    :param type: Which sort of action to take
    :param target_type: Which type of target to send to
    :param target_identifier: (Optional) The identifier of the target
    :param target_display: (Optional) Human readable name for the target
    :param integration: (Optional) The Integration related to this action.
    :return: The created action
    """
    target_display = None
    if type == AlertRuleTriggerAction.Type.SLACK:
        from sentry.integrations.slack.utils import get_channel_id

        if target_type != AlertRuleTriggerAction.TargetType.SPECIFIC:
            raise InvalidTriggerActionError("Slack action must specify channel")

        channel_result = get_channel_id(
            trigger.alert_rule.organization, integration.id, target_identifier
        )
        if channel_result is not None:
            channel_id = channel_result[1]
        else:
            raise InvalidTriggerActionError(
                "Could not find channel %s. Channel may not exist, or Sentry may not "
                "have been granted permission to access it" % target_identifier
            )

        # Use the channel name for display
        target_display = target_identifier
        target_identifier = channel_id

    return AlertRuleTriggerAction.objects.create(
        alert_rule_trigger=trigger,
        type=type.value,
        target_type=target_type.value,
        target_identifier=target_identifier,
        target_display=target_display,
        integration=integration,
    )


def update_alert_rule_trigger_action(
    trigger_action, type=None, target_type=None, target_identifier=None, integration=None
):
    """
    Updates values on an AlertRuleTriggerAction
    :param trigger_action: The trigger action to update
    :param type: Which sort of action to take
    :param target_type: Which type of target to send to
    :param target_identifier: The identifier of the target
    :param target_display: Human readable name for the target
    :param integration: The Integration related to this action.
    :return:
    """
    updated_fields = {}
    if type is not None:
        updated_fields["type"] = type.value
    if target_type is not None:
        updated_fields["target_type"] = target_type.value
    if integration is not None:
        updated_fields["integration"] = integration
    if target_identifier is not None:
        type = updated_fields.get("type", trigger_action.type)

        if type == AlertRuleTriggerAction.Type.SLACK.value:
            from sentry.integrations.slack.utils import get_channel_id

            integration = updated_fields.get("integration", trigger_action.integration)
            channel_id = get_channel_id(
                trigger_action.alert_rule_trigger.alert_rule.organization,
                integration.id,
                target_identifier,
            )[1]
            # Use the channel name for display
            updated_fields["target_display"] = target_identifier
            updated_fields["target_identifier"] = channel_id
        else:
            updated_fields["target_identifier"] = target_identifier

    trigger_action.update(**updated_fields)
    return trigger_action


def delete_alert_rule_trigger_action(trigger_action):
    """
    Deletes a AlertRuleTriggerAction
    """
    trigger_action.delete()


def get_actions_for_trigger(trigger):
    return AlertRuleTriggerAction.objects.filter(alert_rule_trigger=trigger)
