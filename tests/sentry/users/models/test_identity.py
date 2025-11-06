from sentry.identity import register
from sentry.identity.providers.dummy import DummyProvider
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers import override_options
from sentry.testutils.silo import control_silo_test
from sentry.users.models.identity import Identity


@control_silo_test
class IdentityTestCase(TestCase):
    def test_get_provider(self) -> None:
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

    def test_link_identity_for_demo_users(self) -> None:
        user = self.create_user()
        idp = self.create_identity_provider(type="dummy", external_id="1234")

        # if the setting is disabled, the identity should be linked even for demo users
        with override_options({"demo-mode.enabled": True, "demo-mode.users": [user.id]}):
            assert Identity.objects.link_identity(user, idp, "1234") is not None

        # if the setting is enabled, the identity should not be linked for demo users
        with override_options(
            {
                "identity.prevent-link-identity-for-demo-users.enabled": True,
                "demo-mode.enabled": True,
                "demo-mode.users": [user.id],
            }
        ):
            assert Identity.objects.link_identity(user, idp, "1234") is None

        # if the setting is enabled, the identity should still be linked for non-demo users
        with override_options(
            {
                "identity.prevent-link-identity-for-demo-users.enabled": True,
                "demo-mode.enabled": True,
            }
        ):
            assert Identity.objects.link_identity(user, idp, "1234") is not None
