from __future__ import annotations

from enum import Enum

from django.db import models
from django.utils import timezone

from sentry.backup.scopes import RelocationScope
from sentry.db.models import FlexibleForeignKey, Model, UUIDField, cell_silo_model


class IncidentType(Enum):
    ALERT_TRIGGERED = 2


class IncidentStatus(Enum):
    OPEN = 1
    CLOSED = 2
    WARNING = 10
    CRITICAL = 20


class IncidentStatusMethod(Enum):
    MANUAL = 1  # not in use
    RULE_UPDATED = 2  # always corresponds with IncidentStatus.CLOSED
    RULE_TRIGGERED = 3


INCIDENT_STATUS = {
    IncidentStatus.OPEN: "Open",
    IncidentStatus.CLOSED: "Resolved",
    IncidentStatus.CRITICAL: "Critical",
    IncidentStatus.WARNING: "Warning",
}


@cell_silo_model
class Incident(Model):
    """
    An Incident represents the overarching period during an AlertRule's "unhealthy" state.
    An AlertRule can have multiple IncidentTriggers during an Incident (ie. Critical -> Warning -> Critical)
    but if it has been resolved, will end the Incident.

    An AlertRule may have multiple Incidents that correlate with different subscriptions.
    TODO:
    - UI should be able to handle multiple active incidents
    """

    __relocation_scope__ = RelocationScope.Excluded

    organization = FlexibleForeignKey(
        "sentry.Organization", on_delete=models.DO_NOTHING, db_constraint=False
    )
    alert_rule = FlexibleForeignKey(
        "sentry.AlertRule", on_delete=models.DO_NOTHING, db_constraint=False
    )
    # Incrementing id that is specific to the org.
    identifier = models.IntegerField()
    # Identifier used to match incoming events from the detection algorithm
    detection_uuid = UUIDField(null=True, db_index=True)
    status = models.PositiveSmallIntegerField(default=IncidentStatus.OPEN.value)
    status_method = models.PositiveSmallIntegerField(
        default=IncidentStatusMethod.RULE_TRIGGERED.value
    )
    type = models.PositiveSmallIntegerField()
    title = models.TextField()
    # When we suspect the incident actually started
    date_started = models.DateTimeField(default=timezone.now)
    # When we actually detected the incident
    date_detected = models.DateTimeField(default=timezone.now)
    date_added = models.DateTimeField(default=timezone.now)
    date_closed = models.DateTimeField(null=True)
    subscription = FlexibleForeignKey(
        "sentry.QuerySubscription", on_delete=models.DO_NOTHING, null=True, db_constraint=False
    )

    class Meta:
        app_label = "sentry"
        db_table = "sentry_incident"
        unique_together = (("organization", "identifier"),)
        indexes = (models.Index(fields=("alert_rule", "type", "status")),)


class IncidentActivityType(Enum):
    """Numeric activity types retained for legacy-compatible response payloads."""

    CREATED = 1
    STATUS_CHANGE = 2
    DETECTED = 4


class TriggerStatus(Enum):
    ACTIVE = 0
    RESOLVED = 1
