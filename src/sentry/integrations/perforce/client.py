from __future__ import annotations

import logging
from collections.abc import Sequence
from typing import Any

from P4 import P4, P4Exception

from sentry.integrations.source_code_management.commit_context import (
    CommitContextClient,
    FileBlameInfo,
    SourceLineInfo,
)
from sentry.integrations.source_code_management.repository import RepositoryClient
from sentry.models.pullrequest import PullRequest, PullRequestComment
from sentry.models.repository import Repository

logger = logging.getLogger(__name__)


class PerforceClient(RepositoryClient, CommitContextClient):
    """
    Client for interacting with Perforce server.
    Uses P4Python library to execute P4 commands.

    Supports both plaintext and SSL connections. For production use over
    public internet, SSL is strongly recommended.
    """

    def __init__(
        self,
        p4port: str | None = None,
        user: str | None = None,
        password: str | None = None,
        client: str | None = None,
        ssl_fingerprint: str | None = None,
    ):
        """
        Initialize Perforce client.

        Args:
            p4port: P4PORT string (e.g., 'ssl:host:port', 'tcp:host:port', or 'host:port')
            user: Perforce username
            password: Perforce password OR P4 ticket (both are supported)
            client: Client/workspace name
            ssl_fingerprint: SSL trust fingerprint for secure connections
        """
        self.p4port = p4port
        self.ssl_fingerprint = ssl_fingerprint
        self.user = user or ""
        self.password = password
        self.client_name = client
        self.P4 = P4
        self.P4Exception = P4Exception

    def _connect(self):
        """Create and connect a P4 instance with SSL support."""
        pass

    def _disconnect(self, p4):
        """Disconnect P4 instance."""
        pass

    def check_file(self, repo: Repository, path: str, version: str | None) -> object | None:
        """
        Check if a file exists in the depot.

        Args:
            repo: Repository object containing depot path (includes stream if specified)
            path: File path relative to depot
            version: Not used (streams are part of depot_path)

        Returns:
            File info dict if exists, None otherwise
        """
        return None

    def get_depots(self) -> list[dict[str, Any]]:
        """
        List all depots accessible to the user.

        Returns:
            List of depot info dictionaries
        """
        return []

    def get_changes(
        self, depot_path: str, max_changes: int = 20, start_cl: str | None = None
    ) -> list[dict[str, Any]]:
        """
        Get changelists for a depot path.

        Args:
            depot_path: Depot path (e.g., //depot/main/...)
            max_changes: Maximum number of changes to return
            start_cl: Starting changelist number

        Returns:
            List of changelist dictionaries
        """
        return []

    def get_blame_for_files(
        self, files: Sequence[SourceLineInfo], extra: dict[str, Any]
    ) -> list[FileBlameInfo]:
        """
        Get blame information for multiple files using p4 filelog.

        Uses 'p4 filelog' + 'p4 describe' which is much faster than 'p4 annotate'.
        Returns the most recent changelist that modified each file.

        Note: This does not provide line-specific blame. It returns the most recent
        changelist for the entire file, which is sufficient for suspect commit detection.

        Returns a list of FileBlameInfo objects containing commit details for each file.
        """
        return []

    def get_file(
        self, repo: Repository, path: str, ref: str | None, codeowners: bool = False
    ) -> str:
        """
        Get file contents from Perforce depot.
        Required by abstract base class but not used (CODEOWNERS feature removed).
        """
        raise NotImplementedError("get_file is not supported for Perforce")

    def create_comment(self, repo: str, issue_id: str, data: dict[str, Any]) -> Any:
        """Create comment. Not applicable for Perforce."""
        raise NotImplementedError("Perforce does not support issue comments")

    def update_comment(
        self, repo: str, issue_id: str, comment_id: str, data: dict[str, Any]
    ) -> Any:
        """Update comment. Not applicable for Perforce."""
        raise NotImplementedError("Perforce does not support issue comments")

    def create_pr_comment(self, repo: Repository, pr: PullRequest, data: dict[str, Any]) -> Any:
        """Create PR comment. Not applicable for Perforce."""
        raise NotImplementedError("Perforce does not have native pull requests")

    def update_pr_comment(
        self,
        repo: Repository,
        pr: PullRequest,
        pr_comment: PullRequestComment,
        data: dict[str, Any],
    ) -> Any:
        """Update PR comment. Not applicable for Perforce."""
        raise NotImplementedError("Perforce does not have native pull requests")

    def get_merge_commit_sha_from_commit(self, repo: Repository, sha: str) -> str | None:
        """Get merge commit. Not applicable for Perforce."""
        return None
