from __future__ import annotations

from collections.abc import Sequence
from enum import Enum, IntEnum
from typing import Any, ClassVar, Self

from django.conf import settings
from django.db import models
from django.utils import timezone

from sentry.backup.scopes import RelocationScope
from sentry.constants import ObjectStatus
from sentry.db.models import (
    BoundedPositiveIntegerField,
    FlexibleForeignKey,
    GzippedDictField,
    Model,
    region_silo_model,
    sane_repr,
)
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey
from sentry.db.models.manager.base import BaseManager
from sentry.types.actor import Actor
from sentry.utils.cache import cache


class RuleSource(IntEnum):
    ISSUE = 0
    CRON_MONITOR = 1
    UPTIME = 2

    @classmethod
    def as_choices(cls) -> Sequence[tuple[int, str]]:
        return (
            (cls.ISSUE, "issue"),
            (cls.CRON_MONITOR, "cron_monitor"),
            (cls.UPTIME, "uptime"),
        )


@region_silo_model
class Rule(Model):
    __relocation_scope__ = RelocationScope.Organization

    DEFAULT_CONDITION_MATCH = "all"  # any, all
    DEFAULT_FILTER_MATCH = "all"  # match to apply on filters
    DEFAULT_FREQUENCY = 30  # minutes

    project = FlexibleForeignKey("sentry.Project")
    environment_id = BoundedPositiveIntegerField(null=True)
    label = models.CharField(max_length=256)
    # `data` contain all the specifics of the rule - conditions, actions, frequency, etc.
    data: models.Field[dict[str, Any], dict[str, Any]] = GzippedDictField()
    status = BoundedPositiveIntegerField(
        default=ObjectStatus.ACTIVE,
        choices=((ObjectStatus.ACTIVE, "Active"), (ObjectStatus.DISABLED, "Disabled")),
        db_index=True,
    )
    # source is currently used as a way to distinguish rules created specifically
    # for use in other parts of the product (e.g. cron monitor alerting rules)
    source = BoundedPositiveIntegerField(
        default=RuleSource.ISSUE,
        choices=RuleSource.as_choices(),
    )
    owner_user_id = HybridCloudForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete="SET_NULL")
    owner_team = FlexibleForeignKey("sentry.Team", null=True, on_delete=models.SET_NULL)

    date_added = models.DateTimeField(default=timezone.now)

    objects: ClassVar[BaseManager[Self]] = BaseManager(cache_fields=("pk",))

    class Meta:
        db_table = "sentry_rule"
        app_label = "sentry"
        indexes = (
            models.Index(fields=("project", "status", "owner_team")),
            models.Index(fields=("project", "status", "owner_user_id")),
        )
        constraints = (
            models.CheckConstraint(
                condition=(
                    models.Q(owner_user_id__isnull=True, owner_team__isnull=False)
                    | models.Q(owner_user_id__isnull=False, owner_team__isnull=True)
                    | models.Q(owner_user_id__isnull=True, owner_team__isnull=True)
                ),
                name="rule_owner_user_or_team_check",
            ),
        )

    __repr__ = sane_repr("project_id", "label")

    @classmethod
    def get_for_project(cls, project_id):
        cache_key = f"project:{project_id}:rules"
        rules_list = cache.get(cache_key)
        if rules_list is None:
            rules_list = list(cls.objects.filter(project=project_id, status=ObjectStatus.ACTIVE))
            cache.set(cache_key, rules_list, 60)
        return rules_list

    @property
    def created_by_id(self):
        try:
            created_activity = RuleActivity.objects.get(
                rule=self, type=RuleActivityType.CREATED.value
            )
            return created_activity.user_id
        except RuleActivity.DoesNotExist:
            pass

        return None

    @property
    def owner(self) -> Actor | None:
        """Part of ActorOwned Protocol"""
        return Actor.from_id(user_id=self.owner_user_id, team_id=self.owner_team_id)

    @owner.setter
    def owner(self, actor: Actor | None) -> None:
        """Part of ActorOwned Protocol"""
        self.owner_team_id = None
        self.owner_user_id = None
        if actor and actor.is_user:
            self.owner_user_id = actor.id
        if actor and actor.is_team:
            self.owner_team_id = actor.id

    def delete(self, *args, **kwargs):
        rv = super().delete(*args, **kwargs)
        self._clear_project_rule_cache()
        return rv

    def save(self, *args, **kwargs):
        rv = super().save(*args, **kwargs)
        self._clear_project_rule_cache()
        return rv

    def _clear_project_rule_cache(self) -> None:
        cache_key = f"project:{self.project_id}:rules"
        cache.delete(cache_key)

    def get_audit_log_data(self):
        return {
            "label": self.label,
            "data": self.data,
            "status": self.status,
            "environment": self.environment_id,
        }

    def get_rule_action_details_by_uuid(self, rule_action_uuid: str) -> dict[str, Any] | None:
        actions = self.data.get("actions", None)
        if not actions:
            return None

        for action in actions:
            action_uuid = action.get("uuid", None)
            if action_uuid is None:
                # This should not happen, but because the data object is a dictionary, it's better to be safe
                continue

            if action_uuid == rule_action_uuid:
                return action

        return None


class RuleActivityType(Enum):
    CREATED = 1
    DELETED = 2
    UPDATED = 3
    ENABLED = 4
    DISABLED = 5


@region_silo_model
class RuleActivity(Model):
    __relocation_scope__ = RelocationScope.Organization

    rule = FlexibleForeignKey("sentry.Rule")
    user_id = HybridCloudForeignKey("sentry.User", on_delete="SET_NULL", null=True)
    type = models.IntegerField()
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_ruleactivity"


@region_silo_model
class NeglectedRule(Model):
    __relocation_scope__ = RelocationScope.Organization

    rule = FlexibleForeignKey("sentry.Rule")
    organization = FlexibleForeignKey("sentry.Organization")
    disable_date = models.DateTimeField()
    opted_out = models.BooleanField(default=False)
    sent_initial_email_date = models.DateTimeField(null=True)
    sent_final_email_date = models.DateTimeField(null=True)
