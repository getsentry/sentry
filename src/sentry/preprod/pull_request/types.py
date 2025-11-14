from __future__ import annotations
from typing import int

from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel

from sentry.preprod.api.models.project_preprod_build_details_models import BuildDetailsApiResponse


class PullRequestFileStatus(StrEnum):
    ADDED = "added"
    MODIFIED = "modified"
    REMOVED = "removed"
    RENAMED = "renamed"


class PullRequestFileChange(BaseModel):
    """
    Represents a file change in a pull request, normalized across SCM providers.
    """

    filename: str
    status: PullRequestFileStatus
    additions: int
    deletions: int
    changes: int
    previous_filename: str | None = None  # For renamed files
    sha: str | None = None  # File blob SHA/hash
    patch: str | None = None  # The actual diff patch (optional for large files)


class PullRequestAuthor(BaseModel):
    """
    Represents the author of a pull request.
    """

    id: str | None = None  # Provider-specific ID (may be int for GitHub, str for others)
    username: str | None = None
    display_name: str | None = None
    avatar_url: str | None = None


class PullRequestState(StrEnum):
    OPEN = "open"
    CLOSED = "closed"
    MERGED = "merged"
    DRAFT = "draft"


class PullRequestDetails(BaseModel):
    """
    Represents pull request details, normalized across SCM providers.
    """

    id: str | None = None  # Provider-specific ID
    number: int  # PR/MR number
    title: str | None = None
    description: str | None = None
    state: PullRequestState
    author: PullRequestAuthor
    source_branch: str | None = None
    target_branch: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
    merged_at: datetime | None = None
    closed_at: datetime | None = None
    url: str | None = None  # Provider URL to the PR
    commits_count: int
    additions: int  # Total additions across all files
    deletions: int  # Total deletions across all files
    changed_files_count: int


class PullRequestWithFiles(BaseModel):
    """
    Complete pull request data including file changes.
    """

    pull_request: PullRequestDetails
    files: list[PullRequestFileChange]
    build_details: list[BuildDetailsApiResponse]


class PullRequestErrorResponse(BaseModel):
    """
    Error response for pull request operations.
    """

    error: str
    message: str
    details: str | None = None
