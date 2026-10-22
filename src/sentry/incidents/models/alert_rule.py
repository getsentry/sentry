from __future__ import annotations

import logging
from enum import Enum, IntEnum
from typing import Any, ClassVar, Self

from django.conf import settings
from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy

from sentry.backup.scopes import RelocationScope
from sentry.db.models import (
    FlexibleForeignKey,
    Model,
    cell_silo_model,
    sane_repr,
)
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey
from sentry.db.models.manager.base import BaseManager
from sentry.db.models.manager.base_query_set import BaseQuerySet
from sentry.models.project import Project
from sentry.types.actor import Actor

logger = logging.getLogger(__name__)


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

    def get_queryset(self) -> BaseQuerySet[AlertRule]:
        return super().get_queryset().exclude(status=AlertRuleStatus.SNAPSHOT.value)

    def fetch_for_project(self, project: Project) -> BaseQuerySet[AlertRule]:
        return self.filter(projects=project).distinct()


@cell_silo_model
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


class ComparisonDeltaChoices(models.IntegerChoices):
    FIVE_MINUTES = (300, "5 minutes ago")
    FIFTEEN_MINUTES = (900, "15 minutes ago")
    ONE_HOUR = (3600, "1 hour ago")
    ONE_DAY = (86400, "1 day ago")
    ONE_WEEK = (604800, "1 week ago")
    ONE_MONTH = (2592000, "1 month ago")


@cell_silo_model
class AlertRule(Model):
    __relocation_scope__ = RelocationScope.Organization

    objects: ClassVar[AlertRuleManager] = AlertRuleManager()
    objects_with_snapshots: ClassVar[BaseManager[Self]] = BaseManager()

    organization = FlexibleForeignKey("sentry.Organization")
    # NOTE: for now AlertRules and Projects should be 1:1
    # We do not have multi-project alert rules yet
    projects = models.ManyToManyField(
        "sentry.Project", related_name="alert_rule_projects", through=AlertRuleProjects
    )
    snuba_query = FlexibleForeignKey("sentry.SnubaQuery", unique=True)

    user_id = HybridCloudForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete="SET_NULL")
    team = FlexibleForeignKey("sentry.Team", null=True, on_delete=models.SET_NULL)
    name = models.TextField()
    status = models.SmallIntegerField(
        default=AlertRuleStatus.PENDING.value, db_default=AlertRuleStatus.PENDING.value
    )
    threshold_type = models.SmallIntegerField(null=True)
    resolve_threshold = models.FloatField(null=True)
    # How many times an alert value must exceed the threshold to fire/resolve the alert
    threshold_period = models.IntegerField()
    # This represents a time delta, in seconds. If not null, this is used to determine which time
    # window to query to compare the result from the current time_window to.
    comparison_delta = models.IntegerField(choices=ComparisonDeltaChoices.choices, null=True)
    date_modified = models.DateTimeField(default=timezone.now)
    date_added = models.DateTimeField(default=timezone.now)
    monitor_type = models.IntegerField(
        default=AlertRuleMonitorTypeInt.CONTINUOUS, db_default=AlertRuleMonitorTypeInt.CONTINUOUS
    )
    description = models.CharField(max_length=1000, null=True)
    detection_type = models.CharField(
        max_length=32,
        default=AlertRuleDetectionType.STATIC,
        db_default=AlertRuleDetectionType.STATIC,
        choices=AlertRuleDetectionType.choices,
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


class AlertRuleThresholdType(Enum):
    ABOVE = 0
    BELOW = 1
    ABOVE_AND_BELOW = 2


@cell_silo_model
class AlertRuleTrigger(Model):
    """
    This model represents the *threshold* trigger for an AlertRule

    threshold_type is AlertRuleThresholdType (Above/Below)
    alert_threshold is the trigger value
    """

    # Retained only until state retirement; native rows are no longer backup inputs.
    __relocation_scope__ = RelocationScope.Excluded

    alert_rule = FlexibleForeignKey("sentry.AlertRule", db_constraint=False)
    label = models.TextField()
    threshold_type = models.SmallIntegerField(null=True)
    alert_threshold = models.FloatField()
    resolve_threshold = models.FloatField(null=True)
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_alertruletrigger"
        unique_together = (("alert_rule", "label"),)
