from __future__ import annotations

import logging
from collections.abc import Generator, Sequence
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Any, TypedDict

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
from sentry.shared_integrations.exceptions import ApiError, ApiUnauthorized, IntegrationError

logger = logging.getLogger(__name__)

# Default buffer size when fetching changelist ranges to ensure complete coverage
DEFAULT_REVISION_RANGE = 10


class P4ChangeInfo(TypedDict):
    """Type definition for Perforce changelist information."""

    change: str
    user: str
    client: str
    time: str
    desc: str


class P4DepotInfo(TypedDict):
    """Type definition for Perforce depot information."""

    name: str
    type: str
    description: str


class P4UserInfo(TypedDict, total=False):
    """Type definition for Perforce user information."""

    email: str
    full_name: str
    username: str


class P4CommitInfo(TypedDict):
    """Type definition for Sentry commit format."""

    id: str
    repository: str
    author_email: str
    author_name: str
    message: str
    timestamp: str
    patch_set: list[Any]


class P4DepotPath:
    """Encapsulates Perforce depot path logic."""

    def __init__(self, path: str):
        """
        Initialize depot path.

        Args:
            path: Depot path (e.g., //depot or //depot/project)
        """
        self.path = path

    def depot_name(self) -> str:
        """
        Extract depot name from path.

        Returns:
            Depot name (e.g., "depot" from "//depot/project")
        """
        return self.path.strip("/").split("/")[0]


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
            integration: Integration instance containing credentials in metadata
            org_integration: Organization integration instance (required for API compatibility)
        """
        self.integration = integration
        self.org_integration = org_integration

        # Extract configuration from integration.metadata
        if not org_integration:
            raise IntegrationError("Organization Integration is required for Perforce")

        metadata = integration.metadata
        self.p4port = metadata.get("p4port", "localhost:1666")
        self.user = metadata.get("user", "")
        self.password = metadata.get("password")
        self.auth_type = metadata.get(
            "auth_type", "password"
        )  # Default to password for backwards compat
        self.client_name = metadata.get("client")
        self.ssl_fingerprint = metadata.get("ssl_fingerprint")

    @contextmanager
    def _connect(self) -> Generator[P4]:
        """
        Context manager for P4 connections with automatic cleanup.

        Yields a connected P4 instance and ensures disconnection on exit.

        Uses P4Python API:
        - p4.connect(): https://www.perforce.com/manuals/p4python/Content/P4Python/python.programming.html#python.programming.connecting
        - p4.run_trust(): https://www.perforce.com/manuals/cmdref/Content/CmdRef/p4_trust.html
        - p4.run_login(): https://www.perforce.com/manuals/cmdref/Content/CmdRef/p4_login.html

        Example:
            with self._connect() as p4:
                result = p4.run("info")
        """
        p4 = P4()
        p4.port = self.p4port
        p4.user = self.user
        p4.password = self.password

        if self.client_name:
            p4.client = self.client_name

        p4.exception_level = 1  # Only errors raise exceptions

        # Connect to Perforce server
        try:
            p4.connect()
        except P4Exception as e:
            error_msg = str(e)
            # Provide helpful error message for connection failures
            if "SSL" in error_msg or "trust" in error_msg.lower():
                raise ApiError(
                    f"Failed to connect to Perforce (SSL issue): {error_msg}. "
                    f"Ensure ssl_fingerprint is correct. Obtain with: p4 -p {self.p4port} trust -y"
                )
            raise ApiError(f"Failed to connect to Perforce: {error_msg}")

        # Assert SSL trust after connection (if needed)
        # This must be done after p4.connect() but before p4.run_login()
        if self.ssl_fingerprint and self.p4port.startswith("ssl"):
            try:
                p4.run_trust("-i", self.ssl_fingerprint)
            except P4Exception as trust_error:
                try:
                    p4.disconnect()
                except Exception:
                    pass
                raise ApiError(
                    f"Failed to establish SSL trust: {trust_error}. "
                    f"Ensure ssl_fingerprint is correct. Obtain with: p4 -p {self.p4port} trust -y"
                )

        # Authenticate based on auth_type
        # - password: Requires run_login() to exchange password for session ticket
        # - ticket: Already authenticated via p4.password, no login needed
        if self.password and self.auth_type == "password":
            try:
                p4.run_login()
            except P4Exception as login_error:
                try:
                    p4.disconnect()
                except Exception:
                    pass
                raise ApiUnauthorized(
                    f"Failed to authenticate with Perforce: {login_error}. "
                    "Verify your password is correct."
                )
        elif self.password and self.auth_type == "ticket":
            # Ticket authentication: p4.password is already set to the ticket
            # Verify ticket works by running a test command
            try:
                p4.run("info")
            except P4Exception as e:
                try:
                    p4.disconnect()
                except Exception:
                    pass
                raise ApiUnauthorized(
                    f"Failed to authenticate with Perforce ticket: {e}. "
                    "Verify your P4 ticket is valid. Obtain a new ticket with: p4 login -p"
                )

        try:
            yield p4
        finally:
            # Ensure cleanup
            try:
                if p4.connected():
                    p4.disconnect()
            except Exception as e:
                # Log disconnect failures as they may indicate connection leaks
                logger.warning("Failed to disconnect from Perforce: %s", e, exc_info=True)

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
        with self._connect() as p4:
            try:
                depot_path = self.build_depot_path(repo, path)
                result = p4.run("files", depot_path)

                # Verify result contains actual file data (not just warnings)
                # When exception_level=1, warnings are returned in result list
                if result and len(result) > 0 and "depotFile" in result[0]:
                    return result[0]
                return None

            except P4Exception:
                return None

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

    def get_depots(self) -> Sequence[P4DepotInfo]:
        """
        List all depots accessible to the user.

        Uses p4 depots command to display a list of all depots.
        API docs: https://www.perforce.com/manuals/cmdref/Content/CmdRef/p4_depots.html

        Returns:
            Sequence of depot info dictionaries
        """
        with self._connect() as p4:
            depots = p4.run("depots")
            return [
                P4DepotInfo(
                    name=str(depot.get("name", "")),
                    type=str(depot.get("type", "")),
                    description=str(depot.get("desc", "")),
                )
                for depot in depots
            ]

    def get_user(self, username: str) -> P4UserInfo | None:
        """
        Get user information from Perforce.

        Uses p4 user command to fetch user details including email and full name.
        API docs: https://www.perforce.com/manuals/cmdref/Content/CmdRef/p4_user.html

        Args:
            username: Perforce username

        Returns:
            User info dictionary with Email and FullName fields, or None if not found

        Raises:
            P4Exception: For connection or transient errors that may be retryable
        """
        with self._connect() as p4:
            result = p4.run("user", "-o", username)
            if result and len(result) > 0:
                user_info = result[0]
                # p4 user -o returns a template for non-existent users
                # Check if user actually exists by verifying Update field is set
                if not user_info.get("Update"):
                    return None
                return P4UserInfo(
                    email=str(user_info.get("Email", "")),
                    full_name=str(user_info.get("FullName", "")),
                    username=str(user_info.get("User", username)),
                )
            # User not found - return None (not an error condition)
            return None

    def get_author_info_from_cache(
        self, username: str, user_cache: dict[str, P4UserInfo | None]
    ) -> tuple[str, str]:
        """
        Get author email and name from username with caching.

        Args:
            username: Perforce username
            user_cache: Cache dictionary for user lookups

        Returns:
            Tuple of (author_email, author_name)
        """
        author_email = f"{username}@perforce"
        author_name = username

        # Fetch user info if not in cache
        if username not in user_cache:
            try:
                user_cache[username] = self.get_user(username)
            except Exception as e:
                logger.warning(
                    "perforce.get_author_info.user_lookup_failed",
                    extra={
                        "username": username,
                        "error": str(e),
                        "error_type": type(e).__name__,
                    },
                )
                user_cache[username] = None

        user_info = user_cache.get(username)
        if user_info:
            if user_info.get("email"):
                author_email = user_info["email"]
            if user_info.get("full_name"):
                author_name = user_info["full_name"]

        return author_email, author_name

    def get_changes(
        self,
        depot_path: str,
        max_changes: int = 20,
        start_cl: int | None = None,
        end_cl: int | None = None,
    ) -> Sequence[P4ChangeInfo]:
        """
        Get changelists for a depot path.

        Uses p4 changes command to list changelists.
        API docs: https://www.perforce.com/manuals/cmdref/Content/CmdRef/p4_changes.html

        Args:
            depot_path: Depot path (e.g., //depot/main/...)
            max_changes: Maximum number of changes to return when start_cl/end_cl not specified
            start_cl: Starting changelist number (exclusive) - returns changes > start_cl. Must be int.
            end_cl: Ending changelist number (inclusive) - returns changes <= end_cl. Must be int.

        Returns:
            Sequence of changelist dictionaries in range (start_cl, end_cl]

        Raises:
            TypeError: If start_cl or end_cl are not integers
        """
        with self._connect() as p4:
            # Validate types - changelists must be integers
            if start_cl is not None and not isinstance(start_cl, int):
                raise TypeError(
                    f"start_cl must be an integer or None, got {type(start_cl).__name__}"
                )
            if end_cl is not None and not isinstance(end_cl, int):
                raise TypeError(f"end_cl must be an integer or None, got {type(end_cl).__name__}")

            start_cl_num = start_cl
            end_cl_num = end_cl

            # Calculate how many changes to fetch based on range
            if start_cl_num is not None and end_cl_num is not None:
                # Fetch enough to cover the range, adding buffer for safety
                range_size = abs(end_cl_num - start_cl_num) + DEFAULT_REVISION_RANGE
                fetch_limit = max(range_size, max_changes)
            else:
                fetch_limit = max_changes

            args = ["-m", str(fetch_limit), "-l"]

            # P4 -e flag: return changes at or before specified changelist (upper bound)
            # Use it for end_cl (inclusive upper bound)
            if end_cl_num is not None:
                args.extend(["-e", str(end_cl_num)])

            args.append(depot_path)

            changes = p4.run("changes", *args)

            # Client-side filter for start_cl (exclusive lower bound)
            # Filter out changes <= start_cl to get changes > start_cl
            if start_cl_num is not None:
                changes = [
                    c for c in changes if c.get("change") and int(c["change"]) > start_cl_num
                ]

            return [
                P4ChangeInfo(
                    change=str(change.get("change", "")),
                    user=str(change.get("user", "")),
                    client=str(change.get("client", "")),
                    time=str(change.get("time", "")),
                    desc=str(change.get("desc", "")),
                )
                for change in changes
            ]

    def get_blame_for_files(
        self, files: Sequence[SourceLineInfo], extra: dict[str, Any]
    ) -> list[FileBlameInfo]:
        """
        Get blame information for multiple files using p4 changes.

        Uses 'p4 changes -m 1 -l' to get the most recent changelist that modified each file.
        This is simpler and faster than using p4 filelog + p4 describe.

        Note: This does not provide line-specific blame. It returns the most recent
        changelist for the entire file, which is sufficient for suspect commit detection.

        API docs:
        - p4 changes: https://www.perforce.com/manuals/cmdref/Content/CmdRef/p4_changes.html

        Returns a list of FileBlameInfo objects containing commit details for each file.

        Performance notes:
        - Makes ~2 P4 API calls per file: changes (with -l for description), user (cached)
        - User lookups are cached within the request to minimize redundant calls
        - Perforce doesn't have explicit rate limiting like GitHub
        - Individual file failures are caught and logged without failing entire batch
        """
        blames: list[FileBlameInfo] = []
        user_cache: dict[str, P4UserInfo | None] = {}

        with self._connect() as p4:
            for file in files:
                try:
                    # Build depot path for the file (includes stream if specified)
                    # file.ref contains the stream but we are ignoring it since it's
                    # already part of the depot path we get from stacktrace (SourceLineInfo)
                    depot_path = self.build_depot_path(file.repo, file.path, None)

                    # If revision is available from symcache, append it to depot path
                    # This allows us to get the exact changelist that created this revision
                    if file.revision:
                        depot_path = f"{depot_path}#{file.revision}"

                    # Use p4 changes -m 1 -l to get most recent change for this file
                    # -m 1: limit to 1 result (most recent)
                    # -l: include full changelist description
                    changes = p4.run("changes", "-m", "1", "-l", depot_path)

                    if changes and len(changes) > 0:
                        change = changes[0]
                        changelist = change.get("change", "")
                        username = change.get("user", "unknown")

                        # Get author email and name with caching
                        author_email, author_name = self.get_author_info_from_cache(
                            username, user_cache
                        )

                        # Handle potentially null/invalid time field
                        time_value = change.get("time") or 0
                        try:
                            time_int = int(time_value)
                        except (TypeError, ValueError) as e:
                            logger.warning(
                                "perforce.client.get_blame_for_files.invalid_time_value",
                                extra={
                                    **extra,
                                    "changelist": changelist,
                                    "time_value": time_value,
                                    "error": str(e),
                                    "repo_name": file.repo.name,
                                    "file_path": file.path,
                                },
                            )
                            time_int = 0

                        commit = CommitInfo(
                            commitId=str(changelist),
                            committedDate=datetime.fromtimestamp(time_int, tz=timezone.utc),
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
                            revision=file.revision,
                            commit=commit,
                        )
                        blames.append(blame_info)

                except P4Exception as e:
                    # Log but don't fail for individual file errors
                    logger.warning(
                        "perforce.client.get_blame_for_files.error",
                        extra={
                            **extra,
                            "error": str(e),
                            "repo_name": file.repo.name,
                            "file_path": file.path,
                            "file_lineno": file.lineno,
                        },
                    )
                    continue

        return blames

    def get_file(
        self, repo: Repository, path: str, ref: str | None, codeowners: bool = False
    ) -> str:
        """
        Get file contents from Perforce depot.
        Required by abstract base class but not used (CODEOWNERS).
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
