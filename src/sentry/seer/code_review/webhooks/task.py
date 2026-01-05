from __future__ import annotations

import logging
from collections.abc import Mapping
from datetime import datetime, timezone
from typing import Any

from urllib3.exceptions import HTTPError

from sentry.integrations.github.webhook_types import GithubWebhookType
from sentry.models.organization import Organization
from sentry.models.repository import Repository
from sentry.models.repositorysettings import CodeReviewTrigger
from sentry.seer.code_review.utils import transform_webhook_to_codegen_request
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import seer_code_review_tasks
from sentry.taskworker.retry import Retry
from sentry.taskworker.state import current_task
from sentry.utils import metrics

from ..utils import SeerEndpoint, make_seer_request
from .check_run import process_check_run_task_event

logger = logging.getLogger(__name__)


PREFIX = "seer.code_review.task"
MAX_RETRIES = 3
DELAY_BETWEEN_RETRIES = 60  # 1 minute
RETRYABLE_ERRORS = (HTTPError,)
METRICS_PREFIX = "seer.code_review.task"


def _call_seer_request(
    *, github_event: GithubWebhookType, event_payload: Mapping[str, Any], **kwargs: Any
) -> None:
    """
    XXX: This is a placeholder processor to send events to Seer.
    """
    assert github_event != GithubWebhookType.CHECK_RUN
    # XXX: Add checking options to prevent sending events to Seer by mistake.
    make_seer_request(path=SeerEndpoint.OVERWATCH_REQUEST.value, payload=event_payload)


def schedule_task(
    github_event: GithubWebhookType,
    event: Mapping[str, Any],
    organization: Organization,
    repo: Repository,
    target_commit_sha: str,
    trigger: CodeReviewTrigger,
) -> None:
    """Transform and forward a webhook event to Seer for processing."""
    from .task import process_github_webhook_event

    transformed_event = transform_webhook_to_codegen_request(
        github_event=github_event,
        event_payload=dict(event),
        organization=organization,
        repo=repo,
        target_commit_sha=target_commit_sha,
        trigger=trigger,
    )

    if transformed_event is None:
        metrics.incr(
            f"{METRICS_PREFIX}.{github_event.value}.skipped",
            tags={"reason": "failed_to_transform", "github_event": github_event.value},
        )
        return

    process_github_webhook_event.delay(
        github_event=github_event,
        event_payload=transformed_event,
        enqueued_at_str=datetime.now(timezone.utc).isoformat(),
    )
    metrics.incr(
        f"{METRICS_PREFIX}.{github_event.value}.enqueued",
        tags={"status": "success", "github_event": github_event.value},
    )


EVENT_TYPE_TO_PROCESSOR = {GithubWebhookType.CHECK_RUN: process_check_run_task_event}


@instrumented_task(
    name="sentry.seer.code_review.tasks.process_github_webhook_event",
    namespace=seer_code_review_tasks,
    retry=Retry(times=MAX_RETRIES, delay=DELAY_BETWEEN_RETRIES, on=RETRYABLE_ERRORS),
    silo_mode=SiloMode.REGION,
)
def process_github_webhook_event(
    *,
    enqueued_at_str: str,
    github_event: GithubWebhookType,
    event_payload: Mapping[str, Any],
    **kwargs: Any,
) -> None:
    """
    Process GitHub webhook event by forwarding to Seer if applicable.

    Args:
        enqueued_at_str: The timestamp when the task was enqueued
        github_event: The GitHub webhook event type from X-GitHub-Event header (e.g., "check_run", "pull_request")
        event_payload: The payload of the webhook event
        **kwargs: Parameters to pass to webhook handler functions
    """
    status = "success"
    should_record_latency = True
    try:
        event_processor = EVENT_TYPE_TO_PROCESSOR.get(github_event)
        if event_processor:
            event_processor(event_payload=event_payload, **kwargs)
        else:
            _call_seer_request(github_event=github_event, event_payload=event_payload, **kwargs)
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
            metrics.incr(f"{PREFIX}.error", tags={"error_status": status})
        if should_record_latency:
            record_latency(status, enqueued_at_str)


def record_latency(status: str, enqueued_at_str: str) -> None:
    latency_ms = calculate_latency(enqueued_at_str)
    if latency_ms > 0:
        metrics.timing(f"{PREFIX}.e2e_latency", latency_ms, tags={"status": status})


def calculate_latency(enqueued_at_str: str) -> int:
    """Calculate the latency between the enqueued_at timestamp and the current time."""
    try:
        enqueued_at = datetime.fromisoformat(enqueued_at_str)
        processing_started_at = datetime.now(timezone.utc)
        return int((processing_started_at - enqueued_at).total_seconds() * 1000)
    except (ValueError, TypeError) as e:
        # Don't fail the task if timestamp parsing fails
        logger.warning(
            "%s.invalid_timestamp",
            PREFIX,
            extra={"enqueued_at": enqueued_at_str, "error": str(e)},
        )
        return 0
