from __future__ import absolute_import

from datetime import timedelta

from django.db import transaction
from django.utils import timezone

from sentry.api.event_search import get_snuba_query_args
from sentry.incidents.models import (
    Incident,
    IncidentActivity,
    IncidentActivityType,
    IncidentGroup,
    IncidentProject,
    IncidentStatus,
    TimeSeriesSnapshot,
)
from sentry.utils.snuba import (
    raw_query,
    SnubaTSResult,
)

MAX_INITIAL_INCIDENT_PERIOD = timedelta(days=7)


def create_incident(
    organization,
    status,
    title,
    query,
    date_started,
    date_detected=None,
    detection_uuid=None,
    projects=None,
    groups=None,
):
    assert status in (IncidentStatus.CREATED, IncidentStatus.DETECTED)
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
            status=status.value,
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

        if status == IncidentStatus.CREATED:
            activity_status = IncidentActivityType.CREATED
        else:
            activity_status = IncidentActivityType.DETECTED

        event_stats_snapshot = create_initial_event_stats_snapshot(incident)
        create_incident_activity(
            incident,
            activity_status,
            event_stats_snapshot=event_stats_snapshot,
        )
    return incident


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


def create_incident_activity(
    incident,
    activity_type,
    user=None,
    value=None,
    previous_value=None,
    comment=None,
    event_stats_snapshot=None,
):
    return IncidentActivity.objects.create(
        incident=incident,
        type=activity_type.value,
        user=user,
        value=value,
        previous_value=previous_value,
        comment=comment,
        event_stats_snapshot=event_stats_snapshot,
    )


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
