from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import Any

import sentry_sdk
from taskbroker_client.retry import Retry
from urllib3.exceptions import HTTPError

from sentry.integrations.github.webhook_types import GithubWebhookType
from sentry.models.organization import Organization
from sentry.models.repository import Repository
from sentry.seer.code_review.models import (
    SeerCodeReviewTaskRequestForPrClosed,
    SeerCodeReviewTaskRequestForPrReview,
)
from sentry.seer.code_review.utils import transform_webhook_to_codegen_request
from sentry.seer.signed_seer_api import SeerViewerContext
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import seer_code_review_tasks
from sentry.utils import metrics

from ..metrics import WebhookFilteredReason, record_webhook_enqueued, record_webhook_filtered
from ..utils import (
    convert_enum_keys_to_strings,
    get_seer_path_for_request,
    make_seer_request,
)

logger = logging.getLogger(__name__)


PREFIX = "seer.code_review.task"
MAX_RETRIES = 5
DELAY_BETWEEN_RETRIES = 60  # 1 minute
RETRYABLE_ERRORS = (HTTPError,)


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
        validated_payload: (
            SeerCodeReviewTaskRequestForPrClosed | SeerCodeReviewTaskRequestForPrReview
        )
        if github_event == GithubWebhookType.PULL_REQUEST and github_event_action == "closed":
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
        seer_path=get_seer_path_for_request(github_event.value, github_event_action),
        event_payload=payload,
        tags=tags,
    )
    record_webhook_enqueued(github_event, github_event_action)


@instrumented_task(
    name="sentry.seer.code_review.tasks.process_github_webhook_event",
    namespace=seer_code_review_tasks,
    retry=Retry(times=MAX_RETRIES, delay=DELAY_BETWEEN_RETRIES, on=RETRYABLE_ERRORS),
    silo_mode=SiloMode.CELL,
)
def process_github_webhook_event(
    *,
    seer_path: str,
    event_payload: Mapping[str, Any],
    tags: Mapping[str, Any] | None = None,
    **kwargs: Any,
) -> None:
    """
    Forward a validated code-review payload to Seer.

    Args:
        seer_path: The path to the Seer API endpoint to call
        event_payload: The payload (already validated before scheduling)
        tags: Sentry SDK tags to set on this task's scope for error correlation
        **kwargs: Absorbs legacy serialized task arguments from in-flight work
            (e.g. removed ``enqueued_at_str``).
    """
    status = "success"
    try:
        if tags:
            sentry_sdk.set_tags(tags)
        viewer_context: SeerViewerContext | None = None
        if tags and (org_id := tags.get("sentry_organization_id")):
            viewer_context = SeerViewerContext(organization_id=int(org_id))

        make_seer_request(path=seer_path, payload=event_payload, viewer_context=viewer_context)
    except Exception as e:
        status = e.__class__.__name__
        raise
    finally:
        if status != "success":
            metrics.incr(f"{PREFIX}.error", tags={"error_status": status}, sample_rate=1.0)
