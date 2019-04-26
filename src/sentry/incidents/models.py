from __future__ import absolute_import

from django.db import models
from django.utils import timezone
from enum import Enum

from sentry.db.models import (
    FlexibleForeignKey,
    Model,
    UUIDField,
)
from sentry.db.models.manager import BaseManager


class IncidentProject(Model):
    __core__ = False

    project = FlexibleForeignKey('sentry.Project', db_index=False, db_constraint=False)
    incident = FlexibleForeignKey('sentry.Incident')

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_incidentproject'
        unique_together = (('project', 'incident'), )


class IncidentManager(BaseManager):
    def fetch_for_organization(self, organization, projects):
        return self.filter(
            organization=organization,
            projects__in=projects,
        )


class IncidentStatus(Enum):
    DETECTED = 0
    CREATED = 1
    CLOSED = 2


class Incident(Model):
    __core__ = True

    objects = IncidentManager()

    organization = FlexibleForeignKey('sentry.Organization')
    projects = models.ManyToManyField(
        'sentry.Project',
        related_name='incidents',
        through=IncidentProject,
    )
    # Incrementing id that is specific to the org.
    identifier = models.IntegerField()
    # Identifier used to match incoming events from the detection algorithm
    detection_uuid = UUIDField(null=True, db_index=True)
    status = models.PositiveSmallIntegerField()
    title = models.TextField()
    # Query used to fetch events related to an incident
    query = models.TextField()
    # When we suspect the incident actually started
    date_started = models.DateTimeField(default=timezone.now)
    # When we actually detected the incident
    date_detected = models.DateTimeField(default=timezone.now)
    date_added = models.DateTimeField(default=timezone.now)
    date_closed = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_incident'
        unique_together = (('organization', 'identifier'),)
