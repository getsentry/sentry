from sentry.auth.providers.saml2.forms import URLMetadataForm
from sentry.auth.providers.saml2.provider import Attributes, SAML2Provider
from sentry.auth.providers.saml2.views import make_simple_setup
from sentry.auth.view import AuthView

SelectIdP = make_simple_setup(URLMetadataForm, "sentry_auth_auth0/select-idp.html")


class Auth0SAML2Provider(SAML2Provider):
    name = "Auth0"
    key = "auth0"

    def get_saml_setup_pipeline(self) -> list[AuthView]:
        return [SelectIdP()]

    def attribute_mapping(self) -> dict[str, str | None]:
        return {
            Attributes.IDENTIFIER: "user_id",
            Attributes.USER_EMAIL: "email",
            # Auth0 does not provider first / last names
            Attributes.FIRST_NAME: "name",
            Attributes.LAST_NAME: None,
        }
