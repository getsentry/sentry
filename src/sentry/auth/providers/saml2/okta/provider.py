from sentry.auth.providers.saml2.forms import URLMetadataForm
from sentry.auth.providers.saml2.provider import Attributes, SAML2Provider
from sentry.auth.providers.saml2.views import make_simple_setup

SelectIdP = make_simple_setup(URLMetadataForm, "sentry_auth_okta/select-idp.html")


class OktaSAML2Provider(SAML2Provider):
    name = "Okta"

    def get_saml_setup_pipeline(self):
        return [SelectIdP()]

    def attribute_mapping(self):
        return {
            Attributes.IDENTIFIER: "identifier",
            Attributes.USER_EMAIL: "email",
            Attributes.FIRST_NAME: "firstName",
            Attributes.LAST_NAME: "lastName",
        }

    def can_use_scim(self, organization, user):
        return True
