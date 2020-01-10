from __future__ import absolute_import, print_function

from django import forms

from sentry.auth.providers.saml2.provider import SAML2Provider, Attributes
from sentry.auth.providers.saml2.views import make_simple_setup
from sentry.auth.providers.saml2.forms import URLMetadataForm


# Onelogin specifically calls their Metadata URL a 'Issuer URL'
class OneLoginURLMetadataForm(URLMetadataForm):
    metadata_url = forms.URLField(label="Issuer URL")


SelectIdP = make_simple_setup(OneLoginURLMetadataForm, "sentry_auth_onelogin/select-idp.html")


class OneLoginSAML2Provider(SAML2Provider):
    name = "OneLogin"

    def get_saml_setup_pipeline(self):
        return [SelectIdP()]

    def attribute_mapping(self):
        return {
            Attributes.IDENTIFIER: "PersonImmutableID",
            Attributes.USER_EMAIL: "User.email",
            Attributes.FIRST_NAME: "User.FirstName",
            Attributes.LAST_NAME: "User.LastName",
        }
