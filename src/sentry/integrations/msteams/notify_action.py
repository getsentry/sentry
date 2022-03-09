from __future__ import annotations

from typing import Any

from django import forms
from django.utils.translation import ugettext_lazy as _

from sentry.models import Integration
from sentry.rules.actions.base import IntegrationEventAction
from sentry.utils import metrics

from .card_builder import build_group_card
from .client import MsTeamsClient
from .utils import get_channel_id


class MsTeamsNotifyServiceForm(forms.Form):
    team = forms.ChoiceField(choices=(), widget=forms.Select())
    channel = forms.CharField(widget=forms.TextInput())
    channel_id = forms.HiddenInput()

    def __init__(self, *args, **kwargs):
        team_list = [(i.id, i.name) for i in kwargs.pop("integrations")]
        self.channel_transformer = kwargs.pop("channel_transformer")

        super().__init__(*args, **kwargs)

        if team_list:
            self.fields["team"].initial = team_list[0][0]

        self.fields["team"].choices = team_list
        self.fields["team"].widget.choices = self.fields["team"].choices

    def clean(self) -> dict[str, Any] | None:
        cleaned_data = super().clean()

        integration_id = cleaned_data.get("team")
        channel = cleaned_data.get("channel", "")
        channel_id = self.channel_transformer(integration_id, channel)

        if channel_id is None and integration_id is not None:
            params = {
                "channel": channel,
                "team": dict(self.fields["team"].choices).get(int(integration_id)),
            }

            raise forms.ValidationError(
                _('The channel or user "%(channel)s" could not be found in the %(team)s Team.'),
                code="invalid",
                params=params,
            )

        cleaned_data["channel_id"] = channel_id

        return cleaned_data


class MsTeamsNotifyServiceAction(IntegrationEventAction):
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
            "channel": {"type": "string", "placeholder": "i.e. General"},
        }

    def after(self, event, state):
        channel = self.get_option("channel_id")

        try:
            integration = self.get_integration()
        except Integration.DoesNotExist:
            return

        def send_notification(event, futures):
            rules = [f.rule for f in futures]
            card = build_group_card(event.group, event, rules, integration)

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
