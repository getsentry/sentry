from typing import int, Any
from unittest.mock import MagicMock, Mock, patch

from django.urls import reverse

from sentry.codecov.endpoints.repository_tokens.serializers import (
    RepositoryTokenNodeSerializer as NodeSerializer,
)
from sentry.constants import ObjectStatus
from sentry.testutils.cases import APITestCase

mock_graphql_response_populated: dict[str, Any] = {
    "data": {
        "owner": {
            "repositories": {
                "edges": [
                    {
                        "node": {
                            "name": "test-repo-one",
                            "token": "sk_test_token_12345abcdef",
                        }
                    },
                    {
                        "node": {
                            "name": "test-repo-two",
                            "token": "sk_test_token_67890ghijkl",
                        }
                    },
                ],
                "pageInfo": {
                    "endCursor": "cursor123",
                    "hasNextPage": True,
                    "hasPreviousPage": False,
                    "startCursor": "cursor001",
                },
                "totalCount": 2,
            }
        }
    }
}

mock_graphql_response_empty: dict[str, Any] = {
    "data": {
        "owner": {
            "repositories": {
                "edges": [],
                "pageInfo": {
                    "endCursor": None,
                    "hasNextPage": False,
                    "hasPreviousPage": False,
                    "startCursor": None,
                },
                "totalCount": 0,
            }
        }
    }
}


class RepositoryTokensEndpointTest(APITestCase):
    endpoint_name = "sentry-api-0-repository-tokens"

    def setUp(self) -> None:
        super().setUp()
        self.organization = self.create_organization(owner=self.user)
        self.integration = self.create_integration(
            organization=self.organization,
            external_id="1234",
            name="testowner",
            provider="github",
            status=ObjectStatus.ACTIVE,
        )
        self.login_as(user=self.user)

    def reverse_url(self, owner="testowner"):
        """Custom reverse URL method to handle required URL parameters"""
        return reverse(
            self.endpoint_name,
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "owner": self.integration.id,
            },
        )

    @patch("sentry.codecov.endpoints.repository_tokens.repository_tokens.CodecovApiClient")
    def test_get_returns_mock_response_with_default_variables(
        self, mock_codecov_client_class: MagicMock
    ) -> None:
        mock_codecov_client_instance = Mock()
        mock_response = Mock()
        mock_response.json.return_value = mock_graphql_response_populated
        mock_codecov_client_instance.query.return_value = mock_response
        mock_codecov_client_class.return_value = mock_codecov_client_instance

        url = self.reverse_url()
        response = self.client.get(url)

        mock_codecov_client_class.assert_called_once_with(git_provider_org="testowner")

        # Verify the correct variables are passed to the GraphQL query
        expected_variables = {
            "owner": "testowner",
            "direction": "DESC",
            "ordering": "COMMIT_DATE",
            "first": 25,
            "last": None,
            "after": None,
            "before": None,
        }

        mock_codecov_client_instance.query.assert_called_once()
        call_args = mock_codecov_client_instance.query.call_args
        assert call_args[1]["variables"] == expected_variables

        assert response.status_code == 200
        assert len(response.data["results"]) == 2
        assert response.data["results"][0]["name"] == "test-repo-one"
        assert response.data["results"][0]["token"] == "sk_test_token_12345abcdef"
        assert response.data["results"][1]["name"] == "test-repo-two"
        assert response.data["results"][1]["token"] == "sk_test_token_67890ghijkl"
        assert response.data["pageInfo"]["endCursor"] == "cursor123"
        assert response.data["pageInfo"]["hasNextPage"] is True
        assert response.data["pageInfo"]["hasPreviousPage"] is False
        assert response.data["pageInfo"]["startCursor"] == "cursor001"
        assert response.data["totalCount"] == 2

        serializer_fields = set(NodeSerializer().fields.keys())
        response_keys = set(response.data["results"][0].keys())

        assert (
            response_keys == serializer_fields
        ), f"Response keys {response_keys} don't match serializer fields {serializer_fields}"

    @patch("sentry.codecov.endpoints.repository_tokens.repository_tokens.CodecovApiClient")
    def test_get_with_query_parameters(self, mock_codecov_client_class: MagicMock) -> None:
        mock_codecov_client_instance = Mock()
        mock_response = Mock()
        mock_response.json.return_value = mock_graphql_response_empty
        mock_codecov_client_instance.query.return_value = mock_response
        mock_codecov_client_class.return_value = mock_codecov_client_instance

        url = self.reverse_url()
        query_params = {
            "cursor": "cursor123",
            "limit": "5",
            "navigation": "prev",
            "sortBy": "-NAME",
        }
        response = self.client.get(url, query_params)

        expected_variables = {
            "owner": "testowner",
            "direction": "DESC",
            "ordering": "NAME",
            "first": None,
            "last": 5,
            "before": "cursor123",
            "after": None,
        }

        call_args = mock_codecov_client_instance.query.call_args
        assert call_args[1]["variables"] == expected_variables
        assert response.status_code == 200

    def test_get_with_negative_limit_returns_bad_request(self) -> None:
        url = self.reverse_url()
        query_params = {"limit": "-5"}
        response = self.client.get(url, query_params)

        assert response.status_code == 400
        assert response.data == {"details": "provided `limit` parameter must be a positive integer"}

    def test_get_with_zero_limit_returns_bad_request(self) -> None:
        url = self.reverse_url()
        query_params = {"limit": "0"}
        response = self.client.get(url, query_params)

        assert response.status_code == 400
        assert response.data == {"details": "provided `limit` parameter must be a positive integer"}

    def test_get_with_invalid_sort_field_returns_bad_request(self) -> None:
        """Test that invalid sort fields return 400 error."""
        url = self.reverse_url()
        query_params = {"sortBy": "INVALID_FIELD"}
        response = self.client.get(url, query_params)

        assert response.status_code == 400
        assert response.data == {
            "details": "Invalid sortBy parameter. Allowed values: COMMIT_DATE, NAME"
        }
