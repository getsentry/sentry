from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import control_silo_test
from sentry.utils import jwt


@control_silo_test
class OrganizationIntercomJwtEndpointTest(APITestCase):
    endpoint = "sentry-api-0-organization-intercom-jwt"

    def setUp(self) -> None:
        self.login_as(self.user)

    def test_get_jwt_without_feature_flag(self) -> None:
        """Without the feature flag, the endpoint should return 403."""
        response = self.get_response(self.organization.slug)
        assert response.status_code == 403
        assert response.data["detail"] == "Intercom support is not enabled for this organization."

    def test_get_jwt_without_secret_configured(self) -> None:
        """Without the secret configured, the endpoint should return 503."""
        with self.feature("organizations:intercom-support"):
            response = self.get_response(self.organization.slug)

        assert response.status_code == 503
        assert response.data["detail"] == "Intercom identity verification is not configured."

    def test_get_jwt_success(self) -> None:
        """With feature flag and secret configured, should return JWT and user data."""
        test_secret = "test-intercom-secret-key"

        with (
            self.feature("organizations:intercom-support"),
            self.options({"intercom.sentry-api-secret": test_secret}),
        ):
            response = self.get_success_response(self.organization.slug)

        assert "jwt" in response.data
        assert "userData" in response.data

        # Verify user data
        user_data = response.data["userData"]
        assert user_data["userId"] == str(self.user.id)
        assert user_data["email"] == self.user.email
        assert user_data["organizationId"] == str(self.organization.id)
        assert user_data["organizationName"] == self.organization.name
        assert "createdAt" in user_data

        # Verify JWT can be decoded with the secret
        token = response.data["jwt"]
        decoded = jwt.decode(token, test_secret, algorithms=["HS256"], audience=False)

        assert decoded["user_id"] == str(self.user.id)
        assert decoded["email"] == self.user.email
        assert "iat" in decoded
        assert "exp" in decoded

    def test_get_jwt_unauthenticated(self) -> None:
        """Unauthenticated requests should return 401."""
        self.client.logout()
        response = self.get_response(self.organization.slug)
        assert response.status_code == 401
