from typing import Any
from unittest.mock import MagicMock, Mock, patch

from django.urls import reverse

from sentry.codecov.endpoints.repositories.serializers import (
    RepositoryNodeSerializer as NodeSerializer,
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
                            "updatedAt": "2025-05-22T16:21:18.763951+00:00",
                            "latestCommitAt": "2025-05-21T16:21:18.763951+00:00",
                            "defaultBranch": "branch-one",
                        }
                    },
                    {
                        "node": {
                            "name": "test-repo-one",
                            "updatedAt": "2025-05-22T16:21:18.763951+00:00",
                            "latestCommitAt": "2025-05-21T16:21:18.763951+00:00",
                            "defaultBranch": "branch-one",
                        }
                    },
                ],
                "pageInfo": {
                    "endCursor": "cursor123",
                    "hasNextPage": False,
                    "hasPreviousPage": False,
                    "startCursor": None,
                },
            }
        }
    }
}

mock_graphql_response_empty: dict[str, Any] = {
    "data": {
        "owner": {
            "repositories": {
                "edges": [],
            }
        }
    }
}


class RepositoriesEndpointTest(APITestCase):
    endpoint_name = "sentry-api-0-repositories"

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

    @patch("sentry.codecov.endpoints.repositories.repositories.CodecovApiClient")
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
            "filters": {
                "term": None,
            },
            "direction": "DESC",
            "ordering": "COMMIT_DATE",
            "first": 50,
            "last": None,
            "after": None,
            "before": None,
        }

        mock_codecov_client_instance.query.assert_called_once()
        call_args = mock_codecov_client_instance.query.call_args
        assert call_args[1]["variables"] == expected_variables

        assert response.status_code == 200
        assert len(response.data["results"]) == 2
        assert response.data["pageInfo"]["endCursor"] == "cursor123"
        assert response.data["pageInfo"]["hasNextPage"] is False
        assert response.data["pageInfo"]["hasPreviousPage"] is False
        assert response.data["pageInfo"]["startCursor"] is None
        assert response.data["totalCount"] == 2

        serializer_fields = set(NodeSerializer().fields.keys())
        response_keys = set(response.data["results"][0].keys())

        assert response_keys == serializer_fields, (
            f"Response keys {response_keys} don't match serializer fields {serializer_fields}"
        )

    @patch("sentry.codecov.endpoints.repositories.repositories.CodecovApiClient")
    def test_get_with_query_parameters(self, mock_codecov_client_class: MagicMock) -> None:
        mock_codecov_client_instance = Mock()
        mock_response = Mock()
        mock_response.json.return_value = mock_graphql_response_empty
        mock_codecov_client_instance.query.return_value = mock_response
        mock_codecov_client_class.return_value = mock_codecov_client_instance

        url = self.reverse_url()
        query_params = {
            "term": "search-term",
            "limit": "3",
        }
        response = self.client.get(url, query_params)

        # Verify the correct variables are passed with custom query parameters
        expected_variables = {
            "owner": "testowner",
            "filters": {
                "term": "search-term",
            },
            "direction": "DESC",
            "ordering": "COMMIT_DATE",
            "first": 3,
            "last": None,
            "after": None,
            "before": None,
        }

        call_args = mock_codecov_client_instance.query.call_args
        assert call_args[1]["variables"] == expected_variables
        assert response.status_code == 200

    @patch("sentry.codecov.endpoints.repositories.repositories.CodecovApiClient")
    def test_get_with_cursor_and_direction(self, mock_codecov_client_class: MagicMock) -> None:
        mock_codecov_client_instance = Mock()
        mock_response = Mock()
        mock_response.json.return_value = mock_graphql_response_empty
        mock_codecov_client_instance.query.return_value = mock_response
        mock_codecov_client_class.return_value = mock_codecov_client_instance

        url = self.reverse_url()
        query_params = {"cursor": "cursor123", "limit": "10", "navigation": "prev"}
        response = self.client.get(url, query_params)

        expected_variables = {
            "owner": "testowner",
            "filters": {
                "term": None,
            },
            "direction": "DESC",
            "ordering": "COMMIT_DATE",
            "first": None,
            "last": 10,
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

    def test_get_with_limit_as_string_returns_bad_request(self) -> None:
        url = self.reverse_url()
        query_params = {"limit": "asdf"}
        response = self.client.get(url, query_params)

        assert response.status_code == 400
        assert response.data == {"details": "provided `limit` parameter must be a positive integer"}
