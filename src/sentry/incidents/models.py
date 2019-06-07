from __future__ import absolute_import

from django.conf import settings
from django.db import (
    IntegrityError,
    models,
    transaction,
)
from django.utils import timezone
from enum import Enum

from sentry.db.models import (
    FlexibleForeignKey,
    Model,
    UUIDField,
)
from sentry.db.models import (
    ArrayField,
    sane_repr,
)
from sentry.db.models.manager import BaseManager
from sentry.utils.retries import TimedRetryPolicy


class IncidentProject(Model):
    __core__ = False

    project = FlexibleForeignKey('sentry.Project', db_index=False, db_constraint=False)
    incident = FlexibleForeignKey('sentry.Incident')

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_incidentproject'
        unique_together = (('project', 'incident'), )


class IncidentGroup(Model):
    __core__ = False

    group = FlexibleForeignKey('sentry.Group', db_index=False, db_constraint=False)
    incident = FlexibleForeignKey('sentry.Incident')

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_incidentgroup'
        unique_together = (('group', 'incident'), )


class IncidentSeen(Model):
    __core__ = False

    incident = FlexibleForeignKey('sentry.Incident')
    user = FlexibleForeignKey(settings.AUTH_USER_MODEL, db_index=False)
    last_seen = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_incidentseen'
        unique_together = (('user', 'incident'), )


class IncidentManager(BaseManager):
    def fetch_for_organization(self, organization, projects):
        return self.filter(
            organization=organization,
            projects__in=projects,
        ).distinct()

    @TimedRetryPolicy.wrap(timeout=5, exceptions=(IntegrityError, ))
    def create(self, organization, **kwargs):
        """
        Creates an Incident. Fetches the maximum identifier value for the org
        and increments it by one. If two incidents are created for the
        Organization at the same time then an integrity error will be thrown,
        and we'll retry again several times. I prefer to lock optimistically
        here since if we're creating multiple Incidents a second for an
        Organization then we're likely failing at making Incidents useful.
        """
        with transaction.atomic():
            result = self.filter(organization=organization).aggregate(models.Max('identifier'))
            identifier = result['identifier__max']
            if identifier is None:
                identifier = 1
            else:
                identifier += 1

            return super(IncidentManager, self).create(
                organization=organization,
                identifier=identifier,
                **kwargs
            )


class IncidentType(Enum):
    DETECTED = 0
    CREATED = 1


class IncidentStatus(Enum):
    OPEN = 1
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
    groups = models.ManyToManyField(
        'sentry.Group',
        related_name='incidents',
        through=IncidentGroup,
    )
    # Incrementing id that is specific to the org.
    identifier = models.IntegerField()
    # Identifier used to match incoming events from the detection algorithm
    detection_uuid = UUIDField(null=True, db_index=True)
    status = models.PositiveSmallIntegerField(default=IncidentStatus.OPEN.value)
    type = models.PositiveSmallIntegerField(default=IncidentType.CREATED.value)
    title = models.TextField()
    # Query used to fetch events related to an incident
    query = models.TextField()
    # When we suspect the incident actually started
    date_started = models.DateTimeField(default=timezone.now)
    # When we actually detected the incident
    date_detected = models.DateTimeField(default=timezone.now)
    date_added = models.DateTimeField(default=timezone.now)
    date_closed = models.DateTimeField(null=True)

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_incident'
        unique_together = (('organization', 'identifier'),)

    @property
    def current_end_date(self):
        """
        Returns the current end of the incident. Either the date it was closed,
        or the current time if it's still open.
        """
        return self.date_closed if self.date_closed else timezone.now()

    @property
    def duration(self):
        return self.current_end_date - self.date_started


class TimeSeriesSnapshot(Model):
    __core__ = True

    start = models.DateTimeField()
    end = models.DateTimeField()
    values = ArrayField(of=ArrayField(models.IntegerField()))
    period = models.IntegerField()
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_timeseriessnapshot'

    @property
    def snuba_values(self):
        """
        Returns values matching the snuba format, a list of dicts with 'time'
        and 'count' keys.
        :return:
        """
        return {'data': [{'time': time, 'count': count} for time, count in self.values]}


class IncidentActivityType(Enum):
    CREATED = 0
    DETECTED = 1
    STATUS_CHANGE = 2
    COMMENT = 3


class IncidentActivity(Model):
    __core__ = True

    incident = FlexibleForeignKey('sentry.Incident')
    user = FlexibleForeignKey('sentry.User', null=True)
    type = models.IntegerField()
    value = models.TextField(null=True)
    previous_value = models.TextField(null=True)
    comment = models.TextField(null=True)
    event_stats_snapshot = FlexibleForeignKey('sentry.TimeSeriesSnapshot', null=True)
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_incidentactivity'


class IncidentSubscription(Model):
    __core__ = True

    incident = FlexibleForeignKey('sentry.Incident', db_index=False)
    user = FlexibleForeignKey(settings.AUTH_USER_MODEL)
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_incidentsubscription'
        unique_together = (('incident', 'user'), )

    __repr__ = sane_repr('incident_id', 'user_id')
