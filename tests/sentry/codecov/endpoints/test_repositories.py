from typing import Any
from unittest.mock import Mock, patch

from django.urls import reverse

from sentry.codecov.endpoints.Repositories.serializers import (
    RepositoryNodeSerializer as NodeSerializer,
)
from sentry.testutils.cases import APITestCase


class RepositoriesEndpointTest(APITestCase):
    endpoint = "sentry-api-0-repositories"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)

    def reverse_url(self, owner="testowner"):
        """Custom reverse URL method to handle required URL parameters"""
        return reverse(
            self.endpoint,
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "owner": owner,
            },
        )

    @patch("sentry.codecov.endpoints.Repositories.repositories.CodecovApiClient")
    def test_get_returns_mock_response_with_default_variables(self, mock_codecov_client_class):
        mock_graphql_response: dict[str, Any] = {
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
                    }
                }
            }
        }
        mock_codecov_client_instance = Mock()
        mock_response = Mock()
        mock_response.json.return_value = mock_graphql_response
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

        serializer_fields = set(NodeSerializer().fields.keys())
        response_keys = set(response.data["results"][0].keys())

        assert (
            response_keys == serializer_fields
        ), f"Response keys {response_keys} don't match serializer fields {serializer_fields}"

    @patch("sentry.codecov.endpoints.Repositories.repositories.CodecovApiClient")
    def test_get_with_query_parameters(self, mock_codecov_client_class):
        mock_graphql_response: dict[str, Any] = {
            "data": {
                "owner": {
                    "repositories": {
                        "edges": [],
                    }
                }
            }
        }
        mock_codecov_client_instance = Mock()
        mock_response = Mock()
        mock_response.json.return_value = mock_graphql_response
        mock_codecov_client_instance.query.return_value = mock_response
        mock_codecov_client_class.return_value = mock_codecov_client_instance

        url = self.reverse_url()
        query_params = {
            "term": "search-term",
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
            "first": 50,
            "last": None,
            "after": None,
            "before": None,
        }

        call_args = mock_codecov_client_instance.query.call_args
        assert call_args[1]["variables"] == expected_variables
        assert response.status_code == 200

    @patch("sentry.codecov.endpoints.Repositories.repositories.CodecovApiClient")
    def test_get_with_last_parameter(self, mock_codecov_client_class):
        mock_codecov_client_instance = Mock()
        mock_response = Mock()
        mock_response.json.return_value = {
            "data": {
                "owner": {
                    "repositories": {
                        "edges": [],
                    }
                }
            }
        }
        mock_codecov_client_instance.query.return_value = mock_response
        mock_codecov_client_class.return_value = mock_codecov_client_instance

        url = self.reverse_url()
        query_params = {"last": "5"}
        response = self.client.get(url, query_params)

        # Verify the correct variables are passed with last parameter
        expected_variables = {
            "owner": "testowner",
            "filters": {
                "term": None,
            },
            "direction": "DESC",
            "ordering": "COMMIT_DATE",
            "first": None,
            "last": 5,
            "after": None,
            "before": None,
        }

        call_args = mock_codecov_client_instance.query.call_args
        assert call_args[1]["variables"] == expected_variables
        assert response.status_code == 200
