from __future__ import annotations

import builtins
import logging
from dataclasses import asdict
from enum import StrEnum
from typing import TYPE_CHECKING

from django.db import models
from django.db.models.signals import pre_save
from django.dispatch import receiver
from jsonschema import ValidationError, validate

from sentry.backup.scopes import RelocationScope
from sentry.db.models import DefaultFieldsModel, region_silo_model, sane_repr
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey
from sentry.utils import metrics
from sentry.workflow_engine.models.json_config import JSONConfigBase
from sentry.workflow_engine.registry import action_handler_registry
from sentry.workflow_engine.types import ActionHandler, WorkflowEventData

if TYPE_CHECKING:
    from sentry.workflow_engine.models import Detector


logger = logging.getLogger(__name__)


@region_silo_model
class Action(DefaultFieldsModel, JSONConfigBase):
    """
    Actions are actions that can be taken if the conditions of a DataConditionGroup are satisfied.
    Examples include: detectors emitting events, sending notifications, creating an issue in the Issue Platform, etc.

    Any fields denoted with LEGACY are fields that will likely be migrated / removed in the future, and should likely
    live in a separate model related to the notifications.
    """

    __relocation_scope__ = RelocationScope.Excluded
    __repr__ = sane_repr("id", "type")

    class Type(StrEnum):
        SLACK = "slack"
        MSTEAMS = "msteams"
        DISCORD = "discord"

        PAGERDUTY = "pagerduty"
        OPSGENIE = "opsgenie"

        GITHUB = "github"
        GITHUB_ENTERPRISE = "github_enterprise"
        JIRA = "jira"
        JIRA_SERVER = "jira_server"
        AZURE_DEVOPS = "vsts"

        EMAIL = "email"
        SENTRY_APP = "sentry_app"

        PLUGIN = "plugin"
        WEBHOOK = "webhook"

        def is_integration(self) -> bool:
            """
            Returns True if the action is an integration action.
            For those, the value should correspond to the integration key.
            """
            return self not in [
                Action.Type.EMAIL,
                Action.Type.SENTRY_APP,
                Action.Type.PLUGIN,
                Action.Type.WEBHOOK,
            ]

    # The type field is used to denote the type of action we want to trigger
    type = models.TextField(choices=[(t.value, t.value) for t in Type])
    data = models.JSONField(default=dict)

    # LEGACY: The integration_id is used to map the integration_id found in the AlertRuleTriggerAction
    # This allows us to map the way we're saving the notification channels to the action.
    integration_id = HybridCloudForeignKey(
        "sentry.Integration", blank=True, null=True, on_delete="CASCADE"
    )

    def get_handler(self) -> builtins.type[ActionHandler]:
        action_type = Action.Type(self.type)
        return action_handler_registry.get(action_type)

    def trigger(self, event_data: WorkflowEventData, detector: Detector) -> None:
        handler = self.get_handler()
        handler.execute(event_data, self, detector)

        metrics.incr(
            "workflow_engine.action.trigger",
            tags={"action_type": self.type, "detector_type": detector.type},
        )

        logger.info(
            "workflow_engine.action.trigger",
            extra={
                "detector_id": detector.id,
                "action_id": self.id,
                "event_data": asdict(event_data),
            },
        )


@receiver(pre_save, sender=Action)
def enforce_config_schema(sender, instance: Action, **kwargs):
    handler = instance.get_handler()

    config_schema = handler.config_schema
    data_schema = handler.data_schema

    if config_schema is not None:
        instance.validate_config(config_schema)

    if data_schema is not None:
        try:
            validate(instance.data, data_schema)
        except ValidationError as e:
            raise ValidationError(f"Invalid config: {e.message}")
