from __future__ import annotations

import logging
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


@instrumented_task(
    name="sentry.seer.code_review.tasks.process_github_webhook_event",
    namespace=seer_code_review_tasks,
    retry=Retry(times=3, delay=60, on=(HTTPError,)),
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
        **kwargs: Additional logging context & other parameters
    """
    original_run_id = kwargs.get("original_run_id")
    if original_run_id is None:
        logger.error("%s.error", PREFIX, extra=kwargs)
        metrics.incr(f"{PREFIX}.outcome", tags={"status": "invalid_task_parameters"})
        return

    payload = {"original_run_id": original_run_id}
    status = "failure"
    context = {"organization_id": organization_id, **kwargs}

    try:
        if not options.get("coding_workflows.code_review.github.check_run.rerun.enabled"):
            logger.info("Skipping rerun request because the option is disabled", extra=context)
            metrics.incr(f"{PREFIX}.outcome", tags={"status": "option_disabled"})
            return
        response = make_signed_seer_api_request(
            connection_pool=connection_from_url(settings.SEER_AUTOFIX_URL),
            path=SEER_PR_REVIEW_RERUN_PATH,
            body=orjson.dumps(payload),
        )
        # Retry on server errors (5xx) and rate limits (429), but not client errors (4xx)
        if response.status >= 500 or response.status == 429:
            # Server error or rate limit - transient, should retry
            logger.error(
                "%s.error.retryable_status",
                PREFIX,
                extra={**context, "status_code": response.status},
            )
            raise HTTPError(f"Seer returned retryable status {response.status}")
        elif response.status >= 400:
            # Client error (4xx except 429) - permanent, don't retry
            logger.error(
                "%s.error.client_error",
                PREFIX,
                extra={**context, "status_code": response.status},
            )
            status = f"client_error_{response.status}"
        else:
            status = "success"
    except HTTPError as e:
        # Catches all urllib3 errors: TimeoutError, MaxRetryError, NewConnectionError,
        # SSLError, ProxyError, ProtocolError, ResponseError, DecodeError, etc.
        status = e.__class__.__name__
        # Only log exception on the last retry attempt to reduce noise from transient errors
        # times=3 means 3 total attempts: initial + 2 retries (retries are 0-indexed)
        max_retries = 2  # From retry=Retry(times=3, delay=60)
        if self.request.retries >= max_retries:
            logger.exception("%s.error", PREFIX, extra=context)
        raise  # Re-raise to trigger task retry

    metrics.incr(f"{PREFIX}.outcome", tags={"status": status})
