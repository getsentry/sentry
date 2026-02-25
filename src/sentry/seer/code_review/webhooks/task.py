from __future__ import annotations

import logging
from collections.abc import Mapping
from datetime import datetime, timezone
from typing import Any

import sentry_sdk
from urllib3.exceptions import HTTPError

from sentry.integrations.github.webhook_types import GithubWebhookType
from sentry.models.organization import Organization
from sentry.models.repository import Repository
from sentry.seer.code_review.models import (
    SeerCodeReviewTaskRequestForPrClosed,
    SeerCodeReviewTaskRequestForPrReview,
)
from sentry.seer.code_review.utils import transform_webhook_to_codegen_request
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import seer_code_review_tasks
from sentry.taskworker.retry import Retry
from sentry.taskworker.state import current_task
from sentry.utils import metrics

from ..metrics import WebhookFilteredReason, record_webhook_enqueued, record_webhook_filtered
from ..utils import (
    convert_enum_keys_to_strings,
    get_seer_endpoint_for_event,
    make_seer_request,
)

logger = logging.getLogger(__name__)


PREFIX = "seer.code_review.task"
MAX_RETRIES = 5
DELAY_BETWEEN_RETRIES = 60  # 1 minute
RETRYABLE_ERRORS = (HTTPError,)
METRICS_PREFIX = "seer.code_review.task"


def schedule_task(
    github_event: GithubWebhookType,
    github_event_action: str,
    event: Mapping[str, Any],
    organization: Organization,
    repo: Repository,
    target_commit_sha: str,
    tags: Mapping[str, object],
) -> None:
    """Transform and forward a webhook event to Seer for processing."""
    from .task import process_github_webhook_event

    transformed_event = transform_webhook_to_codegen_request(
        github_event=github_event,
        github_event_action=github_event_action,
        event_payload=dict(event),
        organization=organization,
        repo=repo,
        target_commit_sha=target_commit_sha,
    )

    if transformed_event is None:
        record_webhook_filtered(
            github_event, github_event_action, WebhookFilteredReason.TRANSFORM_FAILED
        )
        return

    # Validate payload before scheduling to catch schema mismatches early
    from pydantic import ValidationError

    try:
        request_type = transformed_event.get("request_type")
        validated_payload: (
            SeerCodeReviewTaskRequestForPrClosed | SeerCodeReviewTaskRequestForPrReview
        )
        if request_type == "pr-closed":
            validated_payload = SeerCodeReviewTaskRequestForPrClosed.parse_obj(transformed_event)
        else:
            validated_payload = SeerCodeReviewTaskRequestForPrReview.parse_obj(transformed_event)
        # Convert to dict and handle enum keys (Pydantic v1 converts string keys to enums,
        # but JSON requires string keys, so we need to convert them back)
        payload = convert_enum_keys_to_strings(validated_payload.dict())
        # When upgrading to Pydantic v2, we can remove the convert_enum_keys_to_strings call.
        # Pydantic v2 will automatically convert enum keys to strings.
        # payload = validated_payload.model_dump(mode="json")
    except ValidationError:
        logger.warning("%s.validation_failed_before_scheduling", PREFIX)
        record_webhook_filtered(
            github_event, github_event_action, WebhookFilteredReason.INVALID_PAYLOAD
        )
        return

    process_github_webhook_event.delay(
        github_event=github_event.value,
        event_payload=payload,
        enqueued_at_str=datetime.now(timezone.utc).isoformat(),
        tags=tags,
    )
    record_webhook_enqueued(github_event, github_event_action)


@instrumented_task(
    name="sentry.seer.code_review.tasks.process_github_webhook_event",
    namespace=seer_code_review_tasks,
    retry=Retry(times=MAX_RETRIES, delay=DELAY_BETWEEN_RETRIES, on=RETRYABLE_ERRORS),
    silo_mode=SiloMode.REGION,
)
def process_github_webhook_event(
    *,
    enqueued_at_str: str,
    github_event: str,
    event_payload: Mapping[str, Any],
    tags: Mapping[str, Any] | None = None,
    **kwargs: Any,
) -> None:
    """
    Process GitHub webhook event by forwarding to Seer if applicable.

    Args:
        enqueued_at_str: The timestamp when the task was enqueued
        github_event: The GitHub webhook event type from X-GitHub-Event header (e.g., "check_run", "pull_request")
        event_payload: The payload of the webhook event (already validated before scheduling)
        tags: Sentry SDK tags to set on this task's scope for error correlation
        **kwargs: Parameters to pass to webhook handler functions
    """
    status = "success"
    should_record_latency = True
    try:
        if tags:
            sentry_sdk.set_tags(tags)
        path = get_seer_endpoint_for_event(github_event).value
        make_seer_request(path=path, payload=event_payload)
    except Exception as e:
        status = e.__class__.__name__
        # Retryable errors are automatically retried by taskworker.
        if isinstance(e, RETRYABLE_ERRORS):
            task = current_task()
            if task and task.retries_remaining:
                should_record_latency = False
        raise
    finally:
        if status != "success":
            metrics.incr(f"{PREFIX}.error", tags={"error_status": status}, sample_rate=1.0)
        if should_record_latency:
            record_latency(status, enqueued_at_str)


def record_latency(status: str, enqueued_at_str: str) -> None:
    latency_ms = calculate_latency_ms(enqueued_at_str)
    if latency_ms > 0:
        metrics.timing(f"{PREFIX}.e2e_latency", latency_ms, tags={"status": status})


def calculate_latency_ms(timestamp_str: str) -> int:
    """Calculate the latency in milliseconds between the given timestamp and now."""
    try:
        timestamp = datetime.fromisoformat(timestamp_str)
        now = datetime.now(timezone.utc)
        return int((now - timestamp).total_seconds() * 1000)
    except (ValueError, TypeError) as e:
        # Don't fail the task if timestamp parsing fails
        logger.warning(
            "%s.invalid_timestamp",
            PREFIX,
            extra={"timestamp": timestamp_str, "error": str(e)},
        )
        return 0
