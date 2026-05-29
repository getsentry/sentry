"""
Handler for GitLab merge_request webhook events.
https://docs.gitlab.com/ee/user/project/integrations/webhooks.html#merge-request-events

Known limitations
-----------------

Code review does not fire in production yet: GitLab contributors are never seeded.
``handle_merge_request_event`` runs ``CodeReviewPreflightService``, whose
``_check_billing`` looks up ``OrganizationContributors`` by
``(organization_id, integration_id, external_identifier=str(author_id))`` and
returns ``ORG_CONTRIBUTOR_NOT_FOUND`` (before the beta exemption) when the row is
missing. GitHub creates that row via ``track_contributor_seat`` in
``PullRequestEventWebhook._handle`` on PR creation; the GitLab merge-request path
(PR persistence inline in ``MergeEventWebhook.__call__``) does not, and nothing
else seeds GitLab contributors. Until contributor seeding is added, every GitLab MR
is filtered with ``ORG_CONTRIBUTOR_NOT_FOUND``. The handler tests pass only because
they seed the row manually.

The code-review tests seed OrganizationContributors manually; consider a test that
omits it to lock in the intended production behavior (related to Issue 1).

GitLab has no dedicated "ready_for_review" action: un-drafting an MR arrives as an
"update" whose top-level ``changes`` flips draft/work_in_progress to false, which is
treated as an ON_READY_FOR_REVIEW trigger (see ``_resolve_review_trigger``).
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
from sentry.utils.redis import redis_clusters

from ..metrics import (
    WebhookFilteredReason,
    record_webhook_enqueued,
    record_webhook_filtered,
    record_webhook_received,
)
from ..preflight import CodeReviewPreflightService
from ..utils import SeerEndpoint, _common_codegen_request_payload
from .task import process_github_webhook_event

logger = logging.getLogger(__name__)

GITLAB_WEBHOOK_EVENT = "merge_request"

# GitLab redelivers webhooks (e.g. when our response times out), and the endpoint
# dispatches the same payload once per installed organization. Either can enqueue
# duplicate Seer review requests, so we skip a delivery already seen within this
# window. The key is scoped per organization/repo to keep distinct installs isolated.
WEBHOOK_SEEN_TTL_SECONDS = 20
WEBHOOK_SEEN_KEY_PREFIX = "webhook:gitlab:merge_request:"


def _is_duplicate_delivery(seen_key: str) -> bool:
    """
    Return True if this delivery was already processed within the TTL window.

    On Redis errors we return False (process anyway) since processing twice is
    preferable to never processing.
    """
    try:
        cluster = redis_clusters.get("default")
        is_first_time_seen = cluster.set(seen_key, "1", ex=WEBHOOK_SEEN_TTL_SECONDS, nx=True)
    except Exception:
        logger.warning("gitlab.webhook.merge_request.mark_seen_failed")
        return False
    return not is_first_time_seen


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

CLOSE_ACTIONS = {MergeRequestAction.CLOSE, MergeRequestAction.MERGE}

# Map the repo trigger that gated a review to the trigger value reported to Seer.
CODE_REVIEW_TO_SEER_TRIGGER: dict[CodeReviewTrigger, SeerCodeReviewTrigger] = {
    CodeReviewTrigger.ON_READY_FOR_REVIEW: SeerCodeReviewTrigger.ON_READY_FOR_REVIEW,
    CodeReviewTrigger.ON_NEW_COMMIT: SeerCodeReviewTrigger.ON_NEW_COMMIT,
}


def _is_undraft_update(changes: Mapping[str, Any]) -> bool:
    """
    True when an "update" event marks a draft MR ready for review.

    GitLab has no dedicated "ready_for_review" action (unlike GitHub); un-drafting
    arrives as an "update" whose ``changes`` shows draft/work_in_progress flipping
    from true to false. ``changes`` is a top-level payload field, not part of
    ``object_attributes``.
    """
    for field in ("draft", "work_in_progress"):
        change = changes.get(field) or {}
        if change.get("previous") is True and change.get("current") is False:
            return True
    return False


def _resolve_review_trigger(
    action: MergeRequestAction, event: Mapping[str, Any]
) -> CodeReviewTrigger | None:
    """
    Map a non-close MR action to the repo trigger that gates a review, or None when
    the event should not start one.

    "open" is always a ready-for-review trigger. "update" is ambiguous because GitLab
    fires it for any edit, so it triggers a review only when it brings new commits
    (ON_NEW_COMMIT) or marks the MR ready for review (ON_READY_FOR_REVIEW).
    """
    if action == MergeRequestAction.OPEN:
        return CodeReviewTrigger.ON_READY_FOR_REVIEW
    if action == MergeRequestAction.UPDATE:
        # GitLab puts "changes" at the top level of the payload, while "oldrev"
        # (present only when commits were pushed) lives in "object_attributes".
        if _is_undraft_update(event.get("changes") or {}):
            return CodeReviewTrigger.ON_READY_FOR_REVIEW
        if "oldrev" in (event.get("object_attributes") or {}):
            return CodeReviewTrigger.ON_NEW_COMMIT
    return None


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

    # GitLab fires "update" for any MR edit (title, labels, assignee, etc.), so a
    # non-close action only starts a review when it maps to a repo trigger: a new
    # commit (ON_NEW_COMMIT) or the MR being opened / marked ready (ON_READY_FOR_REVIEW).
    review_trigger: CodeReviewTrigger | None = None
    if action not in CLOSE_ACTIONS:
        review_trigger = _resolve_review_trigger(action, event)
        if review_trigger is None:
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

    if review_trigger is not None and (
        org_code_review_settings is None or review_trigger not in org_code_review_settings.triggers
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

    seen_key = (
        f"{WEBHOOK_SEEN_KEY_PREFIX}{org.id}:{repo.id}:"
        f"{object_attributes.get('iid')}:{action_value}:{target_commit_sha}"
    )
    if _is_duplicate_delivery(seen_key):
        logger.warning("gitlab.webhook.merge_request.duplicate_delivery_skipped")
        return

    _schedule_task(
        action=action,
        action_value=action_value,
        event=event,
        organization=org,
        repo=repo,
        target_commit_sha=target_commit_sha,
        review_trigger=review_trigger,
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
    organization: Organization,
    repo: Repository,
    target_commit_sha: str,
    review_trigger: CodeReviewTrigger | None,
) -> dict[str, Any]:
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
    seer_trigger = (
        CODE_REVIEW_TO_SEER_TRIGGER[review_trigger]
        if review_trigger is not None
        else SeerCodeReviewTrigger.UNKNOWN
    )
    config["trigger"] = seer_trigger.value
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
    organization: Organization,
    repo: Repository,
    target_commit_sha: str,
    review_trigger: CodeReviewTrigger | None,
) -> None:
    payload = _build_payload(action, event, organization, repo, target_commit_sha, review_trigger)

    # GitLab is not supported by the direct-PyGithub /v1/code_review/* endpoints;
    # it must use the scm-platform RPC counterparts at /v1/scm_code_review/*.
    is_closed = action in CLOSE_ACTIONS
    seer_path = (
        SeerEndpoint.SCM_CODE_REVIEW_PR_CLOSED.value
        if is_closed
        else SeerEndpoint.SCM_CODE_REVIEW_REVIEW_REQUEST.value
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
