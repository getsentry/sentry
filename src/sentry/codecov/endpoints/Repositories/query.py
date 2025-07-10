query = """query ReposForOwner(
  $owner: String!
  $filters: RepositorySetFilters!
  $ordering: RepositoryOrdering!
  $direction: OrderingDirection!
  $first: Int
  $after: String
  $last: Int
  $before: String
) {
  owner(username: $owner) {
    repositories(
      filters: $filters
      ordering: $ordering
      orderingDirection: $direction
      first: $first
    ) {
      edges {
        node {
          name
          updatedAt
          latestCommitAt
          defaultBranch
        }
      }
      pageInfo {
          endCursor
          hasNextPage
      }
      totalCount
    }
  }
}"""
