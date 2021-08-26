from sentry.auth.providers.saml2.provider import SAML2Provider, SCIMMixin

from .views import MapAttributes, SAML2ConfigureView, SelectIdP


class GenericSAML2Provider(SCIMMixin, SAML2Provider):
    name = "SAML2"

    def get_configure_view(self):
        return SAML2ConfigureView.as_view()

    def get_saml_setup_pipeline(self):
        return [SelectIdP(), MapAttributes()]
