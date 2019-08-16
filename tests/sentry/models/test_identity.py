from __future__ import absolute_import


from sentry.identity import register
from sentry.identity.base import Provider
from sentry.models import Identity, IdentityProvider
from sentry.testutils import TestCase


class ProviderDummy(Provider):
    name = "Tester"
    key = "tester"

    def build_identity(self, state):
        pass


class IdentityTestCase(TestCase):
    def test_get_provider(self):
        provider_model = IdentityProvider.objects.create(type="tester", external_id="tester_id")

        register(ProviderDummy)
        identity_model = Identity.objects.create(
            idp=provider_model, user=self.user, external_id="identity_id"
        )

        provider = identity_model.get_provider()
        assert provider.name == "Tester"
        assert provider.key == "tester"
