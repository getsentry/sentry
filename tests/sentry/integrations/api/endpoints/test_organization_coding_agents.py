from unittest.mock import Mock

from sentry import features
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
        
        # Mock the integration service
        mock_org_integration = Mock()
        mock_org_integration.id = 1
        mock_org_integration.status = 1  # ObjectStatus.ACTIVE
        
        mock_integration = Mock()
        mock_integration.id = 1
        mock_integration.name = "Test Coding Agent"
        mock_integration.provider = "test_provider"
        mock_integration.metadata = {"api_key": "test_key", "domain_name": "test.example.com"}
        
        mock_installation = Mock()
        mock_installation.get_webhook_url.return_value = "https://example.com/webhook/"
        
        mock_integration.get_installation.return_value = mock_installation
        
        from sentry.integrations.services.integration import integration_service
        
        with (
            self.feature({"organizations:seer-coding-agent-integrations": True}),
            self.mock_integration_service_calls(
                org_integrations=[mock_org_integration],
                integration=mock_integration
            )
        ):
            response = self.get_response(organization.slug)

        assert response.status_code == 200
        integrations = response.data["integrations"]
        assert len(integrations) == 1
        
        integration_data = integrations[0]
        assert integration_data["id"] == "1"
        assert integration_data["name"] == "Test Coding Agent"
        assert integration_data["provider"] == "test_provider"
        assert integration_data["status"] == "active"
        assert integration_data["metadata"]["has_api_key"] is True
        assert integration_data["metadata"]["domain_name"] == "test.example.com"
        assert integration_data["webhook_url"] == "https://example.com/webhook/"

    def mock_integration_service_calls(self, org_integrations=None, integration=None):
        """Helper to mock integration service calls."""
        import contextlib
        from unittest.mock import patch
        
        org_integrations = org_integrations or []
        
        @contextlib.contextmanager 
        def mock_context():
            with (
                patch.object(
                    integration_service, 
                    'get_organization_integrations',
                    return_value=org_integrations
                ),
                patch.object(
                    integration_service,
                    'get_integration', 
                    return_value=integration
                ),
                patch('sentry.integrations.coding_agent.utils.get_coding_agent_providers', return_value=['test_provider'])
            ):
                yield
        
        return mock_context()