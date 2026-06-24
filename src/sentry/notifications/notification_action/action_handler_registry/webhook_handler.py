import logging
from typing import override

from sentry import features
from sentry.models.activity import Activity
from sentry.models.organization import Organization
from sentry.notifications.notification_action.utils import execute_via_activity_type_registry
from sentry.sentry_apps.services.legacy_webhook.service import (
    get_triggering_rule_name,
    send_legacy_webhooks_for_invocation,
    send_sentry_app_webhook,
)
from sentry.services.eventstore.models import GroupEvent
from sentry.workflow_engine.models import Action
from sentry.workflow_engine.registry import action_handler_registry
from sentry.workflow_engine.types import ActionHandler, ActionInvocation, ConfigTransformer

logger = logging.getLogger(__name__)


def _handle_legacy_webhooks(invocation: ActionInvocation) -> None:
    if not isinstance(invocation.event_data.event, GroupEvent):
        return
    send_legacy_webhooks_for_invocation(invocation)


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
        target_identifier = invocation.action.config.get("target_identifier")
        if target_identifier == "webhooks":
            return _handle_legacy_webhooks(invocation)

        if isinstance(invocation.event_data.event, Activity):
            try:
                organization = Organization.objects.get_from_cache(id=organization.id)
                if features.has(
                    "organizations:workflow-engine-evaluate-seer-activities", organization
                ):
                    execute_via_activity_type_registry(invocation=invocation)
            except Exception:
                logger.exception(
                    "Error executing via activity type registry",
                    extra={
                        "action_id": invocation.action.id,
                        "detector_id": invocation.detector.id,
                        "organization_id": organization.id,
                    },
                )
        else:
            send_sentry_app_webhook(
                group_event=invocation.event_data.event,
                sentry_app_slug=target_identifier,
                rule_label=get_triggering_rule_name(invocation),
                organization=organization,
            )
