from __future__ import annotations

from django import forms
from django.core.exceptions import ValidationError
from django.utils.translation import gettext_lazy as _

from sentry.integrations.discord.utils.channel import validate_channel_id
from sentry.services.hybrid_cloud.integration import integration_service


class DiscordNotifyServiceForm(forms.Form):
    server = forms.ChoiceField(choices=(), widget=forms.Select())
    channel_id = forms.CharField(widget=forms.TextInput())
    tags = forms.CharField(required=False, widget=forms.TextInput())

    def __init__(self, *args: object, **kwargs: object) -> None:
        server_list = [(i.id, i.name) for i in kwargs.pop("integrations")]

        super().__init__(*args, **kwargs)

        if server_list:
            self.fields["server"].initial = server_list[0][0]

        self.fields["server"].choices = server_list
        self.fields["server"].widget.choices = self.fields["server"].choices

        # We only want to save if we are able to find a matching channel id for
        # the given channel name.
        # TODO: Do we need this?
        self._pending_save = False

    def _format_discord_error_message(self, message: str) -> object:
        return _(f"Discord: {message}")

    def clean(self) -> dict[str, object] | None:
        channel_id = self.data.get("channel_id")
        cleaned_data: dict[str, object] = super().clean()
        assert cleaned_data is not None

        # tet
        assert channel_id == cleaned_data["channel_id"]

        server = cleaned_data.get("server")

        if channel_id:
            try:
                validate_channel_id(
                    channel_id=channel_id,
                    integration_id=server,
                )
            except ValidationError as e:
                raise forms.ValidationError(
                    self._format_discord_error_message("; ".join(e.messages)),
                    code="invalid",
                )
        integration = integration_service.get_integration(integration_id=server)
        if not integration:
            raise forms.ValidationError(
                self._format_discord_error_message("Server is a required field."),
                code="invalid",
            )

        return cleaned_data
