from enum import Enum

from django.conf import settings

from sentry.db.models import (
    BoundedPositiveIntegerField,
    FlexibleForeignKey,
    Model,
    sane_repr,
)


class NotificationSettingTypes(Enum):
    DEFAULT = 0
    DEPLOY = 10
    ISSUE_ALERTS = 20
    WORKFLOW = 30


NOTIFICATION_SETTING_TYPES = {
    NotificationSettingTypes.DEFAULT: "default",
    NotificationSettingTypes.DEPLOY: "deploy",
    NotificationSettingTypes.ISSUE_ALERTS: "issue",
    NotificationSettingTypes.WORKFLOW: "workflow",
}


class NotificationSettingOptionValues(Enum):
    DEFAULT = 0  # Defer to a setting one level up.
    NEVER = 10
    ALWAYS = 20
    SUBSCRIBE_ONLY = 30  # workflow
    COMMITTED_ONLY = 40  # deploy


NOTIFICATION_SETTING_OPTION_VALUES = {
    NotificationSettingOptionValues.DEFAULT: "default",
    NotificationSettingOptionValues.NEVER: "off",
    NotificationSettingOptionValues.ALWAYS: "on",
    NotificationSettingOptionValues.SUBSCRIBE_ONLY: "subscribe_only",
    NotificationSettingOptionValues.COMMITTED_ONLY: "committed_only",
}


class NotificationSettingProvider(Enum):
    EMAIL = 0
    SLACK = 1


NOTIFICATION_SETTING_PROVIDER = {
    NotificationSettingProvider.EMAIL: "email",
    NotificationSettingProvider.SLACK: "slack",
}


class NotificationSetting(Model):
    """A setting of when to notify a user or team about activity within the app"""

    __core__ = False

    organization = FlexibleForeignKey("sentry.Organization", null=True)
    project = FlexibleForeignKey("sentry.Project", null=True)
    team = FlexibleForeignKey("sentry.Team", null=True)
    user = FlexibleForeignKey(settings.AUTH_USER_MODEL, null=True)
    provider = BoundedPositiveIntegerField(
        choices=(
            (NotificationSettingProvider.EMAIL, "email"),
            (NotificationSettingProvider.SLACK, "slack"),
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

    class Meta:
        app_label = "sentry"
        db_table = "sentry_notificationsetting"
        unique_together = (
            ("organization", "project", "team", "type", "provider"),
            ("organization", "project", "user", "type", "provider"),
        )

    __repr__ = sane_repr(
        "organization_id", "project_id", "team_id", "user_id", "provider", "type", "value"
    )
