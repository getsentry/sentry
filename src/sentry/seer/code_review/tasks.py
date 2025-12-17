from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

import orjson
from django.conf import settings
from urllib3.exceptions import HTTPError

from sentry import options
from sentry.net.http import connection_from_url
from sentry.seer.signed_seer_api import make_signed_seer_api_request
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import seer_code_review_tasks
from sentry.taskworker.retry import Retry
from sentry.utils import metrics

logger = logging.getLogger(__name__)


SEER_CODEGEN_PATH = "/v1/automation/codegen"
# This needs to match the value defined in the Seer API:
# https://github.com/getsentry/seer/blob/main/src/seer/routes/codegen.py
SEER_PR_REVIEW_RERUN_PATH = f"{SEER_CODEGEN_PATH}/rerun"
PREFIX = "seer.code_review.check_run.rerun"
MAX_RETRIES = 3
DELAY_BETWEEN_RETRIES = 60  # 1 minute


@instrumented_task(
    name="sentry.seer.code_review.tasks.process_github_webhook_event",
    namespace=seer_code_review_tasks,
    retry=Retry(times=MAX_RETRIES, delay=DELAY_BETWEEN_RETRIES, on=(HTTPError,)),
    silo_mode=SiloMode.REGION,
    bind=True,  # Bind task instance to access self.request.retries for conditional logging
)
def process_github_webhook_event(self: Any, *, organization_id: int, **kwargs: Any) -> None:
    """
    Process GitHub webhook event by forwarding to Seer if applicable.

    This will be expanded to handle other GitHub webhook events in the future.

    Args:
        self: Task instance (bound via bind=True)
        organization_id: The organization ID (for logging/metrics)
        **kwargs: Additional logging context & other parameters (including enqueued_at)
    """
    context = {"organization_id": organization_id, **kwargs}
    if not options.get("coding_workflows.code_review.github.check_run.rerun.enabled"):
        logger.info("Skipping rerun request because the option is disabled", extra=context)
        status = "option_disabled"
        return

    original_run_id = kwargs.get("original_run_id")
    enqueued_at_str = kwargs.get("enqueued_at")
    if original_run_id is None or enqueued_at_str is None:
        metrics.incr(f"{PREFIX}.outcome", tags={"status": "invalid_task_parameters"})
        raise ValueError("Missing required task parameters.")

    is_last_attempt = self.request.retries >= MAX_RETRIES - 1

    try:
        status = make_seer_request(original_run_id)
        record_metrics(status, enqueued_at_str, is_last_attempt=True)
    except HTTPError as e:
        # Catches all urllib3 errors: TimeoutError, MaxRetryError, NewConnectionError,
        # SSLError, ProxyError, ProtocolError, ResponseError, DecodeError, etc.
        status = e.__class__.__name__
        # Only log and record metrics on the last retry attempt
        if is_last_attempt:
            logger.exception("%s.error", PREFIX, extra=context)
            record_metrics(status, enqueued_at_str, is_last_attempt=True)
        raise  # Re-raise to trigger task retry


def make_seer_request(original_run_id: str) -> str:
    payload = {"original_run_id": original_run_id}
    status = "failure"
    response = make_signed_seer_api_request(
        connection_pool=connection_from_url(settings.SEER_AUTOFIX_URL),
        path=SEER_PR_REVIEW_RERUN_PATH,
        body=orjson.dumps(payload),
    )
    # Retry on server errors (5xx) and rate limits (429), but not client errors (4xx)
    if response.status >= 500 or response.status == 429:
        # Server error or rate limit - transient, should retry
        raise HTTPError(f"Seer returned retryable status {response.status}")
    elif response.status >= 400:
        # Client error (4xx except 429) - permanent, don't retry
        status = f"client_error_{response.status}"
    else:
        status = "success"

    return status


def record_metrics(status: str, enqueued_at_str: str, is_last_attempt: bool) -> None:
    metrics.incr(f"{PREFIX}.outcome", tags={"status": status})

    # Only record latency on the final attempt
    if is_last_attempt:
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
        # Log but don't fail the task if timestamp parsing fails
        logger.warning(
            "%s.invalid_timestamp",
            PREFIX,
            extra={"enqueued_at": enqueued_at_str, "error": str(e)},
        )
        return 0
