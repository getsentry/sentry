from __future__ import annotations

from django.db.models import QuerySet

from sentry.integrations.msteams.actions.form import MsTeamsNotifyServiceForm
from sentry.integrations.msteams.card_builder.issues import MSTeamsIssueMessageBuilder
from sentry.integrations.msteams.client import MsTeamsClient
from sentry.integrations.msteams.utils import get_channel_id
from sentry.models import Integration
from sentry.rules.actions import IntegrationEventAction
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

    def get_integrations(self) -> QuerySet[Integration]:
        # NOTE: We exclude installations of `tenant` type to NOT show up in the team choices dropdown in alert rule actions
        # as currently, there is no way to query the API for users or channels within a `tenant` to send alerts to.
        return (
            super().get_integrations().exclude(metadata__contains={"installation_type": "tenant"})
        )

    def after(self, event, state):
        channel = self.get_option("channel_id")

        try:
            integration = self.get_integration()
        except Integration.DoesNotExist:
            return

        def send_notification(event, futures):
            rules = [f.rule for f in futures]
            card = MSTeamsIssueMessageBuilder(
                event.group, event, rules, integration
            ).build_group_card()

            client = MsTeamsClient(integration)
            client.send_card(channel, card)

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
