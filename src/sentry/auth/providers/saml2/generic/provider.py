from __future__ import annotations

from collections.abc import Callable

from django.http import HttpRequest

from sentry.auth.providers.saml2.provider import SAML2Provider
from sentry.auth.services.auth.model import RpcAuthProvider
from sentry.organizations.services.organization.model import RpcOrganization
from sentry.plugins.base.response import DeferredResponse

from .views import MapAttributes, SelectIdP, saml2_configure_view


class GenericSAML2Provider(SAML2Provider):
    name = "SAML2"
    key = "saml2"

    def get_configure_view(
        self,
    ) -> Callable[[HttpRequest, RpcOrganization, RpcAuthProvider], DeferredResponse]:
        return saml2_configure_view

    def get_saml_setup_pipeline(self):
        return [SelectIdP(), MapAttributes()]
