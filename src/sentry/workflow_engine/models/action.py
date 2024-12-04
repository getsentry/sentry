from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models import DefaultFieldsModel, region_silo_model, sane_repr
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey
from sentry.notifications.models.notificationaction import ActionTarget
from sentry.workflow_engine.actions.notification_action.types import NotificationType


@region_silo_model
class Action(DefaultFieldsModel):
    """
    Actions are actions that can be taken if the conditions of a DataConditionGroup are satisfied.
    Examples include: detectors emitting events, sending notifications, creating an issue in the Issue Platform, etc.

    Any fields denoted with LEGACY are fields that will likely be migrated / removed in the future, and should likely
    live in a separate model related to the notifications.
    """

    __relocation_scope__ = RelocationScope.Excluded
    __repr__ = sane_repr("workflow_id", "type")

    # TODO (@saponifi3d): Don't hardcode these values, and these are incomplete values
    class Type(models.TextChoices):
        NOTIFICATION_SLACK = f"notification.{NotificationType.Slack}", "Slack Notification"
        NOTIFICATION_DISCORD = f"notification.{NotificationType.Discord}", "Discord Notification"
        NOTIFICATION_MSTEAMS = f"notification.{NotificationType.MSTeams}", "MS Teams Notification"
        NOTIFICATION_PAGERDUTY = (
            f"notification.{NotificationType.PagerDuty}",
            "PagerDuty Notification",
        )
        NOTIFICATION_OPSGENIE = f"notification.{NotificationType.Opsgenie}", "Opsgenie Notification"
        NOTIFICATION_GITHUB = f"notification.{NotificationType.GitHub}", "GitHub Notification"
        NOTIFICATION_GITHUB_ENTERPRISE = (
            f"notification.{NotificationType.GithubEnterprise}",
            "GitHub Enterprise Notification",
        )
        NOTIFICATION_GITLAB = f"notification.{NotificationType.Gitlab}", "GitLab Notification"
        NOTIFICATION_JIRA = f"notification.{NotificationType.Jira}", "Jira Notification"
        NOTIFICATION_JIRA_SERVER = (
            f"notification.{NotificationType.JiraServer}",
            "Jira Server Notification",
        )
        NOTIFICATION_AZURE_DEVOPS = (
            f"notification.{NotificationType.AzureDevOps}",
            "Azure DevOps Notification",
        )
        NOTIFICATION_SENTRY_APP = (
            f"notification.{NotificationType.SentryApp}",
            "Sentry App Notification",
        )
        NOTIFICATION_EMAIL = f"notification.{NotificationType.Email}", "Email Notification"

        TRIGGER_WORKFLOW = "trigger_workflow", "Trigger Workflow"

    # The type field is used to denote the type of action we want to trigger
    type = models.TextField(choices=Type.choices)
    data = models.JSONField(default=dict)

    # TODO - finish removing this field
    required = models.BooleanField(default=False, null=True)

    # LEGACY: The integration_id is used to map the integration_id found in the AlertRuleTriggerAction
    # This allows us to map the way we're saving the notification channels to the action.
    integration_id = HybridCloudForeignKey(
        "sentry.Integration", blank=True, null=True, on_delete="CASCADE"
    )

    # LEGACY: The target_display is used to display the target's name in notifications
    target_display = models.TextField(null=True)

    # LEGACY: The target_identifier is used to target the user / team / org that notifications are being sent to
    target_identifier = models.TextField(null=True)

    # LEGACY: This is used to denote if the Notification is going to a user, team, sentry app, etc
    target_type = models.SmallIntegerField(choices=ActionTarget.as_choices(), null=True)
