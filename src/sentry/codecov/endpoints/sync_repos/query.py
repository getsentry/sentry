mutation = """
    mutation SyncRepos {
        syncRepos {
          isSyncing
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
