"""
Handler for GitHub pull_request webhook events.
https://docs.github.com/en/webhooks/webhook-events-and-payloads#pull_request
"""

from __future__ import annotations

import enum
import logging
from collections.abc import Mapping
from typing import Any

from sentry import options
from sentry.integrations.github.webhook_types import GithubWebhookType
from sentry.integrations.services.integration import RpcIntegration
from sentry.models.organization import Organization
from sentry.models.repository import Repository
from sentry.utils import metrics

from ..utils import SeerCodeReviewTrigger, _get_target_commit_sha

logger = logging.getLogger(__name__)


class ErrorStatus(enum.StrEnum):
    MISSING_PULL_REQUEST = "missing_pull_request"
    MISSING_ACTION = "missing_action"
    UNSUPPORTED_ACTION = "unsupported_action"
    DRAFT_PR = "draft_pr"


class Log(enum.StrEnum):
    MISSING_PULL_REQUEST = "github.webhook.pull_request.missing-pull-request"
    MISSING_ACTION = "github.webhook.pull_request.missing-action"
    UNSUPPORTED_ACTION = "github.webhook.pull_request.unsupported-action"
    DRAFT_PR = "github.webhook.pull_request.draft-pr"


class Metrics(enum.StrEnum):
    ERROR = "seer.code_review.webhook.pull_request.error"
    OUTCOME = "seer.code_review.webhook.pull_request.outcome"


class PullRequestAction(enum.StrEnum):
    """
    GitHub pull_request webhook actions.
    https://docs.github.com/en/webhooks/webhook-events-and-payloads#pull_request
    """

    ASSIGNED = "assigned"
    AUTO_MERGE_DISABLED = "auto_merge_disabled"
    AUTO_MERGE_ENABLED = "auto_merge_enabled"
    CLOSED = "closed"
    CONVERTED_TO_DRAFT = "converted_to_draft"
    DEMILESTONED = "demilestoned"
    DEQUEUED = "dequeued"
    EDITED = "edited"
    ENQUEUED = "enqueued"
    LABELED = "labeled"
    LOCKED = "locked"
    MILESTONED = "milestoned"
    OPENED = "opened"
    READY_FOR_REVIEW = "ready_for_review"
    REOPENED = "reopened"
    REVIEW_REQUEST_REMOVED = "review_request_removed"
    REVIEW_REQUESTED = "review_requested"
    # New commits are pushed to the PR
    SYNCHRONIZE = "synchronize"
    UNASSIGNED = "unassigned"
    UNLABELED = "unlabeled"
    UNLOCKED = "unlocked"


WHITELISTED_ACTIONS = {
    PullRequestAction.OPENED,
    PullRequestAction.READY_FOR_REVIEW,
    PullRequestAction.SYNCHRONIZE,
}


def _get_trigger_for_action(action: PullRequestAction) -> SeerCodeReviewTrigger:
    match action:
        case PullRequestAction.OPENED | PullRequestAction.READY_FOR_REVIEW:
            return SeerCodeReviewTrigger.ON_READY_FOR_REVIEW
        case PullRequestAction.SYNCHRONIZE:
            return SeerCodeReviewTrigger.ON_NEW_COMMIT
        case _:
            raise ValueError(f"Unsupported pull request action: {action}")


def _warn_and_increment_metric(
    error_status: ErrorStatus,
    extra: Mapping[str, Any],
    action: PullRequestAction | str | None = None,
) -> None:
    """
    Warn and increment metric for a given error status and action.
    """
    logger.warning(Log[error_status.name].value, extra=extra)
    tags = {"error_status": error_status.value}
    if action:
        tags["action"] = action
    metrics.incr(Metrics.ERROR.value, tags=tags)


def handle_pull_request_event(
    *,
    github_event: GithubWebhookType,
    event: Mapping[str, Any],
    organization: Organization,
    repo: Repository,
    integration: RpcIntegration | None = None,
    **kwargs: Any,
) -> None:
    """
    Handle pull_request webhook events for code review.

    This handler processes PR events and sends them directly to Seer
    """
    extra = {"organization_id": organization.id, "repo": repo.name}
    pull_request = event.get("pull_request")
    if not pull_request:
        _warn_and_increment_metric(ErrorStatus.MISSING_PULL_REQUEST, extra=extra)
        return

    action_value = event.get("action")
    if not action_value or not isinstance(action_value, str):
        _warn_and_increment_metric(ErrorStatus.MISSING_ACTION, extra=extra)
        return

    try:
        action = PullRequestAction(action_value)
    except ValueError:
        _warn_and_increment_metric(ErrorStatus.UNSUPPORTED_ACTION, action=action_value, extra=extra)
        return

    if action not in WHITELISTED_ACTIONS:
        return

    if pull_request.get("draft") is True:
        _warn_and_increment_metric(ErrorStatus.DRAFT_PR, action=action_value, extra=extra)
        return

    if not options.get("github.webhook.pr"):
        from .task import schedule_task

        schedule_task(
            github_event=github_event,
            event=event,
            organization=organization,
            repo=repo,
            target_commit_sha=_get_target_commit_sha(github_event, event, repo, integration),
            trigger=_get_trigger_for_action(action),
        )
