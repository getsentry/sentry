import base64
from unittest.mock import MagicMock, patch

from django.test.utils import override_settings

from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers import with_feature
from sentry.testutils.silo import region_silo_test
from tests.sentry.utils.test_jwt import RS256_KEY

RS256_KEY_B64 = base64.b64encode(RS256_KEY.encode()).decode()


@region_silo_test
class OrganizationConduitDemoEndpointTest(APITestCase):
    endpoint = "sentry-api-0-organization-conduit-demo"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)

    @override_settings(
        CONDUIT_GATEWAY_PRIVATE_KEY=RS256_KEY_B64,
        CONDUIT_GATEWAY_JWT_ISSUER="sentry",
        CONDUIT_GATEWAY_JWT_AUDIENCE="conduit",
        CONDUIT_GATEWAY_URL="https://conduit.example.com",
    )
    @with_feature("organizations:conduit-demo")
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

    @override_settings(
        CONDUIT_GATEWAY_PRIVATE_KEY=RS256_KEY_B64,
        CONDUIT_GATEWAY_JWT_ISSUER="sentry",
        CONDUIT_GATEWAY_JWT_AUDIENCE="conduit",
        CONDUIT_GATEWAY_URL="https://conduit.example.com",
    )
    @with_feature("organizations:conduit-demo")
    def test_post_member_can_access(self) -> None:
        """Test that members can generate credentials."""
        member_user = self.create_user(is_superuser=False)
        self.create_member(
            user=member_user,
            organization=self.organization,
            role="member",
            teams=[],
        )
        self.login_as(member_user)

        response = self.get_success_response(
            self.organization.slug,
            method="POST",
            status_code=201,
        )

        assert "conduit" in response.data
        assert "token" in response.data["conduit"]
        assert "channel_id" in response.data["conduit"]

    @with_feature("organizations:conduit-demo")
    def test_post_without_org_access(self) -> None:
        """Test that users without org access cannot generate credentials."""
        other_org = self.create_organization()

        self.get_error_response(
            other_org.slug,
            method="POST",
            status_code=403,
        )

    @with_feature("organizations:conduit-demo")
    def test_post_missing_conduit_config(self) -> None:
        """Test graceful failure when CONDUIT_PRIVATE_KEY is not configured."""
        response = self.get_error_response(
            self.organization.slug,
            method="POST",
            status_code=500,
        )

        assert response.data == {"error": "Conduit is not configured properly"}

    @override_settings(
        CONDUIT_GATEWAY_PRIVATE_KEY=RS256_KEY_B64,
        CONDUIT_GATEWAY_JWT_ISSUER="sentry",
        CONDUIT_GATEWAY_JWT_AUDIENCE="conduit",
        CONDUIT_GATEWAY_URL="https://conduit.example.com",
    )
    @with_feature("organizations:conduit-demo")
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

    @override_settings(
        CONDUIT_GATEWAY_PRIVATE_KEY=RS256_KEY_B64,
        CONDUIT_GATEWAY_JWT_ISSUER="sentry",
        CONDUIT_GATEWAY_JWT_AUDIENCE="conduit",
        CONDUIT_GATEWAY_URL="https://conduit.example.com",
    )
    @patch("sentry.conduit.endpoints.organization_conduit_demo.stream_demo_data")
    @with_feature("organizations:conduit-demo")
    def test_post_queues_task(self, mock_task: MagicMock):
        self.get_success_response(
            self.organization.slug,
            method="POST",
            status_code=201,
        )
        mock_task.delay.assert_called_once()

    def test_post_without_feature_flag(self) -> None:
        self.get_error_response(
            self.organization.slug,
            method="POST",
            status_code=404,
        )
