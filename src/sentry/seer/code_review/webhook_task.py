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
from sentry.taskworker.state import current_task
from sentry.utils import metrics

logger = logging.getLogger(__name__)


# This needs to match the value defined in the Seer API:
# https://github.com/getsentry/seer/blob/main/src/seer/routes/codegen.py
SEER_PR_REVIEW_RERUN_PATH = "/v1/automation/codegen/pr-review/rerun"
PREFIX = "seer.code_review.check_run.rerun"
MAX_RETRIES = 3
DELAY_BETWEEN_RETRIES = 60  # 1 minute


@instrumented_task(
    name="sentry.seer.code_review.tasks.process_github_webhook_event",
    namespace=seer_code_review_tasks,
    retry=Retry(times=MAX_RETRIES, delay=DELAY_BETWEEN_RETRIES, on=(HTTPError,)),
    silo_mode=SiloMode.REGION,
)
def process_github_webhook_event(
    *, organization_id: int, enqueued_at_str: str, **kwargs: Any
) -> None:
    """
    Process GitHub webhook event by forwarding to Seer if applicable.

    This will be expanded to handle other GitHub webhook events in the future.

    Args:
        organization_id: The organization ID (for logging/metrics)
        enqueued_at_str: The timestamp when the task was enqueued
        **kwargs: Additional logging context & other parameters
    """
    context = {"organization_id": organization_id, **kwargs}
    if not options.get("coding_workflows.code_review.github.check_run.rerun.enabled"):
        logger.info("Skipping rerun request because the option is disabled", extra=context)
        metrics.incr(f"{PREFIX}.outcome", tags={"status": "option_disabled"})
        return

    original_run_id = kwargs.get("original_run_id")
    if original_run_id is None:
        metrics.incr(f"{PREFIX}.outcome", tags={"status": "missing_required_parameters"})
        raise ValueError("Missing required task parameters.")

    should_record_latency = True

    try:
        status = make_seer_request(original_run_id)
    except HTTPError as e:
        # Catches all urllib3 errors: TimeoutError, MaxRetryError, NewConnectionError,
        # SSLError, ProxyError, ProtocolError, ResponseError, DecodeError, etc.
        status = e.__class__.__name__
        task = current_task()
        if task and task.retries_remaining:
            should_record_latency = False
        # Exception automatically captured to Sentry by taskworker on final retry
        raise  # Trigger task retry (error listed in on= parameter)
    except Exception as e:
        # Unexpected errors are not retryable and indicate a programming or configuration error
        status = f"unexpected_error_{e.__class__.__name__}"
        raise  # Task will fail, no retry for unexpected errors not listed in on= parameter
    finally:
        metrics.incr(f"{PREFIX}.outcome", tags={"status": status})
        if should_record_latency:
            record_latency(status, enqueued_at_str)


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
        raise HTTPError(f"Seer returned retryable status {response.status}")
    elif response.status >= 400:
        # Client errors are permanent, don't retry
        status = f"client_error_{response.status}"
    else:
        status = "success"

    return status


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
