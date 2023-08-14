import sentry_sdk
from django.db import models

from sentry.db.models import BoundedPositiveIntegerField, control_silo_only_model, sane_repr
from sentry.notifications.types import NotificationSettingOptionValues
from sentry.types.integrations import ExternalProviders, get_provider_name

from .notificationsettingbase import NotificationSettingBase


@control_silo_only_model
class NotificationSettingProvider(NotificationSettingBase):
    __include_in_export__ = False

    @property
    def provider_str(self) -> str:
        return get_provider_name(self.provider)

    provider = BoundedPositiveIntegerField(
        choices=(
            (ExternalProviders.EMAIL, "email"),
            (ExternalProviders.SLACK, "slack"),
            (ExternalProviders.MSTEAMS, "msteams"),
        ),
        null=False,
    )
    value = BoundedPositiveIntegerField(
        choices=(
            (NotificationSettingOptionValues.NEVER, "off"),
            (NotificationSettingOptionValues.ALWAYS, "on"),
        ),
        null=False,
    )

    class Meta:
        app_label = "sentry"
        db_table = "sentry_notificationsettingprovider"
        unique_together = (
            (
                "scope_type",
                "scope_identifier",
                "user_id",
                "team_id",
                "provider",
                "type",
            ),
        )
        constraints = [
            models.CheckConstraint(
                check=models.Q(team_id__isnull=False, user_id__isnull=True)
                | models.Q(team_id__isnull=True, user_id__isnull=False),
                name="notification_setting_provider_team_or_user_check",
            )
        ]

    __repr__ = sane_repr(
        "scope_str",
        "scope_identifier",
        "user_id",
        "team_id",
        "provider_str",
        "type_str",
        "value_str",
    )

    def save(self, *args, **kwargs):
        try:
            assert not (
                self.user_id is None and self.team_id is None
            ), "Notification setting missing user & team"
        except AssertionError as err:
            sentry_sdk.capture_exception(err)
        super().save(*args, **kwargs)


# REQUIRED for migrations to run
from sentry.trash import *  # NOQA
