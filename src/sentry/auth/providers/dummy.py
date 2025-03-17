from django.http import HttpRequest, HttpResponse

from sentry.auth.provider import MigratingIdentityId, Provider
from sentry.auth.providers.saml2.provider import Attributes, SAML2Provider
from sentry.auth.view import AuthView
from sentry.models.authidentity import AuthIdentity

PLACEHOLDER_TEMPLATE = '<form method="POST"><input type="email" name="email" /></form>'


class AskEmail(AuthView):
    def dispatch(self, request: HttpRequest, helper) -> HttpResponse:
        if "email" in request.POST:
            if "id" in request.POST:
                helper.bind_state("id", request.POST.get("id"))
            helper.bind_state("email", request.POST.get("email"))
            helper.bind_state("legacy_email", request.POST.get("legacy_email"))
            helper.bind_state("email_verified", bool(request.POST.get("email_verified")))
            return helper.next_step()

        return HttpResponse(PLACEHOLDER_TEMPLATE)


class DummyProvider(Provider):
    name = "Dummy"
    key = "dummy"

    def get_auth_pipeline(self):
        return [AskEmail()]

    def build_identity(self, state):
        return {
            "id": MigratingIdentityId(
                id=state.get("id", state["email"]), legacy_id=state.get("legacy_email")
            ),
            "email": state["email"],
            "email_verified": state["email_verified"],
            "name": "Dummy",
        }

    def refresh_identity(self, auth_identity: AuthIdentity) -> None:
        pass

    def build_config(self, state):
        return {}


dummy_provider_config = {
    "idp": {
        "entity_id": "https://example.com/saml/metadata/1234",
        "x509cert": "foo_x509_cert",
        "sso_url": "http://example.com/sso_url",
        "slo_url": "http://example.com/slo_url",
    },
    "attribute_mapping": {
        Attributes.IDENTIFIER: "user_id",
        Attributes.USER_EMAIL: "email",
        Attributes.FIRST_NAME: "first_name",
        Attributes.LAST_NAME: "last_name",
    },
}


class DummySAML2Provider(SAML2Provider):
    name = "DummySAML2"
    key = "saml2_dummy"

    def get_saml_setup_pipeline(self):
        return []

    def build_config(self, state):
        return dummy_provider_config
