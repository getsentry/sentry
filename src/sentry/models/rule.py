from collections.abc import Sequence
from enum import Enum, IntEnum
from typing import Any, ClassVar, Self

from django.conf import settings
from django.db import models
from django.utils import timezone

from sentry.backup.dependencies import PrimaryKeyMap
from sentry.backup.helpers import ImportFlags
from sentry.backup.scopes import ImportScope, RelocationScope
from sentry.constants import ObjectStatus
from sentry.db.models import (
    BoundedPositiveIntegerField,
    FlexibleForeignKey,
    GzippedDictField,
    Model,
    region_silo_only_model,
    sane_repr,
)
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey
from sentry.db.models.manager import BaseManager
from sentry.models.actor import Actor
from sentry.utils.cache import cache


class RuleSource(IntEnum):
    ISSUE = 0
    CRON_MONITOR = 1

    @classmethod
    def as_choices(cls) -> Sequence[tuple[int, str]]:
        return (
            (cls.ISSUE, "issue"),
            (cls.CRON_MONITOR, "cron_monitor"),
        )


@region_silo_only_model
class Rule(Model):
    __relocation_scope__ = RelocationScope.Organization

    DEFAULT_CONDITION_MATCH = "all"  # any, all
    DEFAULT_FILTER_MATCH = "all"  # match to apply on filters
    DEFAULT_FREQUENCY = 30  # minutes

    project = FlexibleForeignKey("sentry.Project")
    environment_id = BoundedPositiveIntegerField(null=True)
    label = models.CharField(max_length=256)
    # `data` contain all the specifics of the rule - conditions, actions, frequency, etc.
    data = GzippedDictField()
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
    # Deprecated. Use owner_user_id or owner_team instead.
    owner = FlexibleForeignKey("sentry.Actor", null=True, on_delete=models.SET_NULL)

    owner_user_id = HybridCloudForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete="SET_NULL")
    owner_team = FlexibleForeignKey("sentry.Team", null=True, on_delete=models.SET_NULL)

    date_added = models.DateTimeField(default=timezone.now)

    objects: ClassVar[BaseManager[Self]] = BaseManager(cache_fields=("pk",))

    class Meta:
        db_table = "sentry_rule"
        app_label = "sentry"
        indexes = (models.Index(fields=("project", "status", "owner")),)
        constraints = (
            models.CheckConstraint(
                check=(
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

    def delete(self, *args, **kwargs):
        rv = super().delete(*args, **kwargs)
        cache_key = f"project:{self.project_id}:rules"
        cache.delete(cache_key)
        return rv

    def save(self, *args, **kwargs):
        self._validate_owner()
        rv = super().save(*args, **kwargs)
        cache_key = f"project:{self.project_id}:rules"
        cache.delete(cache_key)
        return rv

    def _validate_owner(self):
        if self.owner_id is not None and self.owner_team_id is None and self.owner_user_id is None:
            raise ValueError("Rule with owner requires either owner_team or owner_user_id")

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

    def normalize_before_relocation_import(
        self, pk_map: PrimaryKeyMap, scope: ImportScope, flags: ImportFlags
    ) -> int | None:
        old_pk = super().normalize_before_relocation_import(pk_map, scope, flags)
        if old_pk is None:
            return None

        # TODO(hybrid-cloud): actor refactor. Remove this check once we're sure we've migrated all
        # remaining `owner_id`'s to also have `team_id` or `user_id`, which seems to not be the case
        # today.
        if self.owner_id is not None and self.owner_team_id is None and self.owner_user_id is None:
            actor = Actor.objects.filter(id=self.owner_id).first()
            if actor is None or (actor.team_id is None and actor.user_id is None):
                # The `owner_id` references a non-existent `Actor`, or else one that has no
                # `owner_team_id` or `owner_user_id` of its own, making it functionally a null
                # `Actor`. This means the `owner_id` is invalid, so we simply delete it.
                self.owner_id = None
            else:
                # Looks like an existing `Actor` points to a valid team or user - make sure that
                # information is duplicated into this `Rule` model as well.
                self.owner_team_id = actor.team_id
                self.owner_user_id = actor.user_id

        return old_pk


class RuleActivityType(Enum):
    CREATED = 1
    DELETED = 2
    UPDATED = 3
    ENABLED = 4
    DISABLED = 5


@region_silo_only_model
class RuleActivity(Model):
    __relocation_scope__ = RelocationScope.Organization

    rule = FlexibleForeignKey("sentry.Rule")
    user_id = HybridCloudForeignKey("sentry.User", on_delete="SET_NULL", null=True)
    type = models.IntegerField()
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_ruleactivity"


@region_silo_only_model
class NeglectedRule(Model):
    __relocation_scope__ = RelocationScope.Organization

    rule = FlexibleForeignKey("sentry.Rule")
    organization = FlexibleForeignKey("sentry.Organization")
    disable_date = models.DateTimeField()
    opted_out = models.BooleanField(default=False)
    sent_initial_email_date = models.DateTimeField(null=True)
    sent_final_email_date = models.DateTimeField(null=True)
