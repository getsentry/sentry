from __future__ import annotations

from typing import Any, Generator, Optional, Sequence

from sentry import features
from sentry.eventstore.models import GroupEvent
from sentry.integrations.slack.actions.form import SlackNotifyServiceForm
from sentry.integrations.slack.client import SlackClient
from sentry.integrations.slack.message_builder.issues import build_group_attachment
from sentry.integrations.slack.utils import get_channel_id
from sentry.models.integrations.integration import Integration
from sentry.notifications.additional_attachment_manager import get_additional_attachment
from sentry.rules import EventState
from sentry.rules.actions import IntegrationEventAction
from sentry.rules.base import CallbackFuture
from sentry.services.hybrid_cloud.integration import RpcIntegration
from sentry.shared_integrations.exceptions import ApiError
from sentry.types.rules import RuleFuture
from sentry.utils import json, metrics


class SlackNotifyServiceAction(IntegrationEventAction):
    id = "sentry.integrations.slack.notify_action.SlackNotifyServiceAction"
    form_cls = SlackNotifyServiceForm
    label = "Send a notification to the {workspace} Slack workspace to {channel} (optionally, an ID: {channel_id}) and show tags {tags} in notification"
    prompt = "Send a Slack notification"
    provider = "slack"
    integration_key = "workspace"

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        self.form_fields = {
            "workspace": {
                "type": "choice",
                "choices": [(i.id, i.name) for i in self.get_integrations()],
            },
            "channel": {"type": "string", "placeholder": "e.g., #critical, Jane Schmidt"},
            "channel_id": {"type": "string", "placeholder": "e.g., CA2FRA079 or UA1J9RTE1"},
            "tags": {"type": "string", "placeholder": "e.g., environment,user,my_tag"},
        }

    def after(
        self, event: GroupEvent, state: EventState, notification_uuid: Optional[str] = None
    ) -> Generator[CallbackFuture, None, None]:
        channel = self.get_option("channel_id")
        tags = set(self.get_tags_list())

        i = self.get_integration()
        if not i:
            # Integration removed, rule still active.
            return

        # integration is captured in a closure, type assert the None case is handled.
        integration: RpcIntegration = i

        def send_notification(event: GroupEvent, futures: Sequence[RuleFuture]) -> None:
            rules = [f.rule for f in futures]
            additional_attachment = get_additional_attachment(
                integration, self.project.organization
            )
            if features.has("organizations:slack-block-kit", event.group.project.organization):
                blocks = build_group_attachment(
                    event.group,
                    event=event,
                    tags=tags,
                    rules=rules,
                    notification_uuid=notification_uuid,
                )
                if additional_attachment:
                    for block in additional_attachment:
                        blocks["blocks"].append(block)

                if blocks.get("blocks"):
                    payload = {
                        "text": blocks.get("text"),
                        "blocks": json.dumps(blocks.get("blocks")),
                        "channel": channel,
                        "unfurl_links": False,
                        "unfurl_media": False,
                    }
            else:
                attachments = [
                    build_group_attachment(
                        event.group,
                        event=event,
                        tags=tags,
                        rules=rules,
                        notification_uuid=notification_uuid,
                    )
                ]
                # getsentry might add a billing related attachment
                if additional_attachment:
                    attachments.append(additional_attachment)

                payload = {
                    "channel": channel,
                    "link_names": 1,
                    "attachments": json.dumps(attachments),
                }

            client = SlackClient(integration_id=integration.id)
            try:
                client.post("/chat.postMessage", data=payload, timeout=5)
            except ApiError as e:
                self.logger.info(
                    "rule.fail.slack_post",
                    extra={
                        "error": str(e),
                        "project_id": event.project_id,
                        "event_id": event.event_id,
                        "channel_name": self.get_option("channel"),
                    },
                )
            rule = rules[0] if rules else None
            self.record_notification_sent(event, channel, rule, notification_uuid)

        key = f"slack:{integration.id}:{channel}"

        metrics.incr("notifications.sent", instance="slack.notification", skip_internal=False)
        yield self.future(send_notification, key=key)

    def render_label(self) -> str:
        tags = self.get_tags_list()

        return self.label.format(
            workspace=self.get_integration_name(),
            channel=self.get_option("channel"),
            channel_id=self.get_option("channel_id"),
            tags="[{}]".format(", ".join(tags)),
        )

    def get_tags_list(self) -> Sequence[str]:
        return [s.strip() for s in self.get_option("tags", "").split(",")]

    def get_form_instance(self) -> Any:
        return self.form_cls(
            self.data, integrations=self.get_integrations(), channel_transformer=self.get_channel_id
        )

    def get_channel_id(self, integration: Integration, name: str) -> tuple[str, str | None, bool]:
        return get_channel_id(self.project.organization, integration, name)
