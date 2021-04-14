from django.db import models

from sentry.db.models import (
    BoundedBigIntegerField,
    BoundedPositiveIntegerField,
    FlexibleForeignKey,
    Model,
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


class NotificationSetting(Model):
    """
    A setting of when to notify a user or team about activity within the app.
    Each row is a notification setting where a key is:
    ("scope_type", "scope_identifier", "target", "provider", "type"),
    and the value is ("value").
    """

    __core__ = False

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
        ),
        null=False,
    )
    # user_id, organization_id, project_id
    scope_identifier = BoundedBigIntegerField(null=False)
    target = FlexibleForeignKey(
        "sentry.Actor", db_index=True, unique=False, null=False, on_delete=models.CASCADE
    )
    provider = BoundedPositiveIntegerField(
        choices=(
            (ExternalProviders.EMAIL, "email"),
            (ExternalProviders.SLACK, "slack"),
        ),
        null=False,
    )
    type = BoundedPositiveIntegerField(
        choices=(
            (NotificationSettingTypes.DEFAULT, "default"),
            (NotificationSettingTypes.DEPLOY, "deploy"),
            (NotificationSettingTypes.ISSUE_ALERTS, "issue"),
            (NotificationSettingTypes.WORKFLOW, "workflow"),
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


# REQUIRED for migrations to run
from sentry.trash import *  # NOQA
