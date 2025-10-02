from __future__ import annotations

from datetime import datetime
from typing import Any, Literal, TypedDict


class PullRequestFileChange(TypedDict):
    """
    Represents a file change in a pull request, normalized across SCM providers.
    """

    filename: str
    status: Literal["added", "modified", "removed", "renamed"]
    additions: int
    deletions: int
    changes: int
    previous_filename: str | None  # For renamed files
    sha: str | None  # File blob SHA/hash
    patch: str | None  # The actual diff patch (optional for large files)


class PullRequestAuthor(TypedDict):
    """
    Represents the author of a pull request.
    """

    id: str | None  # Provider-specific ID (may be int for GitHub, str for others)
    username: str | None
    display_name: str | None
    avatar_url: str | None


class PullRequestDetails(TypedDict):
    """
    Represents pull request details, normalized across SCM providers.
    """

    id: str | None  # Provider-specific ID
    number: int  # PR/MR number
    title: str | None
    description: str | None
    state: Literal["open", "closed", "merged", "draft"]
    author: PullRequestAuthor
    source_branch: str | None
    target_branch: str | None
    created_at: datetime | None
    updated_at: datetime | None
    merged_at: datetime | None
    closed_at: datetime | None
    url: str | None  # Provider URL to the PR
    commits_count: int
    additions: int  # Total additions across all files
    deletions: int  # Total deletions across all files
    changed_files_count: int


class PullRequestWithFiles(TypedDict):
    """
    Complete pull request data including file changes.
    """

    pull_request: PullRequestDetails
    files: list[PullRequestFileChange]
    build_details: list[dict[str, Any]]


class PullRequestErrorResponse(TypedDict):
    """
    Error response for pull request operations.
    """

    error: str
    message: str
    details: str | None
