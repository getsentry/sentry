"""
Webhooks for GitHub check_run webhook events.

This module is used to handle GitHub check_run webhook events for PR review rerun.
When a user clicks "Re-run" on a check run in GitHub UI, we enqueue
a task to forward the original run ID to Seer so it can rerun the PR review.
"""

from __future__ import annotations

import enum
import logging
from collections.abc import Mapping
from datetime import datetime, timezone
from enum import StrEnum
from typing import Any

from pydantic import BaseModel, Field, ValidationError  # noqa: F401

from sentry.models.organization import Organization
from sentry.utils import metrics

from ..permissions import has_code_review_enabled
from ..utils import SeerEndpoint, make_seer_request
from .types import EventType

logger = logging.getLogger(__name__)


class ErrorStatus(enum.StrEnum):
    MISSING_ORGANIZATION = "missing_organization"
    MISSING_ACTION = "missing_action"
    CODE_REVIEW_NOT_ENABLED = "code_review_not_enabled"
    INVALID_PAYLOAD = "invalid_payload"


class Log(enum.StrEnum):
    MISSING_ORGANIZATION = "github.webhook.check_run.missing-organization"
    MISSING_ACTION = "github.webhook.check_run.missing-action"
    INVALID_PAYLOAD = "github.webhook.check_run.invalid-payload"
    INVALID_EXTERNAL_ID = "github.webhook.check_run.invalid-external-id"


class Metrics(enum.StrEnum):
    ERROR = "seer.code_review.error"


SUCCESS_STATUS = "success"


class GitHubCheckRunAction(StrEnum):
    COMPLETED = "completed"
    CREATED = "created"
    REQUESTED_ACTION = "requested_action"
    REREQUESTED = "rerequested"


class GitHubCheckRunData(BaseModel):
    """GitHub check_run object structure."""

    external_id: str = Field(..., description="The external ID set by Seer")
    html_url: str = Field(..., description="The URL to view the check run on GitHub")

    class Config:
        extra = "allow"  # Allow additional fields from GitHub (Pydantic v1 syntax)


class GitHubCheckRunEvent(BaseModel):
    """
    GitHub check_run webhook event payload.
    https://docs.github.com/en/webhooks/webhook-events-and-payloads#check_run
    """

    action: str = Field(..., description="The action performed (e.g., 'rerequested')")
    check_run: GitHubCheckRunData = Field(..., description="The check run data")

    class Config:
        extra = "allow"  # Allow additional fields from GitHub (Pydantic v1 syntax)


def handle_check_run_event(
    *, event_type: str, event: Mapping[str, Any], organization: Organization, **kwargs: Any
) -> None:
    """
    This is called when a check_run event is received from GitHub.
    When a user clicks "Re-run" on a check run in GitHub UI, we enqueue
    a task to forward the original run ID to Seer so it can rerun the PR review.

    Args:
        event_type: The type of the webhook event (as string)
        event: The webhook event payload
        organization: The Sentry organization that the webhook event belongs to
        **kwargs: Additional keyword arguments
    """
    if event_type != EventType.CHECK_RUN:
        return

    action = event.get("action")
    # We can use html_url to search through the logs for this event.
    extra = {"html_url": event.get("check_run", {}).get("html_url"), "action": action}
    tags = {"action": action}

    if action is None:
        logger.error(Log.MISSING_ACTION.value, extra=extra)
        metrics.incr(
            f"{Metrics.ERROR.value}",
            tags={**tags, "error_status": ErrorStatus.MISSING_ACTION.value},
        )
        return

    if action != GitHubCheckRunAction.REREQUESTED:
        return

    if not has_code_review_enabled(organization):
        metrics.incr(
            f"{Metrics.ERROR.value}",
            tags={**tags, "error_status": ErrorStatus.CODE_REVIEW_NOT_ENABLED.value},
        )
        return

    try:
        validated_event = _validate_github_check_run_event(event)
    except (ValidationError, ValueError):
        # Prevent sending a 500 error to GitHub which would trigger a retry
        logger.exception(Log.INVALID_PAYLOAD.value, extra=extra)
        metrics.incr(
            f"{Metrics.ERROR.value}",
            tags={**tags, "error_status": ErrorStatus.INVALID_PAYLOAD.value},
        )
        return

    # Import here to avoid circular dependency with webhook_task
    from .task import process_github_webhook_event

    # Scheduling the work as a task allows us to retry the request if it fails.
    process_github_webhook_event.delay(
        event_type=EventType.CHECK_RUN,
        # A reduced payload is enough for the task to process.
        event_payload={"original_run_id": validated_event.check_run.external_id},
        action=validated_event.action,
        html_url=validated_event.check_run.html_url,
        enqueued_at_str=datetime.now(timezone.utc).isoformat(),
    )


def _validate_github_check_run_event(event: Mapping[str, Any]) -> GitHubCheckRunEvent:
    """
    Validate GitHub check_run event payload using Pydantic.

    Raises:
        ValidationError: If the event payload is invalid
        ValueError: If external_id is not numeric
    """
    validated_event = GitHubCheckRunEvent.parse_obj(event)
    int(validated_event.check_run.external_id)  # Raises ValueError if not numeric
    return validated_event


def process_check_run_task_event(
    *, event_type: str, event_payload: Mapping[str, Any], **kwargs: Any
) -> None:
    """
    Process check_run task events.

    Only processes events with event_type='check_run'.
    This allows the task to be shared by multiple webhook types without conflicts.
    """
    if event_type != EventType.CHECK_RUN:
        return

    original_run_id = event_payload["original_run_id"]
    payload = {"original_run_id": original_run_id}
    make_seer_request(path=SeerEndpoint.PR_REVIEW_RERUN.value, payload=payload)
