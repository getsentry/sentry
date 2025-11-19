from __future__ import annotations

import logging
from collections.abc import Sequence
from datetime import datetime, timezone
from typing import Any

from P4 import P4, P4Exception

from sentry.integrations.models.integration import Integration
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.integrations.services.integration import RpcIntegration, RpcOrganizationIntegration
from sentry.integrations.source_code_management.commit_context import (
    CommitContextClient,
    CommitInfo,
    FileBlameInfo,
    SourceLineInfo,
)
from sentry.integrations.source_code_management.repository import RepositoryClient
from sentry.models.pullrequest import PullRequest, PullRequestComment
from sentry.models.repository import Repository
from sentry.shared_integrations.exceptions import ApiError, IntegrationError
from sentry.utils import metrics

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
        integration: Integration | RpcIntegration,
        org_integration: OrganizationIntegration | RpcOrganizationIntegration | None = None,
    ):
        """
        Initialize Perforce client.

        Args:
            integration: Integration instance
            org_integration: Organization integration instance containing per-org config
        """
        self.integration = integration
        self.org_integration = org_integration
        self.P4 = P4
        self.P4Exception = P4Exception

        # Extract configuration from org_integration
        if not org_integration:
            raise IntegrationError("Organization Integration is required for Perforce")

        config = org_integration.config
        self.p4port = config.get("p4port", "localhost:1666")
        self.user = config.get("user", "")
        self.password = config.get("password")
        self.client_name = config.get("client")
        self.ssl_fingerprint = config.get("ssl_fingerprint")

    def _connect(self):
        """
        Create and connect a P4 instance with SSL support.

        Uses P4Python API:
        - p4.connect(): https://www.perforce.com/manuals/p4python/Content/P4Python/python.programming.html#python.programming.connecting
        - p4.run_trust(): https://www.perforce.com/manuals/cmdref/Content/CmdRef/p4_trust.html
        - p4.run_login(): https://www.perforce.com/manuals/cmdref/Content/CmdRef/p4_login.html
        """
        p4 = self.P4()
        p4.port = self.p4port
        p4.user = self.user
        p4.password = self.password

        if self.client_name:
            p4.client = self.client_name

        p4.exception_level = 1  # Only errors raise exceptions

        try:
            p4.connect()

            if self.ssl_fingerprint and self.p4port.startswith("ssl:"):
                try:
                    p4.run_trust("-i", self.ssl_fingerprint)
                except self.P4Exception as trust_error:
                    p4.disconnect()
                    raise ApiError(
                        f"Failed to establish SSL trust: {trust_error}. "
                        f"Ensure ssl_fingerprint is correct. Obtain with: p4 -p {self.p4port} trust -y"
                    )

            if self.password:
                try:
                    p4.run_login()
                except self.P4Exception as login_error:
                    p4.disconnect()
                    raise ApiError(f"Failed to authenticate with Perforce: {login_error}")

            return p4
        except self.P4Exception as e:
            error_msg = str(e)
            # Provide helpful error message for SSL issues
            if "SSL" in error_msg or "trust" in error_msg.lower():
                raise ApiError(
                    f"Failed to connect to Perforce (SSL issue): {error_msg}. "
                    f"Ensure ssl_fingerprint is correct. Obtain with: p4 -p {self.p4port} trust -y"
                )
            raise ApiError(f"Failed to connect to Perforce: {error_msg}")

    def _disconnect(self, p4):
        """Disconnect P4 instance."""
        try:
            if p4.connected():
                p4.disconnect()
        except Exception:
            pass

    def check_file(self, repo: Repository, path: str, version: str | None) -> object | None:
        """
        Check if a file exists in the depot.

        Uses p4 files command to list file(s) in the depot.
        API docs: https://www.perforce.com/manuals/cmdref/Content/CmdRef/p4_files.html

        Args:
            repo: Repository object containing depot path (includes stream if specified)
            path: File path relative to depot
            version: Not used (streams are part of depot_path)

        Returns:
            File info dict if exists, None otherwise
        """
        p4 = self._connect()
        try:
            depot_path = self.build_depot_path(repo, path)
            result = p4.run("files", depot_path)

            if result and len(result) > 0:
                return result[0]
            return None

        except self.P4Exception:
            return None
        finally:
            self._disconnect(p4)

    def build_depot_path(self, repo: Repository, path: str, stream: str | None = None) -> str:
        """
        Build full depot path from repo config and file path.

        Handles both relative and absolute paths:
        - Relative: "depot/app/file.py" or "app/file.py" → "//depot/app/file.py"
        - Absolute: "//depot/app/file.py" → "//depot/app/file.py" (unchanged)
        - With stream: "app/file.py" + stream="main" → "//depot/main/app/file.py"

        Args:
            repo: Repository object
            path: File path (may include #revision for file revisions like "file.cpp#1")
            stream: Optional stream name to insert after depot (e.g., "main", "dev")

        Returns:
            Full depot path with #revision preserved if present
        """
        # Extract file revision if present (# syntax only)
        revision = None
        path_without_rev = path

        if "#" in path:
            path_without_rev, revision = path.rsplit("#", 1)

        # If already absolute depot path, use as-is
        if path_without_rev.startswith("//"):
            full_path = path_without_rev
        else:
            depot_root = repo.config.get("depot_path", repo.name).rstrip("/")

            # Normalize depot_root to ensure it starts with //
            if not depot_root.startswith("//"):
                depot_root = f"//{depot_root}"

            # Strip depot name from path if it duplicates depot_root
            # e.g., depot_root="//depot", path="depot/app/file.py" → "app/file.py"
            depot_name = depot_root.lstrip("/")  # "depot"
            if path_without_rev.startswith(depot_name + "/") or path_without_rev == depot_name:
                path_without_rev = path_without_rev[len(depot_name) :].lstrip("/")

            # Remove leading slashes from relative path
            path_without_rev = path_without_rev.lstrip("/")

            # Handle Perforce streams: insert stream after depot
            # Format: //depot/stream/path/to/file
            if stream:
                full_path = f"{depot_root}/{stream}/{path_without_rev}"
            else:
                full_path = f"{depot_root}/{path_without_rev}"

        # Add file revision back if present
        if revision:
            full_path = f"{full_path}#{revision}"

        return full_path

    def get_depots(self) -> list[dict[str, Any]]:
        """
        List all depots accessible to the user.

        Uses p4 depots command to display a list of all depots.
        API docs: https://www.perforce.com/manuals/cmdref/Content/CmdRef/p4_depots.html

        Returns:
            List of depot info dictionaries
        """
        p4 = self._connect()
        try:
            depots = p4.run("depots")
            return [
                {
                    "name": depot.get("name"),
                    "type": depot.get("type"),
                    "description": depot.get("desc", ""),
                }
                for depot in depots
            ]
        finally:
            self._disconnect(p4)

    def get_user(self, username: str) -> dict[str, Any] | None:
        """
        Get user information from Perforce.

        Uses p4 user command to fetch user details including email and full name.
        API docs: https://www.perforce.com/manuals/cmdref/Content/CmdRef/p4_user.html

        Args:
            username: Perforce username

        Returns:
            User info dictionary with Email and FullName fields, or None if not found
        """
        p4 = self._connect()
        try:
            result = p4.run("user", "-o", username)
            if result and len(result) > 0:
                user_info = result[0]
                return {
                    "email": user_info.get("Email", ""),
                    "full_name": user_info.get("FullName", ""),
                    "username": user_info.get("User", username),
                }
            return None
        except self.P4Exception:
            return None
        finally:
            self._disconnect(p4)

    def get_changes(
        self, depot_path: str, max_changes: int = 20, start_cl: str | None = None
    ) -> list[dict[str, Any]]:
        """
        Get changelists for a depot path.

        Uses p4 changes command to list changelists.
        API docs: https://www.perforce.com/manuals/cmdref/Content/CmdRef/p4_changes.html

        Args:
            depot_path: Depot path (e.g., //depot/main/...)
            max_changes: Maximum number of changes to return
            start_cl: Starting changelist number

        Returns:
            List of changelist dictionaries
        """
        p4 = self._connect()
        try:
            args = ["-m", str(max_changes), "-l"]

            if start_cl:
                args.extend(["-e", start_cl])

            args.append(depot_path)

            changes = p4.run("changes", *args)

            return [
                {
                    "change": change.get("change"),
                    "user": change.get("user"),
                    "client": change.get("client"),
                    "time": change.get("time"),
                    "desc": change.get("desc"),
                }
                for change in changes
            ]
        finally:
            self._disconnect(p4)

    def get_blame_for_files(
        self, files: Sequence[SourceLineInfo], extra: dict[str, Any]
    ) -> list[FileBlameInfo]:
        """
        Get blame information for multiple files using p4 filelog.

        Uses 'p4 filelog' + 'p4 describe' which is much faster than 'p4 annotate'.
        Returns the most recent changelist that modified each file.

        Note: This does not provide line-specific blame. It returns the most recent
        changelist for the entire file, which is sufficient for suspect commit detection.

        API docs:
        - p4 filelog: https://www.perforce.com/manuals/cmdref/Content/CmdRef/p4_filelog.html
        - p4 describe: https://www.perforce.com/manuals/cmdref/Content/CmdRef/p4_describe.html

        Returns a list of FileBlameInfo objects containing commit details for each file.
        """
        metrics.incr("integrations.perforce.get_blame_for_files")
        blames = []
        p4 = self._connect()

        # Cache user info to avoid multiple lookups for the same user
        user_cache: dict[str, dict[str, Any] | None] = {}

        try:
            for file in files:
                try:
                    # Build depot path for the file (includes stream if specified)
                    # file.ref contains the revision/changelist if available
                    depot_path = self.build_depot_path(file.repo, file.path)

                    # Use faster p4 filelog approach to get most recent changelist
                    # This is much faster than p4 annotate
                    filelog = p4.run("filelog", "-m1", depot_path)

                    changelist = None
                    if filelog and len(filelog) > 0:
                        # The 'change' field contains the changelist numbers (as a list)
                        changelists = filelog[0].get("change", [])
                        if changelists and len(changelists) > 0:
                            # Get the first (most recent) changelist number
                            changelist = changelists[0]

                    # If we found a changelist, get detailed commit info
                    if changelist:
                        try:
                            change_info = p4.run("describe", "-s", changelist)
                            if change_info and len(change_info) > 0:
                                change = change_info[0]
                                username = change.get("user", "unknown")

                                # Get user information from Perforce for email and full name
                                author_email = f"{username}@perforce"
                                author_name = username

                                # Fetch user info if not in cache
                                if username != "unknown" and username not in user_cache:
                                    user_cache[username] = self.get_user(username)

                                user_info = user_cache.get(username)
                                if user_info:
                                    # Use actual email from Perforce if available
                                    if user_info.get("email"):
                                        author_email = user_info["email"]
                                    # Use full name from Perforce if available
                                    if user_info.get("full_name"):
                                        author_name = user_info["full_name"]

                                # Handle potentially null/invalid time field
                                time_value = change.get("time") or 0
                                try:
                                    timestamp = int(time_value)
                                except (TypeError, ValueError):
                                    timestamp = 0

                                commit = CommitInfo(
                                    commitId=str(changelist),  # Ensure string type
                                    committedDate=datetime.fromtimestamp(
                                        timestamp, tz=timezone.utc
                                    ),
                                    commitMessage=change.get("desc", "").strip(),
                                    commitAuthorName=author_name,
                                    commitAuthorEmail=author_email,
                                )

                                blame_info = FileBlameInfo(
                                    lineno=file.lineno,
                                    path=file.path,
                                    ref=file.ref,
                                    repo=file.repo,
                                    code_mapping=file.code_mapping,
                                    commit=commit,
                                )
                                blames.append(blame_info)
                        except self.P4Exception:
                            pass
                except self.P4Exception:
                    continue

            return blames
        finally:
            self._disconnect(p4)

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
