from sentry.integrations.types import IntegrationProviderSlug
from sentry.notifications.notification_action.action_handler_registry.base import (
    IntegrationActionHandler,
)
from sentry.notifications.notification_action.action_handler_registry.common import (
    MESSAGING_ACTION_CONFIG_SCHEMA,
    NOTES_SCHEMA,
    TAGS_SCHEMA,
)
from sentry.workflow_engine.models import Action, Detector
from sentry.workflow_engine.registry import action_handler_registry
from sentry.workflow_engine.types import ActionHandler, WorkflowEventData


@action_handler_registry.register(Action.Type.SLACK)
class SlackActionHandler(IntegrationActionHandler):
    group = ActionHandler.Group.NOTIFICATION
    provider_slug = IntegrationProviderSlug.SLACK

    config_schema = MESSAGING_ACTION_CONFIG_SCHEMA

    data_schema = {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "type": "object",
        "description": "Schema for Slack action data blob",
        "properties": {
            "tags": TAGS_SCHEMA,
            "notes": NOTES_SCHEMA,
        },
        "additionalProperties": False,
    }

    @staticmethod
    def execute(
        job: WorkflowEventData,
        action: Action,
        detector: Detector,
    ) -> None:
        from sentry.notifications.notification_action.utils import execute_via_group_type_registry

        execute_via_group_type_registry(job, action, detector)
