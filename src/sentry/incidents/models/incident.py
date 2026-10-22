from __future__ import annotations

import logging
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, ClassVar
from uuid import uuid4

from django.db import IntegrityError, models, router, transaction
from django.utils import timezone

from sentry.backup.dependencies import PrimaryKeyMap
from sentry.backup.helpers import ImportFlags
from sentry.backup.scopes import ImportScope, RelocationScope
from sentry.db.models import FlexibleForeignKey, Model, UUIDField, cell_silo_model
from sentry.db.models.manager.base import BaseManager
from sentry.models.organization import Organization
from sentry.utils.retries import TimedRetryPolicy

logger = logging.getLogger(__name__)


class IncidentManager(BaseManager["Incident"]):
    @TimedRetryPolicy.wrap(timeout=5, exceptions=(IntegrityError,))
    def create(self, organization: Organization, **kwargs: Any) -> Incident:
        """
        Creates an Incident. Fetches the maximum identifier value for the org
        and increments it by one. If two incidents are created for the
        Organization at the same time then an integrity error will be thrown,
        and we'll retry again several times. I prefer to lock optimistically
        here since if we're creating multiple Incidents a second for an
        Organization then we're likely failing at making Incidents useful.
        """
        with transaction.atomic(router.db_for_write(Organization)):
            result = self.filter(organization=organization).aggregate(models.Max("identifier"))
            identifier = result["identifier__max"]
            if identifier is None:
                identifier = 1
            else:
                identifier += 1

            return super().create(organization=organization, identifier=identifier, **kwargs)


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

    __relocation_scope__ = RelocationScope.Global

    objects: ClassVar[IncidentManager] = IncidentManager()

    organization = FlexibleForeignKey("sentry.Organization")
    alert_rule = FlexibleForeignKey("sentry.AlertRule", on_delete=models.PROTECT)
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
        "sentry.QuerySubscription", on_delete=models.SET_NULL, null=True
    )

    class Meta:
        app_label = "sentry"
        db_table = "sentry_incident"
        unique_together = (("organization", "identifier"),)
        indexes = (models.Index(fields=("alert_rule", "type", "status")),)

    @property
    def current_end_date(self) -> datetime:
        """
        Returns the current end of the incident. Either the date it was closed,
        or the current time if it's still open.
        """
        return self.date_closed if self.date_closed else timezone.now()

    @property
    def duration(self) -> timedelta:
        return self.current_end_date - self.date_started

    def normalize_before_relocation_import(
        self, pk_map: PrimaryKeyMap, scope: ImportScope, flags: ImportFlags
    ) -> int | None:
        old_pk = super().normalize_before_relocation_import(pk_map, scope, flags)
        if old_pk is None:
            return None

        # Generate a new UUID, if one exists.
        if self.detection_uuid:
            self.detection_uuid = uuid4()
        return old_pk


class IncidentActivityType(Enum):
    """Numeric activity types retained for legacy-compatible response payloads."""

    CREATED = 1
    STATUS_CHANGE = 2
    DETECTED = 4


class TriggerStatus(Enum):
    ACTIVE = 0
    RESOLVED = 1
