from unittest.mock import Mock

from sentry.testutils.cases import APITestCase


class OrganizationCodingAgentsEndpointTest(APITestCase):
    endpoint = "sentry-api-0-organization-coding-agents"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)

    def test_get_feature_flag_disabled(self):
        """Test GET request when feature flag is disabled."""
        organization = self.create_organization(owner=self.user)

        with self.feature({"organizations:seer-coding-agent-integrations": False}):
            response = self.get_response(organization.slug)

        assert response.status_code == 404
        assert response.data["detail"] == "Feature not available"

    def test_get_no_integrations(self):
        """Test GET request with no coding agent integrations."""
        organization = self.create_organization(owner=self.user)

        with self.feature({"organizations:seer-coding-agent-integrations": True}):
            response = self.get_response(organization.slug)

        assert response.status_code == 200
        assert response.data["integrations"] == []

    def test_get_with_mock_integration(self):
        """Test GET request with mocked coding agent integration."""
        organization = self.create_organization(owner=self.user)

        mock_integration = Mock()
        mock_integration.id = 1
        mock_integration.name = "Test Coding Agent"
        mock_integration.provider = "test_provider"

        with (
            self.feature({"organizations:seer-coding-agent-integrations": True}),
            self.mock_integration_service_calls(integrations=[mock_integration]),
        ):
            response = self.get_response(organization.slug)

        assert response.status_code == 200
        integrations = response.data["integrations"]
        assert len(integrations) == 1

        integration_data = integrations[0]
        assert integration_data["id"] == "1"
        assert integration_data["name"] == "Test Coding Agent"
        assert integration_data["provider"] == "test_provider"

    def mock_integration_service_calls(self, integrations=None):
        """Helper to mock integration service calls."""
        import contextlib
        from unittest.mock import patch

        from sentry.integrations.services.integration import integration_service

        integrations = integrations or []

        @contextlib.contextmanager
        def mock_context():
            with (
                patch.object(
                    integration_service,
                    "get_integrations",
                    return_value=integrations,
                ),
                patch(
                    "sentry.integrations.coding_agent.utils.get_coding_agent_providers",
                    return_value=["test_provider"],
                ),
            ):
                yield

        return mock_context()
