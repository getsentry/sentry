query = """query ReposForOwner(
  $filters: RepositorySetFilters!
  $owner: String!
  $ordering: RepositoryOrdering!
  $direction: OrderingDirection!
  $first: Int
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
    }
  }
}"""
