from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models import control_silo_only_model, sane_repr

from .notificationsettingbase import NotificationSettingBase


@control_silo_only_model
class NotificationSettingOption(NotificationSettingBase):
    __relocation_scope__ = RelocationScope.Excluded

    class Meta:
        app_label = "sentry"
        db_table = "sentry_notificationsettingoption"
        unique_together = (
            (
                "scope_type",
                "scope_identifier",
                "user_id",
                "team_id",
                "type",
            ),
        )
        constraints = [
            models.CheckConstraint(
                check=models.Q(team_id__isnull=False, user_id__isnull=True)
                | models.Q(team_id__isnull=True, user_id__isnull=False),
                name="notification_setting_option_team_or_user_check",
            )
        ]

    __repr__ = sane_repr(
        "scope_type",
        "scope_identifier",
        "type",
        "user_id",
        "team_id",
        "value",
    )
