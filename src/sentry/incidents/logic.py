from __future__ import absolute_import

from collections import defaultdict
from copy import deepcopy
from datetime import timedelta

import six
from django.db import transaction
from django.db.models.signals import post_save
from django.utils import timezone

from sentry import analytics
from sentry.api.event_search import get_filter
from sentry.incidents import tasks
from sentry.incidents.models import (
    AlertRule,
    AlertRuleEnvironment,
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
    TimeSeriesSnapshot,
)
from sentry.models import Integration, Project
from sentry.snuba.discover import resolve_discover_aliases
from sentry.snuba.models import query_aggregation_to_snuba, QueryAggregations, QueryDatasets
from sentry.snuba.subscriptions import (
    bulk_create_snuba_subscriptions,
    bulk_delete_snuba_subscriptions,
    bulk_update_snuba_subscriptions,
)
from sentry.snuba.tasks import apply_dataset_conditions
from sentry.utils.db import attach_foreignkey
from sentry.utils.snuba import bulk_raw_query, SnubaQueryParams, SnubaTSResult
from sentry.utils.compat import zip

# We can return an incident as "windowed" which returns a range of points around the start of the incident
# It attempts to center the start of the incident, only showing earlier data if there isn't enough time
# after the incident started to display the correct start date.
WINDOWED_STATS_DATA_POINTS = 200


class AlreadyDeletedError(Exception):
    pass


class InvalidTriggerActionError(Exception):
    pass


def create_incident(
    organization,
    type_,
    title,
    query,
    aggregation,
    date_started,
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

    if date_detected is None:
        date_detected = date_started

    with transaction.atomic():
        incident = Incident.objects.create(
            organization=organization,
            detection_uuid=detection_uuid,
            status=IncidentStatus.OPEN.value,
            type=type_.value,
            title=title,
            query=query,
            aggregation=aggregation.value,
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

        if groups:
            IncidentGroup.objects.bulk_create(
                [IncidentGroup(incident=incident, group=group) for group in groups]
            )

        create_incident_activity(incident, IncidentActivityType.DETECTED, user=user)
        analytics.record(
            "incident.created",
            incident_id=incident.id,
            organization_id=incident.organization_id,
            incident_type=type_.value,
        )

    return incident


def update_incident_status(incident, status, user=None, comment=None):
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
            create_incident_snapshot(incident, windowed_stats=True)

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


@transaction.atomic
def create_incident_activity(
    incident,
    activity_type,
    user=None,
    value=None,
    previous_value=None,
    comment=None,
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


def create_incident_snapshot(incident, windowed_stats=False):
    """
    Creates a snapshot of an incident. This includes the count of unique users
    and total events, plus a time series snapshot of the entire incident.
    """

    assert incident.status == IncidentStatus.CLOSED.value

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
    return bulk_build_incident_query_params(
        [incident], start=start, end=end, windowed_stats=windowed_stats
    )[0]


def bulk_build_incident_query_params(incidents, start=None, end=None, windowed_stats=False):
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

    attach_foreignkey(incidents, Incident.alert_rule)

    query_args_list = []
    for incident in incidents:
        params = {}

        params["start"], params["end"] = calculate_incident_time_range(
            incident, start, end, windowed_stats=windowed_stats
        )

        group_ids = incident_groups[incident.id]
        if group_ids:
            params["group_ids"] = group_ids
        project_ids = incident_projects[incident.id]
        if project_ids:
            params["project_id"] = project_ids

        snuba_filter = get_filter(incident.query, params)
        conditions = resolve_discover_aliases(snuba_filter)[0].conditions
        if incident.alert_rule:
            conditions = apply_dataset_conditions(
                QueryDatasets(incident.alert_rule.dataset), conditions
            )
        snuba_args = {
            "start": snuba_filter.start,
            "end": snuba_filter.end,
            "conditions": conditions,
            "filter_keys": snuba_filter.filter_keys,
            "having": [],
        }
        query_args_list.append(snuba_args)

    return query_args_list


def calculate_incident_time_range(incident, start=None, end=None, windowed_stats=False):
    # TODO: When time_window is persisted, switch to using that instead of alert_rule.time_window.
    time_window = incident.alert_rule.time_window if incident.alert_rule is not None else 1
    time_window_delta = timedelta(minutes=time_window)
    start = incident.date_started - time_window_delta if start is None else start
    end = incident.current_end_date if end is None else end
    if windowed_stats:
        now = timezone.now()
        end = start + timedelta(minutes=time_window * (WINDOWED_STATS_DATA_POINTS / 2))
        start = start - timedelta(minutes=time_window * (WINDOWED_STATS_DATA_POINTS / 2))
        if end > now:
            end = now
            start = now - timedelta(minutes=time_window * WINDOWED_STATS_DATA_POINTS)

    return start, end


def calculate_incident_prewindow(start, end, incident=None):
    # Make the a bit earlier to show more relevant data from before the incident started:
    prewindow = (end - start) / 5
    if incident and incident.alert_rule is not None:
        alert_rule_time_window = timedelta(minutes=incident.alert_rule.time_window)
        prewindow = max(alert_rule_time_window, prewindow)
    return prewindow


def get_incident_event_stats(incident, start=None, end=None, windowed_stats=False):
    """
    Gets event stats for an incident. If start/end are provided, uses that time
    period, otherwise uses the incident start/current_end.
    """
    query_params = bulk_build_incident_query_params(
        [incident], start=start, end=end, windowed_stats=windowed_stats
    )
    return bulk_get_incident_event_stats([incident], query_params)[0]


def bulk_get_incident_event_stats(incidents, query_params_list):
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
            rollup=incident.alert_rule.time_window * 60
            if incident.alert_rule is not None
            else 1
            * 60,  # TODO: When time_window is persisted, switch to using that instead of alert_rule.time_window.
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


def get_incident_aggregates(incident, start=None, end=None, windowed_stats=False):
    """
    Calculates aggregate stats across the life of an incident, or the provided range.
    - count: Total count of events
    - unique_users: Total number of unique users
    """
    query_params = build_incident_query_params(incident, start, end, windowed_stats)
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


def bulk_get_incident_stats(incidents, windowed_stats=False):
    """
    Returns bulk stats for a list of incidents. This includes unique user count,
    total event count and event stats.
    Note that even though this function accepts a windowed_stats parameter, it does not
    affect the snapshots. Only the live fetched stats.
    """
    incident_stats = {}
    if windowed_stats:
        # At the moment, snapshots are only ever created with windowed_stats as True
        # so if they send False, we need to do a live calculation below.
        closed = [i for i in incidents if i.status == IncidentStatus.CLOSED.value]
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
        query_params_list = bulk_build_incident_query_params(to_fetch, windowed_stats=False)
        if windowed_stats:
            windowed_query_params_list = bulk_build_incident_query_params(
                to_fetch, windowed_stats=True
            )
            all_event_stats = bulk_get_incident_event_stats(to_fetch, windowed_query_params_list)
        else:
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
    return IncidentActivity.objects.filter(incident=incident).select_related("user", "incident")


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
    environment=None,
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
    :param environment: List of environments that this rule applies to
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

        if environment:
            for e in environment:
                AlertRuleEnvironment.objects.create(alert_rule=alert_rule, environment=e)

        subscribe_projects_to_alert_rule(alert_rule, projects)

    return alert_rule


def snapshot_alert_rule(alert_rule):
    # Creates an archived alert_rule using the same properties as the passed rule
    # It will also resolve any incidents attached to this rule.
    with transaction.atomic():
        triggers = AlertRuleTrigger.objects.filter(alert_rule=alert_rule)
        incidents = Incident.objects.filter(alert_rule=alert_rule)
        alert_rule_snapshot = deepcopy(alert_rule)
        alert_rule_snapshot.id = None
        alert_rule_snapshot.status = AlertRuleStatus.SNAPSHOT.value
        alert_rule_snapshot.save()

        incidents.update(alert_rule=alert_rule_snapshot, status=IncidentStatus.CLOSED.value)

        for trigger in triggers:
            actions = AlertRuleTriggerAction.objects.filter(alert_rule_trigger=trigger)
            trigger.id = None
            trigger.alert_rule = alert_rule_snapshot
            trigger.save()
            for action in actions:
                action.id = None
                action.alert_rule_trigger = trigger
                action.save()


def update_alert_rule(
    alert_rule,
    projects=None,
    name=None,
    query=None,
    aggregation=None,
    time_window=None,
    environment=None,
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
    :param environment: List of environments that this rule applies to
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
        incidents = Incident.objects.filter(alert_rule=alert_rule).exists()
        if incidents:
            snapshot_alert_rule(alert_rule)

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

        if environment:
            # Delete rows we don't have present in the updated data.
            AlertRuleEnvironment.objects.filter(alert_rule=alert_rule).exclude(
                environment__in=environment
            ).delete()
            for e in environment:
                AlertRuleEnvironment.objects.get_or_create(alert_rule=alert_rule, environment=e)
        else:
            AlertRuleEnvironment.objects.filter(alert_rule=alert_rule).delete()

        if existing_subs and (
            query is not None or aggregation is not None or time_window is not None
        ):
            # If updating any subscription details, update related Snuba subscriptions
            # too
            bulk_update_snuba_subscriptions(
                existing_subs,
                alert_rule.query,
                QueryAggregations(alert_rule.aggregation),
                timedelta(minutes=alert_rule.time_window),
                timedelta(minutes=DEFAULT_ALERT_RULE_RESOLUTION),
                list(alert_rule.environment.all()),
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
        timedelta(minutes=alert_rule.time_window),
        timedelta(minutes=alert_rule.resolution),
        list(alert_rule.environment.all()),
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
    if alert_rule.status == AlertRuleStatus.SNAPSHOT.value:
        raise AlreadyDeletedError()

    with transaction.atomic():
        incidents = Incident.objects.filter(alert_rule=alert_rule)
        bulk_delete_snuba_subscriptions(list(alert_rule.query_subscriptions.all()))
        if incidents:
            alert_rule.update(status=AlertRuleStatus.SNAPSHOT.value)
            for incident in incidents:
                incident.update(status=IncidentStatus.CLOSED.value)
        else:
            alert_rule.delete()


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
    # We set resolve_threshold to None as a 'reset', in case it was previously a value and we're removing it here.
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

        prefix, channel_id, _ = get_channel_id(
            trigger.alert_rule.organization, integration.id, target_identifier
        )
        if channel_id is None:
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
            prefix, channel_id, _ = get_channel_id(
                trigger_action.alert_rule_trigger.alert_rule.organization,
                integration.id,
                target_identifier,
            )
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
