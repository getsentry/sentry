from typing import int
query = """query GetRepo(
  $owner: String!
  $repo: String!
) {
  owner(username: $owner) {
    repository(name: $repo) {
      __typename
      ... on Repository {
          uploadToken
          testAnalyticsEnabled
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
