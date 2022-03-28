from __future__ import annotations

from sentry import auth
from sentry.auth.providers.dummy import DummyProvider
from sentry.auth.providers.saml2.activedirectory.apps import ACTIVE_DIRECTORY_PROVIDER_NAME
from sentry.models import AuthProvider as AuthProviderModel

from ..api import APITestCase


class SCIMTestCase(APITestCase):
    def setUp(self, provider="dummy"):
        super().setUp()
        self.auth_provider = AuthProviderModel(organization=self.organization, provider=provider)
        self.auth_provider.enable_scim(self.user)
        self.auth_provider.save()
        self.login_as(user=self.user)


class SCIMAzureTestCase(SCIMTestCase):
    def setUp(self):
        auth.register(ACTIVE_DIRECTORY_PROVIDER_NAME, DummyProvider)
        super().setUp(provider=ACTIVE_DIRECTORY_PROVIDER_NAME)
        self.addCleanup(auth.unregister, ACTIVE_DIRECTORY_PROVIDER_NAME, DummyProvider)
