from __future__ import annotations

import logging
from datetime import datetime
from enum import Enum
from typing import ClassVar
from uuid import uuid4

from django.conf import settings
from django.core.cache import cache
from django.db import IntegrityError, models, router, transaction
from django.db.models.signals import post_delete, post_save
from django.utils import timezone

from sentry.backup.dependencies import PrimaryKeyMap, get_model_name
from sentry.backup.helpers import ImportFlags
from sentry.backup.scopes import ImportScope, RelocationScope
from sentry.db.models import (
    ArrayField,
    FlexibleForeignKey,
    Model,
    OneToOneCascadeDeletes,
    UUIDField,
    region_silo_model,
    sane_repr,
)
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey
from sentry.db.models.manager.base import BaseManager
from sentry.models.organization import Organization
from sentry.utils.retries import TimedRetryPolicy

logger = logging.getLogger(__name__)


@region_silo_model
class IncidentProject(Model):
    __relocation_scope__ = RelocationScope.Excluded

    project = FlexibleForeignKey("sentry.Project", db_index=False, db_constraint=False)
    incident = FlexibleForeignKey("sentry.Incident")

    class Meta:
        app_label = "sentry"
        db_table = "sentry_incidentproject"
        unique_together = (("project", "incident"),)


@region_silo_model
class IncidentSeen(Model):
    __relocation_scope__ = RelocationScope.Excluded

    incident = FlexibleForeignKey("sentry.Incident")
    user_id = HybridCloudForeignKey(settings.AUTH_USER_MODEL, on_delete="CASCADE", db_index=False)
    last_seen = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_incidentseen"
        unique_together = (("user_id", "incident"),)


class IncidentManager(BaseManager["Incident"]):
    CACHE_KEY = "incidents:active:%s:%s:%s"

    def fetch_for_organization(self, organization, projects):
        return self.filter(organization=organization, projects__in=projects).distinct()

    @classmethod
    def _build_active_incident_cache_key(cls, alert_rule_id, project_id, subscription_id=None):
        return cls.CACHE_KEY % (alert_rule_id, project_id, subscription_id)

    def get_active_incident(self, alert_rule, project, subscription=None):
        """
        fetches the latest incident for a given alert rule and project (and subscription) that is not closed
        """
        cache_key = self._build_active_incident_cache_key(
            alert_rule_id=alert_rule.id,
            project_id=project.id,
            subscription_id=(subscription.id if subscription else None),
        )
        incident = cache.get(cache_key)
        if incident is None:
            try:
                incident_query = Incident.objects.filter(
                    type=IncidentType.ALERT_TRIGGERED.value,
                    alert_rule=alert_rule,
                    projects=project,
                    subscription=subscription,
                )
                incident = incident_query.exclude(status=IncidentStatus.CLOSED.value).order_by(
                    "-date_added"
                )[0]
            except IndexError:
                # Set this to False so that we can have a negative cache as well.
                incident = False
            cache.set(cache_key, incident)
            if incident is False:
                incident = None
        elif not incident:
            # If we had a falsey not None value in the cache, then we stored that there
            # are no current active incidents. Just set to None
            incident = None

        return incident

    @classmethod
    def clear_active_incident_cache(cls, instance, **kwargs):
        # instance is an Incident
        for project in instance.projects.all():
            subscription = instance.subscription
            key = cls._build_active_incident_cache_key(
                instance.alert_rule_id, project.id, subscription.id if subscription else None
            )
            cache.delete(key)
            assert cache.get(key) is None

    @classmethod
    def clear_active_incident_project_cache(cls, instance, **kwargs):
        # instance is an IncidentProject
        project_id = instance.project_id
        incident = instance.incident
        subscription_id = incident.subscription_id if incident.subscription else None
        key = cls._build_active_incident_cache_key(
            incident.alert_rule_id, project_id, subscription_id
        )
        cache.delete(key)
        assert cache.get(key) is None

    @TimedRetryPolicy.wrap(timeout=5, exceptions=(IntegrityError,))
    def create(self, organization, **kwargs):
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
    DETECTED = 0
    ALERT_TRIGGERED = 2


class IncidentStatus(Enum):
    OPEN = 1
    CLOSED = 2
    WARNING = 10
    CRITICAL = 20


class IncidentStatusMethod(Enum):
    MANUAL = 1
    RULE_UPDATED = 2
    RULE_TRIGGERED = 3


INCIDENT_STATUS = {
    IncidentStatus.OPEN: "Open",
    IncidentStatus.CLOSED: "Resolved",
    IncidentStatus.CRITICAL: "Critical",
    IncidentStatus.WARNING: "Warning",
}


@region_silo_model
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
    projects = models.ManyToManyField(
        "sentry.Project", related_name="incidents", through=IncidentProject
    )
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
    activation = FlexibleForeignKey(
        "sentry.AlertRuleActivations", on_delete=models.SET_NULL, null=True
    )
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
    def duration(self):
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


@region_silo_model
class PendingIncidentSnapshot(Model):
    __relocation_scope__ = RelocationScope.Global

    incident = OneToOneCascadeDeletes("sentry.Incident", db_constraint=False)
    target_run_date = models.DateTimeField(db_index=True, default=timezone.now)
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_pendingincidentsnapshot"


@region_silo_model
class IncidentSnapshot(Model):
    __relocation_scope__ = RelocationScope.Global

    incident = OneToOneCascadeDeletes("sentry.Incident", db_constraint=False)
    event_stats_snapshot = FlexibleForeignKey("sentry.TimeSeriesSnapshot", db_constraint=False)
    unique_users = models.IntegerField()
    total_events = models.IntegerField()
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_incidentsnapshot"


@region_silo_model
class TimeSeriesSnapshot(Model):
    __relocation_scope__ = RelocationScope.Global
    __relocation_dependencies__ = {"sentry.Incident"}

    start = models.DateTimeField()
    end = models.DateTimeField()
    values = ArrayField(of=ArrayField(models.FloatField()))
    period = models.IntegerField()
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_timeseriessnapshot"

    @classmethod
    def query_for_relocation_export(cls, q: models.Q, pk_map: PrimaryKeyMap) -> models.Q:
        pks = IncidentSnapshot.objects.filter(
            incident__in=pk_map.get_pks(get_model_name(Incident))
        ).values_list("event_stats_snapshot_id", flat=True)

        return q & models.Q(pk__in=pks)


class IncidentActivityType(Enum):
    CREATED = 1
    STATUS_CHANGE = 2
    COMMENT = 3
    DETECTED = 4


@region_silo_model
class IncidentActivity(Model):
    """
    An IncidentActivity is a record of a change that occurred in an Incident. This could be a status change,
    """

    __relocation_scope__ = RelocationScope.Global

    incident = FlexibleForeignKey("sentry.Incident")
    user_id = HybridCloudForeignKey(settings.AUTH_USER_MODEL, on_delete="CASCADE", null=True)
    type: models.Field = models.IntegerField()
    value = models.TextField(null=True)
    previous_value = models.TextField(null=True)
    comment = models.TextField(null=True)
    date_added = models.DateTimeField(default=timezone.now)
    notification_uuid = models.UUIDField("notification_uuid", null=True)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_incidentactivity"

    def normalize_before_relocation_import(
        self, pk_map: PrimaryKeyMap, scope: ImportScope, flags: ImportFlags
    ) -> int | None:
        old_pk = super().normalize_before_relocation_import(pk_map, scope, flags)
        if old_pk is None:
            return None

        # Generate a new UUID, if one exists.
        if self.notification_uuid:
            self.notification_uuid = uuid4()
        return old_pk


@region_silo_model
class IncidentSubscription(Model):
    """
    IncidentSubscription is a record of a user being subscribed to an incident.
    Not to be confused with a snuba QuerySubscription
    """

    __relocation_scope__ = RelocationScope.Global

    incident = FlexibleForeignKey("sentry.Incident", db_index=False)
    user_id = HybridCloudForeignKey(settings.AUTH_USER_MODEL, on_delete="CASCADE")
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_incidentsubscription"
        unique_together = (("incident", "user_id"),)

    __repr__ = sane_repr("incident_id", "user_id")


class TriggerStatus(Enum):
    ACTIVE = 0
    RESOLVED = 1


class IncidentTriggerManager(BaseManager["IncidentTrigger"]):
    CACHE_KEY = "incident:triggers:%s"

    @classmethod
    def _build_cache_key(cls, incident_id):
        return cls.CACHE_KEY % incident_id

    def get_for_incident(self, incident):
        """
        Fetches the IncidentTriggers associated with an Incident. Attempts to fetch from
        cache then hits the database.
        """
        cache_key = self._build_cache_key(incident.id)
        triggers = cache.get(cache_key)
        if triggers is None:
            triggers = list(IncidentTrigger.objects.filter(incident=incident))
            cache.set(cache_key, triggers, 3600)

        return triggers

    @classmethod
    def clear_incident_cache(cls, instance, **kwargs):
        cache.delete(cls._build_cache_key(instance.id))
        assert cache.get(cls._build_cache_key(instance.id)) is None

    @classmethod
    def clear_incident_trigger_cache(cls, instance, **kwargs):
        cache.delete(cls._build_cache_key(instance.incident_id))
        assert cache.get(cls._build_cache_key(instance.incident_id)) is None


@region_silo_model
class IncidentTrigger(Model):
    """
    An instance of an alert rule trigger (eg. each time the rule hits the trigger threshold, we create an incident trigger)
    NOTE: dissimilar to an AlertRuleTrigger which represents the trigger threshold required to initialize an Incident
    """

    __relocation_scope__ = RelocationScope.Global

    objects: ClassVar[IncidentTriggerManager] = IncidentTriggerManager()

    incident = FlexibleForeignKey("sentry.Incident", db_index=False)
    alert_rule_trigger = FlexibleForeignKey("sentry.AlertRuleTrigger")
    status = models.SmallIntegerField()
    date_modified = models.DateTimeField(default=timezone.now, null=False)
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_incidenttrigger"
        unique_together = (("incident", "alert_rule_trigger"),)
        indexes = (models.Index(fields=("alert_rule_trigger", "incident_id")),)


post_save.connect(IncidentManager.clear_active_incident_cache, sender=Incident)
post_save.connect(IncidentManager.clear_active_incident_project_cache, sender=IncidentProject)
post_delete.connect(IncidentManager.clear_active_incident_project_cache, sender=IncidentProject)

post_delete.connect(IncidentTriggerManager.clear_incident_cache, sender=Incident)
post_save.connect(IncidentTriggerManager.clear_incident_trigger_cache, sender=IncidentTrigger)
post_delete.connect(IncidentTriggerManager.clear_incident_trigger_cache, sender=IncidentTrigger)
