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
    extract_github_info,
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

    # Convert enum to string for Celery serialization
    process_github_webhook_event.delay(
        github_event=github_event.value,
        event_payload=transformed_event,
        enqueued_at_str=datetime.now(timezone.utc).isoformat(),
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
        _set_tags(event_payload, github_event)
        path = get_seer_endpoint_for_event(github_event).value

        # Validate payload with Pydantic (except for CHECK_RUN events which use minimal payload)
        if github_event != GithubWebhookType.CHECK_RUN:
            # Parse with appropriate model based on request type to enforce
            # organization_id and integration_id requirements for PR closed
            request_type = event_payload.get("request_type")
            validated_payload: (
                SeerCodeReviewTaskRequestForPrClosed | SeerCodeReviewTaskRequestForPrReview
            )
            if request_type == "pr-closed":
                validated_payload = SeerCodeReviewTaskRequestForPrClosed.parse_obj(event_payload)
            else:
                validated_payload = SeerCodeReviewTaskRequestForPrReview.parse_obj(event_payload)
            # Convert to dict and handle enum keys (Pydantic v1 converts string keys to enums,
            # but JSON requires string keys, so we need to convert them back)
            payload = convert_enum_keys_to_strings(validated_payload.dict())
            # When upgrading to Pydantic v2, we can remove the convert_enum_keys_to_strings call.
            # Pydantic v2 will automatically convert enum keys to strings.
            # payload = validated_payload.model_dump(mode="json")
        else:
            payload = event_payload

        record_github_to_seer_latency(event_payload)
        make_seer_request(path=path, payload=payload)
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


def _set_tags(event_payload: Mapping[str, Any], github_event: str) -> None:
    """Set Sentry SDK tags for error correlation.

    Builds a synthetic GitHub-event-like dict from the Seer task payload so that
    extract_github_info can be used. extract_github_info sets the scm_* tags;
    this function adds the task-payload-specific extras and overrides scm_event_url
    based on trigger type, mirroring Seer's extract_context().
    """
    data = event_payload.get("data", {})
    repo_data = data.get("repo", {})
    config = data.get("config", {}) or {}
    owner = repo_data.get("owner")
    name = repo_data.get("name")
    pr_id = data.get("pr_id")

    # Build a minimal GitHub-event-like dict so extract_github_info can parse it.
    # extract_github_info also calls sentry_sdk.set_tags() for the scm_* fields.
    synthetic_event: dict[str, Any] = {}
    if owner or name:
        synthetic_event["repository"] = {
            "owner": {"login": owner},
            "name": name,
            "full_name": f"{owner}/{name}" if owner and name else None,
        }
    if pr_id:
        synthetic_event["pull_request"] = {
            "html_url": f"https://github.com/{owner}/{name}/pull/{pr_id}"
            if owner and name
            else None,
        }
    trigger = config.get("trigger")
    extract_github_info(synthetic_event, github_event=github_event, trigger=trigger)

    # Override scm_event_url based on trigger type (default PR URL is already set above).
    # ON_NEW_COMMIT → commit URL; ON_COMMAND_PHRASE → comment URL.
    commit_sha = repo_data.get("base_commit_sha")
    comment_id = config.get("trigger_comment_id")
    if trigger == "on_new_commit" and owner and name and commit_sha:
        sentry_sdk.set_tag(
            "scm_event_url", f"https://github.com/{owner}/{name}/commit/{commit_sha}"
        )
    elif trigger == "on_command_phrase" and owner and name and pr_id and comment_id:
        sentry_sdk.set_tag(
            "scm_event_url",
            f"https://github.com/{owner}/{name}/pull/{pr_id}#issuecomment-{comment_id}",
        )

    # Extra tags from the Seer payload not in the raw webhook event.
    sentry_sdk.set_tags(
        {
            k: v
            for k, v in {
                "pr_id": pr_id,
                "sentry_organization_id": repo_data.get("organization_id"),
                "sentry_integration_id": repo_data.get("integration_id"),
            }.items()
            if v is not None
        }
    )


def record_latency(status: str, enqueued_at_str: str) -> None:
    latency_ms = calculate_latency_ms(enqueued_at_str)
    if latency_ms > 0:
        metrics.timing(f"{PREFIX}.e2e_latency", latency_ms, tags={"status": status})


def record_github_to_seer_latency(event_payload: Mapping[str, Any]) -> None:
    """Record the latency from when GitHub triggered the event to when Seer is called."""
    trigger_at_str = (event_payload.get("data", {}).get("config") or {}).get("trigger_at")
    if not trigger_at_str:
        return
    latency_ms = calculate_latency_ms(trigger_at_str)
    if latency_ms > 0:
        metrics.timing(f"{PREFIX}.github_to_seer_latency", latency_ms, sample_rate=1.0)


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
