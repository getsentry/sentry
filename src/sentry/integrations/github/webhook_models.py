"""
Pydantic models for GitHub webhook payloads.

These models validate the structure and required fields of incoming webhook events
from GitHub, ensuring data integrity before processing.
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class GitHubUser(BaseModel):
    """Represents a GitHub user in webhook payloads."""

    login: str
    id: int
    # Optional fields that may or may not be present
    avatar_url: str | None = None
    gravatar_id: str | None = None
    url: str | None = None
    html_url: str | None = None
    followers_url: str | None = None
    following_url: str | None = None
    gists_url: str | None = None
    starred_url: str | None = None
    subscriptions_url: str | None = None
    organizations_url: str | None = None
    repos_url: str | None = None
    events_url: str | None = None
    received_events_url: str | None = None
    type: str | None = None
    site_admin: bool | None = None

    class Config:
        # Allow extra fields that GitHub may add in the future
        extra = "allow"


class GitHubRepository(BaseModel):
    """Represents a GitHub repository in webhook payloads."""

    id: int
    name: str
    full_name: str
    html_url: str
    # Optional fields
    owner: dict[str, Any] | None = None
    private: bool | None = None
    description: str | None = None
    fork: bool | None = None
    url: str | None = None
    default_branch: str | None = None

    class Config:
        extra = "allow"


class GitHubInstallation(BaseModel):
    """Represents a GitHub App installation in webhook payloads."""

    id: int
    # Optional fields
    app_id: int | None = None
    account: dict[str, Any] | None = None
    access_tokens_url: str | None = None
    repositories_url: str | None = None
    html_url: str | None = None

    class Config:
        extra = "allow"


class GitHubCommitAuthor(BaseModel):
    """Represents a commit author in webhook payloads."""

    name: str
    email: str
    # username is optional and may not be present for bot users
    username: str | None = None

    class Config:
        extra = "allow"


class GitHubCommit(BaseModel):
    """Represents a commit in push event webhooks."""

    id: str
    message: str
    timestamp: str
    author: GitHubCommitAuthor
    committer: GitHubCommitAuthor
    # File change lists
    added: list[str] = Field(default_factory=list)
    removed: list[str] = Field(default_factory=list)
    modified: list[str] = Field(default_factory=list)
    # Optional fields
    distinct: bool | None = None
    url: str | None = None
    tree_id: str | None = None

    class Config:
        extra = "allow"


class PushEventPayload(BaseModel):
    """Validates push event webhook payloads from GitHub."""

    ref: str
    commits: list[GitHubCommit]
    repository: GitHubRepository
    # Optional but commonly present fields
    installation: GitHubInstallation | None = None
    sender: GitHubUser | None = None
    pusher: dict[str, Any] | None = None
    before: str | None = None
    after: str | None = None
    created: bool | None = None
    deleted: bool | None = None
    forced: bool | None = None
    base_ref: str | None = None
    compare: str | None = None
    head_commit: dict[str, Any] | None = None

    class Config:
        extra = "allow"


class GitHubPullRequest(BaseModel):
    """Represents a pull request in webhook payloads."""

    number: int
    title: str
    user: GitHubUser
    body: str | None = None
    # Optional fields
    id: int | None = None
    url: str | None = None
    html_url: str | None = None
    diff_url: str | None = None
    patch_url: str | None = None
    state: str | None = None
    locked: bool | None = None
    merged: bool | None = None
    merge_commit_sha: str | None = None
    created_at: str | None = None
    updated_at: str | None = None
    closed_at: str | None = None
    merged_at: str | None = None
    assignee: GitHubUser | None = None
    milestone: dict[str, Any] | None = None
    head: dict[str, Any] | None = None
    base: dict[str, Any] | None = None

    class Config:
        extra = "allow"


class PullRequestEventPayload(BaseModel):
    """Validates pull request event webhook payloads from GitHub."""

    action: str
    pull_request: GitHubPullRequest
    repository: GitHubRepository
    # Optional fields
    number: int | None = None
    installation: GitHubInstallation | None = None
    sender: GitHubUser | None = None
    organization: dict[str, Any] | None = None

    class Config:
        extra = "allow"


class GitHubIssue(BaseModel):
    """Represents a GitHub issue in webhook payloads."""

    number: int
    title: str
    user: GitHubUser
    # Optional fields
    id: int | None = None
    url: str | None = None
    html_url: str | None = None
    repository_url: str | None = None
    state: str | None = None
    locked: bool | None = None
    assignee: GitHubUser | None = None
    assignees: list[GitHubUser] = Field(default_factory=list)
    labels: list[dict[str, Any]] = Field(default_factory=list)
    milestone: dict[str, Any] | None = None
    comments: int | None = None
    created_at: str | None = None
    updated_at: str | None = None
    closed_at: str | None = None
    body: str | None = None

    class Config:
        extra = "allow"


class IssuesEventPayload(BaseModel):
    """Validates issues event webhook payloads from GitHub."""

    action: str
    issue: GitHubIssue
    repository: GitHubRepository
    # Optional fields
    assignee: GitHubUser | None = None
    installation: GitHubInstallation | None = None
    sender: GitHubUser | None = None
    organization: dict[str, Any] | None = None

    class Config:
        extra = "allow"


class InstallationEventPayload(BaseModel):
    """Validates installation event webhook payloads from GitHub."""

    action: str
    installation: GitHubInstallation
    sender: GitHubUser
    # Optional fields
    repositories: list[dict[str, Any]] = Field(default_factory=list)
    repository_selection: str | None = None

    class Config:
        extra = "allow"
