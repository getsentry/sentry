"""
Handler for GitLab merge_request webhook events.
https://docs.gitlab.com/ee/user/project/integrations/webhooks.html#merge-request-events
"""

from __future__ import annotations

import enum
import logging
from collections.abc import Mapping
from datetime import datetime, timezone
from typing import Any

from pydantic import ValidationError

from sentry.integrations.services.integration.model import RpcIntegration
from sentry.models.organization import Organization
from sentry.models.repository import Repository
from sentry.models.repositorysettings import CodeReviewTrigger
from sentry.organizations.services.organization.model import RpcOrganization
from sentry.seer.code_review.models import (
    SeerCodeReviewTaskRequestForPrClosed,
    SeerCodeReviewTaskRequestForPrReview,
    SeerCodeReviewTrigger,
)
from sentry.utils import json

from ..metrics import (
    WebhookFilteredReason,
    record_webhook_enqueued,
    record_webhook_filtered,
    record_webhook_received,
)
from ..preflight import CodeReviewPreflightService
from ..utils import SeerEndpoint

logger = logging.getLogger(__name__)

GITLAB_WEBHOOK_EVENT = "merge_request"


class MergeRequestAction(enum.StrEnum):
    """
    GitLab merge request webhook actions.
    https://docs.gitlab.com/ee/user/project/integrations/webhooks.html#merge-request-events
    """

    OPEN = "open"
    CLOSE = "close"
    REOPEN = "reopen"
    UPDATE = "update"
    MERGE = "merge"
    APPROVED = "approved"
    UNAPPROVED = "unapproved"


WHITELISTED_ACTIONS = {
    MergeRequestAction.CLOSE,
    MergeRequestAction.MERGE,
    MergeRequestAction.OPEN,
    MergeRequestAction.UPDATE,
}

ACTIONS_REQUIRING_TRIGGER_CHECK: dict[MergeRequestAction, CodeReviewTrigger] = {
    MergeRequestAction.OPEN: CodeReviewTrigger.ON_READY_FOR_REVIEW,
    MergeRequestAction.UPDATE: CodeReviewTrigger.ON_NEW_COMMIT,
}

CLOSE_ACTIONS = {MergeRequestAction.CLOSE, MergeRequestAction.MERGE}

SEER_TRIGGER_MAP: dict[MergeRequestAction, SeerCodeReviewTrigger] = {
    MergeRequestAction.OPEN: SeerCodeReviewTrigger.ON_READY_FOR_REVIEW,
    MergeRequestAction.UPDATE: SeerCodeReviewTrigger.ON_NEW_COMMIT,
}


def handle_merge_request_event(
    *,
    event: Mapping[str, Any],
    organization: RpcOrganization,
    repo: Repository,
    integration: RpcIntegration | None = None,
    **kwargs: Any,
) -> None:
    """Handle GitLab merge request webhook events for code review."""
    if integration is None:
        return

    object_attributes = event.get("object_attributes", {})
    action_value = object_attributes.get("action")
    if not action_value or not isinstance(action_value, str):
        return

    record_webhook_received(GITLAB_WEBHOOK_EVENT, action_value)

    try:
        action = MergeRequestAction(action_value)
    except ValueError:
        record_webhook_filtered(
            GITLAB_WEBHOOK_EVENT, action_value, WebhookFilteredReason.UNSUPPORTED_ACTION
        )
        return

    if action not in WHITELISTED_ACTIONS:
        record_webhook_filtered(
            GITLAB_WEBHOOK_EVENT, action_value, WebhookFilteredReason.UNSUPPORTED_ACTION
        )
        return

    # GitLab fires "update" for any MR edit (title, labels, assignee, etc.).
    # oldrev is only present when the source branch received new commits, which
    # is the equivalent of GitHub's "synchronize" event that ON_NEW_COMMIT models.
    if action == MergeRequestAction.UPDATE and "oldrev" not in object_attributes:
        record_webhook_filtered(
            GITLAB_WEBHOOK_EVENT, action_value, WebhookFilteredReason.UNSUPPORTED_ACTION
        )
        return

    try:
        org = Organization.objects.get_from_cache(id=organization.id)
    except Organization.DoesNotExist:
        return

    author_id = object_attributes.get("author_id")
    preflight = CodeReviewPreflightService(
        organization=org,
        repo=repo,
        integration_id=integration.id,
        pr_author_external_id=str(author_id) if author_id else None,
    ).check()

    if not preflight.allowed:
        if preflight.denial_reason:
            record_webhook_filtered(GITLAB_WEBHOOK_EVENT, action_value, preflight.denial_reason)
        return

    org_code_review_settings = preflight.settings

    action_requires_trigger_permission = ACTIONS_REQUIRING_TRIGGER_CHECK.get(action)
    if action_requires_trigger_permission is not None and (
        org_code_review_settings is None
        or action_requires_trigger_permission not in org_code_review_settings.triggers
    ):
        record_webhook_filtered(
            GITLAB_WEBHOOK_EVENT, action_value, WebhookFilteredReason.TRIGGER_DISABLED
        )
        return

    if action in CLOSE_ACTIONS and (
        org_code_review_settings is None or not org_code_review_settings.triggers
    ):
        record_webhook_filtered(
            GITLAB_WEBHOOK_EVENT, action_value, WebhookFilteredReason.TRIGGER_DISABLED
        )
        return

    if action not in CLOSE_ACTIONS:
        if (
            object_attributes.get("draft") is True
            or object_attributes.get("work_in_progress") is True
        ):
            return

    last_commit = object_attributes.get("last_commit") or {}
    target_commit_sha = last_commit.get("id")
    if not target_commit_sha:
        return

    _schedule_task(
        action=action,
        action_value=action_value,
        event=event,
        organization=org,
        repo=repo,
        target_commit_sha=target_commit_sha,
    )


def _get_trigger_metadata(event: Mapping[str, Any]) -> dict[str, Any]:
    user = event.get("user", {})
    object_attributes = event.get("object_attributes", {})
    trigger_at = (
        object_attributes.get("updated_at")
        or object_attributes.get("created_at")
        or datetime.now(timezone.utc).isoformat()
    )
    return {
        "trigger_user": user.get("username"),
        "trigger_user_id": user.get("id"),
        "trigger_comment_id": None,
        "trigger_comment_type": None,
        "trigger_at": trigger_at,
    }


def _build_payload(
    action: MergeRequestAction,
    event: Mapping[str, Any],
    organization: Any,
    repo: Repository,
    target_commit_sha: str,
) -> dict[str, Any]:
    from ..utils import _common_codegen_request_payload

    is_close = action in CLOSE_ACTIONS
    payload = _common_codegen_request_payload(
        add_experiment_enabled=not is_close,
        repo=repo,
        target_commit_sha=target_commit_sha,
        organization=organization,
        event_payload=event,
    )

    object_attributes = event.get("object_attributes", {})
    payload["data"]["pr_id"] = object_attributes.get("iid")

    config = payload["data"]["config"]
    trigger_metadata = _get_trigger_metadata(event)
    config["trigger"] = SEER_TRIGGER_MAP.get(action, SeerCodeReviewTrigger.UNKNOWN).value
    config["trigger_user"] = trigger_metadata["trigger_user"]
    config["trigger_user_id"] = trigger_metadata["trigger_user_id"]
    config["trigger_comment_id"] = trigger_metadata["trigger_comment_id"]
    config["trigger_comment_type"] = trigger_metadata["trigger_comment_type"]
    config["trigger_at"] = trigger_metadata["trigger_at"]
    config["sentry_received_trigger_at"] = datetime.now(timezone.utc).isoformat()

    return payload


def _schedule_task(
    *,
    action: MergeRequestAction,
    action_value: str,
    event: Mapping[str, Any],
    organization: Any,
    repo: Repository,
    target_commit_sha: str,
) -> None:
    payload = _build_payload(action, event, organization, repo, target_commit_sha)

    is_closed = action in CLOSE_ACTIONS
    seer_path = (
        SeerEndpoint.CODE_REVIEW_PR_CLOSED.value
        if is_closed
        else SeerEndpoint.CODE_REVIEW_REVIEW_REQUEST.value
    )

    try:
        validated: SeerCodeReviewTaskRequestForPrClosed | SeerCodeReviewTaskRequestForPrReview
        if is_closed:
            validated = SeerCodeReviewTaskRequestForPrClosed.parse_obj(payload)
        else:
            validated = SeerCodeReviewTaskRequestForPrReview.parse_obj(payload)
        serialized_payload = json.loads(validated.json())
    except ValidationError:
        logger.warning("gitlab.webhook.merge_request.validation_failed")
        record_webhook_filtered(
            GITLAB_WEBHOOK_EVENT, action_value, WebhookFilteredReason.INVALID_PAYLOAD
        )
        return

    from .task import process_github_webhook_event

    process_github_webhook_event.delay(
        seer_path=seer_path,
        event_payload=serialized_payload,
        tags={
            "sentry_organization_id": str(organization.id),
            "sentry_organization_slug": organization.slug,
            "sentry_integration_id": str(repo.integration_id) if repo.integration_id else "",
            "scm_provider": "gitlab",
        },
    )
    record_webhook_enqueued(GITLAB_WEBHOOK_EVENT, action_value)
