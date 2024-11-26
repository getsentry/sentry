from __future__ import annotations

import abc
import logging
from collections.abc import Callable, Collection, Iterable
from datetime import timedelta
from enum import Enum, IntEnum, StrEnum
from typing import TYPE_CHECKING, Any, ClassVar, Protocol, Self

from django.conf import settings
from django.core.cache import cache
from django.db import models
from django.db.models import QuerySet
from django.db.models.signals import post_delete, post_save
from django.utils import timezone
from django.utils.translation import gettext_lazy

from sentry.backup.scopes import RelocationScope
from sentry.constants import ObjectStatus
from sentry.db.models import (
    BoundedPositiveIntegerField,
    FlexibleForeignKey,
    JSONField,
    Model,
    region_silo_model,
    sane_repr,
)
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey
from sentry.db.models.manager.base import BaseManager
from sentry.db.models.manager.base_query_set import BaseQuerySet
from sentry.incidents.models.alert_rule_activations import AlertRuleActivations
from sentry.incidents.models.incident import Incident, IncidentStatus, IncidentTrigger
from sentry.incidents.utils.constants import INCIDENTS_SNUBA_SUBSCRIPTION_TYPE
from sentry.incidents.utils.types import AlertRuleActivationConditionType
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.models.team import Team
from sentry.notifications.models.notificationaction import (
    AbstractNotificationAction,
    ActionService,
    ActionTarget,
)
from sentry.seer.anomaly_detection.delete_rule import delete_rule_in_seer
from sentry.snuba.models import QuerySubscription
from sentry.snuba.subscriptions import bulk_create_snuba_subscriptions, delete_snuba_subscription
from sentry.types.actor import Actor
from sentry.users.services.user import RpcUser
from sentry.users.services.user.service import user_service
from sentry.utils import metrics

if TYPE_CHECKING:
    from sentry.incidents.action_handlers import ActionHandler


logger = logging.getLogger(__name__)


class SubscriptionCallback(Protocol):
    def __call__(self, subscription: QuerySubscription, *args: Any, **kwargs: Any) -> bool: ...


alert_subscription_callback_registry: dict[AlertRuleMonitorTypeInt, SubscriptionCallback] = {}


def register_alert_subscription_callback(
    monitor_type: AlertRuleMonitorTypeInt,
) -> Callable[[Callable], Callable]:
    def decorator(func: Callable) -> Callable:
        alert_subscription_callback_registry[monitor_type] = func
        return func

    return decorator


def invoke_alert_subscription_callback(
    monitor_type: AlertRuleMonitorTypeInt, subscription: QuerySubscription, **kwargs: Any
) -> bool:
    try:
        callback = alert_subscription_callback_registry[monitor_type]
    except KeyError:
        return False

    return callback(subscription, **kwargs)


class AlertRuleStatus(Enum):
    PENDING = 0
    SNAPSHOT = 4
    DISABLED = 5
    NOT_ENOUGH_DATA = 6


class AlertRuleDetectionType(models.TextChoices):
    STATIC = "static", gettext_lazy("Static")
    PERCENT = "percent", gettext_lazy("Percent")
    DYNAMIC = "dynamic", gettext_lazy("Dynamic")


class AlertRuleSensitivity(models.TextChoices):
    LOW = "low", gettext_lazy("Low")
    MEDIUM = "medium", gettext_lazy("Medium")
    HIGH = "high", gettext_lazy("High")


class AlertRuleSeasonality(models.TextChoices):
    """All combinations of multi select fields for anomaly detection alerts
    We do not anticipate adding more
    """

    AUTO = "auto", gettext_lazy("Auto")
    HOURLY = "hourly", gettext_lazy("Hourly")
    DAILY = "daily", gettext_lazy("Daily")
    WEEKLY = "weekly", gettext_lazy("Weekly")
    HOURLY_DAILY = "hourly_daily", gettext_lazy("Hourly & Daily")
    HOURLY_WEEKLY = "hourly_weekly", gettext_lazy("Hourly & Weekly")
    HOURLY_DAILY_WEEKLY = "hourly_daily_weekly", gettext_lazy("Hourly, Daily, & Weekly")
    DAILY_WEEKLY = "daily_weekly", gettext_lazy("Daily & Weekly")


class AlertRuleManager(BaseManager["AlertRule"]):
    """
    A manager that excludes all rows that are snapshots.
    """

    CACHE_SUBSCRIPTION_KEY = "alert_rule:subscription:%s"

    def get_queryset(self) -> BaseQuerySet[AlertRule]:
        return super().get_queryset().exclude(status=AlertRuleStatus.SNAPSHOT.value)

    def fetch_for_organization(
        self, organization: Organization, projects: Collection[Project] | None = None
    ):
        queryset = self.filter(organization=organization)
        if projects is not None:
            queryset = queryset.filter(projects__in=projects).distinct()

        return queryset

    def fetch_for_project(self, project: Project) -> BaseQuerySet[AlertRule]:
        return self.filter(projects=project).distinct()

    @classmethod
    def __build_subscription_cache_key(cls, subscription_id: int) -> str:
        return cls.CACHE_SUBSCRIPTION_KEY % subscription_id

    def get_for_subscription(self, subscription: Model) -> AlertRule:
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
    def clear_subscription_cache(cls, instance, **kwargs: Any) -> None:
        cache.delete(cls.__build_subscription_cache_key(instance.id))
        assert cache.get(cls.__build_subscription_cache_key(instance.id)) is None

    @classmethod
    def clear_alert_rule_subscription_caches(cls, instance: AlertRule, **kwargs: Any) -> None:
        subscription_ids = QuerySubscription.objects.filter(
            snuba_query_id=instance.snuba_query_id
        ).values_list("id", flat=True)
        if subscription_ids:
            cache.delete_many(
                cls.__build_subscription_cache_key(sub_id) for sub_id in subscription_ids
            )
            assert all(
                cache.get(cls.__build_subscription_cache_key(sub_id)) is None
                for sub_id in subscription_ids
            )

    @classmethod
    def delete_data_in_seer(cls, instance: AlertRule, **kwargs: Any) -> None:
        if instance.detection_type == AlertRuleDetectionType.DYNAMIC:
            success = delete_rule_in_seer(alert_rule=instance)
            if not success:
                logger.error(
                    "Call to delete rule data in Seer failed",
                    extra={
                        "rule_id": instance.id,
                    },
                )

    def conditionally_subscribe_project_to_alert_rules(
        self,
        project: Project,
        activation_condition: AlertRuleActivationConditionType,
        query_extra: str,
        origin: str,
        activator: str,
    ) -> list[QuerySubscription]:
        """
        Subscribes a project to an alert rule given activation condition
        Initializes an AlertRule activation instance
        """
        try:
            project_alert_rules: QuerySet[AlertRule] = self.filter(
                projects=project,
                monitor_type=AlertRuleMonitorTypeInt.ACTIVATED,
            )
            created_subscriptions = []
            for alert_rule in project_alert_rules:
                # an alert rule should only ever have a single condition
                if alert_rule.activation_condition.filter(
                    condition_type=activation_condition.value
                ).exists():
                    # if an activated alert rule exists with the passed condition
                    logger.info(
                        "Attempt subscribe project to activated alert rule",
                        extra={
                            "origin": origin,
                            "query_extra": query_extra,
                            "condition": activation_condition,
                        },
                    )
                    # attempt to subscribe the alert rule
                    created_subscriptions.extend(
                        alert_rule.subscribe_projects(
                            projects=[project],
                            monitor_type=AlertRuleMonitorTypeInt.ACTIVATED,
                            query_extra=query_extra,
                            activation_condition=activation_condition,
                            activator=activator,
                        )
                    )
            return created_subscriptions
        except Exception as e:
            logger.exception(
                "Failed to subscribe project to activated alert rule",
                extra={
                    "origin": origin,
                    "exception": e,
                },
            )
        return []


@region_silo_model
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


class AlertRuleMonitorTypeInt(IntEnum):
    CONTINUOUS = 0
    ACTIVATED = 1


@region_silo_model
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

    user_id = HybridCloudForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete="SET_NULL")
    team = FlexibleForeignKey("sentry.Team", null=True, on_delete=models.SET_NULL)
    name = models.TextField()
    status = models.SmallIntegerField(default=AlertRuleStatus.PENDING.value)
    threshold_type = models.SmallIntegerField(null=True)
    resolve_threshold = models.FloatField(null=True)
    # How many times an alert value must exceed the threshold to fire/resolve the alert
    threshold_period = models.IntegerField()
    # This represents a time delta, in seconds. If not null, this is used to determine which time
    # window to query to compare the result from the current time_window to.
    comparison_delta = models.IntegerField(null=True)
    date_modified = models.DateTimeField(default=timezone.now)
    date_added = models.DateTimeField(default=timezone.now)
    monitor_type = models.IntegerField(default=AlertRuleMonitorTypeInt.CONTINUOUS)
    description = models.CharField(max_length=1000, null=True)
    detection_type = models.CharField(
        default=AlertRuleDetectionType.STATIC, choices=AlertRuleDetectionType.choices
    )
    sensitivity = models.CharField(choices=AlertRuleSensitivity.choices, null=True)
    seasonality = models.CharField(choices=AlertRuleSeasonality.choices, null=True)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_alertrule"
        base_manager_name = "objects_with_snapshots"
        default_manager_name = "objects_with_snapshots"

    __repr__ = sane_repr("id", "name", "date_added")

    @property
    def created_by_id(self) -> int | None:
        try:
            created_activity = AlertRuleActivity.objects.get(
                alert_rule=self, type=AlertRuleActivityType.CREATED.value
            )
            return created_activity.user_id
        except AlertRuleActivity.DoesNotExist:
            pass
        return None

    @property
    def owner(self) -> Actor | None:
        """Part of ActorOwned Protocol"""
        return Actor.from_id(user_id=self.user_id, team_id=self.team_id)

    @owner.setter
    def owner(self, actor: Actor | None) -> None:
        """Part of ActorOwned Protocol"""
        self.team_id = None
        self.user_id = None
        if actor and actor.is_user:
            self.user_id = actor.id
        if actor and actor.is_team:
            self.team_id = actor.id

    def get_audit_log_data(self) -> dict[str, Any]:
        return {"label": self.name}

    def subscribe_projects(
        self,
        projects: Iterable[Project],
        monitor_type: AlertRuleMonitorTypeInt = AlertRuleMonitorTypeInt.CONTINUOUS,
        query_extra: str | None = None,
        activation_condition: AlertRuleActivationConditionType | None = None,
        activator: str | None = None,
    ) -> list[QuerySubscription]:
        """
        Subscribes a list of projects to the alert rule instance
        :return: The list of created subscriptions
        """

        logger.info(
            "Subscribing projects to alert rule",
            extra={
                "alert_rule.monitor_type": self.monitor_type,
                "conditional_monitor_type": monitor_type,
                "query_extra": query_extra,
            },
        )
        # NOTE: AlertRuleMonitorTypeInt.ACTIVATED will be conditionally subscribed given activation triggers
        # On activated subscription, additional query parameters will be added to the constructed query in Snuba
        created_subscriptions = []
        if self.monitor_type == monitor_type:
            # NOTE: QuerySubscriptions hold reference to Projects which should match the AlertRule's project reference
            created_subscriptions = bulk_create_snuba_subscriptions(
                projects,
                INCIDENTS_SNUBA_SUBSCRIPTION_TYPE,
                self.snuba_query,
                query_extra=query_extra,
            )
            if self.monitor_type == AlertRuleMonitorTypeInt.ACTIVATED:
                # NOTE: Activated Alert Rules are conditionally subscribed
                # Meaning at time of subscription, the rule must have been activated
                if not activator or activation_condition is None:
                    raise Exception(
                        "Alert activations require an activation condition and activator reference"
                    )

                for subscription in created_subscriptions:
                    AlertRuleActivations.objects.create(
                        alert_rule=self,
                        query_subscription=subscription,
                        condition_type=activation_condition.value,
                        activator=activator,
                    )

        return created_subscriptions


class AlertRuleTriggerManager(BaseManager["AlertRuleTrigger"]):
    CACHE_KEY = "alert_rule_triggers:alert_rule:%s"

    @classmethod
    def _build_trigger_cache_key(cls, alert_rule_id: int) -> str:
        return cls.CACHE_KEY % alert_rule_id

    def get_for_alert_rule(self, alert_rule: AlertRule) -> list[AlertRuleTrigger]:
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
    def clear_trigger_cache(cls, instance: AlertRuleTrigger, **kwargs: Any) -> None:
        cache.delete(cls._build_trigger_cache_key(instance.alert_rule_id))
        assert cache.get(cls._build_trigger_cache_key(instance.alert_rule_id)) is None

    @classmethod
    def clear_alert_rule_trigger_cache(cls, instance: AlertRuleTrigger, **kwargs: Any) -> None:
        cache.delete(cls._build_trigger_cache_key(instance.id))
        assert cache.get(cls._build_trigger_cache_key(instance.id)) is None


class AlertRuleThresholdType(Enum):
    ABOVE = 0
    BELOW = 1
    ABOVE_AND_BELOW = 2


@region_silo_model
class AlertRuleTrigger(Model):
    """
    This model represents the *threshold* trigger for an AlertRule

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


class AlertRuleTriggerActionMethod(StrEnum):
    FIRE = "fire"
    RESOLVE = "resolve"


class AlertRuleTriggerActionManager(BaseManager["AlertRuleTriggerAction"]):
    """
    A manager that excludes trigger actions that are pending to be deleted
    """

    def get_queryset(self) -> BaseQuerySet[AlertRuleTriggerAction]:
        return super().get_queryset().exclude(status=ObjectStatus.PENDING_DELETION)


class ActionHandlerFactory(abc.ABC):
    """A factory for action handlers tied to a specific incident service.

    The factory's builder method is augmented with metadata about which service it is
    for and which target types that service supports.
    """

    def __init__(
        self,
        slug: str,
        service_type: ActionService,
        supported_target_types: Iterable[ActionTarget],
        integration_provider: str | None,
    ) -> None:
        self.slug = slug
        self.service_type = service_type
        self.supported_target_types = frozenset(supported_target_types)
        self.integration_provider = integration_provider

    @abc.abstractmethod
    def build_handler(
        self,
        action: AlertRuleTriggerAction,
        incident: Incident,
        project: Project,
    ) -> ActionHandler:
        raise NotImplementedError


class _AlertRuleActionHandlerClassFactory(ActionHandlerFactory):
    """A factory derived from a concrete ActionHandler class.

    The factory builds a handler simply by instantiating the provided class. The
    `AlertRuleTriggerAction.register_type` decorator provides the rest of the metadata.
    """

    def __init__(
        self,
        slug: str,
        service_type: ActionService,
        supported_target_types: Iterable[ActionTarget],
        integration_provider: str | None,
        trigger_action_class: type[ActionHandler],
    ) -> None:
        super().__init__(slug, service_type, supported_target_types, integration_provider)
        self.trigger_action_class = trigger_action_class

    def build_handler(
        self, action: AlertRuleTriggerAction, incident: Incident, project: Project
    ) -> ActionHandler:
        return self.trigger_action_class(action, incident, project)


class _FactoryRegistry:
    def __init__(self) -> None:
        # Two kinds of index. The value sets should be equal at all times.
        self.by_action_service: dict[ActionService, ActionHandlerFactory] = {}
        self.by_slug: dict[str, ActionHandlerFactory] = {}

    def register(self, factory: ActionHandlerFactory) -> None:
        if factory.service_type in self.by_action_service:
            raise Exception(f"Handler already registered for type {factory.service_type}")
        if factory.slug in self.by_slug:
            raise Exception(f"Handler already registered with slug={factory.slug!r}")
        self.by_action_service[factory.service_type] = factory
        self.by_slug[factory.slug] = factory


@region_silo_model
class AlertRuleTriggerAction(AbstractNotificationAction):
    """
    This model represents an action that occurs when a trigger (over/under) is fired. This is
    typically some sort of notification.

    NOTE: AlertRuleTrigger is the 'threshold' for the AlertRule
    """

    __relocation_scope__ = RelocationScope.Global

    Type = ActionService
    TargetType = ActionTarget

    # As a test utility, TemporaryAlertRuleTriggerActionRegistry has privileged
    # access to this otherwise private class variable
    _factory_registrations = _FactoryRegistry()

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

    objects: ClassVar[AlertRuleTriggerActionManager] = AlertRuleTriggerActionManager()
    objects_for_deletion: ClassVar[BaseManager] = BaseManager()

    alert_rule_trigger = FlexibleForeignKey("sentry.AlertRuleTrigger")

    date_added = models.DateTimeField(default=timezone.now)
    sentry_app_config: models.Field[
        # list of dicts if this is a sentry app, otherwise can be singular dict
        dict[str, Any] | list[dict[str, Any]] | None,
        dict[str, Any] | list[dict[str, Any]] | None,
    ] = JSONField(null=True)
    status = BoundedPositiveIntegerField(
        default=ObjectStatus.ACTIVE, choices=ObjectStatus.as_choices()
    )

    class Meta:
        app_label = "sentry"
        db_table = "sentry_alertruletriggeraction"

    @property
    def target(self) -> RpcUser | Team | str | None:
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
        return None

    def build_handler(
        self, action: AlertRuleTriggerAction, incident: Incident, project: Project
    ) -> ActionHandler | None:
        service_type = AlertRuleTriggerAction.Type(self.type)
        factory = self._factory_registrations.by_action_service.get(service_type)
        if factory is not None:
            return factory.build_handler(action, incident, project)
        else:
            metrics.incr(f"alert_rule_trigger.unhandled_type.{self.type}")
            return None

    def fire(
        self,
        action: AlertRuleTriggerAction,
        incident: Incident,
        project: Project,
        metric_value: int | float,
        new_status: IncidentStatus,
        notification_uuid: str | None = None,
    ) -> None:
        handler = self.build_handler(action, incident, project)
        if handler:
            return handler.fire(metric_value, new_status, notification_uuid)

    def resolve(
        self,
        action: AlertRuleTriggerAction,
        incident: Incident,
        project: Project,
        metric_value: int | float,
        new_status: IncidentStatus,
        notification_uuid: str | None = None,
    ) -> None:
        handler = self.build_handler(action, incident, project)
        if handler:
            return handler.resolve(metric_value, new_status, notification_uuid)

    def get_single_sentry_app_config(self) -> dict[str, Any] | None:
        value = self.sentry_app_config
        if isinstance(value, list):
            raise ValueError("Sentry app actions have a list of configs")
        return value

    @classmethod
    def register_factory(cls, factory: ActionHandlerFactory) -> None:
        cls._factory_registrations.register(factory)

    @classmethod
    def register_type(
        cls,
        slug: str,
        service_type: ActionService,
        supported_target_types: Collection[ActionTarget],
        integration_provider: str | None = None,
    ) -> Callable[[type[ActionHandler]], type[ActionHandler]]:
        """
        Register a factory for the decorated ActionHandler class, for a given service type.

        :param slug: A string representing the name of this type registration
        :param service_type: The action service type the decorated handler supports.
        :param supported_target_types: The target types the decorated handler supports.
        :param integration_provider: String representing the integration provider
               related to this type.
        """

        def inner(handler: type[ActionHandler]) -> type[ActionHandler]:
            """
            :param handler: A subclass of `ActionHandler` that accepts the
                            `AlertRuleActionHandler` and `Incident`.
            """
            factory = _AlertRuleActionHandlerClassFactory(
                slug, service_type, supported_target_types, integration_provider, handler
            )
            cls.register_factory(factory)
            return handler

        return inner

    @classmethod
    def get_registered_factory(cls, service_type: ActionService) -> ActionHandlerFactory:
        return cls._factory_registrations.by_action_service[service_type]

    @classmethod
    def get_registered_factories(cls) -> list[ActionHandlerFactory]:
        return list(cls._factory_registrations.by_action_service.values())

    @classmethod
    def look_up_factory_by_slug(cls, slug: str) -> ActionHandlerFactory | None:
        return cls._factory_registrations.by_slug.get(slug)

    @classmethod
    def get_all_slugs(cls) -> list[str]:
        return list(cls._factory_registrations.by_slug)


class AlertRuleActivityType(Enum):
    CREATED = 1
    DELETED = 2
    UPDATED = 3
    ENABLED = 4
    DISABLED = 5
    SNAPSHOT = 6
    ACTIVATED = 7
    DEACTIVATED = 8


@region_silo_model
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


@register_alert_subscription_callback(AlertRuleMonitorTypeInt.ACTIVATED)
def update_alert_activations(
    subscription: QuerySubscription, alert_rule: AlertRule, value: float
) -> bool:
    if subscription.snuba_query is None:
        return False

    now = timezone.now()
    subscription_end = subscription.date_added + timedelta(
        seconds=subscription.snuba_query.time_window
    )

    if now > subscription_end:
        logger.info(
            "alert activation monitor finishing",
            extra={
                "subscription_window": subscription.snuba_query.time_window,
                "date_added": subscription.date_added,
                "now": now,
            },
        )

        alert_rule.activations.filter(finished_at=None, query_subscription=subscription).update(
            metric_value=value, finished_at=now
        )
        # NOTE: QuerySubscription deletion will set fk to null on the activation
        delete_snuba_subscription(subscription)
    else:
        alert_rule.activations.filter(finished_at=None, query_subscription=subscription).update(
            metric_value=value
        )

    return True


post_delete.connect(AlertRuleManager.clear_subscription_cache, sender=QuerySubscription)
post_delete.connect(AlertRuleManager.delete_data_in_seer, sender=AlertRule)
post_save.connect(AlertRuleManager.clear_subscription_cache, sender=QuerySubscription)
post_save.connect(AlertRuleManager.clear_alert_rule_subscription_caches, sender=AlertRule)
post_delete.connect(AlertRuleManager.clear_alert_rule_subscription_caches, sender=AlertRule)

post_delete.connect(AlertRuleTriggerManager.clear_alert_rule_trigger_cache, sender=AlertRule)
post_save.connect(AlertRuleTriggerManager.clear_alert_rule_trigger_cache, sender=AlertRule)
post_save.connect(AlertRuleTriggerManager.clear_trigger_cache, sender=AlertRuleTrigger)
post_delete.connect(AlertRuleTriggerManager.clear_trigger_cache, sender=AlertRuleTrigger)
