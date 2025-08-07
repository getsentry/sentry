from sentry.notifications.models.notificationaction import ActionTarget
from sentry.notifications.notification_action.utils import execute_via_group_type_registry
from sentry.workflow_engine.models import Action, Detector
from sentry.workflow_engine.registry import action_handler_registry
from sentry.workflow_engine.types import ActionHandler, WorkflowEventData
from sentry.workflow_engine.typings.notification_action import SentryAppIdentifier


@action_handler_registry.register(Action.Type.SENTRY_APP)
class SentryAppActionHandler(ActionHandler):
    group = ActionHandler.Group.OTHER

    config_schema = {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "description": "The configuration schema for a Sentry App Action",
        "type": "object",
        "properties": {
            "target_identifier": {"type": ["string"]},
            "target_display": {"type": ["string", "null"]},
            "target_type": {
                "type": ["integer"],
                "enum": [ActionTarget.SENTRY_APP.value],
            },
            "sentry_app_identifier": {
                "type": ["string"],
                "enum": [*SentryAppIdentifier],
            },
        },
        "required": ["target_type", "target_identifier", "sentry_app_identifier"],
        "additionalProperties": False,
    }
    data_schema = {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "type": "object",
        "properties": {
            "settings": {"type": ["array", "object"]},
        },
        "additionalProperties": False,
    }

    @staticmethod
    def execute(
        job: WorkflowEventData,
        action: Action,
        detector: Detector,
    ) -> None:
        execute_via_group_type_registry(job, action, detector)

    @staticmethod
    def get_dedup_key(action: Action) -> str:
        """
        Returns a deduplication key for Sentry App actions.
        Sentry App actions are deduplicated by target_identifier and sentry_app_identifier.
        """
        key_parts = [action.type]

        sentry_app_identifier = action.config.get("sentry_app_identifier")

        # This is an invariant that we should have a sentry_app_identifier for all Sentry App actions
        assert sentry_app_identifier is not None
        key_parts.append(str(sentry_app_identifier))

        target_identifier = action.config.get("target_identifier")

        # This is an invariant that we should have a target_identifier for all Sentry App actions
        assert target_identifier is not None
        key_parts.append(str(target_identifier))

        return ":".join(key_parts)
