from __future__ import annotations

from collections.abc import Generator, Sequence
from typing import Any

from sentry import features
from sentry.eventstore.models import GroupEvent
from sentry.integrations.slack.actions.form import SlackNotifyServiceForm
from sentry.integrations.slack.client import SlackClient
from sentry.integrations.slack.message_builder.issues import SlackIssuesMessageBuilder
from sentry.integrations.slack.message_builder.notifications.rule_save_edit import (
    SlackRuleSaveEditMessageBuilder,
)
from sentry.integrations.slack.utils import get_channel_id
from sentry.models.integrations.integration import Integration
from sentry.models.rule import Rule
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
    prompt = "Send a Slack notification"
    provider = "slack"
    integration_key = "workspace"

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        # XXX(CEO): when removing the feature flag, put `label` back up as a class var
        self.label = "Send a notification to the {workspace} Slack workspace to {channel} (optionally, an ID: {channel_id}) and show tags {tags} in notification"  # type: ignore
        if features.has("organizations:slack-block-kit", self.project.organization):
            self.label = "Send a notification to the {workspace} Slack workspace to {channel} (optionally, an ID: {channel_id}) and show tags {tags} and notes {notes} in notification"  # type: ignore
        self.form_fields = {
            "workspace": {
                "type": "choice",
                "choices": [(i.id, i.name) for i in self.get_integrations()],
            },
            "channel": {"type": "string", "placeholder": "e.g., #critical, Jane Schmidt"},
            "channel_id": {"type": "string", "placeholder": "e.g., CA2FRA079 or UA1J9RTE1"},
            "tags": {"type": "string", "placeholder": "e.g., environment,user,my_tag"},
        }
        if features.has("organizations:slack-block-kit", self.project.organization):
            self.form_fields["notes"] = {
                "type": "string",
                "placeholder": "e.g. @jane, @on-call-team",
            }

    def after(
        self, event: GroupEvent, state: EventState, notification_uuid: str | None = None
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
                blocks = SlackIssuesMessageBuilder(
                    group=event.group,
                    event=event,
                    tags=tags,
                    rules=rules,
                    notes=self.get_option("notes", ""),
                ).build(notification_uuid=notification_uuid)

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
                    SlackIssuesMessageBuilder(
                        group=event.group,
                        event=event,
                        tags=tags,
                        rules=rules,
                    ).build(notification_uuid=notification_uuid)
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
                client.post(
                    "/chat.postMessage", data=payload, timeout=5, log_response_with_error=True
                )
            except ApiError as e:
                log_params = {
                    "error": str(e),
                    "project_id": event.project_id,
                    "event_id": event.event_id,
                    "channel_name": self.get_option("channel"),
                }
                if features.has("organizations:slack-block-kit", event.group.project.organization):
                    # temporarily log the payload so we can debug message failures
                    log_params["payload"] = json.dumps(payload)

                self.logger.info(
                    "rule.fail.slack_post",
                    extra=log_params,
                )
            rule = rules[0] if rules else None
            self.record_notification_sent(event, channel, rule, notification_uuid)

        key = f"slack:{integration.id}:{channel}"

        metrics.incr("notifications.sent", instance="slack.notification", skip_internal=False)
        yield self.future(send_notification, key=key)

    def send_confirmation_notification(self, rule: Rule, new: bool, changed):
        integration = self.get_integration()
        if not integration:
            # Integration removed, rule still active.
            return

        channel = self.get_option("channel_id")
        blocks = SlackRuleSaveEditMessageBuilder(rule=rule, new=new, changed=changed).build()
        payload = {
            "text": blocks.get("text"),
            "blocks": json.dumps(blocks.get("blocks")),
            "channel": channel,
            "unfurl_links": False,
            "unfurl_media": False,
        }
        client = SlackClient(integration_id=integration.id)
        try:
            client.post("/chat.postMessage", data=payload, timeout=5, log_response_with_error=True)
        except ApiError as e:
            log_params = {
                "error": str(e),
                "project_id": rule.project.id,
                "channel_name": self.get_option("channel"),
            }
            self.logger.info(
                "rule_confirmation.fail.slack_post",
                extra=log_params,
            )

    def render_label(self) -> str:
        tags = self.get_tags_list()

        if features.has("organizations:slack-block-kit", self.project.organization):
            return self.label.format(
                workspace=self.get_integration_name(),
                channel=self.get_option("channel"),
                channel_id=self.get_option("channel_id"),
                tags="[{}]".format(", ".join(tags)),
                notes=self.get_option("notes", ""),
            )

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
