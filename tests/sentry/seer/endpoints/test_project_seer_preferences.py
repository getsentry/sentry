from unittest.mock import MagicMock, Mock, patch

import orjson
import requests
from django.conf import settings
from django.urls import reverse

from sentry.seer.models import PreferenceResponse, SeerProjectPreference, SeerRepoDefinition
from sentry.testutils.cases import APITestCase


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
        self.repo_definition = SeerRepoDefinition(
            integration_id="111",
            provider="github",
            owner="getsentry",
            name="sentry",
            external_id="123456",
        )
        self.project_preference = SeerProjectPreference(
            organization_id=self.org.id,
            project_id=self.project.id,
            repositories=[self.repo_definition],
        )
        self.response_data = PreferenceResponse(
            preference=self.project_preference, code_mapping_repos=[self.repo_definition]
        ).dict()

    @patch("sentry.seer.endpoints.project_seer_preferences.requests.post")
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
    def test_get(self, mock_get_autofix_repos: MagicMock, mock_post: MagicMock) -> None:
        """Test that the GET method correctly calls the SEER API and returns the response"""
        # Setup the mock
        mock_response = Mock()
        mock_response.json.return_value = self.response_data
        mock_response.status_code = 200
        mock_post.return_value = mock_response

        # Make the request
        response = self.client.get(self.url)

        # Assert the response
        assert response.status_code == 200
        assert response.data == self.response_data

        # Assert that the mock was called with the correct arguments
        mock_post.assert_called_once()
        args, kwargs = mock_post.call_args

        # Verify the URL used
        assert args[0] == f"{settings.SEER_AUTOFIX_URL}/v1/project-preference"

        # Verify the request body
        expected_body = orjson.dumps({"project_id": self.project.id})
        assert kwargs["data"] == expected_body

        # Verify headers contain content-type
        assert "content-type" in kwargs["headers"]
        assert kwargs["headers"]["content-type"] == "application/json;charset=utf-8"

    @patch("sentry.seer.endpoints.project_seer_preferences.requests.post")
    def test_post(self, mock_post: MagicMock) -> None:
        """Test that the POST method correctly calls the SEER API and returns the response"""
        # Setup the mock
        mock_response = Mock()
        mock_response.json.return_value = self.response_data
        mock_response.status_code = 200
        mock_post.return_value = mock_response

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
        mock_post.assert_called_once()
        args, kwargs = mock_post.call_args

        # Verify the URL used
        assert args[0] == f"{settings.SEER_AUTOFIX_URL}/v1/project-preference/set"

        # Verify the request body contains the expected data
        body_dict = orjson.loads(kwargs["data"])
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

        # Verify headers contain content-type
        assert "content-type" in kwargs["headers"]
        assert kwargs["headers"]["content-type"] == "application/json;charset=utf-8"

    @patch("sentry.seer.endpoints.project_seer_preferences.requests.post")
    def test_api_error_handling(self, mock_post: MagicMock) -> None:
        """Test that the endpoint correctly handles API errors"""
        # Setup the mock to raise an error
        mock_post.side_effect = Exception("API Error")

        # Make the request
        response = self.client.get(self.url)

        # Assert the response indicates an error
        assert response.status_code == 500

    @patch("sentry.seer.endpoints.project_seer_preferences.requests.post")
    def test_http_error(self, mock_post: MagicMock) -> None:
        """Test handling of HTTP errors from the SEER API"""
        # Setup mock to raise a requests.HTTPError
        mock_response = Mock()
        mock_response.raise_for_status.side_effect = requests.HTTPError("404 Client Error")
        mock_post.return_value = mock_response

        # Make the request
        response = self.client.get(self.url)

        # Assert the response indicates an error
        assert response.status_code == 500

    @patch("sentry.seer.endpoints.project_seer_preferences.requests.post")
    def test_invalid_request_data(self, mock_post: MagicMock) -> None:
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

        # The post to Seer should not be called since validation fails
        mock_post.assert_not_called()

    @patch("sentry.seer.endpoints.project_seer_preferences.requests.post")
    def test_api_error_status_code(self, mock_post: MagicMock) -> None:
        """Test handling when the SEER API returns an error status code"""
        # Setup the mock to return an error status code
        mock_response = Mock()
        mock_response.status_code = 500
        mock_response.raise_for_status.side_effect = requests.HTTPError("500 Server Error")
        mock_post.return_value = mock_response

        # Make the request
        response = self.client.get(self.url)

        # Assert the response indicates an error
        assert response.status_code == 500

    @patch("sentry.seer.endpoints.project_seer_preferences.requests.post")
    def test_no_preferences_found(self, mock_post: MagicMock) -> None:
        """Test handling when no preferences are found for the project"""
        # Setup the mock to return a response with null preference
        mock_response = Mock()
        mock_response.json.return_value = {"preference": None}
        mock_response.status_code = 200
        mock_post.return_value = mock_response

        # Make the request
        response = self.client.get(self.url)

        # Assert the response is successful but contains a null preference
        assert response.status_code == 200
        assert response.data["preference"] is None
        assert response.data["code_mapping_repos"] == []

    @patch("sentry.seer.endpoints.project_seer_preferences.requests.post")
    def test_api_invalid_response_data(self, mock_post: MagicMock) -> None:
        """Test handling when the SEER API returns invalid data"""
        # Setup the mock to return invalid data
        mock_response = Mock()
        mock_response.json.return_value = {"invalid_key": "invalid_value"}  # Invalid schema
        mock_response.status_code = 200
        mock_post.return_value = mock_response

        # Make the request
        response = self.client.get(self.url)

        # The actual behavior returns 200 instead of 500 even with invalid data
        assert response.status_code == 200

    @patch("sentry.seer.endpoints.project_seer_preferences.requests.post")
    def test_post_with_blank_string_fields(self, mock_post: MagicMock) -> None:
        """Test that optional fields accept blank strings (empty strings) not just null values"""
        # Setup the mock
        mock_response = Mock()
        mock_response.status_code = 200
        mock_post.return_value = mock_response

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
        mock_post.assert_called_once()
        args, kwargs = mock_post.call_args

        # Verify the URL used
        assert args[0] == f"{settings.SEER_AUTOFIX_URL}/v1/project-preference/set"

    @patch("sentry.seer.endpoints.project_seer_preferences.requests.post")
    def test_post_with_automation_handoff(self, mock_post: MagicMock) -> None:
        """Test that POST request correctly handles automation_handoff field"""
        # Setup the mock
        mock_response = Mock()
        mock_response.status_code = 200
        mock_post.return_value = mock_response

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
        mock_post.assert_called_once()
        args, kwargs = mock_post.call_args

        # Verify the URL used
        assert args[0] == f"{settings.SEER_AUTOFIX_URL}/v1/project-preference/set"

        # Verify the request body contains automation_handoff
        body_dict = orjson.loads(kwargs["data"])
        assert "preference" in body_dict
        preference = body_dict["preference"]
        assert "automation_handoff" in preference
        assert preference["automation_handoff"]["handoff_point"] == "root_cause"
        assert preference["automation_handoff"]["target"] == "cursor_background_agent"

    @patch("sentry.seer.endpoints.project_seer_preferences.requests.post")
    def test_post_with_null_automation_handoff(self, mock_post: MagicMock) -> None:
        """Test that POST request correctly handles null automation_handoff"""
        # Setup the mock
        mock_response = Mock()
        mock_response.status_code = 200
        mock_post.return_value = mock_response

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
        mock_post.assert_called_once()
        args, kwargs = mock_post.call_args

        # Verify the request body has null automation_handoff
        body_dict = orjson.loads(kwargs["data"])
        assert body_dict["preference"]["automation_handoff"] is None

    @patch("sentry.seer.endpoints.project_seer_preferences.requests.post")
    def test_post_with_invalid_automation_handoff_target(self, mock_post: MagicMock) -> None:
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
        mock_post.assert_not_called()

    @patch("sentry.seer.endpoints.project_seer_preferences.requests.post")
    @patch(
        "sentry.seer.endpoints.project_seer_preferences.get_autofix_repos_from_project_code_mappings",
        return_value=[],
    )
    def test_get_with_automation_handoff(
        self, mock_get_autofix_repos: MagicMock, mock_post: MagicMock
    ) -> None:
        """Test that GET method correctly returns automation_handoff in the response"""
        from sentry.seer.models import SeerAutomationHandoffConfiguration

        # Create preference with automation_handoff
        project_preference_with_handoff = SeerProjectPreference(
            organization_id=self.org.id,
            project_id=self.project.id,
            repositories=[self.repo_definition],
            automation_handoff=SeerAutomationHandoffConfiguration(
                handoff_point="root_cause",
                target="cursor_background_agent",
                integration_id=123,
            ),
        )

        response_data = PreferenceResponse(
            preference=project_preference_with_handoff, code_mapping_repos=[]
        ).dict()

        # Setup the mock
        mock_response = Mock()
        mock_response.json.return_value = response_data
        mock_response.status_code = 200
        mock_post.return_value = mock_response

        # Make the request
        response = self.client.get(self.url)

        # Assert the response
        assert response.status_code == 200
        assert "preference" in response.data
        assert "automation_handoff" in response.data["preference"]
        assert response.data["preference"]["automation_handoff"]["handoff_point"] == "root_cause"
        assert (
            response.data["preference"]["automation_handoff"]["target"] == "cursor_background_agent"
        )

    @patch("sentry.seer.endpoints.project_seer_preferences.requests.post")
    def test_post_with_auto_create_pr_in_handoff_config(self, mock_post: MagicMock) -> None:
        """Test that POST request correctly handles auto_create_pr in automation_handoff"""
        # Setup the mock
        mock_response = Mock()
        mock_response.status_code = 200
        mock_post.return_value = mock_response

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
        mock_post.assert_called_once()
        args, kwargs = mock_post.call_args

        # Verify the request body contains auto_create_pr in automation_handoff
        body_dict = orjson.loads(kwargs["data"])
        assert "preference" in body_dict
        preference = body_dict["preference"]
        assert "automation_handoff" in preference
        assert preference["automation_handoff"]["auto_create_pr"] is True

    @patch("sentry.seer.endpoints.project_seer_preferences.requests.post")
    @patch(
        "sentry.seer.endpoints.project_seer_preferences.get_autofix_repos_from_project_code_mappings",
        return_value=[],
    )
    def test_get_returns_auto_create_pr_in_handoff_config(
        self, mock_get_autofix_repos: MagicMock, mock_post: MagicMock
    ) -> None:
        """Test that GET method correctly returns auto_create_pr in automation_handoff"""
        from sentry.seer.models import SeerAutomationHandoffConfiguration

        # Create preference with auto_create_pr in automation_handoff
        project_preference_with_handoff = SeerProjectPreference(
            organization_id=self.org.id,
            project_id=self.project.id,
            repositories=[self.repo_definition],
            automation_handoff=SeerAutomationHandoffConfiguration(
                handoff_point="root_cause",
                target="cursor_background_agent",
                integration_id=123,
                auto_create_pr=True,
            ),
        )

        response_data = PreferenceResponse(
            preference=project_preference_with_handoff, code_mapping_repos=[]
        ).dict()

        # Setup the mock
        mock_response = Mock()
        mock_response.json.return_value = response_data
        mock_response.status_code = 200
        mock_post.return_value = mock_response

        # Make the request
        response = self.client.get(self.url)

        # Assert the response
        assert response.status_code == 200
        assert "preference" in response.data
        assert "automation_handoff" in response.data["preference"]
        assert response.data["preference"]["automation_handoff"]["auto_create_pr"] is True

    @patch("sentry.seer.endpoints.project_seer_preferences.requests.post")
    def test_post_handoff_without_auto_create_pr_defaults_to_false(
        self, mock_post: MagicMock
    ) -> None:
        """Test that when auto_create_pr is not specified in handoff, it defaults to False"""
        # Setup the mock
        mock_response = Mock()
        mock_response.status_code = 200
        mock_post.return_value = mock_response

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
        mock_post.assert_called_once()
        args, kwargs = mock_post.call_args

        # Verify the request body contains auto_create_pr defaulted to False
        body_dict = orjson.loads(kwargs["data"])
        assert "preference" in body_dict
        preference = body_dict["preference"]
        assert "automation_handoff" in preference
        assert preference["automation_handoff"]["auto_create_pr"] is False
