"""
Webhooks for GitHub check_run webhook events.

This module is used to handle GitHub check_run webhook events for PR review rerun.
When a user clicks "Re-run" on a check run in GitHub UI, we enqueue
a task to forward the original run ID to Seer so it can rerun the PR review.
"""

from __future__ import annotations

import logging
from collections.abc import Mapping
from datetime import datetime, timezone
from enum import StrEnum
from typing import Any

from pydantic import BaseModel, ValidationError

from sentry.integrations.github.webhook_types import GithubWebhookType
from sentry.models.code_review_event import CodeReviewEventStatus
from sentry.models.organization import Organization
from sentry.models.repository import Repository

from ..event_recorder import create_event_record, update_event_status
from ..metrics import (
    CodeReviewErrorType,
    WebhookFilteredReason,
    record_webhook_enqueued,
    record_webhook_filtered,
    record_webhook_handler_error,
    record_webhook_received,
)

logger = logging.getLogger(__name__)


class Log(StrEnum):
    MISSING_ACTION = "github.webhook.check_run.missing-action"
    INVALID_PAYLOAD = "github.webhook.check_run.invalid-payload"


class GitHubCheckRunAction(StrEnum):
    COMPLETED = "completed"
    CREATED = "created"
    REQUESTED_ACTION = "requested_action"
    REREQUESTED = "rerequested"


class GitHubCheckRunData(BaseModel):
    """GitHub check_run object structure."""

    external_id: str  # The external ID set by Seer
    html_url: str  # The URL to view the check run on GitHub

    class Config:
        extra = "allow"  # Allow additional fields from GitHub (Pydantic v1 syntax)


class GitHubCheckRunEvent(BaseModel):
    """
    GitHub check_run webhook event payload.
    https://docs.github.com/en/webhooks/webhook-events-and-payloads#check_run
    """

    action: str
    check_run: GitHubCheckRunData

    class Config:
        extra = "allow"  # Allow additional fields from GitHub (Pydantic v1 syntax)


def handle_check_run_event(
    *,
    github_event: GithubWebhookType,
    github_delivery_id: str | None = None,
    event: Mapping[str, Any],
    organization: Organization | None = None,
    repo: Repository | None = None,
    tags: Mapping[str, Any] | None = None,
    **kwargs: Any,
) -> None:
    """
    This is called when a check_run event is received from GitHub.
    When a user clicks "Re-run" on a check run in GitHub UI, we enqueue
    a task to forward the original run ID to Seer so it can rerun the PR review.

    Args:
        github_event: The GitHub webhook event type from X-GitHub-Event header (e.g., "check_run")
        event: The webhook event payload
        organization: The Sentry organization that the webhook event belongs to
        **kwargs: Additional keyword arguments
    """
    if github_event != GithubWebhookType.CHECK_RUN:
        return

    action = event.get("action")

    if action is None:
        logger.error(Log.MISSING_ACTION.value)
        record_webhook_handler_error(
            github_event,
            action or "",
            CodeReviewErrorType.MISSING_ACTION,
        )
        return

    record_webhook_received(github_event, action)

    if action != GitHubCheckRunAction.REREQUESTED:
        record_webhook_filtered(github_event, action, WebhookFilteredReason.UNSUPPORTED_ACTION)
        return

    try:
        validated_event = _validate_github_check_run_event(event)
    except (ValidationError, ValueError):
        # Prevent sending a 500 error to GitHub which would trigger a retry
        logger.exception(Log.INVALID_PAYLOAD.value)
        record_webhook_handler_error(
            github_event,
            action,
            CodeReviewErrorType.INVALID_PAYLOAD,
        )
        return

    # Action is supported — create the event record
    event_record = None
    if organization is not None and repo is not None:
        event_record = create_event_record(
            organization_id=organization.id,
            repository_id=repo.id,
            raw_event_type=github_event.value,
            raw_event_action=action,
            trigger_id=github_delivery_id,
            event=event,
            status=CodeReviewEventStatus.WEBHOOK_RECEIVED,
        )

    # Import here to avoid circular dependency with webhook_task
    from .task import process_github_webhook_event

    # Scheduling the work as a task allows us to retry the request if it fails.
    # Convert enum to string for Celery serialization
    process_github_webhook_event.delay(
        github_event=github_event.value,
        # A reduced payload is enough for the task to process.
        event_payload={"original_run_id": validated_event.check_run.external_id},
        enqueued_at_str=datetime.now(timezone.utc).isoformat(),
        trigger_id=github_delivery_id,
        organization_id=organization.id if organization else None,
        repository_id=repo.id if repo else None,
        tags=tags,
    )
    record_webhook_enqueued(github_event, action)
    update_event_status(event_record, CodeReviewEventStatus.TASK_ENQUEUED)


def _validate_github_check_run_event(event: Mapping[str, Any]) -> GitHubCheckRunEvent:
    """Raises ValidationError or ValueError if the payload is invalid."""
    validated_event = GitHubCheckRunEvent.parse_obj(event)
    int(validated_event.check_run.external_id)  # Must be numeric
    return validated_event
