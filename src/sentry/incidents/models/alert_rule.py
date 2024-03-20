from __future__ import annotations

import logging
from collections import namedtuple
from collections.abc import Callable
from datetime import timedelta
from enum import Enum
from typing import Any, ClassVar, Self

from django.conf import settings
from django.core.cache import cache
from django.db import models
from django.db.models import Q, QuerySet
from django.db.models.signals import post_delete, post_save
from django.utils import timezone

from sentry.backup.dependencies import PrimaryKeyMap
from sentry.backup.helpers import ImportFlags
from sentry.backup.scopes import ImportScope, RelocationScope
from sentry.constants import ObjectStatus
from sentry.db.models import (
    BoundedPositiveIntegerField,
    FlexibleForeignKey,
    JSONField,
    Model,
    region_silo_only_model,
    sane_repr,
)
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey
from sentry.db.models.manager import BaseManager
from sentry.incidents.models.alert_rule_activations import AlertRuleActivations
from sentry.incidents.models.incident import IncidentTrigger
from sentry.incidents.utils.constants import INCIDENTS_SNUBA_SUBSCRIPTION_TYPE
from sentry.incidents.utils.types import AlertRuleActivationConditionType
from sentry.models.actor import Actor
from sentry.models.notificationaction import AbstractNotificationAction, ActionService, ActionTarget
from sentry.models.project import Project
from sentry.models.team import Team
from sentry.services.hybrid_cloud.user.service import user_service
from sentry.snuba.models import QuerySubscription
from sentry.snuba.subscriptions import bulk_create_snuba_subscriptions, delete_snuba_subscription
from sentry.utils import metrics

logger = logging.getLogger(__name__)

alert_subscription_callback_registry: dict[
    AlertRuleMonitorType, Callable[[QuerySubscription], bool]
] = {}


def register_alert_subscription_callback(
    monitor_type: AlertRuleMonitorType,
) -> Callable[[Callable], Callable]:
    def decorator(func: Callable) -> Callable:
        alert_subscription_callback_registry[monitor_type] = func
        return func

    return decorator


def invoke_alert_subscription_callback(
    monitor_type: AlertRuleMonitorType, subscription: QuerySubscription
) -> bool:
    try:
        callback = alert_subscription_callback_registry[monitor_type]
    except KeyError:
        return False

    return callback(subscription)


class AlertRuleStatus(Enum):
    PENDING = 0
    SNAPSHOT = 4
    DISABLED = 5


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
            # TODO - Cleanup Subscription Project Mapping
            queryset = queryset.filter(
                Q(snuba_query__subscriptions__project__in=projects) | Q(projects__in=projects)
            ).distinct()

        return queryset

    def fetch_for_project(self, project):
        # TODO - Cleanup Subscription Project Mapping
        return self.filter(
            Q(snuba_query__subscriptions__project=project) | Q(projects=project)
        ).distinct()

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

    def conditionally_subscribe_project_to_alert_rules(
        self,
        project: Project,
        activation_condition: AlertRuleActivationConditionType,
        query_extra: str,
        trigger: str,
    ) -> list[QuerySubscription]:
        """
        Subscribes a project to an alert rule given activation condition
        Initializes an AlertRule activation instance
        """
        try:
            project_alert_rules: QuerySet[AlertRule] = self.filter(
                projects=project,
                monitor_type=AlertRuleMonitorType.ACTIVATED.value,
            )
            created_subscriptions = []
            for alert_rule in project_alert_rules:
                if alert_rule.activation_conditions.filter(
                    condition_type=activation_condition.value
                ).exists():
                    # if an activated alert rule exists with the passed condition
                    logger.info(
                        "Attempt subscribe project to activated alert rule",
                        extra={
                            "trigger": trigger,
                            "query_extra": query_extra,
                            "condition": activation_condition,
                        },
                    )
                    # attempt to subscribe the alert rule
                    created_subscriptions.extend(
                        alert_rule.subscribe_projects(
                            projects=[project],
                            monitor_type=AlertRuleMonitorType.ACTIVATED,
                            query_extra=query_extra,
                        )
                    )
            return created_subscriptions
        except Exception as e:
            logger.exception(
                "Failed to subscribe project to activated alert rule",
                extra={
                    "trigger": trigger,
                    "exception": e,
                },
            )
        return []


@region_silo_only_model
class AlertRuleExcludedProjects(Model):
    """
    Excludes a specific project from an AlertRule

    NOTE: This feature is not currently utilized.
    """

    __relocation_scope__ = RelocationScope.Organization

    alert_rule = FlexibleForeignKey("sentry.AlertRule", db_index=False)
    project = FlexibleForeignKey("sentry.Project", db_constraint=False)
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_alertruleexcludedprojects"
        unique_together = (("alert_rule", "project"),)


@region_silo_only_model
class AlertRuleProjects(Model):
    """
    Specify a project for the AlertRule
    """

    __relocation_scope__ = RelocationScope.Organization

    alert_rule = FlexibleForeignKey("sentry.AlertRule", db_index=False)
    project = FlexibleForeignKey("sentry.Project")
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_alertruleprojects"
        unique_together = (("alert_rule", "project"),)


class AlertRuleMonitorType(Enum):
    CONTINUOUS = 0
    ACTIVATED = 1


@region_silo_only_model
class AlertRule(Model):
    __relocation_scope__ = RelocationScope.Organization

    objects: ClassVar[AlertRuleManager] = AlertRuleManager()
    objects_with_snapshots: ClassVar[BaseManager[Self]] = BaseManager()

    organization = FlexibleForeignKey("sentry.Organization", null=True)
    # NOTE: for now AlertRules and Projects should be 1:1
    # We do not have multi-project alert rules yet
    projects = models.ManyToManyField(
        "sentry.Project", related_name="alert_rule_projects", through=AlertRuleProjects
    )
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
    )  # NOTE: This feature is not currently utilized.
    name = models.TextField()
    status = models.SmallIntegerField(default=AlertRuleStatus.PENDING.value)
    # Determines whether we include all current and future projects from this
    # organization in this rule.
    include_all_projects = models.BooleanField(
        default=False
    )  # NOTE: This feature is not currently utilized.
    threshold_type = models.SmallIntegerField(null=True)
    resolve_threshold = models.FloatField(null=True)
    # How many times an alert value must exceed the threshold to fire/resolve the alert
    threshold_period = models.IntegerField()
    # This represents a time delta, in seconds. If not null, this is used to determine which time
    # window to query to compare the result from the current time_window to.
    comparison_delta = models.IntegerField(null=True)
    date_modified = models.DateTimeField(default=timezone.now)
    date_added = models.DateTimeField(default=timezone.now)
    monitor_type = models.IntegerField(default=AlertRuleMonitorType.CONTINUOUS.value)

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

    def save(self, *args, **kwargs: Any) -> None:
        self._validate_actor()
        return super().save(*args, **kwargs)

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

    def normalize_before_relocation_import(
        self, pk_map: PrimaryKeyMap, scope: ImportScope, flags: ImportFlags
    ) -> int | None:
        old_pk = super().normalize_before_relocation_import(pk_map, scope, flags)
        if old_pk is None:
            return None

        # TODO(hybrid-cloud): actor refactor. Remove this check once we're sure we've migrated all
        # remaining `owner_id`'s to also have `team_id` or `user_id`, which seems to not be the case
        # today.
        if self.owner_id is not None and self.team_id is None and self.user_id is None:
            actor = Actor.objects.filter(id=self.owner_id).first()
            if actor is None or (actor.team_id is None and actor.user_id is None):
                # The `owner_id` references a non-existent `Actor`, or else one that has no
                # `team_id` or `user_id` of its own, making it functionally a null `Actor`. This
                # means the `owner_id` is invalid, so we simply delete it.
                self.owner_id = None
            else:
                # Looks like an existing `Actor` points to a valid team or user - make sure that
                # information is duplicated into this `AlertRule` model as well.
                self.team_id = actor.team_id
                self.user_id = actor.user_id

        return old_pk

    def subscribe_projects(
        self,
        projects: list[Project],
        monitor_type: AlertRuleMonitorType = AlertRuleMonitorType.CONTINUOUS,
        query_extra: str | None = None,
    ) -> list[QuerySubscription]:
        """
        Subscribes a list of projects to the alert rule instance
        :return: The list of created subscriptions
        """

        logger.info(
            "Subscribing projects to alert rule",
            extra={
                "alert_rule.monitor_type": self.monitor_type,
                "conditional_monitor_type": monitor_type.value,
                "query_extra": query_extra,
            },
        )
        # NOTE: AlertRuleMonitorType.ACTIVATED will be conditionally subscribed given activation triggers
        # On activated subscription, additional query parameters will be added to the constructed query in Snuba
        created_subscriptions = []
        if self.monitor_type == monitor_type.value:
            created_subscriptions = bulk_create_snuba_subscriptions(
                projects,
                INCIDENTS_SNUBA_SUBSCRIPTION_TYPE,
                self.snuba_query,
                query_extra,
            )
            # NOTE: activations should be tied to subscriptions for multi-project alert rules
            # TODO: ensure we're updating the activation on subscription process
            AlertRuleActivations.objects.create(
                alert_rule=self,
                metric_value=0,
            )

        return created_subscriptions


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


class AlertRuleThresholdType(Enum):
    ABOVE = 0
    BELOW = 1


@region_silo_only_model
class AlertRuleTrigger(Model):
    """
    This model represents the threshold trigger for an AlertRule

    threshold_type is AlertRuleThresholdType (Above/Below)
    alert_threshold is the trigger value
    """

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
    """
    Allows us to define a specific trigger to be excluded from a query subscription
    """

    __relocation_scope__ = RelocationScope.Organization

    alert_rule_trigger = FlexibleForeignKey("sentry.AlertRuleTrigger", related_name="exclusions")
    query_subscription = FlexibleForeignKey("sentry.QuerySubscription")
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_alertruletriggerexclusion"
        unique_together = (("alert_rule_trigger", "query_subscription"),)


class AlertRuleTriggerActionManager(BaseManager["AlertRuleTriggerAction"]):
    """
    A manager that excludes trigger actions that are pending to be deleted
    """

    def get_queryset(self):
        return super().get_queryset().exclude(status=ObjectStatus.PENDING_DELETION)


@region_silo_only_model
class AlertRuleTriggerAction(AbstractNotificationAction):
    """
    This model represents an action that occurs when a trigger is fired. This is
    typically some sort of notification.
    """

    __relocation_scope__ = RelocationScope.Global

    Type = ActionService
    TargetType = ActionTarget

    _type_registrations: dict[ActionService, TypeRegistration] = {}

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

    objects: ClassVar[AlertRuleTriggerActionManager] = AlertRuleTriggerActionManager()
    objects_for_deletion: ClassVar[BaseManager] = BaseManager()

    alert_rule_trigger = FlexibleForeignKey("sentry.AlertRuleTrigger")

    date_added = models.DateTimeField(default=timezone.now)
    sentry_app_config = JSONField(
        null=True
    )  # list of dicts if this is a sentry app, otherwise can be singular dict
    status = BoundedPositiveIntegerField(
        default=ObjectStatus.ACTIVE, choices=ObjectStatus.as_choices()
    )

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
    ACTIVATED = 7
    DEACTIVATED = 8


@region_silo_only_model
class AlertRuleActivity(Model):
    """
    Provides an audit log of activity for the alert rule
    """

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


@register_alert_subscription_callback(AlertRuleMonitorType.ACTIVATED)
def clean_expired_alerts(subscription: QuerySubscription) -> bool:
    now = timezone.now()
    subscription_end = subscription.date_added + timedelta(
        seconds=subscription.snuba_query.time_window
    )

    if now > subscription_end:
        delete_snuba_subscription(subscription)

    return True


post_delete.connect(AlertRuleManager.clear_subscription_cache, sender=QuerySubscription)
post_save.connect(AlertRuleManager.clear_subscription_cache, sender=QuerySubscription)
post_save.connect(AlertRuleManager.clear_alert_rule_subscription_caches, sender=AlertRule)
post_delete.connect(AlertRuleManager.clear_alert_rule_subscription_caches, sender=AlertRule)

post_delete.connect(AlertRuleTriggerManager.clear_alert_rule_trigger_cache, sender=AlertRule)
post_save.connect(AlertRuleTriggerManager.clear_alert_rule_trigger_cache, sender=AlertRule)
post_save.connect(AlertRuleTriggerManager.clear_trigger_cache, sender=AlertRuleTrigger)
post_delete.connect(AlertRuleTriggerManager.clear_trigger_cache, sender=AlertRuleTrigger)
