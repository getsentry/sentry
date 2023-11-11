from __future__ import annotations

from collections import namedtuple
from enum import Enum
from typing import Any, ClassVar, Optional
from uuid import uuid4

from django.conf import settings
from django.core.cache import cache
from django.db import IntegrityError, models, router, transaction
from django.db.models.signals import post_delete, post_save
from django.utils import timezone
from typing_extensions import Self

from sentry.backup.dependencies import PrimaryKeyMap, get_model_name
from sentry.backup.helpers import ImportFlags
from sentry.backup.scopes import ImportScope, RelocationScope
from sentry.db.models import (
    ArrayField,
    FlexibleForeignKey,
    JSONField,
    Model,
    OneToOneCascadeDeletes,
    UUIDField,
    region_silo_only_model,
    sane_repr,
)
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey
from sentry.db.models.manager import BaseManager
from sentry.models.notificationaction import AbstractNotificationAction, ActionService, ActionTarget
from sentry.models.organization import Organization
from sentry.models.team import Team
from sentry.services.hybrid_cloud.user.service import user_service
from sentry.snuba.models import QuerySubscription
from sentry.utils import metrics
from sentry.utils.retries import TimedRetryPolicy


@region_silo_only_model
class IncidentProject(Model):
    __relocation_scope__ = RelocationScope.Excluded

    project = FlexibleForeignKey("sentry.Project", db_index=False, db_constraint=False)
    incident = FlexibleForeignKey("sentry.Incident")

    class Meta:
        app_label = "sentry"
        db_table = "sentry_incidentproject"
        unique_together = (("project", "incident"),)


@region_silo_only_model
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
    CACHE_KEY = "incidents:active:%s:%s"

    def fetch_for_organization(self, organization, projects):
        return self.filter(organization=organization, projects__in=projects).distinct()

    @classmethod
    def _build_active_incident_cache_key(cls, alert_rule_id, project_id):
        return cls.CACHE_KEY % (alert_rule_id, project_id)

    def get_active_incident(self, alert_rule, project):
        cache_key = self._build_active_incident_cache_key(alert_rule.id, project.id)
        incident = cache.get(cache_key)
        if incident is None:
            try:
                incident = (
                    Incident.objects.filter(
                        type=IncidentType.ALERT_TRIGGERED.value,
                        alert_rule=alert_rule,
                        projects=project,
                    )
                    .exclude(status=IncidentStatus.CLOSED.value)
                    .order_by("-date_added")[0]
                )
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
        for project in instance.projects.all():
            cache.delete(cls._build_active_incident_cache_key(instance.alert_rule_id, project.id))
            assert (
                cache.get(cls._build_active_incident_cache_key(instance.alert_rule_id, project.id))
                is None
            )

    @classmethod
    def clear_active_incident_project_cache(cls, instance, **kwargs):
        cache.delete(
            cls._build_active_incident_cache_key(
                instance.incident.alert_rule_id, instance.project_id
            )
        )
        assert (
            cache.get(
                cls._build_active_incident_cache_key(
                    instance.incident.alert_rule_id, instance.project_id
                )
            )
            is None
        )

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


@region_silo_only_model
class Incident(Model):
    __relocation_scope__ = RelocationScope.Organization

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

    class Meta:
        app_label = "sentry"
        db_table = "sentry_incident"
        unique_together = (("organization", "identifier"),)
        index_together = (("alert_rule", "type", "status"),)

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

    def normalize_before_relocation_import(
        self, pk_map: PrimaryKeyMap, scope: ImportScope, flags: ImportFlags
    ) -> Optional[int]:
        old_pk = super().normalize_before_relocation_import(pk_map, scope, flags)
        if old_pk is None:
            return None

        # Generate a new UUID, if one exists.
        if self.detection_uuid:
            self.detection_uuid = uuid4()
        return old_pk


@region_silo_only_model
class PendingIncidentSnapshot(Model):
    __relocation_scope__ = RelocationScope.Organization

    incident = OneToOneCascadeDeletes("sentry.Incident", db_constraint=False)
    target_run_date = models.DateTimeField(db_index=True, default=timezone.now)
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_pendingincidentsnapshot"


@region_silo_only_model
class IncidentSnapshot(Model):
    __relocation_scope__ = RelocationScope.Organization

    incident = OneToOneCascadeDeletes("sentry.Incident", db_constraint=False)
    event_stats_snapshot = FlexibleForeignKey("sentry.TimeSeriesSnapshot", db_constraint=False)
    unique_users = models.IntegerField()
    total_events = models.IntegerField()
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_incidentsnapshot"


@region_silo_only_model
class TimeSeriesSnapshot(Model):
    __relocation_scope__ = RelocationScope.Organization
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


@region_silo_only_model
class IncidentActivity(Model):
    __relocation_scope__ = RelocationScope.Organization

    incident = FlexibleForeignKey("sentry.Incident")
    user_id = HybridCloudForeignKey(settings.AUTH_USER_MODEL, on_delete="CASCADE", null=True)
    type: models.Field[int | IncidentActivityType, int] = models.IntegerField()
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
    ) -> Optional[int]:
        old_pk = super().normalize_before_relocation_import(pk_map, scope, flags)
        if old_pk is None:
            return None

        # Generate a new UUID, if one exists.
        if self.notification_uuid:
            self.notification_uuid = uuid4()
        return old_pk


@region_silo_only_model
class IncidentSubscription(Model):
    __relocation_scope__ = RelocationScope.Organization

    incident = FlexibleForeignKey("sentry.Incident", db_index=False)
    user_id = HybridCloudForeignKey(settings.AUTH_USER_MODEL, on_delete="CASCADE")
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_incidentsubscription"
        unique_together = (("incident", "user_id"),)

    __repr__ = sane_repr("incident_id", "user_id")


class AlertRuleStatus(Enum):
    PENDING = 0
    SNAPSHOT = 4
    DISABLED = 5


class AlertRuleThresholdType(Enum):
    ABOVE = 0
    BELOW = 1


class AlertRuleManager(BaseManager["AlertRule"]):
    """
    A manager that excludes all rows that are snapshots.
    """

    CACHE_SUBSCRIPTION_KEY = "alert_rule:subscription:%s"

    def get_queryset(self):
        return super().get_queryset().exclude(status=AlertRuleStatus.SNAPSHOT.value)

    def fetch_for_organization(self, organization, projects=None):
        queryset = self.filter(organization=organization)
        if projects is not None:
            queryset = queryset.filter(snuba_query__subscriptions__project__in=projects).distinct()
        return queryset

    def fetch_for_project(self, project):
        return self.filter(snuba_query__subscriptions__project=project)

    @classmethod
    def __build_subscription_cache_key(cls, subscription_id):
        return cls.CACHE_SUBSCRIPTION_KEY % subscription_id

    def get_for_subscription(self, subscription):
        """
        Fetches the AlertRule associated with a Subscription. Attempts to fetch from
        cache then hits the database
        """
        cache_key = self.__build_subscription_cache_key(subscription.id)
        alert_rule = cache.get(cache_key)
        if alert_rule is None:
            alert_rule = AlertRule.objects.get(snuba_query__subscriptions=subscription)
            cache.set(cache_key, alert_rule, 3600)

        return alert_rule

    @classmethod
    def clear_subscription_cache(cls, instance, **kwargs):
        cache.delete(cls.__build_subscription_cache_key(instance.id))
        assert cache.get(cls.__build_subscription_cache_key(instance.id)) is None

    @classmethod
    def clear_alert_rule_subscription_caches(cls, instance, **kwargs):
        subscription_ids = QuerySubscription.objects.filter(
            snuba_query=instance.snuba_query
        ).values_list("id", flat=True)
        if subscription_ids:
            cache.delete_many(
                cls.__build_subscription_cache_key(sub_id) for sub_id in subscription_ids
            )
            assert all(
                cache.get(cls.__build_subscription_cache_key(sub_id)) is None
                for sub_id in subscription_ids
            )


@region_silo_only_model
class AlertRuleExcludedProjects(Model):
    __relocation_scope__ = RelocationScope.Organization

    alert_rule = FlexibleForeignKey("sentry.AlertRule", db_index=False)
    project = FlexibleForeignKey("sentry.Project", db_constraint=False)
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_alertruleexcludedprojects"
        unique_together = (("alert_rule", "project"),)


@region_silo_only_model
class AlertRule(Model):
    __relocation_scope__ = RelocationScope.Organization

    objects: ClassVar[AlertRuleManager] = AlertRuleManager()
    objects_with_snapshots: ClassVar[BaseManager[Self]] = BaseManager()

    organization = FlexibleForeignKey("sentry.Organization", null=True)
    snuba_query = FlexibleForeignKey("sentry.SnubaQuery", null=True, unique=True)
    owner = FlexibleForeignKey(
        "sentry.Actor",
        null=True,
        on_delete=models.SET_NULL,
    )
    user_id = HybridCloudForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete="SET_NULL")
    team = FlexibleForeignKey("sentry.Team", null=True, on_delete=models.SET_NULL)
    excluded_projects = models.ManyToManyField(
        "sentry.Project", related_name="alert_rule_exclusions", through=AlertRuleExcludedProjects
    )
    name = models.TextField()
    status = models.SmallIntegerField(default=AlertRuleStatus.PENDING.value)
    # Determines whether we include all current and future projects from this
    # organization in this rule.
    include_all_projects = models.BooleanField(default=False)
    threshold_type = models.SmallIntegerField(null=True)
    resolve_threshold = models.FloatField(null=True)
    # How many times an alert value must exceed the threshold to fire/resolve the alert
    threshold_period = models.IntegerField()
    # This represents a time delta, in seconds. If not null, this is used to determine which time
    # window to query to compare the result from the current time_window to.
    comparison_delta = models.IntegerField(null=True)
    date_modified = models.DateTimeField(default=timezone.now)
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_alertrule"
        base_manager_name = "objects_with_snapshots"
        default_manager_name = "objects_with_snapshots"

    __repr__ = sane_repr("id", "name", "date_added")

    def _validate_actor(self):
        # TODO: Remove once owner is fully removed.
        if self.owner_id is not None and self.team_id is None and self.user_id is None:
            raise ValueError("AlertRule with owner requires either team_id or user_id")

    def save(self, **kwargs: Any) -> None:
        self._validate_actor()
        return super().save(**kwargs)

    @property
    def created_by_id(self):
        try:
            created_activity = AlertRuleActivity.objects.get(
                alert_rule=self, type=AlertRuleActivityType.CREATED.value
            )
            return created_activity.user_id
        except AlertRuleActivity.DoesNotExist:
            pass
        return None

    def get_audit_log_data(self):
        return {"label": self.name}


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


@region_silo_only_model
class IncidentTrigger(Model):
    __relocation_scope__ = RelocationScope.Organization

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
        index_together = (("alert_rule_trigger", "incident_id"),)


class AlertRuleTriggerManager(BaseManager["AlertRuleTrigger"]):
    CACHE_KEY = "alert_rule_triggers:alert_rule:%s"

    @classmethod
    def _build_trigger_cache_key(cls, alert_rule_id):
        return cls.CACHE_KEY % alert_rule_id

    def get_for_alert_rule(self, alert_rule):
        """
        Fetches the AlertRuleTriggers associated with an AlertRule. Attempts to fetch
        from cache then hits the database
        """
        cache_key = self._build_trigger_cache_key(alert_rule.id)
        triggers = cache.get(cache_key)
        if triggers is None:
            triggers = list(AlertRuleTrigger.objects.filter(alert_rule=alert_rule))
            cache.set(cache_key, triggers, 3600)
        return triggers

    @classmethod
    def clear_trigger_cache(cls, instance, **kwargs):
        cache.delete(cls._build_trigger_cache_key(instance.alert_rule_id))
        assert cache.get(cls._build_trigger_cache_key(instance.alert_rule_id)) is None

    @classmethod
    def clear_alert_rule_trigger_cache(cls, instance, **kwargs):
        cache.delete(cls._build_trigger_cache_key(instance.id))
        assert cache.get(cls._build_trigger_cache_key(instance.id)) is None


@region_silo_only_model
class AlertRuleTrigger(Model):
    __relocation_scope__ = RelocationScope.Organization

    alert_rule = FlexibleForeignKey("sentry.AlertRule")
    label = models.TextField()
    threshold_type = models.SmallIntegerField(null=True)
    alert_threshold = models.FloatField()
    resolve_threshold = models.FloatField(null=True)
    triggered_incidents = models.ManyToManyField(
        "sentry.Incident", related_name="triggers", through=IncidentTrigger
    )
    date_added = models.DateTimeField(default=timezone.now)

    objects: ClassVar[AlertRuleTriggerManager] = AlertRuleTriggerManager()

    class Meta:
        app_label = "sentry"
        db_table = "sentry_alertruletrigger"
        unique_together = (("alert_rule", "label"),)


@region_silo_only_model
class AlertRuleTriggerExclusion(Model):
    __relocation_scope__ = RelocationScope.Organization

    alert_rule_trigger = FlexibleForeignKey("sentry.AlertRuleTrigger", related_name="exclusions")
    query_subscription = FlexibleForeignKey("sentry.QuerySubscription")
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_alertruletriggerexclusion"
        unique_together = (("alert_rule_trigger", "query_subscription"),)


@region_silo_only_model
class AlertRuleTriggerAction(AbstractNotificationAction):
    """
    This model represents an action that occurs when a trigger is fired. This is
    typically some sort of notification.
    """

    __relocation_scope__ = RelocationScope.Global

    Type = ActionService
    TargetType = ActionTarget

    _type_registrations = {}

    INTEGRATION_TYPES = frozenset(
        (
            Type.PAGERDUTY.value,
            Type.SLACK.value,
            Type.MSTEAMS.value,
            Type.OPSGENIE.value,
            Type.DISCORD.value,
        )
    )

    # ActionService items which are not supported for AlertRuleTriggerActions
    EXEMPT_SERVICES = frozenset((Type.SENTRY_NOTIFICATION.value,))

    TypeRegistration = namedtuple(
        "TypeRegistration",
        ["handler", "slug", "type", "supported_target_types", "integration_provider"],
    )

    alert_rule_trigger = FlexibleForeignKey("sentry.AlertRuleTrigger")

    date_added = models.DateTimeField(default=timezone.now)
    sentry_app_config = JSONField(null=True)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_alertruletriggeraction"

    @property
    def target(self):
        if self.target_identifier is None:
            return None

        if self.target_type == self.TargetType.USER.value:
            return user_service.get_user(user_id=int(self.target_identifier))
        elif self.target_type == self.TargetType.TEAM.value:
            try:
                return Team.objects.get(id=int(self.target_identifier))
            except Team.DoesNotExist:
                pass
        elif self.target_type == self.TargetType.SPECIFIC.value:
            # TODO: This is only for email. We should have a way of validating that it's
            # ok to contact this email.
            return self.target_identifier

    def build_handler(self, action, incident, project):
        type = AlertRuleTriggerAction.Type(self.type)
        if type in self._type_registrations:
            return self._type_registrations[type].handler(action, incident, project)
        else:
            metrics.incr(f"alert_rule_trigger.unhandled_type.{self.type}")

    def fire(self, action, incident, project, metric_value, new_status, notification_uuid=None):
        handler = self.build_handler(action, incident, project)
        if handler:
            return handler.fire(metric_value, new_status, notification_uuid)

    def resolve(self, action, incident, project, metric_value, new_status, notification_uuid=None):
        handler = self.build_handler(action, incident, project)
        if handler:
            return handler.resolve(metric_value, new_status, notification_uuid)

    @classmethod
    def register_type(cls, slug, type, supported_target_types, integration_provider=None):
        """
        Registers a handler for a given type.
        :param slug: A string representing the name of this type registration
        :param type: The `Type` to handle.
        :param handler: A subclass of `ActionHandler` that accepts the
        `AlertRuleTriggerAction` and `Incident`.
        :param integration_provider: String representing the integration provider
        related to this type.
        """

        def inner(handler):
            if type not in cls._type_registrations:
                cls._type_registrations[type] = cls.TypeRegistration(
                    handler, slug, type, frozenset(supported_target_types), integration_provider
                )
            else:
                raise Exception("Handler already registered for type %s" % type)
            return handler

        return inner

    @classmethod
    def get_registered_type(cls, type):
        return cls._type_registrations[type]

    @classmethod
    def get_registered_types(cls):
        return list(cls._type_registrations.values())


class AlertRuleActivityType(Enum):
    CREATED = 1
    DELETED = 2
    UPDATED = 3
    ENABLED = 4
    DISABLED = 5
    SNAPSHOT = 6


@region_silo_only_model
class AlertRuleActivity(Model):
    __relocation_scope__ = RelocationScope.Organization

    alert_rule = FlexibleForeignKey("sentry.AlertRule")
    previous_alert_rule = FlexibleForeignKey(
        "sentry.AlertRule", null=True, related_name="previous_alert_rule"
    )
    user_id = HybridCloudForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete="SET_NULL")
    type = models.IntegerField()
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_alertruleactivity"


post_delete.connect(AlertRuleManager.clear_subscription_cache, sender=QuerySubscription)
post_save.connect(AlertRuleManager.clear_subscription_cache, sender=QuerySubscription)
post_save.connect(AlertRuleManager.clear_alert_rule_subscription_caches, sender=AlertRule)
post_delete.connect(AlertRuleManager.clear_alert_rule_subscription_caches, sender=AlertRule)

post_delete.connect(AlertRuleTriggerManager.clear_alert_rule_trigger_cache, sender=AlertRule)
post_save.connect(AlertRuleTriggerManager.clear_alert_rule_trigger_cache, sender=AlertRule)
post_save.connect(AlertRuleTriggerManager.clear_trigger_cache, sender=AlertRuleTrigger)
post_delete.connect(AlertRuleTriggerManager.clear_trigger_cache, sender=AlertRuleTrigger)

post_save.connect(IncidentManager.clear_active_incident_cache, sender=Incident)
post_save.connect(IncidentManager.clear_active_incident_project_cache, sender=IncidentProject)
post_delete.connect(IncidentManager.clear_active_incident_project_cache, sender=IncidentProject)

post_delete.connect(IncidentTriggerManager.clear_incident_cache, sender=Incident)
post_save.connect(IncidentTriggerManager.clear_incident_trigger_cache, sender=IncidentTrigger)
post_delete.connect(IncidentTriggerManager.clear_incident_trigger_cache, sender=IncidentTrigger)
