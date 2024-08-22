from __future__ import annotations

from enum import Enum
from typing import Any

from django.db import models
from django.db.models import Field, Q
from django.db.models.constraints import CheckConstraint

from sentry.backup.scopes import RelocationScope
from sentry.db.models import FlexibleForeignKey, JSONField, region_silo_model, sane_repr
from sentry.db.models.base import DefaultFieldsModel
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey
from sentry.notifications.types import NotificationSettingEnum


class NotificationHistoryStatus(Enum):
    UNREAD = "unread"
    READ = "read"
    ARCHIVED = "archived"

    @classmethod
    def as_choices(cls) -> list[tuple[str, str]]:
        return [(key.value, key.name) for key in cls]

    @classmethod
    def get_name(cls, value: str) -> str | None:
        return dict(cls.as_choices()).get(value)


def get_source_choices() -> list[tuple[int, str]]:
    return [(key.value, key.name) for key in NotificationSettingEnum]


@region_silo_model
class NotificationHistory(DefaultFieldsModel):
    __relocation_scope__ = RelocationScope.Excluded
    user_id = HybridCloudForeignKey("sentry.User", on_delete="CASCADE", null=True)
    team = FlexibleForeignKey("sentry.Team", null=True)

    title = models.CharField()
    description = models.CharField()
    status = models.CharField(choices=NotificationHistoryStatus.as_choices())
    source = models.CharField(choices=get_source_choices())
    content: Field[dict[str, Any] | None, dict[str, Any] | None] = JSONField(default={})

    class Meta:
        app_label = "sentry"
        db_table = "sentry_notificationhistory"
        # A notification history record should be attached to a team or user but never both
        constraints = [
            CheckConstraint(
                check=(
                    (Q(user_id__isnull=True) & Q(team__isnull=False))
                    | (Q(user_id__isnull=False) & Q(team__isnull=True))
                ),
                name="user_xor_team_required",
            )
        ]

    __repr__ = sane_repr("user_id", "team_id", "status", "title")


# from sentry.incidents.models.alert_rule import (
#     AlertRuleTriggerAction,
#     Incident,
#     IncidentStatus,
# )
# from sentry.models import Organization, Project


# """
# from sentry.notifications.centre import fire_alert
# """


# def fire_alert(rule_trigger_action_id=1):
#     trigger = AlertRuleTriggerAction.objects.get(id=rule_trigger_action_id)
#     alert_rule = trigger.alert_rule_trigger.alert_rule
#     org = Organization.objects.get(id=4506694771408912)
#     project = Project.objects.get(id=2)
#     incident = Incident.objects.create(
#         organization=org,
#         title="It's Lit",
#         alert_rule=alert_rule,
#         type=2,
#         status=20,
#     )
#     trigger.fire(trigger, incident, project, 3, IncidentStatus.OPEN)
