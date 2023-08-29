from typing import Any, Generator, Optional, Sequence

from sentry import analytics, features
from sentry.eventstore.models import GroupEvent
from sentry.integrations.discord.actions.form import DiscordNotifyServiceForm
from sentry.integrations.discord.client import DiscordClient
from sentry.integrations.discord.message_builder.issues import DiscordIssuesMessageBuilder
from sentry.rules.actions import IntegrationEventAction
from sentry.rules.base import CallbackFuture, EventState
from sentry.shared_integrations.exceptions.base import ApiError
from sentry.types.rules import RuleFuture
from sentry.utils import metrics


class DiscordNotifyServiceAction(IntegrationEventAction):
    id = "sentry.integrations.discord.notify_action.DiscordNotifyServiceAction"
    form_cls = DiscordNotifyServiceForm
    label = "Send a notification to the {server} Discord server in the channel with ID: {channel_id} and show tags {tags} in the notification."
    prompt = "Send a Discord notification"
    provider = "discord"
    integration_key = "server"

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        self.form_fields = {
            "server": {
                "type": "choice",
                "choices": [(i.id, i.name) for i in self.get_integrations()],
            },
            "channel_id": {"type": "string", "placeholder": "e.g., 1134274732116676679"},
            "tags": {"type": "string", "placeholder": "e.g., environment,user,my_tag"},
        }

    def after(
        self, event: GroupEvent, state: EventState, notification_uuid: Optional[str] = None
    ) -> Generator[CallbackFuture, None, None]:
        channel_id = self.get_option("channel_id")
        tags = set(self.get_tags_list())

        integration = self.get_integration()
        if not integration:
            # Integration removed, but rule still active
            return

        def send_notification(event: GroupEvent, futures: Sequence[RuleFuture]) -> None:
            if not features.has(
                "organizations:integrations-discord-notifications", event.organization
            ):
                return

            rules = [f.rule for f in futures]
            message = DiscordIssuesMessageBuilder(event.group, event=event, tags=tags, rules=rules)

            client = DiscordClient(integration_id=integration.id)
            try:
                client.send_message(channel_id, message)
            except ApiError as e:
                self.logger.error(
                    "rule.fail.discord_post",
                    extra={
                        "error": str(e),
                        "project_id": event.project_id,
                        "event_id": event.event_id,
                        "guild_id": integration.external_id,
                        "channel_id": channel_id,
                    },
                )

        key = f"discord:{integration.id}:{channel_id}"

        analytics.record(
            "integrations.discord.notification_sent",
            organization_id=event.organization.id,
            project_id=event.project_id,
            group_id=event.group_id,
        )
        metrics.incr("notifications.sent", instance="discord.notifications", skip_internal=False)
        yield self.future(send_notification, key=key)

    def render_label(self) -> str:
        tags = self.get_tags_list()

        return self.label.format(
            server=self.get_integration_name(),
            channel_id=self.get_option("channel_id"),
            tags="[{}]".format(", ".join(tags)),
        )

    def get_tags_list(self) -> Sequence[str]:
        return [s.strip() for s in self.get_option("tags", "").split(",")]

    def get_form_instance(self) -> Any:
        return self.form_cls(self.data, integrations=self.get_integrations())
