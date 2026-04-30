from sentry.integrations.types import IntegrationProviderSlug
from sentry.notifications.notification_action.action_handler_registry.base import (
    TicketingActionHandler,
)
from sentry.workflow_engine.models import Action
from sentry.workflow_engine.registry import action_handler_registry
from sentry.workflow_engine.types import ActionHandler


@action_handler_registry.register(Action.Type.GITHUB)
class GithubActionHandler(TicketingActionHandler):
    group = ActionHandler.Group.TICKET_CREATION
    provider_slug = IntegrationProviderSlug.GITHUB

    data_schema = {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "type": "object",
        "description": "Schema for GitHub ticket creation action data blob",
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
                "properties": {
                    "repo": {"type": "string"},
                    "labels": {
                        "type": ["array", "null"],
                        "items": {"type": "string"},
                        "default": [],
                    },
                    "assignee": {
                        "type": ["string", "null"],
                    },
                    "integration": {
                        "type": [
                            "string",
                        ],
                    },
                },
                "required": ["repo", "integration"],
            },
        },
        "required": ["additional_fields"],
        "additionalProperties": False,
    }
