query = """query GetRepo(
  $owner: String!
  $repo: String!
) {
  owner(username: $owner) {
    repository(name: $repo) {
      __typename
      ... on Repository {
          private
          uploadToken
          defaultBranch
          activated
          active
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
