from unittest.mock import patch

from rest_framework import status

from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.features import with_feature


@with_feature("organizations:gen-ai-explore-traces")
@with_feature("organizations:gen-ai-features")
class TraceExplorerAIQueryTest(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)
        self.organization = self.create_organization(owner=self.user)
        self.project = self.create_project(organization=self.organization)
        self.url = f"/api/0/organizations/{self.organization.slug}/trace-explorer-ai/query/"

    @patch("sentry.seer.endpoints.trace_explorer_ai_query.send_translate_request")
    @patch("django.conf.settings.SEER_AUTOFIX_URL", "https://seer.example.com")
    def test_query_successful(self, mock_send_request) -> None:
        mock_send_request.return_value = {
            "responses": [
                {
                    "query": "transaction.duration:>1000",
                    "stats_period": "14d",
                    "group_by": ["transaction"],
                    "visualization": [],
                    "sort": "-count()",
                    "mode": "spans",
                }
            ],
            "unsupported_reason": None,
        }

        response = self.client.post(
            self.url,
            data={
                "project_ids": [self.project.id],
                "natural_language_query": "Find slow transactions",
                "limit": 1,
            },
            format="json",
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.data["status"] == "ok"
        assert len(response.data["queries"]) == 1
        assert response.data["queries"][0]["query"] == "transaction.duration:>1000"

        mock_send_request.assert_called_once_with(
            self.organization.id,
            self.organization.slug,
            [self.project.id],
            "Find slow transactions",
        )

    def test_query_missing_parameters(self) -> None:
        response = self.client.post(
            self.url,
            data={
                "project_ids": [],
                "natural_language_query": "",
            },
            format="json",
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "Missing one or more required parameters" in response.data["detail"]

    @patch("sentry.seer.endpoints.trace_explorer_ai_query.send_translate_request")
    @patch("django.conf.settings.SEER_AUTOFIX_URL", "https://seer.example.com")
    def test_empty_project_ids_with_valid_query(self, mock_send_request) -> None:
        """Test that empty project_ids list is rejected even with valid query."""
        mock_send_request.return_value = {
            "responses": [],
            "unsupported_reason": None,
        }

        response = self.client.post(
            self.url,
            data={
                "project_ids": [],
                "natural_language_query": "Find slow transactions",
            },
            format="json",
        )

        # Should return 400 because project_ids is empty
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "Missing one or more required parameters" in response.data["detail"]
        mock_send_request.assert_not_called()

    @patch("sentry.seer.endpoints.trace_explorer_ai_query.send_translate_request")
    @patch("django.conf.settings.SEER_AUTOFIX_URL", "https://seer.example.com")
    def test_cross_organization_access_denied(self, mock_send_request) -> None:
        """
        Test that a user from one organization cannot query projects from another organization.
        """
        # Configure mock to return valid data structure to prevent serialization hang
        mock_send_request.return_value = {
            "responses": [],
            "unsupported_reason": None,
        }

        # Create a completely separate organization with its own user and project
        other_org = self.create_organization(name="Other Organization")
        other_user = self.create_user(email="other@example.com")
        self.create_member(organization=other_org, user=other_user, role="owner")

        # Login as the user from the OTHER organization
        self.login_as(user=other_user)

        # Try to query a project from self.organization using other_org's URL
        other_org_url = f"/api/0/organizations/{other_org.slug}/trace-explorer-ai/query/"
        response = self.client.post(
            other_org_url,
            data={
                "project_ids": [self.project.id],  # Project from different org!
                "natural_language_query": "Find slow transactions",
                "limit": 1,
            },
            format="json",
        )

        # The organization permission check happens before get_projects(),
        # so cross-org access is denied at the permission level with 403
        assert response.status_code == status.HTTP_403_FORBIDDEN, (
            f"Expected 403 Forbidden for cross-org access. "
            f"Got status {response.status_code}. Response: {response.data}"
        )

        # Verify Seer was not called with cross-org project access
        mock_send_request.assert_not_called()
