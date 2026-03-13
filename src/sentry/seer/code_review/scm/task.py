"""
Provider-agnostic Celery task and payload builder for SCM code review.

All functions work with normalized PullRequestEvent and derive the provider
from the subscription_event metadata.
"""

from __future__ import annotations

import logging
from collections.abc import Mapping
from datetime import datetime, timezone
from typing import Any

import sentry_sdk
from urllib3.exceptions import HTTPError

from sentry.models.organization import Organization
from sentry.models.repository import Repository
from sentry.scm.types import PullRequestAction, PullRequestEvent
from sentry.seer.code_review.models import (
    SeerCodeReviewTaskRequestForPrClosed,
    SeerCodeReviewTaskRequestForPrReview,
    SeerCodeReviewTrigger,
)
from sentry.seer.code_review.utils import (
    SeerEndpoint,
    convert_enum_keys_to_strings,
    is_org_enabled_for_code_review_experiments,
    make_seer_request,
)
from sentry.seer.signed_seer_api import SeerViewerContext
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import seer_code_review_tasks
from sentry.taskworker.retry import Retry
from sentry.taskworker.state import current_task
from sentry.utils import metrics

logger = logging.getLogger(__name__)

PREFIX = "seer.code_review.scm.task"
MAX_RETRIES = 5
DELAY_BETWEEN_RETRIES = 60
RETRYABLE_ERRORS = (HTTPError,)

# Map PullRequestAction → SeerCodeReviewTrigger
ACTION_TRIGGER_MAP: dict[PullRequestAction, SeerCodeReviewTrigger] = {
    "opened": SeerCodeReviewTrigger.ON_READY_FOR_REVIEW,
    "synchronize": SeerCodeReviewTrigger.ON_NEW_COMMIT,
}


def _get_seer_path(action: PullRequestAction) -> str:
    if action == "closed":
        return SeerEndpoint.V2_CODE_REVIEW_PR_CLOSED.value
    return SeerEndpoint.V2_CODE_REVIEW_REVIEW_REQUEST.value


def build_seer_v2_payload(
    event: PullRequestEvent,
    organization: Organization,
    repo: Repository,
    integration_id: int,
    provider: str,
) -> dict[str, Any] | None:
    """Build the Seer v2 code review request payload from a normalized PullRequestEvent."""
    action = event.action
    pr = event.pull_request
    head_sha = pr["head"]["sha"]

    if not head_sha and action != "closed":
        logger.warning("%s.missing_head_sha", PREFIX, extra={"provider": provider})
        return None

    # Parse owner/name from repo.name (format: "group/project" or "group/subgroup/project")
    repo_name_sections = repo.name.split("/")
    if len(repo_name_sections) < 2:
        logger.warning(
            "%s.invalid_repo_name",
            PREFIX,
            extra={"repo_name": repo.name},
        )
        return None

    trigger = ACTION_TRIGGER_MAP.get(action, SeerCodeReviewTrigger.UNKNOWN)
    is_pr_review = action not in ("closed", "reopened")

    author = pr.get("author")

    repo_definition: dict[str, Any] = {
        "provider": provider,
        "owner": repo_name_sections[0],
        "name": "/".join(repo_name_sections[1:]),
        "external_id": repo.external_id,
        "base_commit_sha": head_sha or "",
        "organization_id": repo.organization_id,
        "is_private": pr.get("is_private_repo"),
    }
    if repo.integration_id is not None:
        repo_definition["integration_id"] = str(repo.integration_id)

    data: dict[str, Any] = {
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
            "trigger_at": datetime.now(timezone.utc).isoformat(),
            "sentry_received_trigger_at": datetime.now(timezone.utc).isoformat(),
        },
    }

    if is_pr_review:
        data["experiment_enabled"] = is_org_enabled_for_code_review_experiments(organization)

    return {
        "external_owner_id": repo.external_id,
        "data": data,
    }


def schedule_scm_code_review_task(
    event: PullRequestEvent,
    organization: Organization,
    repo: Repository,
    integration_id: int,
) -> None:
    """Build payload and schedule the Celery task."""
    provider = event.subscription_event["type"]
    action = event.action

    payload = build_seer_v2_payload(
        event=event,
        organization=organization,
        repo=repo,
        integration_id=integration_id,
        provider=provider,
    )
    if payload is None:
        return

    # Validate with Pydantic before scheduling
    from pydantic import ValidationError

    try:
        if action == "closed":
            validated = SeerCodeReviewTaskRequestForPrClosed.parse_obj(payload)
        else:
            validated = SeerCodeReviewTaskRequestForPrReview.parse_obj(payload)
        serialized_payload = convert_enum_keys_to_strings(validated.dict())
    except ValidationError:
        logger.warning("%s.validation_failed", PREFIX, extra={"provider": provider})
        return

    process_scm_code_review_event.delay(
        seer_path=_get_seer_path(action),
        event_payload=serialized_payload,
        enqueued_at_str=datetime.now(timezone.utc).isoformat(),
        scm_provider=provider,
        organization_id=organization.id,
    )


@instrumented_task(
    name="sentry.seer.code_review.scm.process_scm_code_review_event",
    namespace=seer_code_review_tasks,
    retry=Retry(times=MAX_RETRIES, delay=DELAY_BETWEEN_RETRIES, on=RETRYABLE_ERRORS),
    silo_mode=SiloMode.CELL,
)
def process_scm_code_review_event(
    *,
    seer_path: str,
    event_payload: Mapping[str, Any],
    enqueued_at_str: str,
    scm_provider: str = "",
    organization_id: int | None = None,
    **kwargs: Any,
) -> None:
    """Process an SCM code review event by forwarding to Seer v2."""
    status = "success"
    should_record_latency = True
    try:
        sentry_sdk.set_tag("scm_provider", scm_provider)

        viewer_context: SeerViewerContext | None = None
        if organization_id:
            viewer_context = SeerViewerContext(organization_id=organization_id)

        make_seer_request(path=seer_path, payload=event_payload, viewer_context=viewer_context)
    except Exception as e:
        status = e.__class__.__name__
        if isinstance(e, RETRYABLE_ERRORS):
            task = current_task()
            if task and task.retries_remaining:
                should_record_latency = False
        raise
    finally:
        if status != "success":
            metrics.incr(
                f"{PREFIX}.error",
                tags={"error_status": status, "scm_provider": scm_provider},
                sample_rate=1.0,
            )
        if should_record_latency:
            _record_latency(status, enqueued_at_str)


def _record_latency(status: str, enqueued_at_str: str) -> None:
    try:
        timestamp = datetime.fromisoformat(enqueued_at_str)
        latency_ms = int((datetime.now(timezone.utc) - timestamp).total_seconds() * 1000)
        if latency_ms > 0:
            metrics.timing(f"{PREFIX}.e2e_latency", latency_ms, tags={"status": status})
    except (ValueError, TypeError):
        pass
