from sentry.notifications.notification_action.utils import execute_via_group_type_registry
from sentry.workflow_engine.handlers.action.notification.base import IntegrationActionHandler
from sentry.workflow_engine.handlers.action.notification.common import (
    MESSAGING_ACTION_CONFIG_SCHEMA,
)
from sentry.workflow_engine.models import Action, Detector
from sentry.workflow_engine.registry import action_handler_registry
from sentry.workflow_engine.types import ActionHandler, WorkflowEventData


@action_handler_registry.register(Action.Type.MSTEAMS)
class MSTeamsActionHandler(IntegrationActionHandler):
    group = ActionHandler.Group.NOTIFICATION
    provider_slug = "msteams"

    config_schema = MESSAGING_ACTION_CONFIG_SCHEMA

    data_schema = {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "type": "object",
        "description": "Schema for MSTeams action data blob",
        "properties": {},
        "additionalProperties": False,
    }

    @staticmethod
    def execute(
        job: WorkflowEventData,
        action: Action,
        detector: Detector,
    ) -> None:
        execute_via_group_type_registry(job, action, detector)
