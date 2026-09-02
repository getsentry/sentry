from __future__ import annotations

from typing import Any

from django import forms
from django.utils.translation import gettext_lazy as _

from sentry.constants import ObjectStatus
from sentry.integrations.msteams.utils import find_channel_id
from sentry.integrations.services.integration.service import integration_service
from sentry.shared_integrations.exceptions import ApiInvalidRequestError
from sentry.utils.forms import set_field_choices


class MsTeamsNotifyServiceForm(forms.Form):
    team = forms.ChoiceField(choices=(), widget=forms.Select())
    channel = forms.CharField(widget=forms.TextInput())
    channel_id = forms.HiddenInput()

    def __init__(self, *args, **kwargs):
        self._team_list = [(i.id, i.name) for i in kwargs.pop("integrations")]

        super().__init__(*args, **kwargs)

        if self._team_list:
            self.fields["team"].initial = self._team_list[0][0]

        set_field_choices(self.fields["team"], self._team_list)

    def clean(self) -> dict[str, Any] | None:
        cleaned_data = super().clean()
        if cleaned_data is None:
            return None

        integration_id = cleaned_data.get("team")
        channel = cleaned_data.get("channel", "")
        integration = integration_service.get_integration(
            integration_id=integration_id, status=ObjectStatus.ACTIVE
        )
        if not integration:
            raise forms.ValidationError(_("Team is a required field."), code="invalid")

        try:
            channel_id = find_channel_id(integration, channel)
        except ApiInvalidRequestError as error:
            # MS Teams can reject the stored team/conversation id itself (e.g. BadSyntax)
            # before we ever match the entered channel name. Surface that as validation
            # instead of letting the exception bubble out of action validation / test-fire.
            error_code = (error.json or {}).get("error", {}).get("code")
            if error_code == "BadSyntax":
                raise forms.ValidationError(
                    _(
                        "Microsoft Teams rejected this team configuration. "
                        "Reinstall the integration and try again."
                    ),
                    code="invalid",
                ) from error
            raise

        if channel_id is None and integration_id is not None:
            params = {
                "channel": channel,
                "team": dict(self._team_list).get(int(integration_id)),
            }

            raise forms.ValidationError(
                _('The channel or user "%(channel)s" could not be found in the %(team)s Team.'),
                code="invalid",
                params=params,
            )

        cleaned_data["channel_id"] = channel_id

        return cleaned_data
