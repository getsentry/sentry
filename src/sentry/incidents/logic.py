from __future__ import absolute_import

from django.db import transaction

from sentry.api.event_search import get_snuba_query_args
from sentry.incidents.models import (
    Incident,
    IncidentGroup,
    IncidentProject,
)
from sentry.utils.snuba import (
    raw_query,
    SnubaTSResult,
)


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
    return incident


def build_incident_query_params(incident):
    params = {'start': incident.date_started, 'end': incident.current_end_date}
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


def get_incident_event_stats(incident, data_points=20):
    kwargs = build_incident_query_params(incident)
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
