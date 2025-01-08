from __future__ import annotations

from typing import TYPE_CHECKING

from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models import DefaultFieldsModel, region_silo_model, sane_repr
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey
from sentry.notifications.models.notificationaction import ActionTarget
from sentry.workflow_engine.registry import action_handler_registry
from sentry.workflow_engine.types import ActionHandler, WorkflowJob

if TYPE_CHECKING:
    from sentry.workflow_engine.models import Detector


@region_silo_model
class Action(DefaultFieldsModel):
    """
    Actions are actions that can be taken if the conditions of a DataConditionGroup are satisfied.
    Examples include: detectors emitting events, sending notifications, creating an issue in the Issue Platform, etc.

    Any fields denoted with LEGACY are fields that will likely be migrated / removed in the future, and should likely
    live in a separate model related to the notifications.
    """

    __relocation_scope__ = RelocationScope.Excluded
    __repr__ = sane_repr("id", "type")

    class Type(models.TextChoices):
        EMAIL = "email"
        SLACK = "slack"
        DISCORD = "discord"
        MSTEAMS = "msteams"
        PAGERDUTY = "pagerduty"
        OPSGENIE = "opsgenie"
        GITHUB = "github"
        GITHUB_ENTERPRISE = "github_enterprise"
        JIRA = "jira"
        JIRA_SERVER = "jira_server"
        AZURE_DEVOPS = "azure_devops"
        WEBHOOK = "webhook"
        PLUGIN = "plugin"
        SENTRY_APP = "sentry_app"

    class LegacyNotificationType(models.TextChoices):
        ISSUE_ALERT = "issue"
        METRIC_ALERT = "metric"

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

    def get_handler(self) -> ActionHandler:
        action_type = Action.Type(self.type)
        return action_handler_registry.get(action_type)

    def trigger(self, job: WorkflowJob, detector: Detector) -> None:
        # get the handler for the action type
        handler = self.get_handler()
        handler.execute(job, self, detector)
