from __future__ import annotations

from typing import Any

from django import forms
from django.core.exceptions import ValidationError
from django.forms.fields import ChoiceField

from sentry.integrations.discord.utils.channel import validate_channel_id
from sentry.integrations.discord.utils.channel_from_url import get_channel_id_from_url
from sentry.services.hybrid_cloud.integration import integration_service
from sentry.shared_integrations.exceptions import ApiTimeoutError, IntegrationError


class DiscordNotifyServiceForm(forms.Form):
    # NOTE: server (guild id) maps directly to the integration ID
    server = forms.ChoiceField(choices=(), widget=forms.Select())
    channel_id = forms.CharField(widget=forms.TextInput())
    tags = forms.CharField(required=False, widget=forms.TextInput())

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        server_list = [(i.id, i.name) for i in kwargs.pop("integrations")]

        super().__init__(*args, **kwargs)

        if server_list:
            assert isinstance(self.fields["server"], ChoiceField)
            self.fields["server"].initial = server_list[0][0]
            self.fields["server"].choices = server_list
            self.fields["server"].widget.choices = server_list

    def _format_discord_error_message(self, message: str) -> str:
        return f"Discord: {message}"

    def clean(self) -> dict[str, object] | None:
        cleaned_data: dict[str, object] = super().clean() or {}
        channel_id = cleaned_data.get("channel_id")
        server = cleaned_data.get("server")
        integration = integration_service.get_integration(integration_id=server)

        if not server or not integration:
            raise forms.ValidationError(
                self._format_discord_error_message("Server is a required field."),
                code="invalid",
            )

        if channel_id and isinstance(channel_id, str):
            try:
                channel = get_channel_id_from_url(channel_id)
                validate_channel_id(
                    channel_id=channel,
                    guild_id=integration.external_id,
                    guild_name=integration.name,
                )
                cleaned_data["channel_id"] = channel
            except ValidationError as e:
                raise forms.ValidationError(
                    self._format_discord_error_message("; ".join(e.messages)),
                    code="invalid",
                )
            except IntegrationError as e:
                raise forms.ValidationError(
                    self._format_discord_error_message("; ".join(str(e))),
                    code="invalid",
                )
            except ApiTimeoutError:
                raise forms.ValidationError("Discord channel lookup timed out")
        return cleaned_data
