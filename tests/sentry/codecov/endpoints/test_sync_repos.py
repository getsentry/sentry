from unittest.mock import ANY, Mock, patch

import pytest
from django.urls import reverse

from sentry.codecov.endpoints.sync_repos.serializers import SyncReposSerializer
from sentry.testutils.cases import APITestCase


class SyncReposEndpointTest(APITestCase):
    endpoint_name = "sentry-api-0-repositories-sync"

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

    def reverse_url(self):
        """Custom reverse URL method to handle required URL parameters"""
        return reverse(
            self.endpoint_name,
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "owner": self.integration.id,
            },
        )

    @patch("sentry.codecov.endpoints.sync_repos.sync_repos.CodecovApiClient")
    def test_post_calls_api(self, mock_codecov_client_class) -> None:
        """Test that starts repository sync process"""
        mock_graphql_response = {
            "data": {
                "syncRepos": {
                    "isSyncing": True,
                }
            }
        }

        mock_codecov_client_instance = Mock()
        mock_response = Mock()
        mock_response.json.return_value = mock_graphql_response
        mock_codecov_client_instance.query.return_value = mock_response
        mock_codecov_client_class.return_value = mock_codecov_client_instance

        url = self.reverse_url()
        response = self.client.post(url, data={})

        mock_codecov_client_class.assert_called_once_with(git_provider_org="testowner")
        mock_codecov_client_instance.query.assert_called_once_with(query=ANY, variables={})
        assert response.status_code == 200
        assert response.data["isSyncing"] is True

    @patch("sentry.codecov.endpoints.sync_repos.sync_repos.CodecovApiClient")
    def test_get_calls_api(self, mock_codecov_client_class) -> None:
        """Test that gets sync status"""
        mock_graphql_response = {
            "data": {
                "me": {
                    "isSyncing": True,
                }
            }
        }

        mock_codecov_client_instance = Mock()
        mock_response = Mock()
        mock_response.json.return_value = mock_graphql_response
        mock_codecov_client_instance.query.return_value = mock_response
        mock_codecov_client_class.return_value = mock_codecov_client_instance

        url = self.reverse_url()
        response = self.client.get(url, data={})

        mock_codecov_client_class.assert_called_once_with(git_provider_org="testowner")
        mock_codecov_client_instance.query.assert_called_once_with(query=ANY, variables={})
        assert response.status_code == 200
        assert response.data["isSyncing"] is True

    @patch("sentry.codecov.endpoints.sync_repos.serializers.sentry_sdk.capture_exception")
    @patch("sentry.codecov.endpoints.sync_repos.serializers.logger.exception")
    def test_serializer_exception_handling(self, mock_logger, mock_capture_exception):
        malformed_response = {"wrong_key": "value"}

        serializer = SyncReposSerializer(context={"http_method": "POST"})

        with pytest.raises(KeyError):
            serializer.to_representation(malformed_response)

        mock_capture_exception.assert_called_once()
        mock_logger.assert_called_once()
