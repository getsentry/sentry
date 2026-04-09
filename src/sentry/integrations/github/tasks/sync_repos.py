"""
Backwards-compatible re-exports. The sync task has moved to
sentry.integrations.source_code_management.sync_repos.
"""

from sentry.integrations.source_code_management.sync_repos import (
    scm_repo_sync_beat as scm_repo_sync_beat,
)
from sentry.integrations.source_code_management.sync_repos import (
    sync_repos_for_org as sync_repos_for_org,
)

# Legacy alias
github_repo_sync_beat = scm_repo_sync_beat

__all__ = [
    "github_repo_sync_beat",
    "scm_repo_sync_beat",
    "sync_repos_for_org",
]
