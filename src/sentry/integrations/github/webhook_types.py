from __future__ import annotations

from enum import StrEnum
from typing import Any, Literal, TypedDict

GITHUB_WEBHOOK_TYPE_HEADER = "HTTP_X_GITHUB_EVENT"
GITHUB_WEBHOOK_TYPE_HEADER_KEY = "X-GITHUB-EVENT"
GITHUB_INSTALLATION_TARGET_ID_HEADER = "X-GITHUB-HOOK-INSTALLATION-TARGET-ID"


# All implemented webhook types are listed here.
# Reference: https://docs.github.com/en/webhooks/webhook-events-and-payloads
class GithubWebhookType(StrEnum):
    CHECK_RUN = "check_run"
    INSTALLATION = "installation"
    INSTALLATION_REPOSITORIES = "installation_repositories"
    ISSUE = "issues"
    ISSUE_COMMENT = "issue_comment"
    PULL_REQUEST = "pull_request"
    PULL_REQUEST_REVIEW = "pull_request_review"
    PULL_REQUEST_REVIEW_COMMENT = "pull_request_review_comment"
    PULL_REQUEST_REVIEW_THREAD = "pull_request_review_thread"
    PUSH = "push"
    CHECK_SUITE = "check_suite"


# Event type strings (X-GitHub-Event header values) that the cell webhook endpoint processes.
# INSTALLATION and INSTALLATION_REPOSITORIES are handled in control only.
_CONTROL_ONLY_EVENTS = frozenset(
    {GithubWebhookType.INSTALLATION, GithubWebhookType.INSTALLATION_REPOSITORIES}
)
CELL_PROCESSED_GITHUB_EVENTS = frozenset(
    t.value for t in GithubWebhookType if t not in _CONTROL_ONLY_EVENTS
)

# Every action GitHub sends for check_run events; used to bound metric tag cardinality.
GITHUB_CHECK_RUN_ACTIONS = frozenset({"completed", "created", "requested_action", "rerequested"})

# check_run actions that a cell-side processor actually consumes
# (see CheckRunEventWebhook.WEBHOOK_EVENT_PROCESSORS):
#   completed        -> sentry.pr_metrics.webhooks.handle_check_run
#   requested_action -> sentry.preprod.vcs.webhooks.github_check_run
#   rerequested      -> sentry.seer.code_review.webhooks.check_run
# The control parser drops the other actions (notably "created") before forwarding,
# so a new consumer must add its action here to receive those events.
CELL_PROCESSED_CHECK_RUN_ACTIONS = frozenset({"completed", "requested_action", "rerequested"})


class GitHubInstallationRepo(TypedDict):
    id: int
    full_name: str
    private: bool


class InstallationRepositoriesEvent(TypedDict):
    action: Literal["added", "removed"]
    installation: dict[str, Any]
    repositories_added: list[GitHubInstallationRepo]
    repositories_removed: list[GitHubInstallationRepo]
    repository_selection: Literal["all", "selected"]
    sender: dict[str, Any]
