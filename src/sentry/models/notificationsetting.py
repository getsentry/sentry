from sentry.db.models import (
    BoundedBigIntegerField,
    BoundedPositiveIntegerField,
    Model,
    sane_repr,
)
from sentry.models.integration import ExternalProviders
from sentry.notifications.manager import NotificationsManager
from sentry.notifications.types import (
    NotificationScopeType,
    NotificationSettingOptionValues,
    NotificationSettingTypes,
    NotificationTargetType,
)


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

    objects = NotificationsManager()

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
