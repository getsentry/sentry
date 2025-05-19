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

# NOTE: There is no testResult resolver in GQL atm so if we need this, will need to build it.
get_query = """query GetTestResult(
  $owner: String!
  $repo: String!
  $testResultId: String!
) {
}
"""


@region_silo_endpoint
class TestResultsEndpoint(CodecovEndpoint):
    owner = ApiOwner.CODECOV
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
    }

    def get(self, request: Request) -> Response:
        """Retrieves the list of test results for a given commit. If a test result id is also
        provided, the endpoint will return the test result with that id."""

        test_result_id = request.GET.get("test_result_id")
        owner = request.GET.get("owner")
        repo = request.GET.get("repo")
        commit = request.GET.get("commit")

        variables = {
            "owner": owner,
            "repo": repo,
            "commit": commit,
        }

        assert variables  # just to get rid of lint error

        if test_result_id:
            # TODO: graphQL Query
            # Passing in query into codecov client means we need the query to be structured by the time we call it.

            # res = CodecovClient.query(get_query, variables)
            # transformed_res = CodecovClient.transform_response(res, serializer)

            return Response(
                {
                    "updatedAt": "2021-01-01T00:00:00Z",
                    "name": "test",
                    "commitsFailed": 1,
                    "failureRate": 0.01,
                    "flakeRate": 100,
                    "avgDuration": 100,
                    "lastDuration": 100,
                    "totalFailCount": 1,
                    "totalFlakyFailCount": 1,
                    "totalSkipCount": 0,
                    "totalPassCount": 0,
                }
            )

        # CodecovClient.query(list_query, variables)

        # TODO: Response filtering

        return Response(
            {
                [
                    {
                        "updatedAt": "2021-01-01T00:00:00Z",
                        "name": "test",
                        "commitsFailed": 1,
                        "failureRate": 0.01,
                        "flakeRate": 100,
                        "avgDuration": 100,
                        "lastDuration": 100,
                        "totalFailCount": 1,
                        "totalFlakyFailCount": 1,
                        "totalSkipCount": 0,
                        "totalPassCount": 0,
                    },
                    {
                        "updatedAt": "2021-01-01T00:00:00Z",
                        "name": "test",
                        "commitsFailed": 4,
                        "failureRate": 0.5,
                        "flakeRate": 0.2,
                        "avgDuration": 100,
                        "lastDuration": 100,
                        "totalFailCount": 4,
                        "totalFlakyFailCount": 0,
                        "totalSkipCount": 0,
                        "totalPassCount": 0,
                    },
                ]
            }
        )
