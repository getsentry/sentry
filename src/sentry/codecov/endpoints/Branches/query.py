query = """query GetBranches(
  $owner: String!
  $repo: String!
  $first: Int
  $after: String
  $last: Int
  $before: String
  $filters: BranchesSetFilters
) {
  owner(username: $owner) {
    repository(name: $repo) {
      __typename
      ... on Repository {
        branches(
          filters: $filters
          first: $first,
          after: $after,
          last: $last
          before: $before
        ) {
          edges {
            node {
              name
                head {
                  commitid
                }
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
      ... on NotFoundError {
        message
      }
      ... on OwnerNotActivatedError {
        message
      }
    }
  }
}"""
