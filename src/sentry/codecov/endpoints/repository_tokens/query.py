from typing import int
query = """query RepoTokensForOwner(
  $owner: String!
  $ordering: RepositoryOrdering!
  $direction: OrderingDirection!
  $first: Int
  $after: String
  $last: Int
  $before: String
) {
  owner(username: $owner) {
    repositories(
      ordering: $ordering
      orderingDirection: $direction
      first: $first
      after: $after
      last: $last
      before: $before
    ) {
      edges {
        node {
          name
          token
        }
      }
      pageInfo {
          startCursor
          endCursor
          hasNextPage
          hasPreviousPage
      }
      totalCount
    }
  }
}
"""
