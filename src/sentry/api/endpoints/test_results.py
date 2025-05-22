import sentry_sdk
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.codecov import CodecovEndpoint

list_query = """query GetTestResults(
  $owner: String!
  $repo: String!
  $filters: TestResultsFilters
  $ordering: TestResultsOrdering
  $first: Int
  $after: String
  $last: Int
  $before: String
) {
  owner(username: $owner) {
    repository: repository(name: $repo) {
      __typename
      ... on Repository {
        testAnalytics {
          testResults(
            filters: $filters
            ordering: $ordering
            first: $first
            after: $after
            last: $last
            before: $before
          ) {
            edges {
              node {
                updatedAt
                avgDuration
                name
                failureRate
                flakeRate
                commitsFailed
                totalFailCount
                totalFlakyFailCount
                totalSkipCount
                totalPassCount
              }
            }
            pageInfo {
              endCursor
              hasNextPage
            }
            totalCount
          }
        }
      }
      ... on NotFoundError {
        message
      }
      ... on OwnerNotActivatedError {
        message
      }
    }
  }
}
"""


class TestResultNodeSerializer(serializers.Serializer):
    """
    Serializer for individual test result nodes from GraphQL response
    """

    updatedAt = serializers.CharField()
    avgDuration = serializers.FloatField()
    name = serializers.CharField()
    failureRate = serializers.FloatField()
    flakeRate = serializers.FloatField()
    commitsFailed = serializers.IntegerField()
    totalFailCount = serializers.IntegerField()
    totalFlakyFailCount = serializers.IntegerField()
    totalSkipCount = serializers.IntegerField()
    totalPassCount = serializers.IntegerField()
    lastDuration = serializers.FloatField()


class TestResultSerializer(serializers.ListSerializer):
    """
    Serializer for a list of test results - inherits from ListSerializer to handle arrays
    """

    child = TestResultNodeSerializer()

    def to_representation(self, graphql_response):
        """
        Transform the GraphQL response to the expected client format
        """
        try:
            # Extract test result nodes from the nested GraphQL structure
            test_results = graphql_response["data"]["owner"]["repository"]["testAnalytics"][
                "testResults"
            ]["edges"]

            # Transform each edge to just the node data
            nodes = []
            for edge in test_results:
                node = edge["node"]
                # Add lastDuration fallback if not present
                if "lastDuration" not in node:
                    node["lastDuration"] = node["avgDuration"]
                nodes.append(node)

            # Use the parent ListSerializer to serialize each test result
            return super().to_representation(nodes)

        except (KeyError, TypeError) as e:
            # Handle malformed GraphQL response
            sentry_sdk.capture_exception(e)
            return []


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

    def get(self, request: Request, owner: str, repository: str, commit: str) -> Response:
        """Retrieves the list of test results for a given commit."""

        variables = {
            "owner": owner,
            "repo": repository,
            "commit": commit,
        }

        assert variables

        # TODO: Uncomment when CodecovClient is available
        # graphql_response = CodecovClient.query(list_query, variables)

        graphql_response = sample_graphql_response  # Mock response for now

        # transform response to the response that we want
        serializer = TestResultSerializer()
        test_results = serializer.to_representation(graphql_response)

        return Response(test_results)
