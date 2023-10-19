from __future__ import annotations

from typing import List, Optional

from sentry.eventstore.models import GroupEvent
from sentry.integrations.msteams.actions.form import MsTeamsNotifyServiceForm
from sentry.integrations.msteams.card_builder.issues import MSTeamsIssueMessageBuilder
from sentry.integrations.msteams.client import MsTeamsClient
from sentry.integrations.msteams.utils import get_channel_id
from sentry.rules.actions import IntegrationEventAction
from sentry.rules.base import EventState
from sentry.services.hybrid_cloud.integration import RpcIntegration
from sentry.utils import metrics


class MsTeamsNotifyServiceAction(IntegrationEventAction):
    id = "sentry.integrations.msteams.notify_action.MsTeamsNotifyServiceAction"
    form_cls = MsTeamsNotifyServiceForm
    label = "Send a notification to the {team} Team to {channel}"
    prompt = "Send a Microsoft Teams notification"
    provider = "msteams"
    integration_key = "team"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.form_fields = {
            "team": {
                "type": "choice",
                "choices": [(i.id, i.name) for i in self.get_integrations()],
            },
            "channel": {"type": "string", "placeholder": "i.e. General, Jane Schmidt"},
        }

    def get_integrations(self) -> List[RpcIntegration]:
        # NOTE: We exclude installations of `tenant` type to NOT show up in the team choices dropdown in alert rule actions
        # as currently, there is no way to query the API for users or channels within a `tenant` to send alerts to.
        return [
            a for a in super().get_integrations() if a.metadata.get("installation_type") != "tenant"
        ]

    def after(self, event: GroupEvent, state: EventState, notification_uuid: Optional[str] = None):
        channel = self.get_option("channel_id")

        integration = self.get_integration()
        if not integration:
            return

        def send_notification(event, futures):
            rules = [f.rule for f in futures]
            card = MSTeamsIssueMessageBuilder(
                event.group, event, rules, integration
            ).build_group_card(notification_uuid=notification_uuid)

            client = MsTeamsClient(integration)
            client.send_card(channel, card)
            rule = rules[0] if rules else None
            self.record_notification_sent(event, channel, rule, notification_uuid)

        key = f"msteams:{integration.id}:{channel}"

        metrics.incr("notifications.sent", instance="msteams.notification", skip_internal=False)
        yield self.future(send_notification, key=key)

    def render_label(self):
        return self.label.format(
            team=self.get_integration_name(), channel=self.get_option("channel")
        )

    def get_form_instance(self):
        return self.form_cls(
            self.data, integrations=self.get_integrations(), channel_transformer=self.get_channel_id
        )

    def get_channel_id(self, integration_id, name):
        return get_channel_id(self.project.organization, integration_id, name)
