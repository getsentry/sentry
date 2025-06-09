from unittest.mock import Mock, patch

from django.urls import reverse

from sentry.codecov.endpoints.TestResults.serializers import (
    TestResultNodeSerializer as NodeSerializer,
)
from sentry.testutils.cases import APITestCase


class TestResultsEndpointTest(APITestCase):
    endpoint = "sentry-api-0-test-results"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)

    def reverse_url(self, owner="testowner", repository="testrepo"):
        """Custom reverse URL method to handle required URL parameters"""
        return reverse(
            self.endpoint,
            kwargs={
                "owner": owner,
                "repository": repository,
            },
        )

    @patch("sentry.codecov.endpoints.TestResults.test_results.CodecovApiClient")
    def test_get_returns_mock_response(self, mock_codecov_client_class):
        mock_graphql_response = {
            "data": {
                "owner": {
                    "repository": {
                        "__typename": "Repository",
                        "testAnalytics": {
                            "testResults": {
                                "edges": [
                                    {
                                        "node": {
                                            "updatedAt": "2025-05-22T16:21:18.763951+00:00",
                                            "avgDuration": 0.04066228070175437,
                                            "lastDuration": 0.04066228070175437,
                                            "name": "../usr/local/lib/python3.13/site-packages/asgiref/sync.py::GetFinalYamlInteractorTest::test_when_commit_has_no_yaml",
                                            "failureRate": 0.0,
                                            "flakeRate": 0.0,
                                            "commitsFailed": 0,
                                            "totalFailCount": 0,
                                            "totalFlakyFailCount": 0,
                                            "totalSkipCount": 0,
                                            "totalPassCount": 70,
                                        }
                                    },
                                    {
                                        "node": {
                                            "updatedAt": "2025-05-22T16:21:18.763961+00:00",
                                            "avgDuration": 0.034125877192982455,
                                            "lastDuration": 0.034125877192982455,
                                            "name": "../usr/local/lib/python3.13/site-packages/asgiref/sync.py::GetFinalYamlInteractorTest::test_when_commit_has_yaml",
                                            "failureRate": 0.0,
                                            "flakeRate": 0.0,
                                            "commitsFailed": 0,
                                            "totalFailCount": 0,
                                            "totalFlakyFailCount": 0,
                                            "totalSkipCount": 0,
                                            "totalPassCount": 70,
                                        }
                                    },
                                ],
                                "pageInfo": {"endCursor": "cursor123", "hasNextPage": False},
                                "totalCount": 2,
                            }
                        },
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

        mock_codecov_client_class.assert_called_once_with(git_provider_org="codecov")
        assert mock_codecov_client_instance.query.call_count == 1
        assert response.status_code == 200

        assert len(response.data["results"]) == 2

        assert response.data["pageInfo"]["endCursor"] == "cursor123"
        assert response.data["pageInfo"]["hasNextPage"] is False
        assert response.data["totalCount"] == 2

        serializer_fields = set(NodeSerializer().fields.keys())
        response_keys = set(response.data["results"][0].keys())

        assert (
            response_keys == serializer_fields
        ), f"Response keys {response_keys} don't match serializer fields {serializer_fields}"
