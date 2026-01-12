from __future__ import annotations

import logging
from collections.abc import Mapping
from datetime import datetime, timezone
from typing import Any

from urllib3.exceptions import HTTPError

from sentry import options
from sentry.integrations.github.webhook_types import GithubWebhookType
from sentry.models.organization import Organization
from sentry.models.repository import Repository
from sentry.seer.code_review.utils import (
    get_webhook_option_key,
    transform_webhook_to_codegen_request,
)
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import seer_code_review_tasks
from sentry.taskworker.retry import Retry
from sentry.taskworker.state import current_task
from sentry.utils import metrics

from ..logging import debug_log
from ..metrics import WebhookFilteredReason, record_webhook_filtered
from ..utils import SeerCodeReviewTrigger, get_seer_endpoint_for_event, make_seer_request
from .config import get_direct_to_seer_gh_orgs

logger = logging.getLogger(__name__)


PREFIX = "seer.code_review.task"
MAX_RETRIES = 3
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
    trigger: SeerCodeReviewTrigger,
) -> None:
    """Transform and forward a webhook event to Seer for processing."""
    from .task import process_github_webhook_event

    base_extra = {
        "github_event": github_event.value if hasattr(github_event, "value") else str(github_event),
        "github_event_action": github_event_action,
        "organization_id": organization.id,
        "organization_slug": organization.slug,
        "repo_name": repo.name,
        "target_commit_sha": target_commit_sha,
        "trigger": trigger.value if hasattr(trigger, "value") else str(trigger),
    }

    debug_log("code_review.schedule_task.entry", extra=base_extra)

    transformed_event = transform_webhook_to_codegen_request(
        github_event=github_event,
        event_payload=dict(event),
        organization=organization,
        repo=repo,
        target_commit_sha=target_commit_sha,
        trigger=trigger,
    )

    if transformed_event is None:
        debug_log(
            "code_review.schedule_task.transform_failed",
            extra={**base_extra, "reason": "transform_returned_none"},
        )
        record_webhook_filtered(
            github_event, github_event_action, WebhookFilteredReason.TRANSFORM_FAILED
        )
        return

    debug_log(
        "code_review.schedule_task.transform_success",
        extra={
            **base_extra,
            "payload_keys": (
                list(transformed_event.keys()) if isinstance(transformed_event, dict) else None
            ),
        },
    )

    enqueued_at = datetime.now(timezone.utc).isoformat()

    debug_log(
        "code_review.schedule_task.enqueuing",
        extra={**base_extra, "enqueued_at": enqueued_at},
    )

    process_github_webhook_event.delay(
        github_event=github_event,
        event_payload=transformed_event,
        enqueued_at_str=enqueued_at,
    )

    debug_log("code_review.schedule_task.enqueued", extra=base_extra)


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
    option_key = get_webhook_option_key(github_event)

    # Extract info for logging
    repo_owner = event_payload.get("data", {}).get("repo", {}).get("owner")
    repo_name = event_payload.get("data", {}).get("repo", {}).get("name")
    pr_id = event_payload.get("data", {}).get("pr_id")

    base_extra = {
        "github_event": github_event.value if hasattr(github_event, "value") else str(github_event),
        "enqueued_at": enqueued_at_str,
        "repo_owner": repo_owner,
        "repo_name": repo_name,
        "pr_id": pr_id,
        "option_key": option_key,
    }

    debug_log("code_review.task.entry", extra=base_extra)

    # Skip this check for CHECK_RUN events (always go to Seer)
    if github_event != GithubWebhookType.CHECK_RUN:
        direct_to_seer_orgs = get_direct_to_seer_gh_orgs()
        is_direct_to_seer = repo_owner in direct_to_seer_orgs
        option_value = options.get(option_key) if option_key else None

        debug_log(
            "code_review.task.routing_check",
            extra={
                **base_extra,
                "direct_to_seer_orgs": direct_to_seer_orgs,
                "is_direct_to_seer": is_direct_to_seer,
                "option_value": option_value,
            },
        )

        if repo_owner not in direct_to_seer_orgs:
            # If option is True, Overwatch handles this - skip Seer processing
            if option_key and option_value:
                debug_log(
                    "code_review.task.skipped_overwatch_handles",
                    extra={
                        **base_extra,
                        "reason": "overwatch_enabled_for_this_event_type",
                        "option_key": option_key,
                        "option_value": option_value,
                    },
                )
                return
    else:
        debug_log(
            "code_review.task.check_run_always_seer",
            extra={**base_extra, "reason": "check_run_events_always_go_to_seer"},
        )

    try:
        path = get_seer_endpoint_for_event(github_event).value

        debug_log(
            "code_review.task.seer_request_start",
            extra={
                **base_extra,
                "seer_path": path,
                "payload_keys": (
                    list(event_payload.keys()) if isinstance(event_payload, dict) else None
                ),
            },
        )

        make_seer_request(path=path, payload=event_payload)

        debug_log("code_review.task.seer_request_success", extra=base_extra)
    except Exception as e:
        status = e.__class__.__name__

        debug_log(
            "code_review.task.seer_request_failed",
            extra={
                **base_extra,
                "error_type": status,
                "error_message": str(e),
            },
        )

        # Retryable errors are automatically retried by taskworker.
        if isinstance(e, RETRYABLE_ERRORS):
            task = current_task()
            if task and task.retries_remaining:
                debug_log(
                    "code_review.task.will_retry",
                    extra={
                        **base_extra,
                        "retries_remaining": task.retries_remaining,
                    },
                )
                should_record_latency = False
        raise
    finally:
        if status != "success":
            metrics.incr(f"{PREFIX}.error", tags={"error_status": status}, sample_rate=1.0)
        if should_record_latency:
            record_latency(status, enqueued_at_str)

        debug_log(
            "code_review.task.complete",
            extra={**base_extra, "status": status},
        )


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
