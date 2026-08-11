from __future__ import annotations

from collections.abc import Mapping
from enum import StrEnum
from typing import Any, Literal, NamedTuple, TypedDict

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


class ActionFilter(NamedTuple):
    """Which actions of an event type the control parser forwards to a cell.

    ``consumed`` is the allowlist: an action outside it has no cell-side processor,
    so the parser drops the request before a WebhookPayload is written.

    ``known`` is every action GitHub documents for the event, and bounds metric tag
    cardinality. The request body is not signature-verified until it reaches the
    cell, so an action is only tagged verbatim when GitHub could have sent it.
    """

    consumed: frozenset[str]
    known: frozenset[str]


# Event types whose actions are filtered in control; an event type absent here has
# all of its actions forwarded. These two carry by far the highest webhook volume,
# and most of it is actions nothing consumes — check_run "created" and check_suite
# "requested"/"rerequested".
#
# The cell-side consumer of each allowed action
# (see CheckRunEventWebhook / CheckSuiteWebhook WEBHOOK_EVENT_PROCESSORS):
#   check_run   completed        -> sentry.pr_metrics.webhooks.handle_check_run
#   check_run   requested_action -> sentry.preprod.vcs.webhooks.github_check_run
#   check_run   rerequested      -> sentry.seer.code_review.webhooks.check_run
#   check_suite completed        -> sentry.pr_metrics.webhooks.handle_check_suite
#
# A cell also republishes every delivered webhook onto the SCM event stream, so
# `sentry.scm.stream` listeners are the second set of consumers to check before
# narrowing this map. They gate on the same actions today.
#
# A new consumer on either path must add its action here to receive those events.
CELL_PROCESSED_ACTIONS: Mapping[str, ActionFilter] = {
    GithubWebhookType.CHECK_RUN: ActionFilter(
        consumed=frozenset({"completed", "requested_action", "rerequested"}),
        known=frozenset({"completed", "created", "requested_action", "rerequested"}),
    ),
    GithubWebhookType.CHECK_SUITE: ActionFilter(
        consumed=frozenset({"completed"}),
        known=frozenset({"completed", "requested", "rerequested"}),
    ),
}


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
