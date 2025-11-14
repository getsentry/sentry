from typing import int
query = """
        mutation RegenerateRepositoryUploadToken(
            $owner: String!
            $repoName: String!
        ) {
            regenerateRepositoryUploadToken(input: { owner: $owner, repoName: $repoName }) {
                error {
                    ... on ValidationError {
                        __typename
                        message
                    }
                }
                token
            }
        }
      """
