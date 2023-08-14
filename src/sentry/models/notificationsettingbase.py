import sentry_sdk
from django.conf import settings
from django.db import models

from sentry.db.models import (
    BoundedBigIntegerField,
    BoundedPositiveIntegerField,
    FlexibleForeignKey,
    Model,
)
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey
from sentry.notifications.types import (
    NotificationScopeType,
    NotificationSettingOptionValues,
    NotificationSettingTypes,
    get_notification_scope_name,
    get_notification_setting_type_name,
    get_notification_setting_value_name,
)


class NotificationSettingBase(Model):
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
    team_id = HybridCloudForeignKey("sentry.Team", null=True, db_index=True, on_delete="CASCADE")
    user = FlexibleForeignKey(
        settings.AUTH_USER_MODEL, null=True, db_index=True, on_delete=models.CASCADE
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
            (NotificationSettingTypes.QUOTA_ATTACHMENTS, "quotaAttachments"),
            (NotificationSettingTypes.QUOTA_REPLAYS, "quotaReplays"),
            (NotificationSettingTypes.QUOTA_WARNINGS, "quotaWarnings"),
            (NotificationSettingTypes.QUOTA_SPEND_ALLOCATIONS, "quotaSpendAllocations"),
            (NotificationSettingTypes.SPIKE_PROTECTION, "spikeProtection"),
        ),
        null=False,
    )
    value = BoundedPositiveIntegerField(
        choices=(
            (NotificationSettingOptionValues.NEVER, "never"),
            (NotificationSettingOptionValues.ALWAYS, "always"),
        ),
        null=False,
    )

    class Meta:
        abstract = True

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
