import jwt

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
        provider = self.auth_provider.get_provider()
        user_id = "test-user-123"
        user_email = "test@example.com"
        user_name = "Test User"

        token_payload = {
            "user_id": user_id,
            "user_email": user_email,
            "user_name": user_name,
        }
        id_token = jwt.encode(token_payload, "dummy-secret", algorithm="HS256")

        # state dict that matches what OAuth2CallbackView would create
        state = {
            "data": {
                "id_token": id_token,
                "access_token": "dummy-access-token",
                "token_type": "Bearer",
            }
        }

        result = provider.build_identity(state)

        assert result == {
            "type": "vercel",
            "id": user_id,
            "email": user_email,
            "name": user_name,
            "data": provider.get_oauth_data(state["data"]),
            "email_verified": True,
        }
