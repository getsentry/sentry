"""GitHub webhook handling for the PR Merge Live Metrics pipeline.

Multiple independent processors serve several webhook event types:
- ``PullRequestEventWebhook``: ``handle_attribution``, ``handle_metrics``,
  ``handle_emission``, ``handle_activity``
- ``IssueCommentEventWebhook``: ``handle_comment``
- ``PullRequestReviewEventWebhook``: ``handle_review``
- ``PullRequestReviewCommentEventWebhook``: ``handle_review_comment``
- ``PullRequestReviewThreadEventWebhook``: ``handle_review_thread``

Processors are separate rather than one routing function so the webhook loop
isolates each in its own try/except — a failure in one can't suppress the
others — and each carries its own feature flag and action gate.
"""

from __future__ import annotations

import logging
from collections.abc import Mapping
from dataclasses import asdict
from typing import Any

from django.conf import settings
from django.db import IntegrityError, router, transaction

from sentry import features
from sentry.integrations.github.webhook_types import GithubWebhookType
from sentry.integrations.services.integration import RpcIntegration
from sentry.models.organization import Organization
from sentry.models.pullrequest import (
    PullRequest,
    PullRequestActivity,
    PullRequestActivityType,
    PullRequestAttributionSignalType,
    PullRequestAttributionSource,
    PullRequestMetrics,
    PullRequestVerdict,
)
from sentry.models.repository import Repository
from sentry.pr_metrics.activity_types import (
    AssignedPayload,
    ClosedPayload,
    CommentCreatedPayload,
    CommentEditedPayload,
    ConvertedToDraftPayload,
    EditedPayload,
    LabeledPayload,
    OpenedPayload,
    ReadyForReviewPayload,
    ReopenedPayload,
    ReviewRequestedPayload,
    ReviewRequestRemovedPayload,
    ReviewSubmittedPayload,
    ReviewThreadPayload,
    SynchronizePayload,
    UnassignedPayload,
    UnlabeledPayload,
)
from sentry.pr_metrics.attribution import record_attribution_signal
from sentry.pr_metrics.emit import (
    emit_pr_metrics_row,
    is_pr_tracked,
    select_verdict,
)
from sentry.utils import metrics

logger = logging.getLogger("sentry.webhooks")

# Actions that set attribution for who authored the PR. The PR author is fixed
# at creation time and never changes, so app attribution is a one-shot write.
_AUTHOR_ATTRIBUTION_ACTIONS = frozenset({"opened"})

_ACTIVITY_ACTIONS = frozenset(
    {
        "opened",
        "closed",
        "reopened",
        "synchronize",
        "edited",
        "labeled",
        "unlabeled",
        "review_requested",
        "review_request_removed",
        "converted_to_draft",
        "ready_for_review",
        "assigned",
        "unassigned",
    }
)

# Maps webhook action strings to PullRequestActivityType values.
# "closed" is absent because it forks on pull_request.merged — handled in _write_activity.
_ACTION_TO_ACTIVITY_TYPE: dict[str, PullRequestActivityType] = {
    "opened": PullRequestActivityType.OPENED,
    "reopened": PullRequestActivityType.REOPENED,
    "synchronize": PullRequestActivityType.SYNCHRONIZED,
    "edited": PullRequestActivityType.EDITED,
    "labeled": PullRequestActivityType.LABELED,
    "unlabeled": PullRequestActivityType.UNLABELED,
    "review_requested": PullRequestActivityType.REVIEW_REQUESTED,
    "review_request_removed": PullRequestActivityType.REVIEW_REQUEST_REMOVED,
    "converted_to_draft": PullRequestActivityType.CONVERTED_TO_DRAFT,
    "ready_for_review": PullRequestActivityType.READY_FOR_REVIEW,
    "assigned": PullRequestActivityType.ASSIGNED,
    "unassigned": PullRequestActivityType.UNASSIGNED,
}


def handle_attribution(
    *,
    github_event: GithubWebhookType,
    event: Mapping[str, Any],
    organization: Organization,
    repo: Repository,
    integration: RpcIntegration | None = None,
    **kwargs: Any,
) -> None:
    """Record GH-App author attribution signals from the pull_request webhook payload."""
    pull_request = event.get("pull_request")
    action = event.get("action")
    github_user = (pull_request or {}).get("user")
    if not (action and github_user):
        return

    if action not in _AUTHOR_ATTRIBUTION_ACTIONS:
        return

    if not features.has("organizations:pr-metrics-attribution", organization):
        return

    pr = _get_pull_request(organization, repo, pull_request)
    if pr is None:
        return

    _write_author_attribution(pr, github_user)


def _claim_terminal_event(pr: PullRequest, verdict: PullRequestVerdict) -> bool:
    """Atomically claim a PR's terminal (close/merge) event for emission.

    The redelivery guard. GitHub redelivers webhooks, and
    ``PullRequestEventWebhook._handle`` stamps ``closed_at``/``state`` from every
    payload, so the PR row can't tell whether the terminal event was already
    processed. The pipeline-owned ``PullRequestMetrics.verdict`` can: it stays
    null until we settle one, so a compare-and-set on ``verdict IS NULL`` lets
    exactly one delivery claim the event and write ``verdict``, even under
    concurrent redeliveries. Returns True if this call won the claim.

    Only called once a deterministic ``verdict`` is in hand. A PR that needs a
    judge is guarded the same way once the forward path lands — it claims the
    event with a sentinel verdict before forwarding — but that isn't wired yet.
    """
    claimed = PullRequestMetrics.objects.filter(pull_request=pr, verdict__isnull=True).update(
        verdict=verdict
    )
    return bool(claimed)


def handle_emission(
    *,
    github_event: GithubWebhookType,
    event: Mapping[str, Any],
    organization: Organization,
    repo: Repository,
    integration: RpcIntegration | None = None,
    **kwargs: Any,
) -> None:
    """Emit a metrics row on a terminal (close/merge) PR webhook for a tracked PR.

    GitHub's single ``closed`` action covers both merges and plain closes; emit
    derives which from the stored row, so this handler only filters for ``closed``
    and delegates. All non-terminal actions are ignored.

    Untracked PRs (no valid attribution) are dropped first, before any verdict is
    claimed: claiming would burn the redelivery guard, so a PR that gained
    attribution only later (e.g. a Seer backfill) could never emit. ``select_verdict``
    then decides the outcome: a deterministic verdict is claimed (the redelivery
    guard) and emitted. A PR that needs a judge is forwarded to Seer instead; that
    path — including its own redelivery guard — isn't wired yet, so for now a
    judge-needed PR is skipped here.
    """
    if event.get("action") != "closed":
        return

    if not features.has("organizations:pr-metrics-emit", organization):
        return

    pr = _get_pull_request(organization, repo, event.get("pull_request"))
    if pr is None:
        return

    if not is_pr_tracked(pr):
        metrics.incr("pr_metrics.emit.skipped", tags={"reason": "untracked"})
        return

    verdict = select_verdict(pr, organization)
    if verdict is None:
        metrics.incr("pr_metrics.emit.skipped", tags={"reason": "needs_judge"})
        logger.info(
            "pr_metrics.emit.needs_judge",
            extra={"organization_id": organization.id, "pull_request_id": pr.id},
        )
        return

    if not _claim_terminal_event(pr, verdict):
        metrics.incr("pr_metrics.emit.skipped", tags={"reason": "redelivery"})
        return

    # Claim before emit so build_pr_metrics_row reads the verdict back onto the row.
    # analytics.record is best-effort, async-batched telemetry; if it raises the
    # claim still stands and the row is forgone — an acceptable loss for telemetry,
    # not worth a rollback that would reopen the redelivery race.
    emit_pr_metrics_row(pull_request=pr)


def handle_metrics(
    *,
    github_event: GithubWebhookType,
    event: Mapping[str, Any],
    organization: Organization,
    repo: Repository,
    integration: RpcIntegration | None = None,
    **kwargs: Any,
) -> None:
    """Persist the webhook-sourced activity counters onto ``PullRequestMetrics``.

    Kept current on every ``pull_request`` event so the emit path can read the
    counts off the row — the judge path (Seer RPC callback) has no payload to
    derive them from. Registered before ``handle_emission`` so a close/merge
    reflects the final counts. Gated by the emit flag, the sole consumer; only
    the webhook-sourced columns are written, leaving the Seer-derived ones
    (verdict, participants_count, reviews_count) untouched.
    """
    pull_request = event.get("pull_request")
    if not pull_request:
        return

    if not features.has("organizations:pr-metrics-emit", organization):
        return

    pr = _get_pull_request(organization, repo, pull_request)
    if pr is None:
        return

    PullRequestMetrics.objects.update_or_create(
        pull_request=pr,
        defaults=_metrics_counters(pull_request),
    )


def handle_activity(
    *,
    github_event: GithubWebhookType,
    event: Mapping[str, Any],
    organization: Organization,
    repo: Repository,
    integration: RpcIntegration | None = None,
    **kwargs: Any,
) -> None:
    """Record PR lifecycle activity rows from pull_request webhook events."""
    pull_request_data = event.get("pull_request")
    action = event.get("action")
    if not action or action not in _ACTIVITY_ACTIONS:
        return

    pr = _get_pull_request(organization, repo, pull_request_data)
    if pr is None:
        return

    if not features.has("organizations:pr-metrics-activity", organization):
        return

    webhook_id: str | None = kwargs.get("github_delivery_id")
    _write_activity(pr, action, pull_request_data or {}, event, webhook_id)


def handle_comment(
    *,
    github_event: GithubWebhookType,
    event: Mapping[str, Any],
    organization: Organization,
    repo: Repository,
    integration: RpcIntegration | None = None,
    **kwargs: Any,
) -> None:
    """Record PR comment activity from issue_comment webhook events."""
    action = event.get("action")
    if action not in ("created", "edited"):
        return

    if not features.has("organizations:pr-metrics-activity", organization):
        return

    issue = event.get("issue")
    if not issue:
        return

    # Only track PR comments, not comments on plain issues.
    if not issue.get("pull_request"):
        return

    try:
        pr = PullRequest.objects.get(
            organization_id=organization.id,
            repository_id=repo.id,
            key=str(issue["number"]),
        )
    except PullRequest.DoesNotExist:
        logger.warning(
            "github.pr_metrics.comment.pr_not_found",
            extra={"repository_id": repo.id, "issue_number": issue["number"]},
        )
        return

    sender = event.get("sender") or {}
    comment = event.get("comment") or {}

    if action == "created":
        event_type = PullRequestActivityType.COMMENT_CREATED
        payload_obj: CommentCreatedPayload | CommentEditedPayload = CommentCreatedPayload(
            sender_login=sender.get("login", ""),
            sender_type=sender.get("type", ""),
            author_association=comment.get("author_association", "NONE"),
        )
    else:
        event_type = PullRequestActivityType.COMMENT_EDITED
        payload_obj = CommentEditedPayload(
            sender_login=sender.get("login", ""),
            sender_type=sender.get("type", ""),
            author_association=comment.get("author_association", "NONE"),
        )

    webhook_id: str | None = kwargs.get("github_delivery_id")
    if not webhook_id:
        return

    _write_activity_row(pr, webhook_id, event_type, asdict(payload_obj))


def handle_review(
    *,
    github_event: GithubWebhookType,
    event: Mapping[str, Any],
    organization: Organization,
    repo: Repository,
    integration: RpcIntegration | None = None,
    **kwargs: Any,
) -> None:
    """Record a submitted PR review (approved / changes_requested / commented)."""
    action = event.get("action")
    if action != "submitted":
        return

    if not features.has("organizations:pr-metrics-activity", organization):
        return

    pr = _get_pull_request(organization, repo, event.get("pull_request"))
    if pr is None:
        return

    review = event.get("review") or {}
    sender = event.get("sender") or {}
    payload = asdict(
        ReviewSubmittedPayload(
            action=action,
            sender_login=sender.get("login", ""),
            sender_type=sender.get("type", ""),
            review_state=review.get("state", ""),
            review_id=review.get("id", 0),
        )
    )

    webhook_id: str | None = kwargs.get("github_delivery_id")
    if not webhook_id:
        return
    _write_activity_row(pr, webhook_id, PullRequestActivityType.REVIEW_SUBMITTED, payload)


def handle_review_comment(
    *,
    github_event: GithubWebhookType,
    event: Mapping[str, Any],
    organization: Organization,
    repo: Repository,
    integration: RpcIntegration | None = None,
    **kwargs: Any,
) -> None:
    """Record inline PR review comments (pull_request_review_comment events)."""
    action = event.get("action")
    if action not in ("created", "edited"):
        return

    if not features.has("organizations:pr-metrics-activity", organization):
        return

    pr = _get_pull_request(organization, repo, event.get("pull_request"))
    if pr is None:
        return

    comment = event.get("comment") or {}
    sender = event.get("sender") or {}

    if action == "created":
        event_type = PullRequestActivityType.COMMENT_CREATED
        payload_obj: CommentCreatedPayload | CommentEditedPayload = CommentCreatedPayload(
            sender_login=sender.get("login", ""),
            sender_type=sender.get("type", ""),
            author_association=comment.get("author_association", "NONE"),
            is_review=True,
            review_id=comment.get("pull_request_review_id"),
        )
    else:
        event_type = PullRequestActivityType.COMMENT_EDITED
        payload_obj = CommentEditedPayload(
            sender_login=sender.get("login", ""),
            sender_type=sender.get("type", ""),
            author_association=comment.get("author_association", "NONE"),
            is_review=True,
            review_id=comment.get("pull_request_review_id"),
        )

    webhook_id: str | None = kwargs.get("github_delivery_id")
    if not webhook_id:
        return
    _write_activity_row(pr, webhook_id, event_type, asdict(payload_obj))


def handle_review_thread(
    *,
    github_event: GithubWebhookType,
    event: Mapping[str, Any],
    organization: Organization,
    repo: Repository,
    integration: RpcIntegration | None = None,
    **kwargs: Any,
) -> None:
    """Record review thread resolved / unresolved events."""
    action = event.get("action")
    if action not in ("resolved", "unresolved"):
        return

    if not features.has("organizations:pr-metrics-activity", organization):
        return

    pr = _get_pull_request(organization, repo, event.get("pull_request"))
    if pr is None:
        return

    thread = event.get("thread") or {}
    sender = event.get("sender") or {}
    is_resolved = action == "resolved"
    event_type = (
        PullRequestActivityType.REVIEW_THREAD_RESOLVED
        if is_resolved
        else PullRequestActivityType.REVIEW_THREAD_UNRESOLVED
    )
    payload = asdict(
        ReviewThreadPayload(
            action=action,
            sender_login=sender.get("login", ""),
            sender_type=sender.get("type", ""),
            thread_id=thread.get("node_id", ""),
            is_resolved=is_resolved,
        )
    )

    webhook_id: str | None = kwargs.get("github_delivery_id")
    if not webhook_id:
        return
    _write_activity_row(pr, webhook_id, event_type, payload)


def _get_pull_request(
    organization: Organization, repo: Repository, pull_request: dict[str, Any] | None
) -> PullRequest | None:
    """Resolve the canonical PullRequest row for a webhook payload, or None.

    Returns None when the event carries no pull_request. Otherwise the row is
    upserted by ``PullRequestEventWebhook._handle`` before processors run, so a
    miss is unexpected — log it and let the caller bail.
    """
    if not pull_request:
        return None
    try:
        return PullRequest.objects.get(
            organization_id=organization.id,
            repository_id=repo.id,
            key=str(pull_request["number"]),
        )
    except PullRequest.DoesNotExist:
        logger.warning(
            "github.pr_metrics.pr_not_found",
            extra={"repository_id": repo.id, "pr_number": pull_request["number"]},
        )
        return None


def _metrics_counters(pull_request: Mapping[str, Any]) -> dict[str, Any]:
    """Map a GitHub PR payload to the ``PullRequestMetrics`` counter columns.

    Counts are coalesced to 0 (the columns are non-null); ``is_assigned`` is
    derived here since the payload carries assignees, not a flag.
    """
    return {
        "additions": pull_request.get("additions") or 0,
        "deletions": pull_request.get("deletions") or 0,
        "files_changed": pull_request.get("changed_files") or 0,
        "commits_count": pull_request.get("commits") or 0,
        "comments_count": pull_request.get("comments") or 0,
        "review_comments_count": pull_request.get("review_comments") or 0,
        "is_assigned": bool(pull_request.get("assignees") or pull_request.get("assignee")),
    }


def _detect_app_signal(github_user_id: int) -> PullRequestAttributionSignalType | None:
    seer_id = getattr(settings, "SEER_AUTOFIX_GITHUB_APP_USER_ID", None)
    sentry_id = getattr(settings, "SENTRY_GITHUB_APP_USER_ID", None)
    if github_user_id in (seer_id, sentry_id):
        return PullRequestAttributionSignalType.SENTRY_APP
    return None


def _write_author_attribution(pr: PullRequest, github_user: dict[str, Any]) -> None:
    user_id = github_user.get("id")
    if user_id is None:
        return
    signal_type = _detect_app_signal(user_id)
    if signal_type is None:
        return
    record_attribution_signal(
        pull_request=pr,
        signal_type=signal_type,
        source=PullRequestAttributionSource.WEBHOOK_DATA,
    )


def _write_activity_row(
    pr: PullRequest,
    webhook_id: str,
    event_type: PullRequestActivityType,
    payload: dict[str, Any],
) -> None:
    try:
        with transaction.atomic(using=router.db_for_write(PullRequestActivity)):
            PullRequestActivity.objects.create(
                pull_request=pr,
                webhook_id=webhook_id,
                event_type=event_type,
                payload=payload,
            )
    except IntegrityError:
        pass  # redelivery — already processed


def _write_activity(
    pr: PullRequest,
    action: str,
    pull_request: Mapping[str, Any],
    event: Mapping[str, Any],
    webhook_id: str | None,
) -> None:
    if not webhook_id:
        # Without a delivery ID idempotency cannot be guaranteed — skip.
        return

    if action == "closed":
        event_type = (
            PullRequestActivityType.MERGED
            if pull_request.get("merged")
            else PullRequestActivityType.CLOSED
        )
    else:
        mapped = _ACTION_TO_ACTIVITY_TYPE.get(action)
        if mapped is None:
            return
        event_type = mapped

    payload = _build_activity_payload(action, pull_request, event)
    _write_activity_row(pr, webhook_id, event_type, payload)


def _build_activity_payload(
    action: str,
    pull_request: Mapping[str, Any],
    event: Mapping[str, Any],
) -> dict[str, Any]:
    head = pull_request.get("head") or {}
    base = pull_request.get("base") or {}
    sender = event.get("sender") or pull_request.get("user") or {}

    base_kw: dict[str, Any] = dict(
        sender_login=sender.get("login", ""),
        sender_type=sender.get("type", ""),
        head_sha=head.get("sha"),
        base_sha=base.get("sha"),
    )

    match action:
        case "opened":
            return asdict(
                OpenedPayload(
                    **base_kw,
                    additions=pull_request.get("additions", 0),
                    deletions=pull_request.get("deletions", 0),
                    changed_files=pull_request.get("changed_files", 0),
                    commits=pull_request.get("commits", 0),
                )
            )
        case "closed":
            return asdict(
                ClosedPayload(
                    **base_kw,
                    merged=pull_request.get("merged", False),
                    additions=pull_request.get("additions", 0),
                    deletions=pull_request.get("deletions", 0),
                    changed_files=pull_request.get("changed_files", 0),
                    commits=pull_request.get("commits", 0),
                    comments=pull_request.get("comments", 0),
                    review_comments=pull_request.get("review_comments", 0),
                    merged_by=(pull_request.get("merged_by") or {}).get("login"),
                )
            )
        case "reopened":
            return asdict(
                ReopenedPayload(
                    **base_kw,
                    additions=pull_request.get("additions", 0),
                    deletions=pull_request.get("deletions", 0),
                    changed_files=pull_request.get("changed_files", 0),
                    commits=pull_request.get("commits", 0),
                )
            )
        case "synchronize":
            return asdict(
                SynchronizePayload(
                    **base_kw,
                    before_sha=event.get("before"),
                    after_sha=event.get("after"),
                )
            )
        case "edited":
            changes = event.get("changes") or {}
            return asdict(EditedPayload(**base_kw, changed_fields=sorted(changes.keys())))
        case "labeled":
            label = event.get("label") or {}
            return asdict(LabeledPayload(**base_kw, label_name=(label.get("name") or "")))
        case "unlabeled":
            label = event.get("label") or {}
            return asdict(UnlabeledPayload(**base_kw, label_name=(label.get("name") or "")))
        case "review_requested":
            return asdict(
                ReviewRequestedPayload(
                    **base_kw, is_team_review=event.get("requested_team") is not None
                )
            )
        case "review_request_removed":
            return asdict(
                ReviewRequestRemovedPayload(
                    **base_kw, is_team_review=event.get("requested_team") is not None
                )
            )
        case "assigned":
            assignee = event.get("assignee") or {}
            return asdict(AssignedPayload(**base_kw, assignee_login=assignee.get("login", "")))
        case "unassigned":
            assignee = event.get("assignee") or {}
            return asdict(UnassignedPayload(**base_kw, assignee_login=assignee.get("login", "")))
        case "converted_to_draft":
            return asdict(ConvertedToDraftPayload(**base_kw))
        case "ready_for_review":
            return asdict(ReadyForReviewPayload(**base_kw))
        case _:
            raise ValueError(f"No payload builder for action {action!r}")
