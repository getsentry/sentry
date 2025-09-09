mutation = """
    mutation SyncRepos {
        syncRepos {
          isSyncing
          error {
            __typename
          }
        }
      }
"""

query = """
    query IsSyncing {
        me {
          isSyncing: isSyncingWithGitProvider
        }
      }
"""
