import logging
from typing import override

from sentry import features
from sentry.notifications.notification_action.utils import execute_via_group_type_registry
from sentry.sentry_apps.services.legacy_webhook.service import send_legacy_webhooks_for_invocation
from sentry.services.eventstore.models import GroupEvent
from sentry.workflow_engine.models import Action
from sentry.workflow_engine.registry import action_handler_registry
from sentry.workflow_engine.types import ActionHandler, ActionInvocation, ConfigTransformer

logger = logging.getLogger(__name__)


@action_handler_registry.register(Action.Type.WEBHOOK)
class WebhookActionHandler(ActionHandler):
    group = ActionHandler.Group.OTHER

    config_schema = {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "description": "The configuration schema for Webhook Actions",
        "type": "object",
        "properties": {
            "target_identifier": {
                "type": ["string"],
            },
            "target_display": {
                "type": ["null"],
            },
            "target_type": {
                "type": ["integer", "null"],
                "enum": [None],
            },
        },
    }
    data_schema = {}

    @staticmethod
    def get_config_transformer() -> ConfigTransformer | None:
        return None

    @staticmethod
    @override
    def execute(invocation: ActionInvocation) -> None:
        organization = invocation.detector.project.organization
        new_path = features.has("organizations:legacy-webhook-new-path", organization)
        disable_old = features.has("organizations:legacy-webhook-disable-old-path", organization)

        if not disable_old:
            try:
                execute_via_group_type_registry(invocation)
            except Exception:
                logger.exception(
                    "webhook_action_handler.old_path_error",
                    extra={"invocation": invocation},
                )

        if new_path and isinstance(invocation.event_data.event, GroupEvent):
            send_legacy_webhooks_for_invocation(invocation)
