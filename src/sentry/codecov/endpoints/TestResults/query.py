query = """query GetTestResults(
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
                totalDuration
                lastDuration
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
              hasPreviousPage
              startCursor
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
