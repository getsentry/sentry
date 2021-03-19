from django.db import models

from sentry.db.models import (
    BoundedBigIntegerField,
    BoundedPositiveIntegerField,
    FlexibleForeignKey,
    Model,
    sane_repr,
)
from sentry.models.integration import ExternalProviders
from sentry.notifications.manager import NotificationsManager
from sentry.notifications.types import (
    NotificationScopeType,
    NotificationSettingOptionValues,
    NotificationSettingTypes,
)


class NotificationSetting(Model):
    """
    A setting of when to notify a user or team about activity within the app.
    Each row is a notification setting where a key is:
    ("scope_type", "scope_identifier", "target", "provider", "type"),
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
        "scope_type",
        "scope_identifier",
        "target",
        "provider",
        "type",
        "value",
    )


# REQUIRED for migrations to run
from sentry.trash import *  # NOQA
