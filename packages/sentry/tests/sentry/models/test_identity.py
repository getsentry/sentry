from sentry.identity import register
from sentry.identity.providers.dummy import DummyProvider
from sentry.models import Identity, IdentityProvider
from sentry.testutils import TestCase


class IdentityTestCase(TestCase):
    def test_get_provider(self):
        provider_model = IdentityProvider.objects.create(type="dummy", external_id="tester_id")

        register(DummyProvider)
        identity_model = Identity.objects.create(
            idp=provider_model, user=self.user, external_id="identity_id"
        )

        provider = identity_model.get_provider()
        assert provider.name == "Dummy"
        assert provider.key == "dummy"
