from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.codecov.base import CodecovEndpoint
from sentry.codecov.client import CodecovApiClient
from sentry.codecov.endpoints.TestResults.query import query
from sentry.codecov.endpoints.TestResults.serializers import TestResultSerializer

# Sample GraphQL response structure for reference
sample_graphql_response = {
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
                    }
                },
            }
        }
    }
}


@region_silo_endpoint
class TestResultsEndpoint(CodecovEndpoint):
    owner = ApiOwner.CODECOV
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
    }

    # Disable pagination requirement for this endpoint
    def has_pagination(self, response):
        return True

    def get(self, request: Request, owner: str, repository: str) -> Response:
        """Retrieves the list of test results for a given commit."""

        variables = {
            "owner": owner,
            "repo": repository,
        }

        assert variables

        graphql_response = CodecovApiClient.query(query, variables)

        graphql_response = sample_graphql_response  # Mock response for now

        test_results = TestResultSerializer().to_representation(graphql_response)

        return Response(test_results)
