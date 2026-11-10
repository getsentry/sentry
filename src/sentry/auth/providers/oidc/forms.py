from __future__ import annotations

from django import forms
from django.utils.translation import gettext_lazy as _

from .discovery import is_https_url


class OIDCSetupForm(forms.Form):
    issuer = forms.URLField(
        label=_("Issuer URL"),
        assume_scheme="https",
        help_text=_(
            "Your identity provider's issuer, for example https://login.example.com. Sentry reads "
            "/.well-known/openid-configuration from it."
        ),
    )
    client_id = forms.CharField(label=_("Client ID"), max_length=255)
    client_secret = forms.CharField(
        label=_("Client Secret"),
        max_length=1024,
        widget=forms.PasswordInput(render_value=False),
    )

    def clean_issuer(self) -> str:
        issuer: str = self.cleaned_data["issuer"]
        if not is_https_url(issuer):
            raise forms.ValidationError(_("The issuer URL must start with https://."))
        return issuer
