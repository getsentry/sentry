from __future__ import absolute_import

from datetime import timedelta

import six
from django.db import transaction
from django.utils import timezone

from sentry import analytics
from sentry.api.event_search import get_snuba_query_args
from sentry.incidents.models import (
    Incident,
    IncidentActivity,
    IncidentActivityType,
    IncidentGroup,
    IncidentProject,
    IncidentSeen,
    IncidentStatus,
    IncidentSubscription,
    IncidentType,
    TimeSeriesSnapshot,
)
from sentry.models import (
    Commit,
    Release,
)
from sentry.incidents.tasks import (
    calculate_incident_suspects,
    send_subscriber_notifications,
)
from sentry.utils.committers import get_event_file_committers
from sentry.utils.snuba import (
    raw_query,
    SnubaTSResult,
)

MAX_INITIAL_INCIDENT_PERIOD = timedelta(days=7)


class StatusAlreadyChangedError(Exception):
    pass


def create_incident(
    organization,
    type,
    title,
    query,
    date_started,
    date_detected=None,
    detection_uuid=None,
    projects=None,
    groups=None,
    user=None,
):
    if date_detected is None:
        date_detected = date_started

    if groups:
        group_projects = [g.project for g in groups]
        if projects is None:
            projects = []
        projects = list(set(projects + group_projects))

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
            IncidentProject.objects.bulk_create([
                IncidentProject(incident=incident, project=project) for project in projects
            ])
        if groups:
            IncidentGroup.objects.bulk_create([
                IncidentGroup(incident=incident, group=group) for group in groups
            ])

        if type == IncidentType.CREATED:
            activity_status = IncidentActivityType.CREATED
        else:
            activity_status = IncidentActivityType.DETECTED

        event_stats_snapshot = create_initial_event_stats_snapshot(incident)
        create_incident_activity(
            incident,
            activity_status,
            event_stats_snapshot=event_stats_snapshot,
            user=user,
        )
        analytics.record(
            'incident.created',
            incident_id=incident.id,
            organization_id=incident.organization_id,
            incident_type=type.value,
        )

    calculate_incident_suspects.apply_async(kwargs={'incident_id': incident.id})
    return incident


def update_incident_status(incident, status, user=None, comment=None):
    """
    Updates the status of an Incident and write an IncidentActivity row to log
    the change. When the status is CLOSED we also set the date closed to the
    current time and (todo) take a snapshot of the current incident state.
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

        kwargs = {
            'status': status.value,
        }
        if status == IncidentStatus.CLOSED:
            kwargs['date_closed'] = timezone.now()
            # TODO: Take a snapshot of the current state once we implement
            # snapshots
        elif status == IncidentStatus.OPEN:
            # If we're moving back out of closed status then unset the closed
            # date
            kwargs['date_closed'] = None
            # TODO: Delete snapshot? Not sure if needed

        incident.update(**kwargs)
        analytics.record(
            'incident.status_change',
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
        incident=incident,
        user=user,
        values={'last_seen': timezone.now()}
    )

    return incident_seen


def create_initial_event_stats_snapshot(incident):
    """
    Creates an event snapshot representing the state at the beginning of
    an incident. It's intended to capture the history of the events involved in
    the incident, the spike and a short period of time after that.
    """
    initial_period_length = min(
        timezone.now() - incident.date_started,
        MAX_INITIAL_INCIDENT_PERIOD,
    )
    end = incident.date_started + initial_period_length
    start = end - (initial_period_length * 8)
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
        user_ids_to_subscribe = set(mentioned_user_ids) - set(IncidentSubscription.objects.filter(
            incident=incident,
            user_id__in=mentioned_user_ids,
        ).values_list('user_id', flat=True))
        if user_ids_to_subscribe:
            IncidentSubscription.objects.bulk_create([
                IncidentSubscription(incident=incident, user_id=mentioned_user_id)
                for mentioned_user_id in user_ids_to_subscribe
            ])
    send_subscriber_notifications.apply_async(
        kwargs={'activity_id': activity.id},
        countdown=10,
    )
    if activity_type == IncidentActivityType.COMMENT:
        analytics.record(
            'incident.comment',
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


def create_event_stat_snapshot(incident, start, end):
    """
    Creates an event stats snapshot for an incident in a given period of time.
    """
    event_stats = get_incident_event_stats(incident, start, end)
    return TimeSeriesSnapshot.objects.create(
        start=start,
        end=end,
        values=[[row['time'], row['count']] for row in event_stats.data['data']],
        period=event_stats.rollup,
    )


def build_incident_query_params(incident, start=None, end=None):
    params = {
        'start': incident.date_started if start is None else start,
        'end': incident.current_end_date if end is None else end,
    }
    group_ids = list(IncidentGroup.objects.filter(
        incident=incident,
    ).values_list('group_id', flat=True))
    if group_ids:
        params['issue.id'] = group_ids
    project_ids = list(IncidentProject.objects.filter(
        incident=incident,
    ).values_list('project_id', flat=True))
    if project_ids:
        params['project_id'] = project_ids

    return get_snuba_query_args(incident.query, params)


def get_incident_event_stats(incident, start=None, end=None, data_points=50):
    """
    Gets event stats for an incident. If start/end are provided, uses that time
    period, otherwise uses the incident start/current_end.
    """
    kwargs = build_incident_query_params(incident, start=start, end=end)
    rollup = max(int(incident.duration.total_seconds() / data_points), 1)
    return SnubaTSResult(
        raw_query(
            aggregations=[
                ('count()', '', 'count'),
            ],
            orderby='time',
            groupby=['time'],
            rollup=rollup,
            referrer='incidents.get_incident_event_stats',
            limit=10000,
            **kwargs
        ),
        kwargs['start'],
        kwargs['end'],
        rollup,
    )


def get_incident_aggregates(incident):
    """
    Calculates aggregate stats across the life of an incident.
    - count: Total count of events
    - unique_users: Total number of unique users
    """
    kwargs = build_incident_query_params(incident)
    return raw_query(
        aggregations=[
            ('count()', '', 'count'),
            ('uniq', 'tags[sentry:user]', 'unique_users'),
        ],
        referrer='incidents.get_incident_aggregates',
        limit=10000,
        **kwargs
    )['data'][0]


def subscribe_to_incident(incident, user):
    return IncidentSubscription.objects.get_or_create(incident=incident, user=user)


def unsubscribe_from_incident(incident, user):
    return IncidentSubscription.objects.filter(incident=incident, user=user).delete()


def get_incident_subscribers(incident):
    return IncidentSubscription.objects.filter(incident=incident)


def get_incident_activity(incident):
    return IncidentActivity.objects.filter(
        incident=incident,
    ).select_related('user', 'event_stats_snapshot', 'incident')


def get_incident_suspects(incident, projects):
    return Commit.objects.filter(
        incidentsuspectcommit__incident=incident,
        releasecommit__release__projects__in=projects,
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
            for (commit, _) in committer['commits']:
                if commit.id in seen:
                    continue
                seen.add(commit.id)
                yield commit.id
