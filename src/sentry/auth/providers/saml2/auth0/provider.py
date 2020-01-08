from __future__ import absolute_import, print_function

from sentry.auth.providers.saml2.provider import SAML2Provider, Attributes
from sentry.auth.providers.saml2.views import make_simple_setup
from sentry.auth.providers.saml2.forms import URLMetadataForm


SelectIdP = make_simple_setup(URLMetadataForm, "sentry_auth_auth0/select-idp.html")


class Auth0SAML2Provider(SAML2Provider):
    name = "Auth0"

    def get_saml_setup_pipeline(self):
        return [SelectIdP()]

    def attribute_mapping(self):
        return {
            Attributes.IDENTIFIER: "user_id",
            Attributes.USER_EMAIL: "email",
            # Auth0 does not provider first / last names
            Attributes.FIRST_NAME: "name",
            Attributes.LAST_NAME: None,
        }
