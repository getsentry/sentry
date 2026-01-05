from __future__ import annotations

import builtins
import logging
from enum import StrEnum
from typing import ClassVar, TypedDict

from django.db import models
from django.db.models import Q
from django.db.models.signals import pre_save
from django.dispatch import receiver
from jsonschema import ValidationError, validate

from sentry.backup.scopes import RelocationScope
from sentry.constants import ObjectStatus
from sentry.db.models import DefaultFieldsModel, region_silo_model, sane_repr
from sentry.db.models.fields.bounded import BoundedPositiveIntegerField
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey
from sentry.db.models.manager.base import BaseManager
from sentry.db.models.manager.base_query_set import BaseQuerySet
from sentry.utils import metrics
from sentry.workflow_engine.models.json_config import JSONConfigBase
from sentry.workflow_engine.registry import action_handler_registry
from sentry.workflow_engine.types import ActionHandler, ActionInvocation, WorkflowEventData

logger = logging.getLogger(__name__)


class ActionSnapshot(TypedDict):
    id: int
    type: Action.Type


class ActionManager(BaseManager["Action"]):
    def get_queryset(self) -> BaseQuerySet[Action]:
        return (
            super()
            .get_queryset()
            .exclude(status__in=(ObjectStatus.PENDING_DELETION, ObjectStatus.DELETION_IN_PROGRESS))
        )


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

    objects: ClassVar[ActionManager] = ActionManager()
    objects_for_deletion: ClassVar[BaseManager] = BaseManager()

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

    status = BoundedPositiveIntegerField(
        db_default=ObjectStatus.ACTIVE, choices=ObjectStatus.as_choices()
    )

    class Meta:
        indexes = [
            models.Index(
                "type",
                models.expressions.RawSQL("config->>'sentry_app_identifier'", []),
                models.expressions.RawSQL("config->>'target_identifier'", []),
                condition=Q(type="sentry_app"),
                name="action_sentry_app_lookup",
            ),
        ]

    def get_snapshot(self) -> ActionSnapshot:
        return {
            "id": self.id,
            "type": Action.Type(self.type),
        }

    def get_handler(self) -> builtins.type[ActionHandler]:
        action_type = Action.Type(self.type)
        return action_handler_registry.get(action_type)

    def trigger(self, event_data: WorkflowEventData) -> None:
        from sentry.workflow_engine.processors.detector import get_detector_from_event_data

        detector = get_detector_from_event_data(event_data)

        with metrics.timer(
            "workflow_engine.action.trigger.execution_time",
            tags={"action_type": self.type, "detector_type": detector.type},
            sample_rate=1.0,
        ):
            handler = self.get_handler()
            invocation = ActionInvocation(
                event_data=event_data,
                action=self,
                detector=detector,
            )
            handler.execute(invocation)

        metrics.incr(
            "workflow_engine.action.trigger",
            tags={"action_type": self.type, "detector_type": detector.type},
            sample_rate=1.0,
        )

        logger.info(
            "workflow_engine.action.trigger",
            extra={
                "detector_id": detector.id,
                "action_id": self.id,
            },
        )

    def get_dedup_key(self, workflow_id: int | None) -> str:
        key_parts = [self.type]
        if workflow_id is not None:
            key_parts.append(str(workflow_id))

        if self.integration_id:
            key_parts.append(str(self.integration_id))

        if self.config:
            config = self.config.copy()
            config.pop("target_display", None)
            key_parts.append(str(config))

        if self.data:
            data = self.data.copy()
            if "dynamic_form_fields" in data:
                data = data["dynamic_form_fields"]

            key_parts.append(str(data))

        return ":".join(key_parts)


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
