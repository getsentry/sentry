from typing import Any
from unittest.mock import Mock, patch

from django.urls import reverse

from sentry.codecov.endpoints.Branches.serializers import BranchNodeSerializer as NodeSerializer
from sentry.testutils.cases import APITestCase

mock_graphql_response_populated: dict[str, Any] = {
    "data": {
        "owner": {
            "repository": {
                "branches": {
                    "edges": [
                        {
                            "node": {
                                "name": "main",
                            }
                        },
                        {
                            "node": {
                                "name": "random branch",
                            }
                        },
                    ],
                }
            }
        }
    }
}

mock_graphql_response_empty: dict[str, Any] = {
    "data": {
        "owner": {
            "repository": {
                "branches": {
                    "edges": [],
                }
            }
        }
    }
}


class BranchesEndpointTest(APITestCase):
    endpoint = "sentry-api-0-branches"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)

    def reverse_url(self, owner="testowner", repository="testrepo"):
        """Custom reverse URL method to handle required URL parameters"""
        return reverse(
            self.endpoint,
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "owner": owner,
                "repository": repository,
            },
        )

    @patch("sentry.codecov.endpoints.Branches.branches.CodecovApiClient")
    def test_get_returns_mock_response_with_default_variables(self, mock_codecov_client_class):
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
            "repo": "testrepo",
            "filters": {
                "searchValue": None,
            },
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

    @patch("sentry.codecov.endpoints.Branches.branches.CodecovApiClient")
    def test_get_with_query_parameters(self, mock_codecov_client_class):
        mock_codecov_client_instance = Mock()
        mock_response = Mock()
        mock_response.json.return_value = mock_graphql_response_empty
        mock_codecov_client_instance.query.return_value = mock_response
        mock_codecov_client_class.return_value = mock_codecov_client_instance

        url = self.reverse_url()
        query_params = {
            "term": "search-term",
            "first": "3",
        }
        response = self.client.get(url, query_params)

        # Verify the correct variables are passed with custom query parameters
        expected_variables = {
            "owner": "testowner",
            "repo": "testrepo",
            "filters": {
                "searchValue": "search-term",
            },
            "first": 3,
            "last": None,
            "after": None,
            "before": None,
        }

        call_args = mock_codecov_client_instance.query.call_args
        assert call_args[1]["variables"] == expected_variables
        assert response.status_code == 200

    @patch("sentry.codecov.endpoints.Branches.branches.CodecovApiClient")
    def test_get_with_last_parameter(self, mock_codecov_client_class):
        mock_codecov_client_instance = Mock()
        mock_response = Mock()
        mock_response.json.return_value = mock_graphql_response_empty
        mock_codecov_client_instance.query.return_value = mock_response
        mock_codecov_client_class.return_value = mock_codecov_client_instance

        url = self.reverse_url()
        query_params = {"last": "5"}
        response = self.client.get(url, query_params)

        # Verify the correct variables are passed with last parameter
        expected_variables = {
            "owner": "testowner",
            "repo": "testrepo",
            "filters": {
                "searchValue": None,
            },
            "first": None,
            "last": 5,
            "after": None,
            "before": None,
        }

        call_args = mock_codecov_client_instance.query.call_args
        assert call_args[1]["variables"] == expected_variables
        assert response.status_code == 200

    def test_when_first_is_not_integer_returns_bad_request(self):
        """Test that providing first as a non numerical string value returns a 400 Bad Request error"""
        url = self.reverse_url()
        query_params = {"first": "abc"}
        response = self.client.get(url, query_params)

        assert response.status_code == 400
        assert response.data == {"details": "Query parameters 'first' and 'last' must be integers."}

    def test_when_both_first_and_last_returns_bad_request(self):
        """Test that providing both first and last parameters returns a 400 Bad Request error"""
        url = self.reverse_url()
        query_params = {"first": "10", "last": "5"}
        response = self.client.get(url, query_params)

        assert response.status_code == 400
        assert response.data == {"details": "Cannot specify both `first` and `last`"}
