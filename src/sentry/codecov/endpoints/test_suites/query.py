from typing import int
query = """query GetTestResultsTestSuites(
    $owner: String!
    $repo: String!
    $term: String
  ) {
    owner(username: $owner) {
        repository: repository(name: $repo) {
            __typename
            ... on Repository {
                testAnalytics {
                    testSuites(term: $term)
                }
            }
            ... on NotFoundError {
                message
            }
        }
    }
}"""
