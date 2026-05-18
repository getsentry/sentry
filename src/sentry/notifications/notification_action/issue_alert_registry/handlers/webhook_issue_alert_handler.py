from typing import Any

from sentry import features
from sentry.notifications.notification_action.registry import issue_alert_handler_registry
from sentry.notifications.notification_action.types import BaseIssueAlertHandler
from sentry.sentry_apps.services.legacy_webhook.service import send_legacy_webhooks_for_project
from sentry.workflow_engine.models import Action
from sentry.workflow_engine.types import ActionInvocation
from sentry.workflow_engine.typings.notification_action import ActionFieldMapping


@issue_alert_handler_registry.register(Action.Type.WEBHOOK)
class WebhookIssueAlertHandler(BaseIssueAlertHandler):
    @classmethod
    def get_integration_id(cls, action: Action, mapping: ActionFieldMapping) -> dict[str, Any]:
        return {}

    @classmethod
    def get_target_display(cls, action: Action, mapping: ActionFieldMapping) -> dict[str, Any]:
        return {}

    @classmethod
    def render_label(
        cls, organization_id: int, blob: dict[str, Any], integration_cache: Any = None
    ) -> str:
        return "Send a notification via webhooks"

    @classmethod
    def invoke_legacy_registry(cls, invocation: ActionInvocation) -> None:
        organization = invocation.detector.project.organization
        new_path = features.has("organizations:legacy-webhook-new-path", organization)
        disable_old = features.has("organizations:legacy-webhook-disable-old-path", organization)

        if new_path:
            project = invocation.detector.project
            group = invocation.event_data.group
            event = invocation.event_data.event
            rule = cls.create_rule_instance_from_action(
                invocation.action,
                invocation.detector,
                invocation.event_data,
                invocation.workflow_id,
            )
            send_legacy_webhooks_for_project(project, group, event, [rule.label])

        if not (new_path and disable_old):
            super().invoke_legacy_registry(invocation)
