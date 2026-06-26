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
from datetime import datetime, timedelta
from typing import Any

import sentry_sdk
from django.conf import settings
from django.core.cache import cache
from django.db import IntegrityError, router, transaction
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from sentry import features
from sentry.integrations.github.webhook_types import GithubWebhookType
from sentry.integrations.services.integration import RpcIntegration
from sentry.issues.constants import cache_key_for_issue_view
from sentry.models.organization import Organization
from sentry.models.pullrequest import (
    PullRequest,
    PullRequestActivity,
    PullRequestActivityType,
    PullRequestAttribution,
    PullRequestAttributionSignalType,
    PullRequestAttributionSource,
    PullRequestMetrics,
    PullRequestVerdict,
)
from sentry.models.repository import Repository
from sentry.pr_metrics.activity_types import (
    AssignedPayload,
    AutoMergeDisabledPayload,
    AutoMergeEnabledPayload,
    CheckRunCompletedPayload,
    CheckSuiteCompletedPayload,
    ClosedPayload,
    CommentCreatedPayload,
    CommentEditedPayload,
    ConvertedToDraftPayload,
    DequeuedPayload,
    EditedPayload,
    EnqueuedPayload,
    LabeledPayload,
    OpenedPayload,
    ReadyForReviewPayload,
    ReopenedPayload,
    ReviewDismissedPayload,
    ReviewRequestedPayload,
    ReviewRequestRemovedPayload,
    ReviewSubmittedPayload,
    ReviewThreadPayload,
    SynchronizePayload,
    UnassignedPayload,
    UnlabeledPayload,
)
from sentry.pr_metrics.attribution import JUDGE_ELIGIBLE_SIGNAL_TYPES, record_attribution_signal
from sentry.pr_metrics.emit import (
    emit_pr_metrics_row,
    is_pr_tracked,
    select_verdict,
)
from sentry.pr_metrics.tasks import forward_pr_to_seer_task
from sentry.pr_metrics.utils import (
    DELEGATED_AGENT_AUTHOR_LOGINS,
    DELEGATED_AGENT_BRANCH_PREFIXES,
    is_activity_tracking_enabled,
    resolved_group_ids,
)
from sentry.seer.seer_setup import has_seer_access
from sentry.utils import metrics

logger = logging.getLogger("sentry.webhooks")

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
        "auto_merge_enabled",
        "auto_merge_disabled",
        "enqueued",
        "dequeued",
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
    "auto_merge_enabled": PullRequestActivityType.AUTO_MERGE_ENABLED,
    "auto_merge_disabled": PullRequestActivityType.AUTO_MERGE_DISABLED,
    "enqueued": PullRequestActivityType.ENQUEUED,
    "dequeued": PullRequestActivityType.DEQUEUED,
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
    """Record attribution signals (app-authored PR + MCP issue views) from the pull_request webhook."""
    pull_request = event.get("pull_request")
    action = event.get("action")
    github_user = (pull_request or {}).get("user")
    if not (action and github_user):
        return

    if not features.has("organizations:pr-metrics-attribution", organization):
        return

    pr = _get_pull_request(organization, repo, pull_request, kwargs.get("github_delivery_id"))
    if pr is None:
        return

    if action == "opened":
        _write_author_attribution(pr, github_user)
    if features.has("organizations:mcp-issue-view-attribution", organization):
        _write_mcp_attribution(pr)
    if action == "opened" and pull_request is not None and has_seer_access(organization):
        _detect_delegated_agent(pr, pull_request)


def _claim_terminal_event(pr: PullRequest, verdict: PullRequestVerdict) -> bool:
    """Atomically claim a PR's terminal (close/merge) event for emission.

    The redelivery guard. GitHub redelivers webhooks, and
    ``PullRequestEventWebhook._handle`` stamps ``closed_at``/``state`` from every
    payload, so the PR row can't tell whether the terminal event was already
    processed. The pipeline-owned ``PullRequestMetrics.verdict`` can: it stays
    null until we settle one, so a compare-and-set on ``verdict IS NULL`` lets
    exactly one delivery claim the event and write ``verdict``, even under
    concurrent redeliveries. Returns True if this call won the claim.

    The verdict is never cleared, so the guard coalesces *every* repeat terminal
    event to that one claim — not just GitHub redeliveries but also a reopen
    followed by another close/merge. That's deliberate: we emit one analytics row
    per PR (its first terminal state is authoritative), since multiple emissions
    have meant costly dedup downstream for little benefit. A PR reopened after a
    close and later merged is thus recorded by its first close — an accepted loss
    on the rare reopened PR.

    Only called once a deterministic ``verdict`` is in hand. A PR that needs a
    judge is guarded the same way once the forward path lands — it claims the
    event with a sentinel verdict before forwarding — but that isn't wired yet.
    """
    claimed = PullRequestMetrics.objects.filter(pull_request=pr, verdict__isnull=True).update(
        verdict=verdict
    )
    return bool(claimed)


def _claim_for_judge(pr: PullRequest) -> bool:
    """Claim a needs-judge terminal event for the forward path.

    Like ``_claim_terminal_event`` but for the ``JUDGE_IN_PROGRESS`` sentinel, and
    tolerant of a missing metrics row: ``select_verdict`` defers to a judge when
    the row is absent, so ensure it exists before the compare-and-set claims the
    sentinel onto a null verdict. Returns True if this call won the claim.
    """
    PullRequestMetrics.objects.get_or_create(pull_request=pr)
    return _claim_terminal_event(pr, PullRequestVerdict.JUDGE_IN_PROGRESS)


def _forward_to_judge(pr: PullRequest, organization: Organization) -> None:
    """Hand a needs-judge terminal event to Seer, guarded against redelivery.


    * Only PRs in orgs that have seer access are forwarded to the judge.
    * Only PRs with attribution in JUDGE_ELIGIBLE_SIGNAL_TYPES are forwarded to
    the judge.

    Gated on ``pr-metrics-judge`` independently of emission: until it's enabled
    (and Seer's endpoint exists), a needs-judge PR is skipped — today's behavior.
    Claims the sentinel via the redelivery guard before enqueuing the forward, so
    a redelivered terminal event can't forward to Seer twice.
    """
    if not has_seer_access(organization):
        metrics.incr("pr_metrics.emit.skipped", tags={"reason": "no_seer_access"})
        logger.info(
            "pr_metrics.emit.needs_judge",
            extra={
                "organization_id": organization.id,
                "repository_id": pr.repository_id,
                "pull_request_id": pr.id,
                "reason": "no_seer_access",
            },
        )
        return

    if not PullRequestAttribution.objects.filter(
        pull_request=pr,
        is_valid=True,
        signal_type__in=JUDGE_ELIGIBLE_SIGNAL_TYPES,
    ).exists():
        metrics.incr("pr_metrics.emit.skipped", tags={"reason": "no_eligible_attribution"})
        logger.info(
            "pr_metrics.emit.needs_judge",
            extra={
                "organization_id": organization.id,
                "repository_id": pr.repository_id,
                "pull_request_id": pr.id,
                "reason": "not_agent_attribution",
            },
        )
        return

    if not features.has("organizations:pr-metrics-judge", organization):
        metrics.incr("pr_metrics.emit.skipped", tags={"reason": "needs_judge"})
        logger.info(
            "pr_metrics.emit.needs_judge",
            extra={
                "organization_id": organization.id,
                "repository_id": pr.repository_id,
                "pull_request_id": pr.id,
                "reason": "blocked_by_flag",
            },
        )
        return

    if not _claim_for_judge(pr):
        metrics.incr("pr_metrics.emit.skipped", tags={"reason": "redelivery"})
        return

    try:
        forward_pr_to_seer_task.delay(
            pull_request_id=pr.id,
            organization_id=organization.id,
            repository_id=pr.repository_id,
        )
    except Exception:
        # The claim committed but the enqueue didn't, so no task will settle this
        # PR. Release the sentinel (only if it's still ours) so a webhook
        # redelivery re-forwards rather than the PR sticking in JUDGE_IN_PROGRESS.
        PullRequestMetrics.objects.filter(
            pull_request=pr, verdict=PullRequestVerdict.JUDGE_IN_PROGRESS
        ).update(verdict=None)
        metrics.incr("pr_metrics.judge.enqueue_failed")
        logger.exception(
            "pr_metrics.judge.enqueue_failed",
            extra={
                "organization_id": organization.id,
                "repository_id": pr.repository_id,
                "pull_request_id": pr.id,
            },
        )
        return
    metrics.incr("pr_metrics.judge.enqueued")


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
    guard) and emitted; a PR that needs a judge is forwarded to Seer instead (gated
    on ``pr-metrics-judge``, guarded by the same claim against redelivery), and Seer
    calls back to settle and emit it.
    """
    if event.get("action") != "closed":
        return

    if not features.has("organizations:pr-metrics-emit", organization):
        return

    pr = _get_pull_request(
        organization, repo, event.get("pull_request"), kwargs.get("github_delivery_id")
    )
    if pr is None:
        return

    if not is_pr_tracked(pr):
        metrics.incr("pr_metrics.emit.skipped", tags={"reason": "untracked"})
        return

    verdict = select_verdict(pr, organization)
    if verdict is None:
        _forward_to_judge(pr, organization)
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

    pr = _get_pull_request(organization, repo, pull_request, kwargs.get("github_delivery_id"))
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

    pr = _get_pull_request(organization, repo, pull_request_data, kwargs.get("github_delivery_id"))
    if pr is None:
        return

    if not is_activity_tracking_enabled(organization):
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

    if not is_activity_tracking_enabled(organization):
        return

    issue = event.get("issue")
    if not issue:
        return

    # Only track PR comments, not comments on plain issues.
    if not issue.get("pull_request"):
        return

    webhook_id: str | None = kwargs.get("github_delivery_id")
    issue_created_at = issue.get("created_at")
    pr = _resolve_or_stub_pull_request(
        organization,
        repo,
        pr_number=issue["number"],
        opened_at=parse_datetime(issue_created_at) if issue_created_at else None,
        title=issue.get("title"),
        github_delivery_id=webhook_id,
    )
    if pr is None:
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
    """Record a PR review event.

    ``submitted`` captures the review state (approved / changes_requested /
    commented); ``dismissed`` captures an approval or changes-request being
    undone — review signal the comment judge can use. Other actions are ignored.
    """
    action = event.get("action")
    if action not in ("submitted", "dismissed"):
        return

    if not is_activity_tracking_enabled(organization):
        return

    pr = _get_pull_request(
        organization, repo, event.get("pull_request"), kwargs.get("github_delivery_id")
    )
    if pr is None:
        return

    review = event.get("review") or {}
    sender = event.get("sender") or {}
    if action == "submitted":
        event_type = PullRequestActivityType.REVIEW_SUBMITTED
        payload = asdict(
            ReviewSubmittedPayload(
                action=action,
                sender_login=sender.get("login", ""),
                sender_type=sender.get("type", ""),
                review_state=review.get("state", ""),
                review_id=review.get("id", 0),
            )
        )
    else:
        event_type = PullRequestActivityType.REVIEW_DISMISSED
        payload = asdict(
            ReviewDismissedPayload(
                sender_login=sender.get("login", ""),
                sender_type=sender.get("type", ""),
                review_id=review.get("id", 0),
            )
        )

    webhook_id: str | None = kwargs.get("github_delivery_id")
    if not webhook_id:
        return
    _write_activity_row(pr, webhook_id, event_type, payload)


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

    if not is_activity_tracking_enabled(organization):
        return

    pr = _get_pull_request(
        organization, repo, event.get("pull_request"), kwargs.get("github_delivery_id")
    )
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

    if not is_activity_tracking_enabled(organization):
        return

    pr = _get_pull_request(
        organization, repo, event.get("pull_request"), kwargs.get("github_delivery_id")
    )
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


def handle_check_suite(
    *,
    github_event: GithubWebhookType,
    event: Mapping[str, Any],
    organization: Organization,
    repo: Repository,
    integration: RpcIntegration | None = None,
    **kwargs: Any,
) -> None:
    """Record the aggregate CI outcome from a completed check_suite event.

    Only ``completed`` carries a conclusion; ``requested``/``rerequested`` are
    ignored. The suite's ``pull_requests`` array lists the same-repo PRs the run
    pertains to (empty for fork PRs) — one activity row is written per PR.
    """
    if event.get("action") != "completed":
        return

    if not is_activity_tracking_enabled(organization):
        return

    webhook_id: str | None = kwargs.get("github_delivery_id")
    if not webhook_id:
        return

    check_suite = event.get("check_suite") or {}
    sender = event.get("sender") or {}
    app = check_suite.get("app") or {}
    payload = asdict(
        CheckSuiteCompletedPayload(
            sender_login=sender.get("login", ""),
            sender_type=sender.get("type", ""),
            head_sha=check_suite.get("head_sha"),
            conclusion=check_suite.get("conclusion") or "",
            app_slug=app.get("slug", ""),
            check_runs_count=check_suite.get("latest_check_runs_count") or 0,
        )
    )

    for pr in _prs_from_check_payload(organization, repo, check_suite, webhook_id):
        _write_activity_row(pr, webhook_id, PullRequestActivityType.CHECK_SUITE_COMPLETED, payload)


def handle_check_run(
    *,
    github_event: GithubWebhookType,
    event: Mapping[str, Any],
    organization: Organization,
    repo: Repository,
    integration: RpcIntegration | None = None,
    **kwargs: Any,
) -> None:
    """Record an individual CI check outcome from a completed check_run event.

    Per-check granularity beneath ``check_suite``; only ``completed`` carries a
    conclusion. ``check_run.pull_requests`` resolves the affected same-repo PRs.
    """
    if event.get("action") != "completed":
        return

    if not is_activity_tracking_enabled(organization):
        return

    webhook_id: str | None = kwargs.get("github_delivery_id")
    if not webhook_id:
        return

    check_run = event.get("check_run") or {}
    sender = event.get("sender") or {}
    app = check_run.get("app") or {}
    payload = asdict(
        CheckRunCompletedPayload(
            sender_login=sender.get("login", ""),
            sender_type=sender.get("type", ""),
            head_sha=check_run.get("head_sha"),
            check_name=check_run.get("name", ""),
            conclusion=check_run.get("conclusion") or "",
            app_slug=app.get("slug", ""),
        )
    )

    for pr in _prs_from_check_payload(organization, repo, check_run, webhook_id):
        _write_activity_row(pr, webhook_id, PullRequestActivityType.CHECK_RUN_COMPLETED, payload)


def _prs_from_check_payload(
    organization: Organization,
    repo: Repository,
    container: Mapping[str, Any],
    webhook_id: str,
) -> list[PullRequest]:
    """Resolve the tracked PRs a check_suite/check_run payload references.

    Both events carry a ``pull_requests`` array of same-repo PR refs (empty for
    fork PRs, and a suite can span more than one PR). Numbers are deduped before
    resolving each to its stored row; unknown PRs are dropped by ``_get_pull_request``.
    """
    seen: set[str] = set()
    prs: list[PullRequest] = []
    for ref in container.get("pull_requests") or ():
        number = ref.get("number")
        if number is None or str(number) in seen:
            continue
        seen.add(str(number))
        pr = _get_pull_request(organization, repo, {"number": number}, webhook_id)
        if pr is not None:
            prs.append(pr)
    return prs


# A comment or review webhook can be delivered before the ``pull_request``
# (opened) webhook that writes the PullRequest row — they are separate GitHub
# deliveries with no ordering guarantee. When the PR was opened within this
# window we treat a miss as that race and create a minimal stub the opened/sync
# event later enriches; an older miss predates our ingestion (no opened event
# will re-fire to fill the stub), so we skip it. Sized well above the observed
# seconds-to-minutes race to absorb webhook backlog.
_PULL_REQUEST_STUB_MAX_AGE = timedelta(hours=1)


def _resolve_or_stub_pull_request(
    organization: Organization,
    repo: Repository,
    *,
    pr_number: int,
    opened_at: datetime | None,
    title: str | None,
    github_delivery_id: str | None,
) -> PullRequest | None:
    """Return the PullRequest row, creating a minimal stub for a recent miss.

    pr_metrics piggybacks on rows written by ``PullRequestEventWebhook`` from
    ``pull_request`` events. Comment and review events are separate deliveries
    that can arrive before that row exists. Rather than drop the activity, create
    a minimal stub the ``pull_request`` event enriches via its own
    ``update_or_create`` — but only for a PR opened recently, since an older miss
    predates ingestion and has no opened event coming to fill the stub.
    ``get_or_create`` is race-safe on the ``(repository_id, key)`` unique
    constraint.
    """
    key = str(pr_number)
    try:
        return PullRequest.objects.get(
            organization_id=organization.id, repository_id=repo.id, key=key
        )
    except PullRequest.DoesNotExist:
        pass

    log_extra = {
        "organization_id": organization.id,
        "repository_id": repo.id,
        "repo_name": repo.name,
        "pr_number": pr_number,
        "github_delivery_id": github_delivery_id,
    }

    if opened_at is None or opened_at < timezone.now() - _PULL_REQUEST_STUB_MAX_AGE:
        # Expected miss: the PR predates our ingestion (or its age is unknown), so
        # no opened event will arrive to enrich a stub. Skip it — not an error.
        metrics.incr("pr_metrics.pull_request.unresolved", tags={"reason": "predates_ingestion"})
        logger.info("pr_metrics.pull_request.unresolved", extra=log_extra)
        return None

    pull_request, created = PullRequest.objects.get_or_create(
        organization_id=organization.id,
        repository_id=repo.id,
        key=key,
        defaults={"opened_at": opened_at, "title": title},
    )
    if created:
        metrics.incr("pr_metrics.pull_request.stub_created")
        logger.info("pr_metrics.pull_request.stub_created", extra=log_extra)
    return pull_request


def _get_pull_request(
    organization: Organization,
    repo: Repository,
    pull_request: dict[str, Any] | None,
    github_delivery_id: str | None = None,
) -> PullRequest | None:
    """Resolve the PullRequest row for a ``pull_request``-shaped payload.

    Returns None when the event carries no pull_request. The row is normally
    upserted by ``PullRequestEventWebhook._handle`` in the same delivery; for the
    cross-delivery review events it may be missing, so we resolve-or-stub (see
    ``_resolve_or_stub_pull_request``).
    """
    if not pull_request:
        return None
    created_at = pull_request.get("created_at")
    return _resolve_or_stub_pull_request(
        organization,
        repo,
        pr_number=pull_request["number"],
        opened_at=parse_datetime(created_at) if created_at else None,
        title=pull_request.get("title"),
        github_delivery_id=github_delivery_id,
    )


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


def _is_delegated_agent_candidate(webhook_pull_request: Mapping[str, Any]) -> str | None:
    """Return a provider hint if a PR looks like a delegated coding-agent PR, else None.

    Two payload-native signals are used. The head branch prefix is primary because
    Claude-delegated PRs are opened by the Sentry GitHub app (no distinct author to
    key on), so the ``claude/`` prefix is the only usable signal. The author login
    covers Copilot, which opens PRs as a distinct bot user. The branch prefix wins
    when both match. This is a cheap heuristic; the authoritative match happens in
    Seer downstream.
    """
    head_ref = (webhook_pull_request.get("head") or {}).get("ref") or ""
    for provider, prefix in DELEGATED_AGENT_BRANCH_PREFIXES.items():
        if prefix and head_ref.startswith(prefix):
            return provider

    github_login = (webhook_pull_request or {}).get("user", {}).get("login") or ""
    return DELEGATED_AGENT_AUTHOR_LOGINS.get(github_login)


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


def _detect_delegated_agent(pr: PullRequest, webhook_pull_request: Mapping[str, Any]) -> None:
    """
    Filter PRs that could have been delegated by Autofix to external coding agents,
    and fire the matching request to Seer if it's a candidate.

    Then Seer calls the RPC "record_pr_attribution" to write the attribution row async.
    """
    provider_hint = _is_delegated_agent_candidate(webhook_pull_request)
    # Our candidates are PRs from delegated agents
    # That explicitly address a Sentry issue
    if provider_hint is not None and resolved_group_ids(pr):
        # TODO: Fire-and-forget request to Seer when the match endpoint exists.
        # We will send: provider_hint, github_login, head_ref
        sentry_sdk.metrics.count(
            "pr_metrics.delegated_agent.seer_match.not_implemented",
            1,
            attributes={"provider_hint": provider_hint},
        )


def _write_mcp_attribution(pr: PullRequest) -> None:
    group_ids = resolved_group_ids(pr)
    if not group_ids:
        return

    # We do not check the PR author here as we cannot accurately map a PR author
    # to a sentry user 100 % of the time
    key_to_group_id = {cache_key_for_issue_view(gid, "mcp"): gid for gid in group_ids}
    hits = cache.get_many(key_to_group_id.keys())
    if not hits:
        return

    matched_groups = {
        str(key_to_group_id[key]): client_family for key, client_family in hits.items()
    }
    record_attribution_signal(
        pull_request=pr,
        signal_type=PullRequestAttributionSignalType.MCP,
        source=PullRequestAttributionSource.WEBHOOK_DATA,
        signal_details={"group_ids": matched_groups},
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
        case "auto_merge_enabled":
            auto_merge = pull_request.get("auto_merge") or {}
            return asdict(
                AutoMergeEnabledPayload(
                    **base_kw, merge_method=auto_merge.get("merge_method") or ""
                )
            )
        case "auto_merge_disabled":
            return asdict(AutoMergeDisabledPayload(**base_kw))
        case "enqueued":
            return asdict(EnqueuedPayload(**base_kw))
        case "dequeued":
            return asdict(DequeuedPayload(**base_kw, reason=event.get("reason") or ""))
        case _:
            raise ValueError(f"No payload builder for action {action!r}")
