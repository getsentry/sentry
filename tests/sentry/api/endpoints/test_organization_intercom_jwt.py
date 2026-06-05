from sentry.api.endpoints.organization_intercom_jwt import get_intercom_user_id
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import control_silo_test
from sentry.utils import jwt


@control_silo_test
class OrganizationIntercomJwtEndpointTest(APITestCase):
    endpoint = "sentry-api-0-organization-intercom-jwt"

    def setUp(self) -> None:
        self.login_as(self.user)

    def test_get_jwt_success(self) -> None:
        """With secret configured, should return JWT and user data."""
        test_secret = "test-intercom-secret-key"

        with self.options({"intercom.sentry-api-secret": test_secret}):
            response = self.get_success_response(self.organization.slug)

        assert "jwt" in response.data
        assert "userData" in response.data

        # Verify user data
        expected_user_id = get_intercom_user_id(self.user.id, self.organization.id)
        user_data = response.data["userData"]
        assert user_data["userId"] == expected_user_id
        assert user_data["email"] == self.user.email
        assert user_data["organizationId"] == str(self.organization.id)
        assert user_data["organizationName"] == self.organization.name
        assert "createdAt" in user_data

        # Verify JWT can be decoded with the secret
        token = response.data["jwt"]
        decoded = jwt.decode(token, test_secret, algorithms=["HS256"], audience=False)

        assert decoded["user_id"] == expected_user_id
        assert decoded["email"] == self.user.email
        assert "iat" in decoded
        assert "exp" in decoded

    def test_get_jwt_user_id_is_scoped_to_organization(self) -> None:
        test_secret = "test-intercom-secret-key"
        other_organization = self.create_organization(owner=self.user)

        with self.options({"intercom.sentry-api-secret": test_secret}):
            response = self.get_success_response(self.organization.slug)
            other_response = self.get_success_response(other_organization.slug)

        user_id = response.data["userData"]["userId"]
        other_user_id = other_response.data["userData"]["userId"]

        assert user_id == get_intercom_user_id(self.user.id, self.organization.id)
        assert other_user_id == get_intercom_user_id(self.user.id, other_organization.id)
        assert user_id != other_user_id

        decoded = jwt.decode(
            response.data["jwt"], test_secret, algorithms=["HS256"], audience=False
        )
        other_decoded = jwt.decode(
            other_response.data["jwt"], test_secret, algorithms=["HS256"], audience=False
        )

        assert decoded["user_id"] == user_id
        assert other_decoded["user_id"] == other_user_id

    def test_get_jwt_unauthenticated(self) -> None:
        """Unauthenticated requests should return 401."""
        self.client.logout()
        response = self.get_response(self.organization.slug)
        assert response.status_code == 401
