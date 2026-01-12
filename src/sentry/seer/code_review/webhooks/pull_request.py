"""
Handler for GitHub pull_request webhook events.
https://docs.github.com/en/webhooks/webhook-events-and-payloads#pull_request
"""

from __future__ import annotations

import enum
import logging
from collections.abc import Mapping
from typing import Any

from sentry.integrations.github.webhook_types import GithubWebhookType
from sentry.integrations.services.integration import RpcIntegration
from sentry.models.organization import Organization
from sentry.models.repository import Repository

from ..logging import debug_log
from ..metrics import (
    CodeReviewErrorType,
    WebhookFilteredReason,
    record_webhook_enqueued,
    record_webhook_filtered,
    record_webhook_handler_error,
    record_webhook_received,
)
from ..utils import SeerCodeReviewTrigger, _get_target_commit_sha
from .config import get_direct_to_seer_gh_orgs

logger = logging.getLogger(__name__)


class Log(enum.StrEnum):
    MISSING_PULL_REQUEST = "github.webhook.pull_request.missing-pull-request"
    MISSING_ACTION = "github.webhook.pull_request.missing-action"
    UNSUPPORTED_ACTION = "github.webhook.pull_request.unsupported-action"
    DRAFT_PR = "github.webhook.pull_request.draft-pr"


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


def handle_pull_request_event(
    *,
    github_event: GithubWebhookType,
    event: Mapping[str, Any],
    organization: Organization,
    github_org: str,
    repo: Repository,
    integration: RpcIntegration | None = None,
    **kwargs: Any,
) -> None:
    """
    Handle pull_request webhook events for code review.

    This handler processes PR events and sends them directly to Seer
    """
    pr_number = event.get("pull_request", {}).get("number")
    base_extra = {
        "organization_id": organization.id,
        "organization_slug": organization.slug,
        "repo": repo.name,
        "github_org": github_org,
        "pr_number": pr_number,
    }

    debug_log("code_review.pull_request.entry", extra=base_extra)

    pull_request = event.get("pull_request")
    if not pull_request:
        debug_log("code_review.pull_request.missing_pull_request", extra=base_extra)
        logger.warning(Log.MISSING_PULL_REQUEST.value, extra=base_extra)
        record_webhook_handler_error(
            github_event, "unknown", CodeReviewErrorType.MISSING_PULL_REQUEST
        )
        return

    action_value = event.get("action")
    if not action_value or not isinstance(action_value, str):
        debug_log("code_review.pull_request.missing_action", extra=base_extra)
        logger.warning(Log.MISSING_ACTION.value, extra=base_extra)
        record_webhook_handler_error(github_event, "unknown", CodeReviewErrorType.MISSING_ACTION)
        return

    base_extra["action"] = action_value
    debug_log("code_review.pull_request.action_received", extra=base_extra)

    record_webhook_received(github_event, action_value)

    try:
        action = PullRequestAction(action_value)
    except ValueError:
        debug_log(
            "code_review.pull_request.unsupported_action",
            extra={**base_extra, "reason": "action_not_in_enum"},
        )
        logger.warning(Log.UNSUPPORTED_ACTION.value, extra=base_extra)
        record_webhook_filtered(
            github_event, action_value, WebhookFilteredReason.UNSUPPORTED_ACTION
        )
        return

    if action not in WHITELISTED_ACTIONS:
        debug_log(
            "code_review.pull_request.action_not_whitelisted",
            extra={
                **base_extra,
                "whitelisted_actions": [a.value for a in WHITELISTED_ACTIONS],
            },
        )
        logger.warning(Log.UNSUPPORTED_ACTION.value, extra=base_extra)
        record_webhook_filtered(
            github_event, action_value, WebhookFilteredReason.UNSUPPORTED_ACTION
        )
        return

    is_draft = pull_request.get("draft") is True
    if is_draft:
        debug_log(
            "code_review.pull_request.skipped_draft",
            extra={**base_extra, "reason": "draft_pr"},
        )
        return

    direct_to_seer_orgs = get_direct_to_seer_gh_orgs()
    is_direct_to_seer = github_org in direct_to_seer_orgs

    debug_log(
        "code_review.pull_request.routing_check",
        extra={
            **base_extra,
            "direct_to_seer_orgs": direct_to_seer_orgs,
            "is_direct_to_seer": is_direct_to_seer,
        },
    )

    if is_direct_to_seer:
        from .task import schedule_task

        trigger = _get_trigger_for_action(action)
        target_commit_sha = _get_target_commit_sha(github_event, event, repo, integration)

        debug_log(
            "code_review.pull_request.scheduling_task",
            extra={
                **base_extra,
                "trigger": trigger.value,
                "target_commit_sha": target_commit_sha,
            },
        )

        schedule_task(
            github_event=github_event,
            github_event_action=action_value,
            event=event,
            organization=organization,
            repo=repo,
            target_commit_sha=target_commit_sha,
            trigger=trigger,
        )
        record_webhook_enqueued(github_event, action_value)

        debug_log("code_review.pull_request.task_scheduled", extra=base_extra)
    else:
        debug_log(
            "code_review.pull_request.not_direct_to_seer",
            extra={**base_extra, "reason": "github_org_not_in_direct_to_seer_list"},
        )
