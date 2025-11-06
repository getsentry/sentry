from __future__ import annotations

import logging
from collections.abc import Sequence
from datetime import datetime, timezone
from typing import Any

from sentry.integrations.source_code_management.commit_context import (
    CommitContextClient,
    FileBlameInfo,
    SourceLineInfo,
)
from sentry.integrations.source_code_management.repository import RepositoryClient
from sentry.models.pullrequest import PullRequest, PullRequestComment
from sentry.models.repository import Repository
from sentry.shared_integrations.exceptions import ApiError
from sentry.utils import metrics

logger = logging.getLogger(__name__)


class PerforceClient(RepositoryClient, CommitContextClient):
    """
    Client for interacting with Perforce server.
    Uses P4Python library to execute P4 commands.
    """

    def __init__(
        self,
        host: str,
        port: int | str,
        user: str,
        password: str | None = None,
        client: str | None = None,
    ):
        self.host = host
        self.port = str(port)
        self.user = user
        self.password = password
        self.client_name = client
        self.base_url = f"p4://{host}:{port}"

        # Import P4 only when needed to avoid import errors if not installed
        try:
            from P4 import P4, P4Exception

            self.P4 = P4
            self.P4Exception = P4Exception
        except ImportError as e:
            logger.exception("P4Python not installed. Install with: pip install p4python")
            raise ImportError("P4Python library is required for Perforce integration") from e

    def _connect(self):
        """Create and connect a P4 instance."""
        p4 = self.P4()
        p4.port = f"{self.host}:{self.port}"
        p4.user = self.user

        if self.password:
            p4.password = self.password

        if self.client_name:
            p4.client = self.client_name

        p4.exception_level = 1  # Only errors raise exceptions

        try:
            p4.connect()
            logger.info(
                "perforce.client.connected",
                extra={"host": self.host, "port": self.port, "user": self.user},
            )
            return p4
        except self.P4Exception as e:
            logger.exception(
                "perforce.client.connection_failed",
                extra={"error": str(e), "host": self.host, "port": self.port},
            )
            raise ApiError(f"Failed to connect to Perforce: {e}")

    def _disconnect(self, p4):
        """Disconnect P4 instance."""
        try:
            if p4.connected():
                p4.disconnect()
        except Exception as e:
            logger.warning("perforce.client.disconnect_error", extra={"error": str(e)})

    def check_file(self, repo: Repository, path: str, version: str | None) -> object | None:
        """
        Check if a file exists in the depot.

        Args:
            repo: Repository object containing depot path
            path: File path relative to depot
            version: Changelist number (optional)

        Returns:
            File info dict if exists, None otherwise
        """
        p4 = self._connect()
        try:
            depot_path = self._build_depot_path(repo, path)

            if version:
                depot_path = f"{depot_path}@{version}"

            logger.info(
                "perforce.client.check_file",
                extra={"depot_path": depot_path},
            )

            result = p4.run("files", depot_path)

            if result and len(result) > 0:
                return result[0]
            return None

        except self.P4Exception as e:
            logger.info(
                "perforce.client.check_file.not_found",
                extra={"depot_path": depot_path, "error": str(e)},
            )
            return None
        finally:
            self._disconnect(p4)

    def get_file(
        self, repo: Repository, path: str, ref: str | None, codeowners: bool = False
    ) -> str:
        """
        Get file contents from depot.

        Args:
            repo: Repository object
            path: File path
            ref: Changelist number
            codeowners: Whether this is a CODEOWNERS file

        Returns:
            File contents as string
        """
        p4 = self._connect()
        try:
            depot_path = self._build_depot_path(repo, path)

            if ref:
                depot_path = f"{depot_path}@{ref}"

            logger.info("perforce.client.get_file", extra={"depot_path": depot_path})

            result = p4.run("print", "-q", depot_path)

            if result and len(result) > 1:
                # First element is file info, second is content
                return result[1]

            raise ApiError(f"File not found: {depot_path}")

        except self.P4Exception as e:
            logger.exception(
                "perforce.client.get_file.error", extra={"depot_path": depot_path, "error": str(e)}
            )
            raise ApiError(f"Failed to get file: {e}")
        finally:
            self._disconnect(p4)

    def _build_depot_path(self, repo: Repository, path: str) -> str:
        """Build full depot path from repo config and file path."""
        depot_root = repo.config.get("depot_path", repo.name)
        # Ensure path doesn't start with /
        path = path.lstrip("/")
        return f"{depot_root}/{path}"

    def get_blame(
        self, repo: Repository, path: str, ref: str | None = None, lineno: int | None = None
    ) -> list[dict[str, Any]]:
        """
        Get blame/annotate information for a file (like git blame).

        Uses 'p4 annotate' to find who last modified each line.
        This is used for CODEOWNERS-style ownership detection.

        Args:
            repo: Repository object
            path: File path relative to depot
            ref: Changelist number (optional)
            lineno: Specific line number to blame (optional)

        Returns:
            List of blame information per line with:
            - line: line number
            - changelist: changelist number
            - user: username who made the change
            - date: date of change
        """
        p4 = self._connect()
        try:
            depot_path = self._build_depot_path(repo, path)

            if ref:
                depot_path = f"{depot_path}@{ref}"

            logger.info(
                "perforce.client.get_blame",
                extra={"depot_path": depot_path, "line_number": lineno},
            )

            # Use 'p4 annotate' to get line-by-line authorship
            # Format: changelist: line_content
            result = p4.run("annotate", "-q", "-c", depot_path)

            blame_info = []
            for i, line in enumerate(result, start=1):
                # Skip if we only want a specific line
                if lineno is not None and i != lineno:
                    continue

                # Parse annotate output: "changelist: content"
                if isinstance(line, str) and ":" in line:
                    parts = line.split(":", 1)
                    changelist = parts[0].strip()

                    # Get changelist details to find the user
                    try:
                        change_info = p4.run("describe", "-s", changelist)
                        if change_info:
                            blame_info.append(
                                {
                                    "line": i,
                                    "changelist": changelist,
                                    "user": change_info[0].get("user", "unknown"),
                                    "date": change_info[0].get("time", ""),
                                }
                            )
                    except self.P4Exception:
                        # If we can't get changelist details, add minimal info
                        blame_info.append(
                            {
                                "line": i,
                                "changelist": changelist,
                                "user": "unknown",
                                "date": "",
                            }
                        )

                # If we only wanted one line, we're done
                if lineno is not None and len(blame_info) > 0:
                    break

            return blame_info

        except self.P4Exception as e:
            logger.warning(
                "perforce.client.get_blame.error", extra={"depot_path": depot_path, "error": str(e)}
            )
            return []
        finally:
            self._disconnect(p4)

    def get_depot_info(self) -> dict[str, Any]:
        """
        Get server info for testing connection.

        Returns:
            Server info dictionary
        """
        p4 = self._connect()
        try:
            info = p4.run("info")[0]
            return {
                "server_address": info.get("serverAddress"),
                "server_version": info.get("serverVersion"),
                "user": info.get("userName"),
                "client": info.get("clientName"),
            }
        finally:
            self._disconnect(p4)

    def get_depots(self) -> list[dict[str, Any]]:
        """
        List all depots accessible to the user.

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

    # CommitContextClient methods (stubbed for now)

    def get_blame_for_files(
        self, files: Sequence[SourceLineInfo], extra: dict[str, Any]
    ) -> list[FileBlameInfo]:
        """
        Get blame information for multiple files using p4 annotate.
        Returns a list of FileBlameInfo objects containing commit details for each file.
        """
        from sentry.integrations.source_code_management.commit_context import (
            CommitInfo,
            FileBlameInfo,
        )

        metrics.incr("integrations.perforce.get_blame_for_files")
        blames = []
        p4 = self._connect()

        try:
            for file in files:
                try:
                    # Build depot path for the file
                    depot_path = self._build_depot_path(file.repo, file.path)
                    if file.ref:
                        depot_path = f"{depot_path}@{file.ref}"

                    # Run p4 annotate to get line-by-line blame info
                    result = p4.run("annotate", "-q", "-c", depot_path)

                    # Find the changelist for the specific line number
                    changelist = None
                    if file.lineno and result:
                        for i, line in enumerate(result, start=1):
                            if i == file.lineno and isinstance(line, str) and ":" in line:
                                parts = line.split(":", 1)
                                changelist = parts[0].strip()
                                break

                    # If we found a changelist, get detailed commit info
                    if changelist:
                        try:
                            change_info = p4.run("describe", "-s", changelist)
                            if change_info and len(change_info) > 0:
                                change = change_info[0]
                                commit = CommitInfo(
                                    commitId=changelist,
                                    committedDate=datetime.fromtimestamp(
                                        int(change.get("time", 0)), tz=timezone.utc
                                    ),
                                    commitMessage=change.get("desc", "").strip(),
                                    commitAuthorName=change.get("user", "unknown"),
                                    commitAuthorEmail=change.get("email"),
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
                        except self.P4Exception as e:
                            logger.warning(
                                "perforce.client.get_blame_for_files.describe_error",
                                extra={
                                    **extra,
                                    "changelist": changelist,
                                    "error": str(e),
                                    "repo_name": file.repo.name,
                                    "file_path": file.path,
                                },
                            )
                except self.P4Exception as e:
                    # Log but don't fail for individual file errors
                    logger.warning(
                        "perforce.client.get_blame_for_files.annotate_error",
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
        finally:
            self._disconnect(p4)

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
