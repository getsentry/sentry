import logging
from typing import override

from sentry import features
from sentry.notifications.notification_action.utils import execute_via_group_type_registry
from sentry.options.rollout import in_random_rollout
from sentry.plugins.sentry_webhooks.plugin import WebHooksPlugin
from sentry.sentry_apps.services.legacy_webhook.service import (
    build_legacy_webhook_payload,
    get_triggering_rule_name,
    send_legacy_webhooks_for_invocation,
    send_sentry_app_webhook,
)
from sentry.sentry_apps.services.legacy_webhook.validation import validate_payload_equivalence
from sentry.services.eventstore.models import GroupEvent
from sentry.workflow_engine.models import Action
from sentry.workflow_engine.registry import action_handler_registry
from sentry.workflow_engine.types import ActionHandler, ActionInvocation, ConfigTransformer

logger = logging.getLogger(__name__)


def _validate_webhook_payloads(invocation: ActionInvocation) -> None:
    group = invocation.event_data.group
    event = invocation.event_data.event
    rule_name = get_triggering_rule_name(invocation)

    old_payload = WebHooksPlugin().get_group_data(group, event, [rule_name])
    new_payload = build_legacy_webhook_payload(invocation)

    validate_payload_equivalence(
        old_payload,
        new_payload,
        organization_id=invocation.detector.project.organization_id,
        project_id=invocation.detector.project.id,
    )


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
            target_identifier = invocation.action.config.get("target_identifier")
            if target_identifier == "webhooks":
                send_legacy_webhooks_for_invocation(invocation)

                if in_random_rollout("sentry-apps.legacy-webhook-payload-validation.rate"):
                    try:
                        _validate_webhook_payloads(invocation)
                    except Exception:
                        logger.exception("webhook_action_handler.validation_error")
            else:
                send_sentry_app_webhook(
                    group_event=invocation.event_data.event,
                    sentry_app_slug=target_identifier,
                    rule_label=get_triggering_rule_name(invocation),
                )
