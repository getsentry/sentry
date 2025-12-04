from __future__ import annotations

from enum import StrEnum
from typing import TypedDict

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
    CHECK_RUN = "check_run"


class GitHubCheckRun(TypedDict, total=False):
    """Minimal GitHub Check Run Object."""

    id: int
    external_id: str  # This is the ID of a row in Seer
    html_url: str
    name: str


class GitHubWebhookEvent(TypedDict, total=False):
    """
    General GitHub Webhook Event Payload Type.

    This is a flexible type that can represent any GitHub webhook event.
    """

    action: str
    check_run: GitHubCheckRun


class GitHubWebhookCheckRunEvent(TypedDict, total=False):
    """
    Minimal GitHub Check Run Webhook Event Payload Type.

    Reference: https://docs.github.com/en/webhooks/webhook-events-and-payloads#check_run
    """

    action: str
    check_run: GitHubCheckRun
