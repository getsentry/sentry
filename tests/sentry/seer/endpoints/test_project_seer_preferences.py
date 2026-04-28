from unittest.mock import MagicMock, Mock, patch

from django.urls import reverse

from sentry.models.repository import Repository
from sentry.seer.models.project_repository import SeerProjectRepository
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.features import with_feature


class ProjectSeerPreferencesEndpointTest(APITestCase):
    endpoint = "sentry-api-0-project-seer-preferences"

    def setUp(self) -> None:
        super().setUp()
        self.user = self.create_user(email="user@example.com")
        self.org = self.create_organization(owner=self.user)
        self.team = self.create_team(organization=self.org)
        self.project = self.create_project(teams=[self.team], organization=self.org)
        self.login_as(user=self.user)

        self.url = reverse(
            self.endpoint,
            kwargs={
                "organization_id_or_slug": self.org.slug,
                "project_id_or_slug": self.project.slug,
            },
        )
        self.repository = self.create_repo(
            project=self.project,
            name="getsentry/sentry",
            provider="github",
            external_id="123456",
        )

    @patch(
        "sentry.seer.endpoints.project_seer_preferences.get_autofix_repos_from_project_code_mappings",
        return_value=[
            {
                "integration_id": "111",
                "provider": "github",
                "owner": "getsentry",
                "name": "sentry",
                "external_id": "123456",
            }
        ],
    )
    def test_get(self, mock_get_autofix_repos: MagicMock) -> None:
        """Test that the GET method reads the preference  and returns it alongside code-mapping repos."""
        SeerProjectRepository.objects.create(project=self.project, repository=self.repository)

        response = self.client.get(self.url)

        assert response.status_code == 200
        preference = response.data["preference"]
        assert preference["project_id"] == self.project.id
        assert preference["organization_id"] == self.org.id
        assert len(preference["repositories"]) == 1
        assert preference["repositories"][0]["external_id"] == "123456"
        assert preference["repositories"][0]["name"] == "sentry"
        assert len(response.data["code_mapping_repos"]) == 1
        assert response.data["code_mapping_repos"][0]["external_id"] == "123456"
        assert response.data["code_mapping_repos"][0]["name"] == "sentry"

    @patch("sentry.seer.endpoints.project_seer_preferences.make_set_project_preference_request")
    def test_post(self, mock_request: MagicMock) -> None:
        """Test that the POST method correctly calls the SEER API and returns the response"""
        mock_response = Mock()
        mock_response.status = 200
        mock_request.return_value = mock_response

        # Request data
        request_data = {
            "repositories": [
                {
                    "organization_id": self.org.id,
                    "integration_id": "111",
                    "provider": "github",
                    "owner": "getsentry",
                    "name": "sentry",
                    "external_id": "123456",
                    "branch_name": "main",
                    "instructions": "test instructions",
                }
            ]
        }

        # Make the request
        response = self.client.post(self.url, data=request_data)

        # Assert the response
        assert response.status_code == 204

        # Assert that the mock was called with the correct arguments
        mock_request.assert_called_once()
        body_dict = mock_request.call_args[0][0]

        # Verify the request body contains the expected data
        assert "preference" in body_dict
        preference = body_dict["preference"]
        assert preference["organization_id"] == self.org.id
        assert preference["project_id"] == self.project.id
        assert len(preference["repositories"]) == 1
        assert preference["repositories"][0]["integration_id"] == "111"
        assert preference["repositories"][0]["provider"] == "github"
        assert preference["repositories"][0]["owner"] == "getsentry"
        assert preference["repositories"][0]["name"] == "sentry"
        assert preference["repositories"][0]["instructions"] == "test instructions"
        assert preference["repositories"][0]["branch_name"] == "main"

    @patch("sentry.seer.endpoints.project_seer_preferences.make_set_project_preference_request")
    def test_invalid_request_data(self, mock_request: MagicMock) -> None:
        """Test handling of invalid request data"""
        # Request with invalid data (missing required fields)
        request_data = {
            "repositories": [
                {
                    # Missing required 'provider' and 'integration_id' fields
                    "owner": "getsentry",
                    "name": "sentry",
                }
            ]
        }

        # Make the request
        response = self.client.post(self.url, data=request_data)

        # Should fail with a 400 error for invalid request data
        assert response.status_code == 400

        # The request to Seer should not be called since validation fails
        mock_request.assert_not_called()

    @patch(
        "sentry.seer.endpoints.project_seer_preferences.get_autofix_repos_from_project_code_mappings",
        return_value=[],
    )
    def test_get_no_seer_project_repositories(self, mock_get_autofix_repos: MagicMock) -> None:
        """Test that GET method returns empty repositories when the project has no SeerProjectRepository rows."""
        response = self.client.get(self.url)

        assert response.status_code == 200
        preference = response.data["preference"]
        assert preference["project_id"] == self.project.id
        assert preference["repositories"] == []
        assert preference["automation_handoff"] is None
        assert response.data["code_mapping_repos"] == []

    @patch("sentry.seer.endpoints.project_seer_preferences.make_set_project_preference_request")
    def test_post_with_blank_string_fields(self, mock_request: MagicMock) -> None:
        """Test that optional fields accept blank strings (empty strings) not just null values"""
        # Setup the mock
        mock_response = Mock()
        mock_response.status = 200
        mock_request.return_value = mock_response

        # Request data with blank strings for optional fields
        request_data = {
            "repositories": [
                {
                    "organization_id": self.org.id,
                    "integration_id": "111",
                    "provider": "github",
                    "owner": "getsentry",
                    "name": "sentry",
                    "external_id": "123456",
                    "branch_name": "",  # blank string
                    "instructions": "",  # blank string
                }
            ]
        }

        # Make the request
        response = self.client.post(self.url, data=request_data)

        # Assert the response is successful
        assert response.status_code == 204

        # Assert that the mock was called
        mock_request.assert_called_once()

    @patch("sentry.seer.endpoints.project_seer_preferences.make_set_project_preference_request")
    def test_post_with_automation_handoff(self, mock_request: MagicMock) -> None:
        """Test that POST request correctly handles automation_handoff field"""
        # Setup the mock
        mock_response = Mock()
        mock_response.status = 200
        mock_request.return_value = mock_response

        # Request data with automation_handoff
        request_data = {
            "repositories": [
                {
                    "organization_id": self.org.id,
                    "integration_id": "111",
                    "provider": "github",
                    "owner": "getsentry",
                    "name": "sentry",
                    "external_id": "123456",
                }
            ],
            "automation_handoff": {
                "handoff_point": "root_cause",
                "target": "cursor_background_agent",
                "integration_id": 123,
            },
        }

        # Make the request
        response = self.client.post(self.url, data=request_data)

        # Assert the response is successful
        assert response.status_code == 204

        # Assert that the mock was called
        mock_request.assert_called_once()
        body_dict = mock_request.call_args[0][0]

        # Verify the request body contains automation_handoff
        assert "preference" in body_dict
        preference = body_dict["preference"]
        assert "automation_handoff" in preference
        assert preference["automation_handoff"]["handoff_point"] == "root_cause"
        assert preference["automation_handoff"]["target"] == "cursor_background_agent"

    @patch("sentry.seer.endpoints.project_seer_preferences.make_set_project_preference_request")
    def test_post_with_null_automation_handoff(self, mock_request: MagicMock) -> None:
        """Test that POST request correctly handles null automation_handoff"""
        # Setup the mock
        mock_response = Mock()
        mock_response.status = 200
        mock_request.return_value = mock_response

        # Request data with null automation_handoff
        request_data = {
            "repositories": [
                {
                    "organization_id": self.org.id,
                    "integration_id": "111",
                    "provider": "github",
                    "owner": "getsentry",
                    "name": "sentry",
                    "external_id": "123456",
                }
            ],
            "automation_handoff": None,
        }

        # Make the request
        response = self.client.post(self.url, data=request_data)

        # Assert the response is successful
        assert response.status_code == 204

        # Assert that the mock was called
        mock_request.assert_called_once()
        body_dict = mock_request.call_args[0][0]

        # Verify the request body has null automation_handoff
        assert body_dict["preference"]["automation_handoff"] is None

    @patch("sentry.seer.endpoints.project_seer_preferences.make_set_project_preference_request")
    def test_post_with_invalid_automation_handoff_target(self, mock_request: MagicMock) -> None:
        """Test that POST request fails with invalid target value"""
        # Request data with invalid target
        request_data = {
            "repositories": [
                {
                    "organization_id": self.org.id,
                    "integration_id": "111",
                    "provider": "github",
                    "owner": "getsentry",
                    "name": "sentry",
                    "external_id": "123456",
                }
            ],
            "automation_handoff": {
                "handoff_point": "root_cause",
                "target": "invalid_target",
                "integration_id": 123,
            },
        }

        # Make the request
        response = self.client.post(self.url, data=request_data)

        # Should fail with a 400 error for invalid request data
        assert response.status_code == 400

        # The post to Seer should not be called since validation fails
        mock_request.assert_not_called()

    @patch(
        "sentry.seer.endpoints.project_seer_preferences.get_autofix_repos_from_project_code_mappings",
        return_value=[],
    )
    def test_get_with_automation_handoff(self, mock_get_autofix_repos: MagicMock) -> None:
        """Test that GET method correctly returns automation_handoff."""
        self.project.update_option("sentry:seer_automation_handoff_point", "root_cause")
        self.project.update_option(
            "sentry:seer_automation_handoff_target", "cursor_background_agent"
        )
        self.project.update_option("sentry:seer_automation_handoff_integration_id", 123)

        response = self.client.get(self.url)

        assert response.status_code == 200
        handoff = response.data["preference"]["automation_handoff"]
        assert handoff["handoff_point"] == "root_cause"
        assert handoff["target"] == "cursor_background_agent"
        assert handoff["integration_id"] == 123

    @patch("sentry.seer.endpoints.project_seer_preferences.make_set_project_preference_request")
    def test_post_with_auto_create_pr_in_handoff_config(self, mock_request: MagicMock) -> None:
        """Test that POST request correctly handles auto_create_pr in automation_handoff"""
        # Setup the mock
        mock_response = Mock()
        mock_response.status = 200
        mock_request.return_value = mock_response

        # Request data with automation_handoff including auto_create_pr
        request_data = {
            "repositories": [
                {
                    "organization_id": self.org.id,
                    "integration_id": "111",
                    "provider": "github",
                    "owner": "getsentry",
                    "name": "sentry",
                    "external_id": "123456",
                }
            ],
            "automation_handoff": {
                "handoff_point": "root_cause",
                "target": "cursor_background_agent",
                "integration_id": 123,
                "auto_create_pr": True,
            },
        }

        # Make the request
        response = self.client.post(self.url, data=request_data)

        # Assert the response is successful
        assert response.status_code == 204

        # Assert that the mock was called
        mock_request.assert_called_once()
        body_dict = mock_request.call_args[0][0]

        # Verify the request body contains auto_create_pr in automation_handoff
        assert "preference" in body_dict
        preference = body_dict["preference"]
        assert "automation_handoff" in preference
        assert preference["automation_handoff"]["auto_create_pr"] is True

    @patch(
        "sentry.seer.endpoints.project_seer_preferences.get_autofix_repos_from_project_code_mappings",
        return_value=[],
    )
    def test_get_returns_auto_create_pr_in_handoff_config(
        self, mock_get_autofix_repos: MagicMock
    ) -> None:
        """Test that GET method correctly returns auto_create_pr in automation_handoff."""
        self.project.update_option("sentry:seer_automation_handoff_point", "root_cause")
        self.project.update_option(
            "sentry:seer_automation_handoff_target", "cursor_background_agent"
        )
        self.project.update_option("sentry:seer_automation_handoff_integration_id", 123)
        self.project.update_option("sentry:seer_automation_handoff_auto_create_pr", True)

        response = self.client.get(self.url)

        assert response.status_code == 200
        assert response.data["preference"]["automation_handoff"]["auto_create_pr"] is True

    @patch("sentry.seer.endpoints.project_seer_preferences.make_set_project_preference_request")
    def test_post_handoff_without_auto_create_pr_defaults_to_false(
        self, mock_request: MagicMock
    ) -> None:
        """Test that when auto_create_pr is not specified in handoff, it defaults to False"""
        # Setup the mock
        mock_response = Mock()
        mock_response.status = 200
        mock_request.return_value = mock_response

        # Request data with automation_handoff but without auto_create_pr
        request_data = {
            "repositories": [
                {
                    "organization_id": self.org.id,
                    "integration_id": "111",
                    "provider": "github",
                    "owner": "getsentry",
                    "name": "sentry",
                    "external_id": "123456",
                }
            ],
            "automation_handoff": {
                "handoff_point": "root_cause",
                "target": "cursor_background_agent",
                "integration_id": 123,
            },
        }

        # Make the request
        response = self.client.post(self.url, data=request_data)

        # Assert the response is successful
        assert response.status_code == 204

        # Assert that the mock was called
        mock_request.assert_called_once()
        body_dict = mock_request.call_args[0][0]

        # Verify the request body contains auto_create_pr defaulted to False
        assert "preference" in body_dict
        preference = body_dict["preference"]
        assert "automation_handoff" in preference
        assert preference["automation_handoff"]["auto_create_pr"] is False

    @patch("sentry.seer.endpoints.project_seer_preferences.make_set_project_preference_request")
    def test_post_validates_repository_exists_in_organization(
        self, mock_request: MagicMock
    ) -> None:
        """Test that POST validates repository exists in the organization"""
        Repository.objects.create(
            organization_id=self.org.id,
            name="getsentry/sentry",
            provider="integrations:github",
            external_id="valid-external-id",
        )

        mock_response = Mock()
        mock_response.status = 200
        mock_request.return_value = mock_response

        request_data = {
            "repositories": [
                {
                    "organization_id": self.org.id,
                    "integration_id": "111",
                    "provider": "integrations:github",
                    "owner": "getsentry",
                    "name": "sentry",
                    "external_id": "valid-external-id",
                }
            ],
        }

        response = self.client.post(self.url, data=request_data)

        assert response.status_code == 204
        mock_request.assert_called_once()

    @patch("sentry.seer.endpoints.project_seer_preferences.make_set_project_preference_request")
    def test_post_rejects_repository_not_in_organization(self, mock_request: MagicMock) -> None:
        """Test that POST fails when repository doesn't exist in the organization"""
        request_data = {
            "repositories": [
                {
                    "organization_id": self.org.id,
                    "integration_id": "111",
                    "provider": "integrations:github",
                    "owner": "getsentry",
                    "name": "sentry",
                    "external_id": "nonexistent-repo-id",
                }
            ],
        }

        response = self.client.post(self.url, data=request_data)

        assert response.status_code == 400
        assert response.data["detail"] == "Invalid repository"
        mock_request.assert_not_called()

    @patch("sentry.seer.endpoints.project_seer_preferences.make_set_project_preference_request")
    def test_post_rejects_repository_from_different_organization(
        self, mock_request: MagicMock
    ) -> None:
        """Test that POST fails when repository exists but belongs to a different organization"""
        other_org = self.create_organization(owner=self.user)
        Repository.objects.create(
            organization_id=other_org.id,
            name="other-org/repo",
            provider="integrations:github",
            external_id="other-org-repo-id",
        )

        request_data = {
            "repositories": [
                {
                    "organization_id": self.org.id,
                    "integration_id": "111",
                    "provider": "integrations:github",
                    "owner": "other-org",
                    "name": "repo",
                    "external_id": "other-org-repo-id",
                }
            ],
        }

        response = self.client.post(self.url, data=request_data)

        assert response.status_code == 400
        assert response.data["detail"] == "Invalid repository"
        mock_request.assert_not_called()

    @patch("sentry.seer.endpoints.project_seer_preferences.make_set_project_preference_request")
    def test_post_rejects_mismatched_organization_id_in_repository_data(
        self, mock_request: MagicMock
    ) -> None:
        """Test that POST fails when repository organization_id doesn't match project's org."""
        other_org = self.create_organization(owner=self.user)

        request_data = {
            "repositories": [
                {
                    "organization_id": other_org.id,
                    "integration_id": "111",
                    "provider": "github",
                    "owner": "getsentry",
                    "name": "sentry",
                    "external_id": "123456",
                }
            ],
        }

        response = self.client.post(self.url, data=request_data)

        assert response.status_code == 400
        assert response.data["detail"] == "Invalid repository"
        mock_request.assert_not_called()

    @patch("sentry.seer.endpoints.project_seer_preferences.make_set_project_preference_request")
    def test_post_rejects_mismatched_repo_name_or_owner(self, mock_request: MagicMock) -> None:
        """Test that POST fails when repository name/owner don't match the database record."""
        request_data = {
            "repositories": [
                {
                    "organization_id": self.org.id,
                    "integration_id": "111",
                    "provider": "github",
                    "owner": "injected-owner",
                    "name": "injected-name",
                    "external_id": "123456",
                }
            ],
        }

        response = self.client.post(self.url, data=request_data)

        assert response.status_code == 400
        assert response.data["detail"] == "Invalid repository"
        mock_request.assert_not_called()

    @patch("sentry.seer.endpoints.project_seer_preferences.make_set_project_preference_request")
    def test_post_rejects_unsupported_repo_provider(self, mock_request: MagicMock) -> None:
        request_data = {
            "repositories": [
                {
                    "organization_id": self.org.id,
                    "integration_id": "111",
                    "provider": "gitlab",
                    "owner": "getsentry",
                    "name": "sentry",
                    "external_id": "123456",
                }
            ],
        }

        response = self.client.post(self.url, data=request_data)

        assert response.status_code == 400
        mock_request.assert_not_called()

    @with_feature("organizations:seer-project-settings-dual-write")
    @patch("sentry.seer.endpoints.project_seer_preferences.write_preference_to_sentry_db")
    @patch("sentry.seer.endpoints.project_seer_preferences.make_set_project_preference_request")
    def test_post_writes_to_sentry_db(
        self, mock_request: MagicMock, mock_write_db: MagicMock
    ) -> None:
        """When feature flag enabled, writes to Sentry DB instead of Seer API."""
        mock_response = Mock()
        mock_response.status = 200
        mock_request.return_value = mock_response

        request_data = {
            "repositories": [
                {
                    "organization_id": self.org.id,
                    "integration_id": "111",
                    "provider": "github",
                    "owner": "getsentry",
                    "name": "sentry",
                    "external_id": "123456",
                    "branch_name": "main",
                    "instructions": "test instructions",
                }
            ],
            "automated_run_stopping_point": "open_pr",
        }

        response = self.client.post(self.url, data=request_data)

        assert response.status_code == 204

        mock_write_db.assert_called_once()
