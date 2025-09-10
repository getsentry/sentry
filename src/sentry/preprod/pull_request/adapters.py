from __future__ import annotations

from datetime import datetime

from dateutil.parser import parse as parse_datetime

from sentry.preprod.pull_request.types import (
    PullRequestAuthor,
    PullRequestDetails,
    PullRequestErrorResponse,
    PullRequestFileChange,
    PullRequestWithFiles,
)


class PullRequestDataAdapter:
    """
    Adapter to convert raw SCM provider data to our normalized format.
    """

    @staticmethod
    def from_github_pr_data(pr_data: dict, files_data: list[dict]) -> PullRequestWithFiles:
        """Convert GitHub API response to our normalized format."""

        github_user = pr_data.get("user", {})
        author: PullRequestAuthor = {
            "id": str(github_user.get("id", "")),
            "username": github_user.get("login", ""),
            "display_name": github_user.get("name"),
            "avatar_url": github_user.get("avatar_url"),
        }

        pull_request: PullRequestDetails = {
            "id": str(pr_data.get("id", "")),
            "number": pr_data.get("number", 0),
            "title": pr_data.get("title", ""),
            "description": pr_data.get("body"),
            "state": pr_data.get("state", "open"),
            "author": author,
            "source_branch": pr_data.get("head", {}).get("ref", ""),
            "target_branch": pr_data.get("base", {}).get("ref", ""),
            "created_at": (
                parse_datetime(pr_data["created_at"])
                if pr_data.get("created_at")
                else datetime.now()
            ),
            "updated_at": (
                parse_datetime(pr_data["updated_at"])
                if pr_data.get("updated_at")
                else datetime.now()
            ),
            "merged_at": parse_datetime(pr_data["merged_at"]) if pr_data.get("merged_at") else None,
            "closed_at": parse_datetime(pr_data["closed_at"]) if pr_data.get("closed_at") else None,
            "url": pr_data.get("html_url", ""),
            "commits_count": pr_data.get("commits", 0),
            "additions": pr_data.get("additions", 0),
            "deletions": pr_data.get("deletions", 0),
            "changed_files_count": pr_data.get("changed_files", 0),
        }

        files: list[PullRequestFileChange] = []
        for file_data in files_data:
            file_change: PullRequestFileChange = {
                "filename": file_data.get("filename", ""),
                "status": file_data.get("status", "modified"),
                "additions": file_data.get("additions", 0),
                "deletions": file_data.get("deletions", 0),
                "changes": file_data.get("changes", 0),
                "previous_filename": file_data.get("previous_filename"),
                "sha": file_data.get("sha"),
                "patch": file_data.get("patch"),
            }
            files.append(file_change)

        return {
            "pull_request": pull_request,
            "files": files,
        }

    @staticmethod
    def create_error_response(
        error: str, message: str, details: str | None = None
    ) -> PullRequestErrorResponse:
        """Create a standardized error response."""
        return {
            "error": error,
            "message": message,
            "details": details,
        }
