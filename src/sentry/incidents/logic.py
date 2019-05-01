from __future__ import absolute_import

from django.db import transaction

from sentry.incidents.models import (
    Incident,
    IncidentGroup,
    IncidentProject,
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
