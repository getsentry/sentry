from enum import Enum

from sentry.db.models import (
    BoundedBigIntegerField,
    BoundedPositiveIntegerField,
    Model,
    sane_repr,
)
from sentry.models.integration import ExternalProviders


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


class NotificationScopeType(Enum):
    USER = 0
    ORGANIZATION = 10
    PROJECT = 20


NOTIFICATION_SCOPE_TYPE = {
    NotificationScopeType.USER: "user",
    NotificationScopeType.ORGANIZATION: "organization",
    NotificationScopeType.PROJECT: "project",
}


class NotificationTargetType(Enum):
    USER = 0
    TEAM = 10


NOTIFICATION_TARGET_TYPE = {
    NotificationTargetType.USER: "user",
    NotificationTargetType.TEAM: "team",
}


class NotificationSetting(Model):
    """
    A setting of when to notify a user or team about activity within the app.
    Each row is a notification setting where a key is:
    ("scope_type", "scope_identifier", "target_type", "target_identifier", "provider", "type"),
    and the value is ("value").
    """

    __core__ = False

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

    target_type = BoundedPositiveIntegerField(
        choices=(
            (NotificationTargetType.USER, "user"),
            (NotificationTargetType.TEAM, "team"),
        ),
        null=False,
    )
    # user_id, team_id
    target_identifier = BoundedBigIntegerField(null=False)

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

    class Meta:
        app_label = "sentry"
        db_table = "sentry_notificationsetting"
        unique_together = (
            (
                "scope_type",
                "scope_identifier",
                "target_type",
                "target_identifier",
                "provider",
                "type",
            ),
        )
        index_together = (("target_type", "target_identifier"),)

    __repr__ = sane_repr(
        "scope_type",
        "scope_identifier",
        "target_type",
        "target_identifier",
        "provider",
        "type",
        "value",
    )
