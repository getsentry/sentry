from django.conf import settings
from django.db import models

from sentry.db.models import (
    BoundedBigIntegerField,
    BoundedPositiveIntegerField,
    FlexibleForeignKey,
    Model,
    control_silo_only_model,
    region_silo_only_model,
    sane_repr,
)
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

PROVIDER_CHOICES = (
    (ExternalProviders.EMAIL, "email"),
    (ExternalProviders.SLACK, "slack"),
    (ExternalProviders.MSTEAMS, "msteams"),
)

TYPE_CHOICES = (
    (NotificationSettingTypes.DEFAULT, "default"),
    (NotificationSettingTypes.DEPLOY, "deploy"),
    (NotificationSettingTypes.ISSUE_ALERTS, "issue"),
    (NotificationSettingTypes.WORKFLOW, "workflow"),
    (NotificationSettingTypes.APPROVAL, "approval"),
    (NotificationSettingTypes.QUOTA, "quota"),
    (NotificationSettingTypes.QUOTA_ERRORS, "quotaErrors"),
    (NotificationSettingTypes.QUOTA_TRANSACTIONS, "quotaTransactions"),
    (NotificationSettingTypes.QUOTA_ATTACHMENTS, "quotaAttacments"),
    (NotificationSettingTypes.QUOTA_WARNINGS, "quotaWarnings"),
    (NotificationSettingTypes.QUOTA_SPEND_ALLOCATIONS, "quotaSpendAllocations"),
    (NotificationSettingTypes.SPIKE_PROTECTION, "spikeProtection"),
)

VALUE_CHOICES = (
    (NotificationSettingOptionValues.DEFAULT, "default"),
    (NotificationSettingOptionValues.NEVER, "off"),
    (NotificationSettingOptionValues.ALWAYS, "on"),
    (NotificationSettingOptionValues.SUBSCRIBE_ONLY, "subscribe_only"),
    (NotificationSettingOptionValues.COMMITTED_ONLY, "committed_only"),
)


class NotificationSettingBase:

    provider = None
    scope_type = None
    type = None
    value = None

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


@region_silo_only_model
class NotificationSetting(Model, NotificationSettingBase):
    """
    A setting of when to notify a user or team about activity within the app.
    Each row is a notification setting where a key is:
    ("scope_type", "scope_identifier", "target", "provider", "type"),
    and the value is ("value").
    """

    __include_in_export__ = False

    scope_type = BoundedPositiveIntegerField(
        choices=(
            # TODO:actor remove user scope type from region model
            (NotificationScopeType.USER, "user"),
            (NotificationScopeType.ORGANIZATION, "organization"),
            (NotificationScopeType.PROJECT, "project"),
            (NotificationScopeType.TEAM, "team"),
        ),
        null=False,
    )
    # user_id, organization_id, project_id
    scope_identifier = BoundedBigIntegerField(null=False)
    target = FlexibleForeignKey(
        "sentry.Actor", db_index=True, unique=False, null=False, on_delete=models.CASCADE
    )
    user = FlexibleForeignKey(settings.AUTH_USER_MODEL, null=True, db_index=True)
    team = FlexibleForeignKey("sentry.Team", null=True, db_index=True)
    provider = BoundedPositiveIntegerField(choices=PROVIDER_CHOICES, null=False)
    type = BoundedPositiveIntegerField(choices=TYPE_CHOICES, null=False)
    value = BoundedPositiveIntegerField(choices=VALUE_CHOICES, null=False)

    objects = NotificationsManager()

    class Meta:
        app_label = "sentry"
        db_table = "sentry_notificationsetting"
        unique_together = (
            (
                "scope_type",
                "scope_identifier",
                "target",
                "provider",
                "type",
            ),
        )

    __repr__ = sane_repr(
        "scope_str",
        "scope_identifier",
        "target",
        "provider_str",
        "type_str",
        "value_str",
    )


@control_silo_only_model
class UserNotificationSetting(Model, NotificationSettingBase):
    """
    A setting of when to notify a user about activity within the app.
    Each row is a notification setting where a key is:
    ("scope_type", "scope_identifier", "target", "provider", "type"),
    and the value is ("value").
    """

    __include_in_export__ = False

    scope_type = BoundedPositiveIntegerField(
        choices=((NotificationScopeType.USER, "user"),),
        null=False,
    )
    scope_identifier = BoundedBigIntegerField(null=False)
    user = FlexibleForeignKey(settings.AUTH_USER_MODEL, null=True, db_index=True)
    provider = BoundedPositiveIntegerField(choices=PROVIDER_CHOICES, null=False)
    type = BoundedPositiveIntegerField(choices=TYPE_CHOICES, null=False)
    value = BoundedPositiveIntegerField(choices=VALUE_CHOICES, null=False)

    objects = NotificationsManager()

    class Meta:
        app_label = "sentry"
        db_table = "sentry_usernotificationsetting"
        unique_together = (
            (
                "scope_type",
                "scope_identifier",
                "user",
                "provider",
                "type",
            ),
        )

    __repr__ = sane_repr(
        "scope_str",
        "scope_identifier",
        "user",
        "provider_str",
        "type_str",
        "value_str",
    )


# REQUIRED for migrations to run
from sentry.trash import *  # NOQA
