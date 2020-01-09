from __future__ import absolute_import, print_function

from sentry.auth.providers.saml2.provider import SAML2Provider

from .views import SAML2ConfigureView, SelectIdP, MapAttributes


class GenericSAML2Provider(SAML2Provider):
    name = "SAML2"

    def get_configure_view(self):
        return SAML2ConfigureView.as_view()

    def get_saml_setup_pipeline(self):
        return [SelectIdP(), MapAttributes()]
