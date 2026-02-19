from __future__ import annotations

import logging
from collections.abc import Mapping
from datetime import datetime, timezone
from typing import Any

from django.db import IntegrityError

from sentry.models.code_review_event import CodeReviewEvent, CodeReviewEventStatus

logger = logging.getLogger(__name__)


def _extract_pr_state(pr: Mapping[str, Any]) -> str | None:
    """Derive PR state from GitHub's state + merged fields."""
    if pr.get("merged"):
        return "merged"
    state = pr.get("state")
    if state in ("open", "closed"):
        return state
    return None


def _extract_pr_metadata(
    raw_event_type: str,
    event: Mapping[str, Any],
) -> dict[str, Any]:
    """Extract PR metadata from a webhook payload based on event type."""
    pr_number = None
    pr_title = None
    pr_author = None
    pr_url = None
    pr_state = None
    target_commit_sha = None

    if raw_event_type == "pull_request":
        pr = event.get("pull_request", {})
        pr_number = pr.get("number")
        pr_title = pr.get("title")
        pr_author = pr.get("user", {}).get("login")
        pr_url = pr.get("html_url")
        pr_state = _extract_pr_state(pr)
        target_commit_sha = pr.get("head", {}).get("sha")
    elif raw_event_type == "issue_comment":
        issue = event.get("issue", {})
        pr_number = issue.get("number")
        pr_title = issue.get("title")
        pr_author = issue.get("user", {}).get("login")
        pr_url = issue.get("pull_request", {}).get("html_url")
        pr_state = issue.get("state")

    return {
        "pr_number": pr_number,
        "pr_title": pr_title,
        "pr_author": pr_author,
        "pr_url": pr_url,
        "pr_state": pr_state,
        "target_commit_sha": target_commit_sha,
    }


_TRIGGER_MAP: dict[str, dict[str, str]] = {
    "pull_request": {
        "opened": "pr_opened",
        "synchronize": "new_commit",
        "ready_for_review": "ready_for_review",
        "closed": "pr_closed",
    },
    "issue_comment": {
        "created": "comment_command",
    },
    "check_run": {
        "rerequested": "rerun",
    },
}


def _extract_trigger_metadata(
    raw_event_type: str,
    raw_event_action: str,
    event: Mapping[str, Any],
) -> dict[str, Any]:
    """Extract provider-agnostic trigger fields from a webhook payload."""
    trigger = _TRIGGER_MAP.get(raw_event_type, {}).get(raw_event_action)
    trigger_user = event.get("sender", {}).get("login")
    trigger_at = _extract_trigger_timestamp(raw_event_type, event)

    return {
        "trigger": trigger,
        "trigger_user": trigger_user,
        "trigger_at": trigger_at,
    }


def _extract_trigger_timestamp(raw_event_type: str, event: Mapping[str, Any]) -> datetime:
    """Extract the trigger timestamp from the webhook payload.

    Falls back to now() for event types without a payload timestamp
    (e.g. check_run rerequested) or when parsing fails.
    """
    timestamp_str: str | None = None
    if raw_event_type == "pull_request":
        timestamp_str = event.get("pull_request", {}).get("updated_at")
    elif raw_event_type == "issue_comment":
        timestamp_str = event.get("comment", {}).get("created_at")

    if not timestamp_str:
        return datetime.now(timezone.utc)
    try:
        dt = datetime.fromisoformat(timestamp_str)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except (ValueError, TypeError):
        return datetime.now(timezone.utc)


def create_event_record(
    *,
    organization_id: int,
    repository_id: int,
    raw_event_type: str,
    raw_event_action: str,
    trigger_id: str | None,
    event: Mapping[str, Any],
    status: str,
    denial_reason: str | None = None,
) -> CodeReviewEvent | None:
    now = datetime.now(timezone.utc)
    pr_metadata = _extract_pr_metadata(raw_event_type, event)
    trigger_metadata = _extract_trigger_metadata(raw_event_type, raw_event_action, event)

    timestamp_field = _status_to_timestamp_field(status)
    timestamps = {timestamp_field: now} if timestamp_field else {}
    # Always record webhook_received_at since we're processing a webhook
    timestamps.setdefault("webhook_received_at", now)

    try:
        return CodeReviewEvent.objects.create(
            organization_id=organization_id,
            repository_id=repository_id,
            raw_event_type=raw_event_type,
            raw_event_action=raw_event_action,
            trigger_id=trigger_id,
            status=status,
            denial_reason=denial_reason,
            **pr_metadata,
            **trigger_metadata,
            **timestamps,
        )
    except IntegrityError:
        logger.info(
            "seer.code_review.event_recorder.create_duplicate",
            extra={
                "organization_id": organization_id,
                "repository_id": repository_id,
                "trigger_id": trigger_id,
            },
        )
        return None


def update_event_status(
    event_record: CodeReviewEvent | None,
    status: str,
    *,
    denial_reason: str | None = None,
) -> None:
    if event_record is None:
        return

    now = datetime.now(timezone.utc)
    update_fields: dict[str, Any] = {"status": status}

    if denial_reason:
        update_fields["denial_reason"] = denial_reason

    timestamp_field = _status_to_timestamp_field(status)
    if timestamp_field:
        update_fields[timestamp_field] = now

    CodeReviewEvent.objects.filter(id=event_record.id).update(**update_fields)


def find_event_by_trigger_id(
    trigger_id: str,
    organization_id: int | None = None,
    repository_id: int | None = None,
) -> CodeReviewEvent | None:
    if not trigger_id:
        return None
    filters: dict[str, Any] = {"trigger_id": trigger_id}
    if organization_id is not None:
        filters["organization_id"] = organization_id
    if repository_id is not None:
        filters["repository_id"] = repository_id
    return CodeReviewEvent.objects.filter(**filters).first()


_STATUS_TIMESTAMP_MAP: dict[str, str] = {
    CodeReviewEventStatus.WEBHOOK_RECEIVED: "webhook_received_at",
    CodeReviewEventStatus.PREFLIGHT_DENIED: "preflight_completed_at",
    CodeReviewEventStatus.WEBHOOK_FILTERED: "preflight_completed_at",
    CodeReviewEventStatus.TASK_ENQUEUED: "task_enqueued_at",
    CodeReviewEventStatus.SENT_TO_SEER: "sent_to_seer_at",
    CodeReviewEventStatus.REVIEW_STARTED: "review_started_at",
    CodeReviewEventStatus.REVIEW_COMPLETED: "review_completed_at",
    CodeReviewEventStatus.REVIEW_FAILED: "review_completed_at",
}


def _status_to_timestamp_field(status: str) -> str | None:
    return _STATUS_TIMESTAMP_MAP.get(status)
