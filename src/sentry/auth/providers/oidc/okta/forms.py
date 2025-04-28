from django import forms
from django.utils.translation import gettext_lazy as _


class OktaOIDCConfigureForm(forms.Form):
    domain = forms.URLField(
        label=_("Domain"),
        widget=forms.TextInput(attrs={"placeholder": "https://your-org.okta.com"}),
        help_text=_("Your Okta organization's domain"),
    )
    client_id = forms.CharField(
        label=_("Client ID"),
        widget=forms.TextInput(attrs={"placeholder": "Your Okta OIDC client ID"}),
    )
    client_secret = forms.CharField(
        label=_("Client Secret"),
        widget=forms.PasswordInput(attrs={"placeholder": "Your Okta OIDC client secret"}),
    )
