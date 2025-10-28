from django.test.utils import override_settings

from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import region_silo_test
from tests.sentry.utils.test_jwt import RS256_KEY


@region_silo_test
class OrganizationConduitDemoEndpointTest(APITestCase):
    endpoint = "sentry-api-0-organization-conduit-demo"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)

    @override_settings(
        CONDUIT_PRIVATE_KEY=RS256_KEY,
        CONDUIT_JWT_ISSUER="sentry",
        CONDUIT_JWT_AUDIENCE="conduit",
        CONDUIT_GATEWAY_URL="https://conduit.example.com",
    )
    def test_post_generate_credentials(self) -> None:
        """Test that POST generates valid credentials."""

        response = self.get_success_response(
            self.organization.slug,
            method="POST",
            status_code=201,
        )

        assert "conduit" in response.data
        assert "token" in response.data["conduit"]
        assert "channel_id" in response.data["conduit"]
        assert "url" in response.data["conduit"]
        assert str(self.organization.id) in response.data["conduit"]["url"]

    def test_post_without_org_access(self) -> None:
        """Test that users without org access cannot generate credentials."""
        other_org = self.create_organization()

        self.get_error_response(
            other_org.slug,
            method="POST",
            status_code=403,
        )

    def test_post_missing_conduit_config(self) -> None:
        """Test graceful failure when CONDUIT_PRIVATE_KEY is not configured."""
        response = self.get_error_response(
            self.organization.slug,
            method="POST",
            status_code=500,
        )

        assert response.data == {"error": "Conduit is not configured properly"}

    @override_settings(
        CONDUIT_PRIVATE_KEY=RS256_KEY,
        CONDUIT_JWT_ISSUER="sentry",
        CONDUIT_JWT_AUDIENCE="conduit",
        CONDUIT_GATEWAY_URL="https://conduit.example.com",
    )
    def test_credentials_are_unique(self) -> None:
        """Test that multiple calls generate different credentials."""
        response1 = self.get_success_response(
            self.organization.slug,
            method="POST",
            status_code=201,
        )

        response2 = self.get_success_response(
            self.organization.slug,
            method="POST",
            status_code=201,
        )

        assert response1.data["conduit"]["token"] != response2.data["conduit"]["token"]
        assert response1.data["conduit"]["channel_id"] != response2.data["conduit"]["channel_id"]
