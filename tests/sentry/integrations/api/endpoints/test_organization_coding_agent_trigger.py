from unittest.mock import patch

from sentry.testutils.cases import APITestCase


class OrganizationCodingAgentTriggerTest(APITestCase):
    endpoint = "sentry-api-0-organization-coding-agent-trigger"

    def setUp(self):
        super().setUp()
        self.login_as(self.user)

        # Create a cursor integration
        self.integration = self.create_provider_integration(
            provider="cursor",
            name="Cursor Agent",
            external_id="cursor",
            metadata={
                "api_key": "test_api_key_123",
                "domain_name": "cursor.sh",
            },
        )

        self.org_integration = self.integration.add_organization(self.organization, self.user)

    def test_get_coding_agent_integrations(self):
        """Test GET endpoint returns coding agent integrations."""
        response = self.get_success_response(self.organization.slug)

        assert len(response.data) == 1
        integration_data = response.data[0]

        assert integration_data["id"] == str(self.integration.id)
        assert integration_data["name"] == "Cursor Agent"
        assert integration_data["provider"] == "cursor"
        assert integration_data["status"] == "active"
        assert integration_data["metadata"]["domain_name"] == "cursor.sh"
        assert integration_data["metadata"]["has_api_key"] is True
        assert "webhook_url" in integration_data

    def test_get_no_coding_agent_integrations(self):
        """Test GET endpoint with no coding agent integrations."""
        # Remove the cursor integration
        self.org_integration.delete()

        response = self.get_success_response(self.organization.slug)
        assert len(response.data) == 0

    @patch("sentry.integrations.cursor.client.CursorAgentClient.launch")
    def test_post_launch_coding_agent(self, mock_launch):
        """Test POST endpoint launches coding agent."""
        mock_launch.return_value = {"status": "launched", "session_id": "test_123"}

        data = {
            "integration_id": str(self.integration.id),
            "context": {"event": "test_event"},
            "project_id": self.project.id,
        }

        response = self.get_success_response(self.organization.slug, method="post", **data)

        assert response.data["status"] == "launched"
        assert response.data["integration_id"] == str(self.integration.id)
        assert response.data["provider"] == "cursor"
        assert "webhook_url" in response.data
        assert "result" in response.data

        # Verify launch was called with correct parameters
        mock_launch.assert_called_once()
        call_args = mock_launch.call_args
        assert "webhook_url" in call_args.kwargs
        assert call_args.kwargs["context"] == {"event": "test_event"}
        assert call_args.kwargs["project_id"] == self.project.id

    def test_post_missing_integration_id(self):
        """Test POST endpoint with missing integration_id."""
        response = self.get_error_response(self.organization.slug, method="post", status_code=400)

        assert response.data["error"] == "integration_id is required"

    def test_post_invalid_integration_id(self):
        """Test POST endpoint with invalid integration_id."""
        data = {"integration_id": "invalid_id"}

        response = self.get_error_response(
            self.organization.slug, method="post", status_code=404, **data
        )

        assert response.data["error"] == "Integration not found"

    def test_post_non_coding_agent_integration(self):
        """Test POST endpoint with non-coding agent integration."""
        # Create a non-coding agent integration (e.g., GitHub)
        github_integration = self.create_provider_integration(
            provider="github",
            name="GitHub",
            external_id="github:123",
        )
        github_integration.add_organization(self.organization, self.user)

        data = {"integration_id": str(github_integration.id)}

        response = self.get_error_response(
            self.organization.slug, method="post", status_code=400, **data
        )

        assert response.data["error"] == "Not a coding agent integration"

    @patch("sentry.integrations.cursor.client.CursorAgentClient.launch")
    def test_post_launch_with_all_parameters(self, mock_launch):
        """Test POST endpoint with all launch parameters."""
        mock_launch.return_value = {"status": "launched"}

        data = {
            "integration_id": str(self.integration.id),
            "context": {"error": "test error", "stacktrace": "..."},
            "project_id": self.project.id,
            "event_id": "event_123",
            "issue_id": "issue_456",
        }

        response = self.get_success_response(self.organization.slug, method="post", **data)

        assert response.data["status"] == "launched"

        # Verify all parameters were passed to launch
        mock_launch.assert_called_once()
        call_args = mock_launch.call_args
        assert call_args.kwargs["context"] == {"error": "test error", "stacktrace": "..."}
        assert call_args.kwargs["project_id"] == self.project.id
        assert call_args.kwargs["event_id"] == "event_123"
        assert call_args.kwargs["issue_id"] == "issue_456"

    @patch("sentry.integrations.cursor.client.CursorAgentClient.launch")
    def test_post_launch_exception_handling(self, mock_launch):
        """Test POST endpoint handles launch exceptions."""
        mock_launch.side_effect = Exception("API Error")

        data = {"integration_id": str(self.integration.id)}

        response = self.get_error_response(
            self.organization.slug, method="post", status_code=500, **data
        )

        assert "Failed to launch coding agent" in response.data["error"]
