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


class TestResultSerializer(serializers.Serializer):
    """
    Serializer to transform GraphQL response to client format
    """

    def transform_graphql_response(self, graphql_response):
        """
        Transform the GraphQL response format to the expected client format
        """
        try:
            # Extract test result nodes from the nested GraphQL structure
            test_results = graphql_response["data"]["owner"]["repository"]["testAnalytics"][
                "testResults"
            ]["edges"]

            # Transform each node to the expected client format
            transformed_results = []
            for edge in test_results:
                node = edge["node"]
                # Note: lastDuration is not in the GraphQL response, using avgDuration as fallback
                transformed_result = {
                    "updatedAt": node["updatedAt"],
                    "name": node["name"],
                    "commitsFailed": node["commitsFailed"],
                    "failureRate": node["failureRate"],
                    "flakeRate": node["flakeRate"],
                    "avgDuration": node["avgDuration"],
                    "lastDuration": node.get(
                        "lastDuration", node["avgDuration"]
                    ),  # fallback to avgDuration
                    "totalFailCount": node["totalFailCount"],
                    "totalFlakyFailCount": node["totalFlakyFailCount"],
                    "totalSkipCount": node["totalSkipCount"],
                    "totalPassCount": node["totalPassCount"],
                }
                transformed_results.append(transformed_result)

            return transformed_results

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
        """Retrieves the list of test results for a given commit. If a test result id is also
        provided, the endpoint will return the test result with that id."""

        variables = {
            "owner": owner,
            "repo": repository,
            "commit": commit,
        }

        assert variables

        # TODO: Uncomment when CodecovClient is available
        # graphql_response = CodecovClient.query(list_query, variables)

        # For now, use the sample response for demonstration
        graphql_response = sample_graphql_response

        # Transform the GraphQL response to client format
        serializer = TestResultSerializer()
        test_results = serializer.transform_graphql_response(graphql_response)

        return Response(test_results)
