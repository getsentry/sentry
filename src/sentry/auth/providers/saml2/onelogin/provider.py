from typing import int
from django import forms

from sentry.auth.providers.saml2.forms import URLMetadataForm
from sentry.auth.providers.saml2.provider import Attributes, SAML2Provider
from sentry.auth.providers.saml2.views import make_simple_setup
from sentry.auth.view import AuthView


# Onelogin specifically calls their Metadata URL a 'Issuer URL'
class OneLoginURLMetadataForm(URLMetadataForm):
    metadata_url = forms.URLField(label="Issuer URL", assume_scheme="https")


SelectIdP = make_simple_setup(OneLoginURLMetadataForm, "sentry_auth_onelogin/select-idp.html")


class OneLoginSAML2Provider(SAML2Provider):
    name = "OneLogin"
    key = "onelogin"

    def get_saml_setup_pipeline(self) -> list[AuthView]:
        return [SelectIdP()]

    def attribute_mapping(self) -> dict[str, str]:
        return {
            Attributes.IDENTIFIER: "PersonImmutableID",
            Attributes.USER_EMAIL: "User.email",
            Attributes.FIRST_NAME: "User.FirstName",
            Attributes.LAST_NAME: "User.LastName",
        }
