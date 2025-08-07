import logging
from abc import ABC

from sentry.integrations.types import IntegrationProviderSlug
from sentry.notifications.models.notificationaction import ActionTarget
from sentry.notifications.notification_action.utils import execute_via_issue_alert_handler
from sentry.workflow_engine.models import Action, Detector
from sentry.workflow_engine.types import ActionHandler, WorkflowEventData

logger = logging.getLogger(__name__)


class IntegrationActionHandler(ActionHandler, ABC):
    provider_slug: IntegrationProviderSlug

    @staticmethod
    def get_dedup_key(action: Action) -> str:
        """
        Returns a deduplication key for integration actions.
        Integration actions are deduplicated by integration_id and target_identifier (channel).
        """
        key_parts = [action.type]

        # This is an invariant that we should have an integration_id for all integration actions
        assert action.integration_id is not None
        key_parts.append(str(action.integration_id))

        # For integration actions, target_identifier is the channel ID
        target_identifier = action.config.get("target_identifier")

        # This is an invariant that we should have a target_identifier for all integration actions
        assert target_identifier is not None

        key_parts.append(str(target_identifier))

        # Include the stringified data
        if action.data:
            key_parts.append(str(action.data))

        return ":".join(key_parts)


class TicketingActionHandler(IntegrationActionHandler, ABC):
    config_schema = {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "description": "The configuration schema for a Ticketing Action",
        "type": "object",
        "properties": {
            "target_identifier": {
                "type": ["null"],
            },
            "target_display": {
                "type": ["null"],
            },
            "target_type": {
                "type": ["integer"],
                "enum": [ActionTarget.SPECIFIC.value],
            },
        },
    }

    @staticmethod
    def get_dedup_key(action: Action) -> str:
        """
        Returns a deduplication key for ticketing actions.
        Ticketing actions are deduplicated by integration_id.
        """
        key_parts = [action.type]

        # This is an invariant that we should have an integration_id for all integration actions
        assert action.integration_id is not None
        key_parts.append(str(action.integration_id))

        return ":".join(key_parts)

    data_schema = {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "type": "object",
        "description": "Schema for ticket creation action data blob",
        "properties": {
            "dynamic_form_fields": {
                "type": "array",
                "description": "Dynamic form fields from customer configuration",
                "items": {"type": "object"},
                "default": [],
            },
            "additional_fields": {
                "type": "object",
                "description": "Additional fields that aren't part of standard fields",
                "additionalProperties": True,
                "default": {},
            },
        },
        "additionalProperties": False,
    }

    @staticmethod
    def execute(
        job: WorkflowEventData,
        action: Action,
        detector: Detector,
    ) -> None:
        execute_via_issue_alert_handler(job, action, detector)
