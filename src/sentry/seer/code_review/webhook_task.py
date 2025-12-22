from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from urllib3.exceptions import HTTPError

from sentry.seer.code_review.webhooks import PROCESSORS
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import seer_code_review_tasks
from sentry.taskworker.retry import Retry
from sentry.taskworker.state import current_task
from sentry.utils import metrics

logger = logging.getLogger(__name__)


PREFIX = "seer.code_review.task"
MAX_RETRIES = 3
DELAY_BETWEEN_RETRIES = 60  # 1 minute
RETRYABLE_ERRORS = (HTTPError,)


@instrumented_task(
    name="sentry.seer.code_review.tasks.process_github_webhook_event",
    namespace=seer_code_review_tasks,
    retry=Retry(times=MAX_RETRIES, delay=DELAY_BETWEEN_RETRIES, on=RETRYABLE_ERRORS),
    silo_mode=SiloMode.REGION,
)
def process_github_webhook_event(
    *, enqueued_at_str: str, organization_id: int | None = None, **kwargs: Any
) -> None:
    """
    Process GitHub webhook event by forwarding to Seer if applicable.

    Args:
        organization_id: The organization ID (TO BE DEPRECATED)
        enqueued_at_str: The timestamp when the task was enqueued
        **kwargs: Parameters to pass to webhook handler functions
    """
    status = "success"
    should_record_latency = True
    try:
        # XXX: We may be able to add mapping from webhook event to the right processor.
        for processor in PROCESSORS:
            processor(kwargs=kwargs)
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
