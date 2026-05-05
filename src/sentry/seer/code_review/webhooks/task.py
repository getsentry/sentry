from __future__ import annotations

import logging
from collections.abc import Mapping
from datetime import datetime, timezone
from typing import Any

import sentry_sdk
from pydantic import ValidationError
from taskbroker_client.retry import Retry
from urllib3.exceptions import HTTPError

from sentry.integrations.github.webhook_types import GithubWebhookType
from sentry.models.organization import Organization
from sentry.models.repository import Repository
from sentry.scm.types import PullRequestEvent
from sentry.seer.code_review.models import (
    SeerCodeReviewTaskRequestForPrClosed,
    SeerCodeReviewTaskRequestForPrReview,
    SeerCodeReviewTrigger,
)
from sentry.seer.code_review.utils import (
    is_org_enabled_for_code_review_experiments,
    transform_webhook_to_codegen_request,
)
from sentry.seer.signed_seer_api import SeerViewerContext
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import seer_code_review_tasks
from sentry.utils import json, metrics

from ..metrics import (
    WebhookFilteredReason,
    record_scm_webhook_enqueued,
    record_scm_webhook_filtered,
    record_webhook_enqueued,
    record_webhook_filtered,
)
from ..utils import (
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
        # Use json.loads(validated_payload.json()) to ensure all types are JSON-serializable
        # (datetimes become ISO strings, enums become their values)
        payload = json.loads(validated_payload.json())
    except ValidationError:
        logger.warning("%s.validation_failed_before_scheduling", PREFIX)
        record_webhook_filtered(
            github_event, github_event_action, WebhookFilteredReason.INVALID_PAYLOAD
        )
        return

    process_webhook_event.delay(
        seer_path=get_seer_path_for_request(github_event.value, github_event_action),
        event_payload=payload,
        tags=tags,
    )
    record_webhook_enqueued(github_event, github_event_action)


def schedule_scm_task(
    pull_request_event: PullRequestEvent,
    organization: Organization,
    repo: Repository,
    target_commit_sha: str,
    tags: Mapping[str, object],
) -> None:
    """Transform and forward an SCM pull request event to Seer for processing."""

    action: str = pull_request_event.action
    pr = pull_request_event.pull_request
    provider: str = pull_request_event.subscription_event["type"]

    match action:
        case "opened" | "ready_for_review":
            trigger = SeerCodeReviewTrigger.ON_READY_FOR_REVIEW
        case "synchronize":
            trigger = SeerCodeReviewTrigger.ON_NEW_COMMIT
        case _:
            trigger = SeerCodeReviewTrigger.UNKNOWN

    repo_name_sections = repo.name.split("/")
    if len(repo_name_sections) < 2:
        logger.warning("%s.scm.invalid_repo_name", PREFIX)
        record_scm_webhook_filtered(provider, action, WebhookFilteredReason.TRANSFORM_FAILED)
        return

    scm_provider = repo.provider.removeprefix("integrations:") if repo.provider else provider
    repo_definition: dict[str, Any] = {
        "provider": scm_provider,
        "owner": repo_name_sections[0],
        "name": "/".join(repo_name_sections[1:]),
        "external_id": repo.external_id,
        "base_commit_sha": target_commit_sha,
        "organization_id": repo.organization_id,
        "is_private": pr["is_private_repo"],
    }
    if repo.integration_id is not None:
        repo_definition["integration_id"] = str(repo.integration_id)

    author = pr["author"]
    received_at = datetime.fromtimestamp(
        pull_request_event.subscription_event["received_at"], tz=timezone.utc
    )
    add_experiment_enabled = action not in ("closed", "reopened")

    transformed_event: dict[str, Any] = {
        "external_owner_id": repo.external_id,
        "data": {
            "repo": repo_definition,
            "pr_id": int(pr["id"]),
            "bug_prediction_specific_information": {
                "organization_id": organization.id,
                "organization_slug": organization.slug,
            },
            "config": {
                "features": {"bug_prediction": True},
                "github_rate_limit_sensitive": False,
                "trigger": trigger.value,
                "trigger_user": author["username"] if author else None,
                "trigger_user_id": int(author["id"]) if author else None,
                "trigger_comment_id": None,
                "trigger_comment_type": None,
                "trigger_at": received_at.isoformat(),
                "sentry_received_trigger_at": datetime.now(timezone.utc).isoformat(),
            },
        },
    }
    if add_experiment_enabled:
        transformed_event["data"]["experiment_enabled"] = (
            is_org_enabled_for_code_review_experiments(organization)
        )

    try:
        validated: SeerCodeReviewTaskRequestForPrClosed | SeerCodeReviewTaskRequestForPrReview
        if action == "closed":
            validated = SeerCodeReviewTaskRequestForPrClosed.parse_obj(transformed_event)
        else:
            validated = SeerCodeReviewTaskRequestForPrReview.parse_obj(transformed_event)
        payload = json.loads(validated.json())
    except ValidationError:
        logger.warning("%s.scm.validation_failed_before_scheduling", PREFIX)
        record_scm_webhook_filtered(provider, action, WebhookFilteredReason.INVALID_PAYLOAD)
        return

    process_webhook_event.delay(
        seer_path=get_seer_path_for_request("pull_request", action),
        event_payload=payload,
        tags=tags,
    )
    record_scm_webhook_enqueued(provider, action)


@instrumented_task(
    name="sentry.seer.code_review.tasks.process_github_webhook_event",
    namespace=seer_code_review_tasks,
    retry=Retry(times=MAX_RETRIES, delay=DELAY_BETWEEN_RETRIES, on=RETRYABLE_ERRORS),
    silo_mode=SiloMode.CELL,
)
def process_webhook_event(
    *,
    seer_path: str,
    event_payload: Mapping[str, Any],
    tags: Mapping[str, Any],
) -> None:
    """
    Forward a validated code-review payload to Seer.

    Args:
        seer_path: The path to the Seer API endpoint to call
        event_payload: The payload (already validated before scheduling)
        tags: Sentry SDK tags to set on this task's scope for error correlation
    """
    status = "success"
    try:
        sentry_sdk.set_tags(tags)
        viewer_context: SeerViewerContext | None = None
        if org_id := tags.get("sentry_organization_id"):
            viewer_context = SeerViewerContext(organization_id=int(org_id))

        make_seer_request(path=seer_path, payload=event_payload, viewer_context=viewer_context)
    except Exception as e:
        status = e.__class__.__name__
        raise
    finally:
        if status != "success":
            metrics.incr(f"{PREFIX}.error", tags={"error_status": status}, sample_rate=1.0)
