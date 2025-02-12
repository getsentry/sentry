from sentry.auth.partnership_configs import ChannelName
from sentry.models.authprovider import AuthProvider
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test
class VercelOAuth2ProviderTest(APITestCase):
    def setUp(self):
        super().setUp()
        self.auth_provider: AuthProvider = AuthProvider.objects.create(
            provider=ChannelName.VERCEL.value, organization_id=self.organization.id
        )

    def test_build_config(self):
        provider = self.auth_provider.get_provider()
        resource = {"id": "test-org", "role": "member"}
        result = provider.build_config(resource=resource)
        assert result == {"org": {"id": "test-org"}}

    def test_build_identity(self):
        # TODO: implement when we get final confirmation from Vercel which claims are going to be present in the id_token
        pass
