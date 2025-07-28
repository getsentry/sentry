from unittest.mock import ANY, Mock, patch

from django.urls import reverse

from sentry.testutils.cases import APITestCase


class RepositoryTokenRegenerateEndpointTest(APITestCase):
    endpoint_name = "sentry-api-0-repository-token-regenerate"

    def setUp(self) -> None:
        super().setUp()
        self.user = self.create_user(email="user@example.com")
        self.organization = self.create_organization(owner=self.user)
        self.integration = self.create_integration(
            organization=self.organization,
            external_id="1234",
            name="testowner",
            provider="github",
        )
        self.login_as(user=self.user)

    def reverse_url(self, owner="testowner", repository="testrepo"):
        """Custom reverse URL method to handle required URL parameters"""
        return reverse(
            self.endpoint_name,
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "owner": self.integration.id,
                "repository": repository,
            },
        )

    @patch(
        "sentry.codecov.endpoints.repository_token_regenerate.repository_token_regenerate.CodecovApiClient"
    )
    def test_post_with_codecov_param_calls_api(self, mock_codecov_client_class):
        """Test that when use_codecov param is provided, it calls the Codecov API"""
        mock_graphql_response = {
            "data": {
                "regenerateRepositoryUploadToken": {
                    "token": "codecov-generated-token-12345",
                }
            }
        }

        mock_codecov_client_instance = Mock()
        mock_response = Mock()
        mock_response.json.return_value = mock_graphql_response
        mock_codecov_client_instance.query.return_value = mock_response
        mock_codecov_client_class.return_value = mock_codecov_client_instance

        url = self.reverse_url()
        response = self.client.post(url, data={}, QUERY_STRING="use_codecov=true")

        mock_codecov_client_class.assert_called_once_with(git_provider_org="testowner")
        mock_codecov_client_instance.query.assert_called_once_with(
            query=ANY,
            variables={
                "owner": "testowner",
                "repoName": "testrepo",
            },
        )
        assert response.status_code == 200
        assert response.data["token"] == "codecov-generated-token-12345"

    @patch(
        "sentry.codecov.endpoints.repository_token_regenerate.repository_token_regenerate.CodecovApiClient"
    )
    def test_post_without_codecov_param_returns_uuid(self, mock_codecov_client_class):
        """Test that when use_codecov param is not provided, it returns a generic UUID and doesn't call Codecov"""
        url = self.reverse_url()
        response = self.client.post(url)

        assert response.status_code == 200
        assert response.data["token"]

        # Verify Codecov client was not called
        mock_codecov_client_class.assert_not_called()

    @patch(
        "sentry.codecov.endpoints.repository_token_regenerate.repository_token_regenerate.CodecovApiClient"
    )
    def test_post_with_codecov_param_handles_errors(self, mock_codecov_client_class):
        """Test that GraphQL errors are properly handled when calling Codecov API"""
        mock_graphql_response = {
            "data": {
                "regenerateRepositoryUploadToken": {
                    "error": "Repository not found",
                }
            }
        }

        mock_codecov_client_instance = Mock()
        mock_response = Mock()
        mock_response.json.return_value = mock_graphql_response
        mock_codecov_client_instance.query.return_value = mock_response
        mock_codecov_client_class.return_value = mock_codecov_client_instance

        url = self.reverse_url()
        response = self.client.post(url, data={}, QUERY_STRING="use_codecov=true")

        assert response.status_code == 400  # ValidationError should return 400
