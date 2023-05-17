import sentry_sdk
from django.conf import settings
from django.db import models

from sentry.db.models import (
    BoundedBigIntegerField,
    BoundedPositiveIntegerField,
    FlexibleForeignKey,
    Model,
    control_silo_only_model,
    sane_repr,
)
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey
from sentry.notifications.manager import NotificationsManager
from sentry.notifications.types import (
    NotificationScopeType,
    NotificationSettingOptionValues,
    NotificationSettingTypes,
    get_notification_scope_name,
    get_notification_setting_type_name,
    get_notification_setting_value_name,
)
from sentry.types.integrations import ExternalProviders, get_provider_name


@control_silo_only_model
class NotificationSetting(Model):
    """
    A setting of when to notify a user or team about activity within the app.
    Each row is a notification setting where a key is:
    ("scope_type", "scope_identifier", "target", "provider", "type"),
    and the value is ("value").
    """

    __include_in_export__ = False

    @property
    def scope_str(self) -> str:
        return get_notification_scope_name(self.scope_type)

    @property
    def type_str(self) -> str:
        return get_notification_setting_type_name(self.type)

    @property
    def value_str(self) -> str:
        return get_notification_setting_value_name(self.value)

    @property
    def provider_str(self) -> str:
        return get_provider_name(self.provider)

    scope_type = BoundedPositiveIntegerField(
        choices=(
            (NotificationScopeType.USER, "user"),
            (NotificationScopeType.ORGANIZATION, "organization"),
            (NotificationScopeType.PROJECT, "project"),
            (NotificationScopeType.TEAM, "team"),
        ),
        null=False,
    )
    scope_identifier = BoundedBigIntegerField(null=False)
    target_id = HybridCloudForeignKey(
        "sentry.Actor", db_index=True, unique=False, null=False, on_delete="CASCADE"
    )
    team_id = HybridCloudForeignKey("sentry.Team", null=True, db_index=True, on_delete="CASCADE")
    user = FlexibleForeignKey(
        settings.AUTH_USER_MODEL, null=True, db_index=True, on_delete=models.CASCADE
    )
    provider = BoundedPositiveIntegerField(
        choices=(
            (ExternalProviders.EMAIL, "email"),
            (ExternalProviders.SLACK, "slack"),
            (ExternalProviders.MSTEAMS, "msteams"),
        ),
        null=False,
    )
    type = BoundedPositiveIntegerField(
        choices=(
            (NotificationSettingTypes.DEFAULT, "default"),
            (NotificationSettingTypes.DEPLOY, "deploy"),
            (NotificationSettingTypes.ISSUE_ALERTS, "issue"),
            (NotificationSettingTypes.WORKFLOW, "workflow"),
            (NotificationSettingTypes.APPROVAL, "approval"),
            (NotificationSettingTypes.QUOTA, "quota"),
            (NotificationSettingTypes.QUOTA_ERRORS, "quotaErrors"),
            (NotificationSettingTypes.QUOTA_TRANSACTIONS, "quotaTransactions"),
            (NotificationSettingTypes.QUOTA_ATTACHMENTS, "quotaAttacments"),
            (NotificationSettingTypes.QUOTA_REPLAYS, "quotaReplays"),
            (NotificationSettingTypes.QUOTA_WARNINGS, "quotaWarnings"),
            (NotificationSettingTypes.QUOTA_SPEND_ALLOCATIONS, "quotaSpendAllocations"),
            (NotificationSettingTypes.SPIKE_PROTECTION, "spikeProtection"),
        ),
        null=False,
    )
    value = BoundedPositiveIntegerField(
        choices=(
            (NotificationSettingOptionValues.DEFAULT, "default"),
            (NotificationSettingOptionValues.NEVER, "off"),
            (NotificationSettingOptionValues.ALWAYS, "on"),
            (NotificationSettingOptionValues.SUBSCRIBE_ONLY, "subscribe_only"),
            (NotificationSettingOptionValues.COMMITTED_ONLY, "committed_only"),
        ),
        null=False,
    )

    objects = NotificationsManager()

    class Meta:
        app_label = "sentry"
        db_table = "sentry_notificationsetting"
        unique_together = (
            (
                "scope_type",
                "scope_identifier",
                "target_id",
                "provider",
                "type",
            ),
        )
        constraints = [
            models.CheckConstraint(
                check=models.Q(team_id__isnull=False, user_id__isnull=True)
                | models.Q(team_id__isnull=True, user_id__isnull=False),
                name="notification_team_or_user_check",
            )
        ]

    __repr__ = sane_repr(
        "scope_str",
        "scope_identifier",
        "target",
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
