from __future__ import annotations

from collections.abc import Mapping
from enum import StrEnum
from typing import Any, TypedDict, Union

GITHUB_WEBHOOK_TYPE_HEADER = "HTTP_X_GITHUB_EVENT"
GITHUB_WEBHOOK_TYPE_HEADER_KEY = "X-GITHUB-EVENT"
GITHUB_INSTALLATION_TARGET_ID_HEADER = "X-GITHUB-HOOK-INSTALLATION-TARGET-ID"


class GithubWebhookType(StrEnum):
    INSTALLATION = "installation"
    INSTALLATION_REPOSITORIES = "installation_repositories"
    ISSUE = "issues"
    ISSUE_COMMENT = "issue_comment"
    PULL_REQUEST = "pull_request"
    PULL_REQUEST_REVIEW_COMMENT = "pull_request_review_comment"
    PULL_REQUEST_REVIEW = "pull_request_review"
    PUSH = "push"


class GitHubUser(TypedDict, total=False):
    """Common GitHub user object found in webhook events."""

    login: str
    id: int
    avatar_url: str
    gravatar_id: str
    url: str
    html_url: str
    followers_url: str
    following_url: str
    gists_url: str
    starred_url: str
    subscriptions_url: str
    organizations_url: str
    orgs: str
    repos_url: str
    events_url: str
    received_events_url: str
    type: str
    site_admin: bool
    name: str
    email: str
    username: str


class GitHubInstallation(TypedDict, total=False):
    """GitHub installation object found in webhook events."""

    id: int
    app_id: int
    account: GitHubUser
    access_tokens_url: str
    repositories_url: str


class GitHubRepository(TypedDict, total=False):
    """GitHub repository object found in webhook events."""

    id: int
    name: str
    full_name: str
    owner: GitHubUser
    private: bool
    html_url: str
    description: str
    fork: bool
    url: str
    created_at: int
    updated_at: str
    pushed_at: int
    git_url: str
    ssh_url: str
    clone_url: str
    svn_url: str
    homepage: str | None
    size: int
    stargazers_count: int
    watchers_count: int
    language: str | None
    has_issues: bool
    has_downloads: bool
    has_wiki: bool
    has_pages: bool
    forks_count: int
    mirror_url: str | None
    open_issues_count: int
    forks: int
    open_issues: int
    watchers: int
    default_branch: str


class GitHubCommit(TypedDict, total=False):
    """GitHub commit object found in webhook events."""

    id: str
    tree_id: str
    distinct: bool
    message: str
    timestamp: str
    url: str
    author: GitHubUser
    committer: GitHubUser
    added: list[str]
    removed: list[str]
    modified: list[str]


class GitHubIssue(TypedDict, total=False):
    """GitHub issue object found in webhook events."""

    url: str
    repository_url: str
    labels_url: str
    comments_url: str
    events_url: str
    html_url: str
    id: int
    number: int
    title: str
    user: GitHubUser
    labels: list[Any]
    state: str
    locked: bool
    assignee: GitHubUser | None
    assignees: list[GitHubUser]
    milestone: Any | None
    comments: int
    created_at: str
    updated_at: str
    closed_at: str | None
    body: str


class GitHubPullRequest(TypedDict, total=False):
    """GitHub pull request object found in webhook events."""

    url: str
    id: int
    html_url: str
    diff_url: str
    patch_url: str
    issue_url: str
    number: int
    state: str
    locked: bool
    title: str
    user: GitHubUser
    body: str
    created_at: str
    updated_at: str
    closed_at: str | None
    merged_at: str | None
    merge_commit_sha: str | None
    assignee: GitHubUser | None
    milestone: Any | None
    head: dict[str, Any]
    base: dict[str, Any]
    merged: bool


class GithubWebhookEvent(TypedDict, total=False):
    """
    Base type for GitHub webhook events.

    This represents the common structure found across all GitHub webhook payloads.
    Different event types will have different additional fields.
    """

    action: str
    installation: GitHubInstallation
    sender: GitHubUser
    repository: GitHubRepository


class PushWebhookEvent(GithubWebhookEvent, total=False):
    """GitHub push event webhook payload."""

    ref: str
    before: str
    after: str
    created: bool
    deleted: bool
    forced: bool
    base_ref: str | None
    compare: str
    commits: list[GitHubCommit]
    head_commit: GitHubCommit
    pusher: GitHubUser


class PullRequestWebhookEvent(GithubWebhookEvent, total=False):
    """GitHub pull request event webhook payload."""

    number: int
    pull_request: GitHubPullRequest


class IssueWebhookEvent(GithubWebhookEvent, total=False):
    """GitHub issues event webhook payload."""

    issue: GitHubIssue
    assignee: GitHubUser | None


class InstallationWebhookEvent(GithubWebhookEvent, total=False):
    """GitHub installation event webhook payload."""

    pass  # Uses base fields from GithubWebhookEvent


# Type alias for any GitHub webhook event
AnyGithubWebhookEvent = Union[
    GithubWebhookEvent,
    PushWebhookEvent,
    PullRequestWebhookEvent,
    IssueWebhookEvent,
    InstallationWebhookEvent,
]
