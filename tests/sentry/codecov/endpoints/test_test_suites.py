from typing import int, Any
from unittest.mock import ANY, MagicMock, Mock, patch

from django.urls import reverse

from sentry.testutils.cases import APITestCase

mock_graphql_response_populated: dict[str, Any] = {
    "data": {
        "owner": {
            "repository": {
                "testAnalytics": {"testSuites": ["suite-1", "another-2", "suite-3"]},
            }
        }
    }
}

mock_graphql_response_empty: dict[str, Any] = {
    "data": {"owner": {"repository": {"testAnalytics": {"testSuites": []}}}}
}


class TestSuitesEndpointTest(APITestCase):
    endpoint_name = "sentry-api-0-test-suites"

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

    @patch("sentry.codecov.endpoints.test_suites.test_suites.CodecovApiClient")
    def test_get_returns_mock_response(self, mock_codecov_client_class: MagicMock) -> None:
        mock_codecov_client_instance = Mock()
        mock_response = Mock()
        mock_response.json.return_value = mock_graphql_response_populated
        mock_codecov_client_instance.query.return_value = mock_response
        mock_codecov_client_class.return_value = mock_codecov_client_instance

        url = self.reverse_url()
        response = self.client.get(url)

        mock_codecov_client_class.assert_called_once_with(git_provider_org="testowner")

        assert mock_codecov_client_instance.query.call_count == 1
        assert response.status_code == 200

        assert response.data["testSuites"] == ["suite-1", "another-2", "suite-3"]

    @patch("sentry.codecov.endpoints.test_suites.test_suites.CodecovApiClient")
    def test_get_with_interval_query_param(self, mock_codecov_client_class: MagicMock) -> None:
        mock_codecov_client_instance = Mock()
        mock_response = Mock()
        mock_response.json.return_value = mock_graphql_response_populated
        mock_codecov_client_instance.query.return_value = mock_response
        mock_codecov_client_class.return_value = mock_codecov_client_instance

        url = self.reverse_url()
        response = self.client.get(url, {"term": "suite-1"})

        assert response.status_code == 200
        mock_codecov_client_class.assert_called_once_with(git_provider_org="testowner")
        mock_codecov_client_instance.query.assert_called_once_with(
            query=ANY,
            variables={
                "owner": "testowner",
                "repo": "testrepo",
                "term": "suite-1",
            },
        )
