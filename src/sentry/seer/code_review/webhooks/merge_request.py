"""
Handler for GitLab merge_request webhook events.
https://docs.gitlab.com/ee/user/project/integrations/webhooks.html#merge-request-events

Known limitations
-----------------

GitLab contributor seeding must run before this handler. ``handle_merge_request_event``
runs ``CodeReviewPreflightService``, whose ``_check_billing`` looks up
``OrganizationContributors`` by
``(organization_id, provider, hostname, external_identifier=str(author_id))`` and
returns ``ORG_CONTRIBUTOR_NOT_FOUND`` when the row is missing. GitLab seeds that row
through ``track_gitlab_contributor_action_processor``, which
``MergeEventWebhook.WEBHOOK_EVENT_PROCESSORS`` registers before this handler. If
that ordering changes, the first MR open from a new contributor is filtered before
the same delivery can seed the contributor.

Contributor seeding still depends on ``MergeEventWebhook.__call__`` reaching its
processors. Seats are only assigned for ``object_attributes.action == "open"``. Payloads
that short-circuit before processor dispatch, such as MRs missing ``last_commit`` or the
author email, do not seed the MR author; later ``update`` events do not backfill it.

GitLab has no dedicated "ready_for_review" action: un-drafting an MR arrives as an
"update" whose top-level ``changes`` flips draft/work_in_progress to false, which is
treated as an ON_READY_FOR_REVIEW trigger (see ``_resolve_review_trigger``).

``@sentry review`` comment support
------------------------------------

GitLab fires a "Note Hook" when a user comments on an MR. This module also
exports ``handle_merge_request_note_event`` which processes those events and
forwards a review request to Seer when the comment body contains
``@sentry review``.  The payload uses ``trigger: on_command_phrase``, matching
the GitHub ``issue_comment`` webhook forwarder.
"""

from __future__ import annotations

import enum
import logging
from collections.abc import Mapping
from datetime import datetime, timezone
from typing import Any

import sentry_sdk
from dateutil.parser import parse as parse_date
from pydantic import ValidationError
from scm import actions as scm_actions
from scm.types import (
    CreatePullRequestCommentReactionProtocol,
    CreatePullRequestReactionProtocol,
    DeletePullRequestReactionProtocol,
    GetAuthenticatedActorProtocol,
    GetPullRequestReactionsProtocol,
    Reaction,
    ReactionResult,
)

from sentry import features
from sentry.integrations.services.integration.model import RpcIntegration
from sentry.models.organization import Organization
from sentry.models.repository import Repository
from sentry.models.repositorysettings import CodeReviewTrigger
from sentry.organizations.services.organization.model import RpcOrganization
from sentry.scm import factory as scm_factory
from sentry.scm.factory import new as make_scm
from sentry.seer.code_review.models import (
    SeerCodeReviewTaskRequestForPrClosed,
    SeerCodeReviewTaskRequestForPrReview,
    SeerCodeReviewTrigger,
)
from sentry.seer.webhooks import SentryReviewCommand, sentry_command
from sentry.utils import json
from sentry.utils.redis import redis_clusters

from ..metrics import (
    CodeReviewErrorType,
    WebhookFilteredReason,
    record_webhook_enqueued,
    record_webhook_filtered,
    record_webhook_handler_error,
    record_webhook_received,
)
from ..preflight import CodeReviewPreflightService
from ..utils import SeerEndpoint, _common_codegen_request_payload
from .logging import debug_log
from .task import process_github_webhook_event

logger = logging.getLogger(__name__)

GITLAB_WEBHOOK_EVENT = "merge_request"
GITLAB_WEBHOOK_NOTE_EVENT = "note"

SENTRY_REVIEW_COMMAND = "@sentry review"

WEBHOOK_NOTE_SEEN_KEY_PREFIX = "webhook:gitlab:note:"

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

    "open" is a ready-for-review trigger unless the MR is opened as a draft. "update"
    is ambiguous because GitLab fires it for any edit, so it triggers a review only
    when it brings new commits (ON_NEW_COMMIT) or marks the MR ready for review
    (ON_READY_FOR_REVIEW).
    """
    if action == MergeRequestAction.OPEN:
        # An MR opened as a draft is not ready for review. GitLab sets
        # object_attributes.draft (legacy: work_in_progress) from the "Draft:"
        # title prefix; un-drafting later arrives as an "update" (_is_undraft_update).
        object_attributes = event.get("object_attributes") or {}
        if (
            object_attributes.get("draft") is True
            or object_attributes.get("work_in_progress") is True
        ):
            return None
        return CodeReviewTrigger.ON_READY_FOR_REVIEW
    if action == MergeRequestAction.UPDATE:
        # GitLab puts "changes" at the top level of the payload, while "oldrev"
        # (present only when commits were pushed) lives in "object_attributes".
        if _is_undraft_update(event.get("changes") or {}):
            return CodeReviewTrigger.ON_READY_FOR_REVIEW
        if "oldrev" in (event.get("object_attributes") or {}):
            return CodeReviewTrigger.ON_NEW_COMMIT
    return None


def _delete_existing_reactions_and_add_reaction(
    *,
    organization_id: int,
    repo: Repository,
    mr_iid: str,
    action_value: str,
    reactions_to_delete: list[Reaction],
    reaction_to_add: Reaction | None,
) -> None:
    """
    Delete stale reactions on the MR and add a fresh one.

    Mirrors ``delete_existing_reactions_and_add_reaction`` from the GitHub webhook
    path. Uses the SCM library's provider-agnostic reaction actions so the logic
    is identical for every supported SCM provider. Errors are logged, recorded as
    a ``REACTION_FAILED`` metric, and swallowed so a failing reaction call never
    blocks the Seer review task.

    ``reactions_to_delete`` and ``reaction_to_add`` use the SCM ``Reaction`` type
    values (e.g. ``"hooray"`` for :tada:, ``"eyes"`` for :eyes:); the provider
    translates them to platform-specific names (GitLab award emoji, etc.).

    Unlike GitHub (where re-adding a reaction is idempotent), GitLab rejects a
    duplicate ``award_emoji`` POST, so we only add ``reaction_to_add`` when our own
    user has not already placed it; otherwise a re-review of an MR that already has
    :eyes: would fail on every trigger.
    """
    try:
        scm = scm_factory.new(organization_id, repo.id, "code-review-webhook")
    except Exception:
        logger.warning("gitlab.webhook.merge_request.reaction.scm_init_failed")
        record_webhook_handler_error(
            GITLAB_WEBHOOK_EVENT, action_value, CodeReviewErrorType.REACTION_FAILED
        )
        return

    # The SCM facade only exposes capability methods after narrowing against the
    # relevant runtime-checkable protocols (see ``scm.facade.Facade``); a provider
    # that does not support reactions would not satisfy these checks.
    if not (
        isinstance(scm, GetAuthenticatedActorProtocol)
        and isinstance(scm, GetPullRequestReactionsProtocol)
        and isinstance(scm, CreatePullRequestReactionProtocol)
        and isinstance(scm, DeletePullRequestReactionProtocol)
    ):
        logger.warning("gitlab.webhook.merge_request.reaction.unsupported_provider")
        record_webhook_handler_error(
            GITLAB_WEBHOOK_EVENT, action_value, CodeReviewErrorType.REACTION_FAILED
        )
        return

    # Reactions placed by the current OAuth user (our integration identity). We only
    # ever touch our own reactions, and reuse this list to skip a redundant add.
    own_reactions: list[ReactionResult] = []
    if reactions_to_delete or reaction_to_add:
        try:
            current_actor_id = scm_actions.get_authenticated_actor(scm)["data"]["id"]
            existing = scm_actions.get_pull_request_reactions(scm, mr_iid)["data"]
            own_reactions = [
                reaction
                for reaction in existing
                if (author := reaction.get("author")) is not None
                and author["id"] == current_actor_id
            ]
            # The add decision below hinges entirely on what this fetch returns: if the
            # authenticated actor id is wrong (or pagination truncates the list) we can
            # both fail to delete stale reactions and wrongly skip/duplicate the add.
            # Log the resolved actor and our own reactions so a missing :eyes: can be
            # traced to the actual reaction state we observed.
            debug_log(
                logger,
                organization_id,
                "gitlab.webhook.merge_request.reaction.existing_fetched",
                {
                    "organization_id": organization_id,
                    "repo_id": repo.id,
                    "mr_iid": mr_iid,
                    "action": action_value,
                    "current_actor_id": current_actor_id,
                    "total_reaction_count": len(existing),
                    "own_reaction_count": len(own_reactions),
                    "own_reaction_contents": [
                        reaction.get("content") for reaction in own_reactions
                    ],
                },
            )
        except Exception:
            logger.warning("gitlab.webhook.merge_request.reaction.fetch_failed", exc_info=True)
            record_webhook_handler_error(
                GITLAB_WEBHOOK_EVENT, action_value, CodeReviewErrorType.REACTION_FAILED
            )

    for reaction in own_reactions:
        if reaction.get("content") in reactions_to_delete and reaction.get("id"):
            try:
                scm_actions.delete_pull_request_reaction(scm, mr_iid, str(reaction["id"]))
                debug_log(
                    logger,
                    organization_id,
                    "gitlab.webhook.merge_request.reaction.deleted",
                    {
                        "organization_id": organization_id,
                        "repo_id": repo.id,
                        "mr_iid": mr_iid,
                        "action": action_value,
                        "reaction": reaction.get("content"),
                    },
                )
            except Exception:
                logger.warning("gitlab.webhook.merge_request.reaction.delete_failed", exc_info=True)
                record_webhook_handler_error(
                    GITLAB_WEBHOOK_EVENT, action_value, CodeReviewErrorType.REACTION_FAILED
                )

    if reaction_to_add is None:
        return

    # GitLab rejects a duplicate award_emoji POST, so we intentionally skip the add when
    # our user already placed this reaction. This is the most common reason a re-review
    # of an MR shows no *new* :eyes: — log it so the skip is not mistaken for a failure.
    if any(reaction.get("content") == reaction_to_add for reaction in own_reactions):
        debug_log(
            logger,
            organization_id,
            "gitlab.webhook.merge_request.reaction.add_skipped_already_present",
            {
                "organization_id": organization_id,
                "repo_id": repo.id,
                "mr_iid": mr_iid,
                "action": action_value,
                "reaction": reaction_to_add,
            },
        )
        return

    try:
        scm_actions.create_pull_request_reaction(scm, mr_iid, reaction_to_add)
        debug_log(
            logger,
            organization_id,
            "gitlab.webhook.merge_request.reaction.added",
            {
                "organization_id": organization_id,
                "repo_id": repo.id,
                "action": action_value,
                "reaction": reaction_to_add,
            },
        )
    except Exception:
        logger.warning("gitlab.webhook.merge_request.reaction.add_failed", exc_info=True)
        record_webhook_handler_error(
            GITLAB_WEBHOOK_EVENT, action_value, CodeReviewErrorType.REACTION_FAILED
        )


def handle_merge_request_event(
    *,
    event: Mapping[str, Any],
    organization: RpcOrganization,
    repo: Repository,
    integration: RpcIntegration | None = None,
    **kwargs: Any,
) -> None:
    """Handle GitLab merge request webhook events for code review."""
    mr_iid = (event.get("object_attributes") or {}).get("iid")
    base_log = {
        "organization_id": organization.id,
        "organization_slug": organization.slug,
        "repo_id": repo.id,
        "mr_iid": mr_iid,
    }

    if integration is None:
        debug_log(logger, organization, "missing_integration", base_log)
        return

    base_log["integration_id"] = integration.id

    debug_log(logger, organization, "handler_started", base_log)

    if not features.has("organizations:seer-gitlab-support", organization):
        return

    object_attributes = event.get("object_attributes", {})
    action_value = object_attributes.get("action")
    if not action_value or not isinstance(action_value, str):
        debug_log(logger, organization, "missing_action", base_log)
        return

    base_log["action"] = action_value
    record_webhook_received(GITLAB_WEBHOOK_EVENT, action_value)

    try:
        action = MergeRequestAction(action_value)
    except ValueError:
        debug_log(logger, organization, "unsupported_action", base_log)
        record_webhook_filtered(
            GITLAB_WEBHOOK_EVENT, action_value, WebhookFilteredReason.UNSUPPORTED_ACTION
        )
        return

    if action not in WHITELISTED_ACTIONS:
        debug_log(logger, organization, "action_not_whitelisted", base_log)
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
            debug_log(logger, organization, "no_review_trigger", base_log)
            record_webhook_filtered(
                GITLAB_WEBHOOK_EVENT, action_value, WebhookFilteredReason.UNSUPPORTED_ACTION
            )
            return

    try:
        org = Organization.objects.get_from_cache(id=organization.id)
    except Organization.DoesNotExist:
        debug_log(logger, organization, "organization_not_found", base_log)
        return

    author_id = object_attributes.get("author_id")
    preflight = CodeReviewPreflightService(
        organization=org,
        repo=repo,
        integration=integration,
        pr_author_external_id=str(author_id) if author_id else None,
    ).check()

    if not preflight.allowed:
        denial = preflight.denial_reason.value if preflight.denial_reason else None
        debug_log(
            logger,
            organization,
            "preflight_denied",
            {**base_log, "denial_reason": denial},
        )
        if preflight.denial_reason:
            record_webhook_filtered(GITLAB_WEBHOOK_EVENT, action_value, preflight.denial_reason)
        return

    debug_log(logger, organization, "preflight_passed", base_log)

    org_code_review_settings = preflight.settings

    if review_trigger is not None and (
        org_code_review_settings is None or review_trigger not in org_code_review_settings.triggers
    ):
        debug_log(
            logger,
            organization,
            "trigger_disabled",
            {**base_log, "review_trigger": review_trigger.value},
        )
        record_webhook_filtered(
            GITLAB_WEBHOOK_EVENT, action_value, WebhookFilteredReason.TRIGGER_DISABLED
        )
        return

    if action in CLOSE_ACTIONS and (
        org_code_review_settings is None or not org_code_review_settings.triggers
    ):
        debug_log(logger, organization, "close_trigger_disabled", base_log)
        record_webhook_filtered(
            GITLAB_WEBHOOK_EVENT, action_value, WebhookFilteredReason.TRIGGER_DISABLED
        )
        return

    if action not in CLOSE_ACTIONS:
        if (
            object_attributes.get("draft") is True
            or object_attributes.get("work_in_progress") is True
        ):
            debug_log(logger, organization, "draft_skipped", base_log)
            return

    last_commit = object_attributes.get("last_commit") or {}
    target_commit_sha = last_commit.get("id")
    if not target_commit_sha:
        debug_log(logger, organization, "missing_target_commit_sha", base_log)
        return

    base_log["target_commit_sha"] = target_commit_sha
    if review_trigger is not None:
        base_log["review_trigger"] = review_trigger.value

    seen_key = (
        f"{WEBHOOK_SEEN_KEY_PREFIX}{org.id}:{repo.id}:"
        f"{object_attributes.get('iid')}:{action_value}:{target_commit_sha}"
    )
    if _is_duplicate_delivery(seen_key):
        debug_log(
            logger,
            organization,
            "duplicate_delivery_skipped",
            base_log,
            level=logging.WARNING,
        )
        return

    # Mirror the GitHub pull_request handler: add :eyes: to the MR description to
    # signal a Seer review run is in progress, and remove any stale :tada: left
    # over from a previous run. Skip for close/merge since those are not new runs.
    # Uses SCM Reaction type values: "hooray" = :tada:, "eyes" = :eyes:.
    if action not in CLOSE_ACTIONS:
        mr_iid = object_attributes.get("iid")
        if mr_iid is not None:
            _delete_existing_reactions_and_add_reaction(
                organization_id=org.id,
                repo=repo,
                mr_iid=str(mr_iid),
                action_value=action_value,
                reactions_to_delete=["hooray"],
                reaction_to_add="eyes",
            )
        else:
            # A non-close MR event with no iid should not happen, but if it does the
            # reaction is silently skipped; log it so a missing :eyes: is explainable.
            logger.warning(
                "gitlab.webhook.merge_request.reaction.skipped_missing_iid",
                extra={"organization_id": org.id, "repo_id": repo.id, "action": action_value},
            )

    debug_log(logger, organization, "scheduling_seer_task", base_log)
    _schedule_task(
        action=action,
        action_value=action_value,
        event=event,
        organization=org,
        repo=repo,
        target_commit_sha=target_commit_sha,
        review_trigger=review_trigger,
        log_context=base_log,
    )


def _normalize_trigger_at(raw: str | None) -> str:
    """Normalize a GitLab webhook timestamp to ISO 8601.

    GitLab webhook timestamps are NOT consistently formatted across event types.
    The "Merge request events" and "Comment events" payloads documented at
    https://docs.gitlab.com/user/project/integrations/webhook_events/ serialize
    ``object_attributes`` timestamps as ``"2026-01-16 05:56:22 UTC"`` (space
    separator, textual ``UTC`` suffix) -- the Rails ``Time#to_s`` default --
    while other event types (work items, jobs, pipelines) use ISO 8601
    (``"2013-12-03T17:15:43Z"``, ``"2014-02-27T10:06:20+02:00"``). Some GitLab
    versions/editions also emit ISO 8601 for MR events, which is why the bug only
    reproduces on instances sending the ``"... UTC"`` form.

    Pydantic v1's ``datetime`` validator accepts ISO 8601 only and rejects the
    space+``UTC`` form with ``value_error.datetime``. Since
    ``SeerCodeReviewConfig.trigger_at`` is such a field -- and a failed
    ``parse_obj`` silently drops the whole review (see ``_schedule_task``) -- we
    normalize here. ``dateutil.parser.parse`` handles BOTH forms, so this is a
    strict superset of the prior behavior. Falls back to "now" when the value is
    missing or unparseable.
    """
    if raw:
        try:
            return parse_date(raw).astimezone(timezone.utc).isoformat()
        except (ValueError, OverflowError) as e:
            # We fall back to "now" below so the review still proceeds, but an
            # unparseable GitLab timestamp means trigger_at is wrong for this
            # review -- escalate it so the unhandled format surfaces in Sentry.
            with sentry_sdk.new_scope() as scope:
                scope.set_context(
                    "code_review_trigger_at",
                    {"raw": raw},
                )
                sentry_sdk.capture_exception(e, level="warning")
    return datetime.now(timezone.utc).isoformat()


def _get_trigger_metadata(event: Mapping[str, Any]) -> dict[str, Any]:
    user = event.get("user", {})
    object_attributes = event.get("object_attributes", {})
    trigger_at = _normalize_trigger_at(
        object_attributes.get("updated_at") or object_attributes.get("created_at")
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
    log_context: dict[str, object] | None = None,
) -> None:
    payload = _build_payload(action, event, organization, repo, target_commit_sha, review_trigger)

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
    except ValidationError as e:
        # Capture at warning level: a dropped review is worth surfacing, but
        # should not count toward the error rate that gates a canary deploy.
        sentry_sdk.capture_exception(
            e,
            level="warning",
            contexts={"code_review_validation": {"seer_path": seer_path}},
        )
        record_webhook_filtered(
            GITLAB_WEBHOOK_EVENT, action_value, WebhookFilteredReason.INVALID_PAYLOAD
        )
        return

    debug_log(
        logger,
        organization,
        "seer_task_enqueued",
        {**(log_context or {}), "seer_path": seer_path},
    )
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


# ---------------------------------------------------------------------------
# GitLab Note Hook ("@sentry review" command) handler
# ---------------------------------------------------------------------------


def _get_note_trigger_metadata(event: Mapping[str, Any]) -> dict[str, Any]:
    """Extract trigger metadata from a GitLab note (comment) event."""
    user = event.get("user", {})
    object_attributes = event.get("object_attributes", {})
    trigger_at = _normalize_trigger_at(object_attributes.get("created_at"))
    return {
        "trigger_user": user.get("username"),
        "trigger_user_id": user.get("id"),
        # The note id is the comment identifier. Seer keys its post-review
        # reaction (eyes -> hooray) off trigger_comment_type: a GitLab MR note is
        # never an issue note, so it must be "pull_request_review_comment", which
        # Seer routes to the merge-request note award_emoji endpoint. Sending
        # "issue_comment" here makes Seer hit /issues/... and 404.
        "trigger_comment_id": object_attributes.get("id"),
        "trigger_comment_type": "pull_request_review_comment",
        "trigger_at": trigger_at,
    }


def _build_note_payload(
    event: Mapping[str, Any],
    organization: Organization,
    repo: Repository,
    target_commit_sha: str,
    mr_iid: int,
) -> dict[str, Any]:
    """Build the Seer review-request payload for an @sentry review note."""
    payload = _common_codegen_request_payload(
        add_experiment_enabled=True,
        repo=repo,
        target_commit_sha=target_commit_sha,
        organization=organization,
        event_payload=event,
    )
    payload["data"]["pr_id"] = mr_iid
    config = payload["data"]["config"]
    trigger_metadata = _get_note_trigger_metadata(event)
    config["trigger"] = SeerCodeReviewTrigger.ON_COMMAND_PHRASE.value
    config["trigger_user"] = trigger_metadata["trigger_user"]
    config["trigger_user_id"] = trigger_metadata["trigger_user_id"]
    config["trigger_comment_id"] = trigger_metadata["trigger_comment_id"]
    config["trigger_comment_type"] = trigger_metadata["trigger_comment_type"]
    config["trigger_at"] = trigger_metadata["trigger_at"]
    config["sentry_received_trigger_at"] = datetime.now(timezone.utc).isoformat()
    return payload


def _add_note_reaction(
    *,
    organization_id: int,
    repo: Repository,
    mr_iid: str,
    note_id: str,
    reaction: Reaction,
) -> None:
    """
    Add a reaction (award emoji) to an MR note via the SCM library.

    Mirrors the GitHub issue_comment path which calls
    ``client.create_comment_reaction(repo.name, comment_id, reaction)``.
    Errors are swallowed so a failing reaction never blocks the Seer task.
    """
    try:
        scm = make_scm(organization_id, repo.id, referrer="seer")
        assert isinstance(scm, CreatePullRequestCommentReactionProtocol)
        scm_actions.create_pull_request_comment_reaction(scm, mr_iid, note_id, reaction)
    except Exception:
        logger.warning("gitlab.webhook.note.reaction_add_failed", exc_info=True)


def _schedule_note_task(
    *,
    action_value: str,
    event: Mapping[str, Any],
    organization: Organization,
    repo: Repository,
    target_commit_sha: str,
    mr_iid: int,
) -> None:
    """Validate the payload and enqueue the Seer review-request task."""
    payload = _build_note_payload(event, organization, repo, target_commit_sha, mr_iid)

    try:
        validated = SeerCodeReviewTaskRequestForPrReview.parse_obj(payload)
        serialized_payload = json.loads(validated.json())
    except ValidationError as e:
        # Capture at warning level: a dropped review is worth surfacing, but
        # should not count toward the error rate that gates a canary deploy.
        sentry_sdk.capture_exception(
            e,
            level="warning",
            contexts={"code_review_validation": {"mr_iid": mr_iid}},
        )
        record_webhook_filtered(
            GITLAB_WEBHOOK_NOTE_EVENT,
            action_value,
            WebhookFilteredReason.INVALID_PAYLOAD,
        )
        return

    debug_log(
        logger,
        organization,
        "note.seer_task_enqueued",
        {"mr_iid": mr_iid, "target_commit_sha": target_commit_sha},
    )
    process_github_webhook_event.delay(
        seer_path=SeerEndpoint.CODE_REVIEW_REVIEW_REQUEST.value,
        event_payload=serialized_payload,
        tags={
            "sentry_organization_id": str(organization.id),
            "sentry_organization_slug": organization.slug,
            "sentry_integration_id": str(repo.integration_id) if repo.integration_id else "",
            "scm_provider": "gitlab",
        },
    )
    record_webhook_enqueued(GITLAB_WEBHOOK_NOTE_EVENT, action_value)


def handle_merge_request_note_event(
    *,
    event: Mapping[str, Any],
    organization: RpcOrganization,
    repo: Repository,
    integration: RpcIntegration | None = None,
    **kwargs: Any,
) -> None:
    """
    Handle GitLab Note Hook events for @sentry review commands on merge requests.

    GitLab fires a Note Hook whenever a user creates a comment on an MR, issue,
    commit, or snippet.  This handler:

    1. Ignores notes that are not on merge requests or not ``@sentry review``.
    2. Runs the standard code-review preflight check.
    3. Adds :eyes: to the note to acknowledge the command.
    4. Enqueues a Seer review request with ``trigger: on_command_phrase``.
    """
    object_attributes = event.get("object_attributes") or {}
    merge_request = event.get("merge_request") or {}
    base_log: dict[str, object] = {
        "organization_id": organization.id,
        "organization_slug": organization.slug,
        "repo_id": repo.id,
        "note_id": object_attributes.get("id"),
        "noteable_type": object_attributes.get("noteable_type"),
        "mr_iid": merge_request.get("iid"),
    }

    if integration is None:
        debug_log(logger, organization, "note.missing_integration", base_log)
        return

    base_log["integration_id"] = integration.id
    debug_log(logger, organization, "note.handler_started", base_log)

    if not features.has("organizations:seer-gitlab-support", organization):
        return

    action_value = object_attributes.get("action", "")
    base_log["action"] = action_value
    record_webhook_received(GITLAB_WEBHOOK_NOTE_EVENT, action_value)

    # Only process newly created notes; ignore edits and deletions.
    if action_value != "create":
        debug_log(logger, organization, "note.unsupported_action", base_log)
        record_webhook_filtered(
            GITLAB_WEBHOOK_NOTE_EVENT,
            action_value,
            WebhookFilteredReason.UNSUPPORTED_ACTION,
        )
        return

    # Only handle notes on merge requests, not issues, commits, or snippets.
    if object_attributes.get("noteable_type") != "MergeRequest":
        debug_log(logger, organization, "note.not_merge_request", base_log)
        record_webhook_filtered(
            GITLAB_WEBHOOK_NOTE_EVENT,
            action_value,
            WebhookFilteredReason.NOT_PR_COMMENT,
        )
        return

    # Filter for the @sentry review command phrase.
    note_body = object_attributes.get("note")
    if not isinstance(sentry_command(note_body), SentryReviewCommand):
        debug_log(logger, organization, "note.not_review_command", base_log)
        record_webhook_filtered(
            GITLAB_WEBHOOK_NOTE_EVENT,
            action_value,
            WebhookFilteredReason.NOT_REVIEW_COMMAND,
        )
        return

    debug_log(
        logger,
        organization,
        "note.review_command_matched",
        {
            **base_log,
            "review_command": SENTRY_REVIEW_COMMAND,
            "note_length": len(note_body or ""),
        },
    )

    try:
        org = Organization.objects.get_from_cache(id=organization.id)
    except Organization.DoesNotExist:
        debug_log(logger, organization, "note.organization_not_found", base_log)
        return

    # Billing seat is keyed to the MR author, not the commenter.
    mr_author_id = merge_request.get("author_id")
    base_log["mr_author_id"] = mr_author_id
    preflight = CodeReviewPreflightService(
        organization=org,
        repo=repo,
        integration=integration,
        pr_author_external_id=str(mr_author_id) if mr_author_id else None,
    ).check()

    if not preflight.allowed:
        denial = preflight.denial_reason.value if preflight.denial_reason else None
        debug_log(
            logger,
            organization,
            "note.preflight_denied",
            {**base_log, "denial_reason": denial},
        )
        if preflight.denial_reason:
            record_webhook_filtered(
                GITLAB_WEBHOOK_NOTE_EVENT, action_value, preflight.denial_reason
            )
        return

    debug_log(logger, organization, "note.preflight_passed", base_log)

    last_commit = merge_request.get("last_commit") or {}
    target_commit_sha = last_commit.get("id")
    if not target_commit_sha:
        debug_log(logger, organization, "note.missing_target_commit_sha", base_log)
        return

    mr_iid = merge_request.get("iid")
    if mr_iid is None:
        debug_log(logger, organization, "note.missing_mr_iid", base_log)
        return

    note_id = object_attributes.get("id")
    base_log["target_commit_sha"] = target_commit_sha

    # Dedup redeliveries: GitLab may resend the same note event on timeout.
    seen_key = f"{WEBHOOK_NOTE_SEEN_KEY_PREFIX}{org.id}:{repo.id}:{note_id}"
    if _is_duplicate_delivery(seen_key):
        debug_log(
            logger,
            organization,
            "note.duplicate_delivery_skipped",
            base_log,
            level=logging.WARNING,
        )
        return

    # Add :eyes: to the note to signal we received the command.
    if note_id is not None:
        _add_note_reaction(
            organization_id=org.id,
            repo=repo,
            mr_iid=str(mr_iid),
            note_id=str(note_id),
            reaction="eyes",
        )

    debug_log(logger, organization, "note.scheduling_seer_task", base_log)
    _schedule_note_task(
        action_value=action_value,
        event=event,
        organization=org,
        repo=repo,
        target_commit_sha=target_commit_sha,
        mr_iid=mr_iid,
    )
