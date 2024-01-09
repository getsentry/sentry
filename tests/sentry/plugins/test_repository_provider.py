from sentry.models.integrations.integration import Integration
from sentry.plugins.providers.dummy.repository import DummyRepositoryProvider
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test
from social_auth.models import UserSocialAuth


@control_silo_test
class RepositoryProviderTest(TestCase):
    def test_needs_auth_for_user(self):
        user = self.create_user()
        provider = DummyRepositoryProvider(id="dummy")

        # if no org is provided, user needs auth
        assert provider.needs_auth(user) is True

        UserSocialAuth.objects.create(provider="dummy", user=user)

        assert provider.needs_auth(user) is False

    def test_needs_auth_for_organization(self):
        user = self.create_user()
        provider = DummyRepositoryProvider(id="dummy")

        org = self.create_organization()
        integration = Integration.objects.create(provider="dummy", external_id="123456")
        integration.add_organization(org, user)

        assert provider.needs_auth(user, organization=org) is False

    def test_get_auth_for_user(self):
        user = self.create_user()
        provider = DummyRepositoryProvider(id="dummy")

        assert provider.get_auth(user) is None

        usa = UserSocialAuth.objects.create(provider="dummy", user=user)

        auth = provider.get_auth(user)
        assert auth
        assert auth.id == usa.id

    def test_get_auth_for_organization(self):
        user = self.create_user()
        user2 = self.create_user()
        provider = DummyRepositoryProvider(id="dummy")

        usa = UserSocialAuth.objects.create(provider="dummy", user=user2)

        org = self.create_organization()
        integration = Integration.objects.create(provider="dummy", external_id="123456")
        integration.add_organization(org, user, default_auth_id=usa.id)

        auth = provider.get_auth(user, organization=org)
        assert auth
        assert auth.id == usa.id
