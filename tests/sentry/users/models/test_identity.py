from sentry.identity import register
from sentry.identity.providers.dummy import DummyProvider
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test
class IdentityTestCase(TestCase):
    def test_get_provider(self):
        integration = self.create_integration(
            organization=self.organization, provider="dummy", external_id="tester_id"
        )
        provider_model = self.create_identity_provider(integration=integration)
        register(DummyProvider)
        identity_model = self.create_identity(
            user=self.user, identity_provider=provider_model, external_id="identity_id"
        )

        provider = identity_model.get_provider()
        assert provider.name == "Dummy"
        assert provider.key == "dummy"
