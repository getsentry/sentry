"""GitHub webhook handling for the PR Merge Live Metrics pipeline.

Multiple independent processors serve several webhook event types:
- ``PullRequestEventWebhook``: ``handle_attribution``, ``handle_metrics``,
  ``handle_activity``, ``handle_emission``
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

from django.conf import settings
from django.core.cache import cache
from django.db import IntegrityError, router, transaction
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from sentry import features, options
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
    ConvertedToDraftPayload,
    DequeuedPayload,
    EnqueuedPayload,
    LabeledPayload,
    MergedPayload,
    OpenedPayload,
    ReadyForReviewPayload,
    ReviewDismissedPayload,
    ReviewRequestedPayload,
    ReviewRequestRemovedPayload,
    ReviewSubmittedPayload,
    ReviewThreadPayload,
    SynchronizePayload,
    UnassignedPayload,
    UnlabeledPayload,
)
from sentry.pr_metrics.attribution import (
    JUDGE_ELIGIBLE_SIGNAL_TYPES,
    SentryAppSignalDetails,
    record_attribution_signal,
)
from sentry.pr_metrics.emit import (
    emit_pr_metrics_row,
    is_pr_tracked,
    select_verdict,
)
from sentry.pr_metrics.tasks import emit_pr_metrics_cooldown_task, forward_pr_to_seer_task
from sentry.pr_metrics.utils import (
    DELEGATED_AGENT_AUTHOR_LOGINS,
    DELEGATED_AGENT_BRANCH_PREFIXES,
    is_activity_tracking_enabled,
    org_has_coding_agent_for_provider,
    resolved_group_ids,
)
from sentry.seer.autofix.utils import (
    MatchDelegatedAgentPrRequest,
    make_match_coding_agent_pr_request,
)
from sentry.seer.models import SeerRepoDefinition
from sentry.seer.seer_setup import has_seer_access
from sentry.utils import metrics

logger = logging.getLogger("sentry.webhooks")

_ACTIVITY_ACTIONS = frozenset(
    {
        "opened",
        "closed",
        "synchronize",
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
# "closed" is absent because it forks on pull_request.merged (CLOSED vs MERGED) —
# resolved in _write_activity.
_ACTION_TO_ACTIVITY_TYPE: dict[str, PullRequestActivityType] = {
    "opened": PullRequestActivityType.OPENED,
    "synchronize": PullRequestActivityType.SYNCHRONIZED,
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

    pr = _get_pull_request(
        organization,
        repo,
        pull_request,
        kwargs.get("github_delivery_id"),
        github_event=github_event,
    )
    if pr is None:
        return

    # SENTRY_APP author attribution is recorded on open and re-checked on close.
    # This is for the unlikely event that we missed the open webhook or for cases
    # where the PR open and closes super fast and the webhooks might be out of order
    if action in ("opened", "closed"):
        pr_url = (pull_request or {}).get("html_url") or None
        _write_author_attribution(pr, github_user, pr_url=pr_url, group_ids=resolved_group_ids(pr))
    if features.has("organizations:mcp-issue-view-attribution", organization):
        _write_mcp_attribution(pr)
    if action == "opened" and pull_request is not None:
        _attribute_delegated_agent(pr, pull_request, repo, organization, github_user)


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


def _claim_cooldown(pr: PullRequest) -> bool:
    """Claim a terminal event's emission cooldown, guarding against redelivery.

    Ensures the metrics row exists (``select_verdict`` runs later in the task and
    tolerates a missing row, but the compare-and-set needs a row to update), then
    atomically transitions ``verdict`` NULL -> ``WAITING_EVENT_COOLDOWN``. Only the
    first close/merge delivery wins, so exactly one cooldown task is scheduled;
    redeliveries — and a reopen-then-reclose while the window is still open — find
    the row already claimed and no-op. Returns True if this call won the claim.
    """
    PullRequestMetrics.objects.get_or_create(pull_request=pr)
    claimed = PullRequestMetrics.objects.filter(pull_request=pr, verdict__isnull=True).update(
        verdict=PullRequestVerdict.WAITING_EVENT_COOLDOWN
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
    """Schedule deferred emission on a terminal (close/merge) PR webhook.

    GitHub's single ``closed`` action covers both merges and plain closes. Rather
    than emitting inline, this claims a cooldown on the metrics row and schedules
    ``emit_pr_metrics_cooldown_task`` ``pr_metrics.emit_cooldown_seconds`` out, so
    late attribution and activity can settle before the verdict is chosen and the
    row emitted (see ``run_deferred_emission``). All non-terminal actions are
    ignored.

    Untracked PRs (no valid attribution) are dropped first, before the cooldown is
    claimed: claiming would burn the redelivery guard, so a PR that gained
    attribution only later could never emit. The cooldown claim is the redelivery
    guard — only the first delivery schedules a task; redeliveries no-op.
    """
    if event.get("action") != "closed":
        return

    if not features.has("organizations:pr-metrics-emit", organization):
        return

    pr = _get_pull_request(
        organization,
        repo,
        event.get("pull_request"),
        kwargs.get("github_delivery_id"),
        github_event=github_event,
    )
    if pr is None:
        return

    if not is_pr_tracked(pr):
        metrics.incr("pr_metrics.emit.skipped", tags={"reason": "untracked"})
        return

    if not _claim_cooldown(pr):
        metrics.incr("pr_metrics.cooldown.skipped", tags={"reason": "already_claimed"})
        return

    log_extra = {
        "organization_id": organization.id,
        "repository_id": pr.repository_id,
        "pull_request_id": pr.id,
    }
    try:
        emit_pr_metrics_cooldown_task.apply_async(
            kwargs={
                "pull_request_id": pr.id,
                "organization_id": organization.id,
                "repository_id": pr.repository_id,
            },
            countdown=options.get("pr_metrics.emit_cooldown_seconds"),
        )
    except Exception:
        # The claim committed but the enqueue didn't, so no task will settle this PR.
        # Release the cooldown sentinel (only if it's still ours) so a redelivery can
        # reschedule rather than the PR sticking in WAITING_EVENT_COOLDOWN.
        PullRequestMetrics.objects.filter(
            pull_request=pr, verdict=PullRequestVerdict.WAITING_EVENT_COOLDOWN
        ).update(verdict=None)
        metrics.incr("pr_metrics.cooldown.enqueue_failed")
        logger.exception("pr_metrics.cooldown.enqueue_failed", extra=log_extra)
        return

    metrics.incr("pr_metrics.cooldown.scheduled")


def run_deferred_emission(pull_request: PullRequest, organization: Organization) -> None:
    """Settle and emit a PR's terminal metrics row after the cooldown window.

    Runs from ``emit_pr_metrics_cooldown_task`` ``pr_metrics.emit_cooldown_seconds``
    after the close/merge webhook claimed ``WAITING_EVENT_COOLDOWN``. By now late
    attribution and activity have settled, so verdict selection and emission read
    final state.

    Reopen handling: if the PR is no longer terminal (reopened during the window),
    release the sentinel and stop — a later re-close reschedules. Otherwise release
    the cooldown claim back to NULL and run the standard verdict -> emit/forward
    path, whose own NULL-based guards settle the row exactly once (a late redelivery
    that races the brief NULL window still emits once: whichever of the two claims
    the verdict wins, the other no-ops).
    """
    log_extra = {
        "organization_id": organization.id,
        "repository_id": pull_request.repository_id,
        "pull_request_id": pull_request.id,
    }

    # Release our cooldown claim so the deterministic/judge guards below — which
    # compare-and-set against a NULL verdict — can settle the row.
    PullRequestMetrics.objects.filter(
        pull_request=pull_request, verdict=PullRequestVerdict.WAITING_EVENT_COOLDOWN
    ).update(verdict=None)

    if pull_request.closed_at is None or pull_request.head_commit_sha is None:
        # Reopened (or no longer terminal) while waiting. Release the sentinel so a
        # later re-close can re-claim and reschedule.
        metrics.incr("pr_metrics.cooldown.skipped", tags={"reason": "reopened"})
        logger.info("pr_metrics.cooldown.reopened", extra=log_extra)
        return

    verdict = select_verdict(pull_request, organization)
    if verdict is None:
        _forward_to_judge(pull_request, organization)
        return

    if not _claim_terminal_event(pull_request, verdict):
        metrics.incr("pr_metrics.emit.skipped", tags={"reason": "redelivery"})
        return

    # Claim before emit so build_pr_metrics_row reads the verdict back onto the row.
    # analytics.record is best-effort, async-batched telemetry; if it raises the
    # claim still stands and the row is forgone — an acceptable loss for telemetry,
    # not worth a rollback that would reopen the redelivery race.
    emit_pr_metrics_row(pull_request=pull_request)
    metrics.incr("pr_metrics.cooldown.emitted")


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
    reflects the final counts. Gated by the emit flag, the sole consumer; it
    writes only the webhook-sourced counters, leaving the other columns to their
    own producers.
    """
    pull_request = event.get("pull_request")
    if not pull_request:
        return

    if not features.has("organizations:pr-metrics-emit", organization):
        return

    pr = _get_pull_request(
        organization,
        repo,
        pull_request,
        kwargs.get("github_delivery_id"),
        github_event=github_event,
    )
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

    pr = _get_pull_request(
        organization,
        repo,
        pull_request_data,
        kwargs.get("github_delivery_id"),
        github_event=github_event,
    )
    if pr is None:
        return

    if not is_activity_tracking_enabled(organization, pr):
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
    if action != "created":
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
        github_event=github_event,
    )
    if pr is None:
        return

    if not is_activity_tracking_enabled(organization, pr):
        return

    sender = event.get("sender") or {}
    comment = event.get("comment") or {}

    payload_obj = CommentCreatedPayload(
        sender_login=sender.get("login", ""),
        sender_type=sender.get("type", ""),
        author_association=comment.get("author_association", "NONE"),
    )

    if not webhook_id:
        return

    _write_activity_row(
        pr, webhook_id, PullRequestActivityType.COMMENT_CREATED, asdict(payload_obj)
    )


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
        organization,
        repo,
        event.get("pull_request"),
        kwargs.get("github_delivery_id"),
        github_event=github_event,
    )
    if pr is None:
        return

    if not is_activity_tracking_enabled(organization, pr):
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
    if action != "created":
        return

    if not is_activity_tracking_enabled(organization):
        return

    pr = _get_pull_request(
        organization,
        repo,
        event.get("pull_request"),
        kwargs.get("github_delivery_id"),
        github_event=github_event,
    )
    if pr is None:
        return

    if not is_activity_tracking_enabled(organization, pr):
        return

    comment = event.get("comment") or {}
    sender = event.get("sender") or {}

    payload_obj = CommentCreatedPayload(
        sender_login=sender.get("login", ""),
        sender_type=sender.get("type", ""),
        author_association=comment.get("author_association", "NONE"),
        is_review=True,
        review_id=comment.get("pull_request_review_id"),
    )

    webhook_id: str | None = kwargs.get("github_delivery_id")
    if not webhook_id:
        return
    _write_activity_row(
        pr, webhook_id, PullRequestActivityType.COMMENT_CREATED, asdict(payload_obj)
    )


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
        organization,
        repo,
        event.get("pull_request"),
        kwargs.get("github_delivery_id"),
        github_event=github_event,
    )
    if pr is None:
        return

    if not is_activity_tracking_enabled(organization, pr):
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
    ignored. One activity row is written per referenced PR that belongs to this
    repo (``pull_requests`` can also carry other repos' PRs — see
    ``_prs_from_check_payload``).
    """
    if event.get("action") != "completed":
        return

    if not is_activity_tracking_enabled(organization):
        return

    webhook_id: str | None = kwargs.get("github_delivery_id")
    if not webhook_id:
        return

    check_suite = event.get("check_suite") or {}
    app = check_suite.get("app") or {}
    payload = asdict(
        CheckSuiteCompletedPayload(
            conclusion=check_suite.get("conclusion") or "",
            app_slug=app.get("slug", ""),
            check_runs_count=check_suite.get("latest_check_runs_count") or 0,
        )
    )

    for pr in _prs_from_check_payload(organization, repo, check_suite, webhook_id, github_event):
        if is_activity_tracking_enabled(organization, pr):
            _write_activity_row(
                pr, webhook_id, PullRequestActivityType.CHECK_SUITE_COMPLETED, payload
            )


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
    conclusion. ``check_run.pull_requests`` is resolved like ``check_suite`` —
    entries from other repos are filtered in ``_prs_from_check_payload``.
    """
    if event.get("action") != "completed":
        return

    if not is_activity_tracking_enabled(organization):
        return

    webhook_id: str | None = kwargs.get("github_delivery_id")
    if not webhook_id:
        return

    check_run = event.get("check_run") or {}
    app = check_run.get("app") or {}
    payload = asdict(
        CheckRunCompletedPayload(
            check_name=check_run.get("name", ""),
            conclusion=check_run.get("conclusion") or "",
            app_slug=app.get("slug", ""),
        )
    )

    for pr in _prs_from_check_payload(organization, repo, check_run, webhook_id, github_event):
        if is_activity_tracking_enabled(organization, pr):
            _write_activity_row(
                pr, webhook_id, PullRequestActivityType.CHECK_RUN_COMPLETED, payload
            )


def _prs_from_check_payload(
    organization: Organization,
    repo: Repository,
    container: Mapping[str, Any],
    webhook_id: str,
    github_event: GithubWebhookType,
) -> list[PullRequest]:
    """Resolve the tracked PRs a check_suite/check_run payload references.

    GitHub lists a PR on a check when they share ``head_sha`` + ``head_branch``,
    so ``pull_requests`` can include PRs that live in *other* repositories. The
    common case: a PR opened to merge this repo's default branch into another
    repo (e.g. a fork syncing from upstream) has its head in this repo, so it
    matches every default-branch check here — but the PR belongs to that other
    repo and its ``number`` is scoped to it. Each entry carries its own
    ``base.repo``, so an entry is only ours to resolve when its base repo is the
    one this webhook is for. Resolving a foreign entry's number against ``repo``
    would miss, or — on a number collision — attribute another repo's PR activity
    to ours, so it is skipped.

    Numbers are deduped before resolving each to its stored row; unknown PRs are
    dropped by ``_get_pull_request``.
    """
    seen: set[str] = set()
    prs: list[PullRequest] = []
    for ref in container.get("pull_requests") or ():
        number = ref.get("number")
        if number is None or str(number) in seen:
            continue
        # A PR's number is scoped to its own base repo; resolve it against
        # ``repo`` only when the PR lives here. Entries whose base is another repo
        # (a PR merging this repo's branch elsewhere) are not ours to record.
        base_repo_id = ((ref.get("base") or {}).get("repo") or {}).get("id")
        if base_repo_id is None or str(base_repo_id) != repo.external_id:
            metrics.incr("pr_metrics.check.foreign_pull_request")
            continue
        seen.add(str(number))
        # Check payloads carry no PR timestamp, only a number. A missing row is the
        # open→check race the stub exists for, so use ``now`` as the opened_at proxy
        # to clear the recency gate; the ``pull_request`` event overwrites it with
        # the true opened_at when it lands.
        pr = _resolve_or_stub_pull_request(
            organization,
            repo,
            pr_number=number,
            opened_at=timezone.now(),
            title=None,
            github_delivery_id=webhook_id,
            github_event=github_event,
        )
        if pr is not None:
            prs.append(pr)
    return prs


# A comment, review, or check webhook can be delivered before the ``pull_request``
# (opened) webhook that writes the PullRequest row — they are separate GitHub
# deliveries with no ordering guarantee. When the PR was opened within this
# window we treat a miss as that race and create a minimal stub the opened/sync
# event later enriches; an older miss predates our ingestion (no opened event
# will re-fire to fill the stub), so we skip it. Sized well above the observed
# seconds-to-minutes race to absorb webhook backlog. (Check payloads carry no PR
# timestamp, so that path passes ``now`` and always clears this window — see
# ``_prs_from_check_payload``.)
_PULL_REQUEST_STUB_MAX_AGE = timedelta(hours=1)


def _resolve_or_stub_pull_request(
    organization: Organization,
    repo: Repository,
    *,
    pr_number: int,
    opened_at: datetime | None,
    title: str | None,
    github_delivery_id: str | None,
    github_event: GithubWebhookType,
) -> PullRequest | None:
    """Return the PullRequest row, creating a minimal stub for a recent miss.

    pr_metrics piggybacks on rows written by ``PullRequestEventWebhook`` from
    ``pull_request`` events. Comment, review, and check events are separate
    deliveries that can arrive before that row exists. Rather than drop the
    activity, create a minimal stub the ``pull_request`` event enriches via its
    own ``update_or_create`` — but only for a PR opened recently, since an older
    miss predates ingestion and has no opened event coming to fill the stub.
    ``get_or_create`` is race-safe on the ``(repository_id, key)`` unique
    constraint.

    Callers whose payload carries no PR timestamp (the check_suite/check_run path,
    whose PR refs hold only a number) pass ``opened_at`` as ``timezone.now()``: a
    missing row on a check is the out-of-order race the stub exists for (CI fired
    before the ``opened`` delivery landed), and the ``opened`` event overwrites the
    proxy with the true ``opened_at`` when it lands.
    """
    key = str(pr_number)
    try:
        return PullRequest.objects.get(
            organization_id=organization.id, repository_id=repo.id, key=key
        )
    except PullRequest.DoesNotExist:
        pass

    log_extra = {
        "github_event": github_event,
        "organization_id": organization.id,
        "repository_id": repo.id,
        "repo_name": repo.name,
        "pr_number": pr_number,
        "github_delivery_id": github_delivery_id,
    }

    # Two distinct misses, kept apart so rollout dashboards can tell them by
    # `reason`: a payload that carried no parseable timestamp (`missing_opened_at`)
    # vs. a PR known to predate our ingestion window (`predates_ingestion`).
    # Neither can be stubbed — no `opened` event will arrive to enrich it — so both
    # skip; only the reason differs. (Expected, not errors.)
    if opened_at is None:
        reason = "missing_opened_at"
    elif opened_at < timezone.now() - _PULL_REQUEST_STUB_MAX_AGE:
        reason = "predates_ingestion"
    else:
        reason = None

    if reason is not None:
        metrics.incr("pr_metrics.pull_request.unresolved", tags={"reason": reason})
        logger.info("pr_metrics.pull_request.unresolved", extra={**log_extra, "reason": reason})
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
    *,
    github_event: GithubWebhookType,
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
        github_event=github_event,
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


def _write_author_attribution(
    pr: PullRequest,
    github_user: dict[str, Any],
    pr_url: str | None = None,
    group_ids: list[int] | None = None,
) -> None:
    user_id = github_user.get("id")
    if user_id is None:
        return
    signal_type = _detect_app_signal(user_id)
    if signal_type is None:
        return
    signal_details: SentryAppSignalDetails | None = None
    if pr_url:
        signal_details = SentryAppSignalDetails(
            pr_url=pr_url,
            group_ids=group_ids or [],
        )
    record_attribution_signal(
        pull_request=pr,
        signal_type=signal_type,
        source=PullRequestAttributionSource.WEBHOOK_DATA,
        signal_details=signal_details.dict() if signal_details is not None else None,
    )


def _record_delegated_candidate(provider: str, outcome: str) -> None:
    """Count where an opened PR lands in the delegated-agent attribution funnel.

    ``provider`` is the provider hint (or ``"unknown"`` when none could be
    derived); ``outcome`` is the terminal stage. Every stage that previously
    returned silently records here, so drop-offs before the Seer match request
    are visible instead of invisible.
    """
    metrics.incr(
        "pr_metrics.delegated_agent.candidate",
        tags={"provider": provider, "outcome": outcome},
    )


def _attribute_delegated_agent(
    pr: PullRequest,
    webhook_pull_request: Mapping[str, Any],
    repository: Repository,
    organization: Organization,
    github_user: Mapping[str, Any],
) -> None:
    """Route an opened PR toward the Seer delegated-agent match, recording where
    it drops off.

    The funnel is scoped to PRs plausibly opened by an agent — either a provider
    hint (branch prefix / bot login) or authorship by the Sentry/Seer app — so
    the counter isn't swamped by ordinary human PRs that legitimately carry no
    hint.
    """
    provider_hint = _is_delegated_agent_candidate(webhook_pull_request)

    if not provider_hint:
        # Claude opens PRs as the Sentry app with no distinct bot login, so the
        # ``claude/`` branch prefix is its only signal; a non-``claude/`` branch
        # leaves no hint and the PR never reaches the match. Surface that only
        # for app-authored PRs — the cohort that should have matched — since
        # human PRs with no hint are expected and would dominate the metric.
        user_id = github_user.get("id")
        if user_id is not None and _detect_app_signal(user_id) is not None:
            _record_delegated_candidate("unknown", "no_provider_hint")
        return

    if not org_has_coding_agent_for_provider(organization, provider_hint):
        _record_delegated_candidate(provider_hint, "no_org_integration")
        return

    _detect_delegated_agent(pr, webhook_pull_request, repository, provider_hint=provider_hint)


def _detect_delegated_agent(
    pr: PullRequest,
    webhook_pull_request: Mapping[str, Any],
    repository: Repository,
    provider_hint: str,
) -> None:
    """
    Filter PRs that could have been delegated by Autofix to external coding agents,
    and fire the matching request to Seer if it's a candidate.

    Then Seer calls the RPC "record_pr_attribution" to write the attribution row async.
    """
    group_ids = resolved_group_ids(pr)
    if not group_ids:
        _record_delegated_candidate(provider_hint, "no_group_ids")
        return

    repo_name_sections = repository.name.split("/")
    if len(repo_name_sections) < 2:
        logger.warning(
            "pr_metrics.delegated_agent.invalid_repo_name",
            extra={"pull_request_id": pr.id, "repo_name": repository.name},
        )
        _record_delegated_candidate(provider_hint, "bad_repo")
        return

    if not repository.provider or not repository.external_id:
        logger.warning(
            "pr_metrics.delegated_agent.missing_repo_metadata",
            extra={
                "pull_request_id": pr.id,
                "has_provider": bool(repository.provider),
                "has_external_id": bool(repository.external_id),
            },
        )
        _record_delegated_candidate(provider_hint, "bad_repo")
        return

    pr_url = webhook_pull_request.get("html_url") or ""
    head_branch = (webhook_pull_request.get("head") or {}).get("ref") or ""

    request_body = MatchDelegatedAgentPrRequest(
        organization_id=pr.organization_id,
        pull_request_id=pr.id,
        pr_url=pr_url,
        repo=SeerRepoDefinition(
            provider=repository.provider,
            owner=repo_name_sections[0],
            name="/".join(repo_name_sections[1:]),
            external_id=repository.external_id,
        ),
        head_branch=head_branch,
        provider=provider_hint,
        group_ids=group_ids,
    )

    _send_seer_delegated_agent_match(request_body, provider_hint, pr)


def _send_seer_delegated_agent_match(
    request_body: MatchDelegatedAgentPrRequest,
    provider_hint: str,
    pr: PullRequest,
) -> None:
    log_extra = {
        "pull_request_id": pr.id,
        "organization_id": pr.organization_id,
        "provider_hint": provider_hint,
    }
    try:
        response = make_match_coding_agent_pr_request(request_body, timeout=5)
    except Exception:
        logger.warning("pr_metrics.delegated_agent.seer_match.error", extra=log_extra)
        _record_delegated_candidate(provider_hint, "seer_error_exception")
        return

    if response.status >= 400:
        logger.warning(
            "pr_metrics.delegated_agent.seer_match.error",
            extra={**log_extra, "status_code": response.status},
        )
        _record_delegated_candidate(provider_hint, "seer_error_bad_status")
        return

    _record_delegated_candidate(provider_hint, "sent")


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
        # GitHub's single "closed" action forks on whether the PR merged; both
        # record the actor (the closer/merger) so emission can derive who closed.
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

    sender_kw: dict[str, Any] = dict(
        sender_login=sender.get("login", ""),
        sender_type=sender.get("type", ""),
    )

    match action:
        case "opened":
            return asdict(
                OpenedPayload(
                    **sender_kw,
                    head_sha=head.get("sha"),
                    base_sha=base.get("sha"),
                    additions=pull_request.get("additions", 0),
                    deletions=pull_request.get("deletions", 0),
                    changed_files=pull_request.get("changed_files", 0),
                    commits=pull_request.get("commits", 0),
                )
            )
        case "synchronize":
            return asdict(
                SynchronizePayload(
                    **sender_kw,
                    before_sha=event.get("before"),
                    after_sha=event.get("after"),
                )
            )
        case "closed":
            if pull_request.get("merged"):
                return asdict(MergedPayload(**sender_kw))
            return asdict(ClosedPayload(**sender_kw))
        case "labeled":
            label = event.get("label") or {}
            return asdict(LabeledPayload(**sender_kw, label_name=(label.get("name") or "")))
        case "unlabeled":
            label = event.get("label") or {}
            return asdict(UnlabeledPayload(**sender_kw, label_name=(label.get("name") or "")))
        case "review_requested":
            return asdict(
                ReviewRequestedPayload(
                    **sender_kw, is_team_review=event.get("requested_team") is not None
                )
            )
        case "review_request_removed":
            return asdict(
                ReviewRequestRemovedPayload(
                    **sender_kw, is_team_review=event.get("requested_team") is not None
                )
            )
        case "assigned":
            assignee = event.get("assignee") or {}
            return asdict(AssignedPayload(**sender_kw, assignee_login=assignee.get("login", "")))
        case "unassigned":
            assignee = event.get("assignee") or {}
            return asdict(UnassignedPayload(**sender_kw, assignee_login=assignee.get("login", "")))
        case "converted_to_draft":
            return asdict(ConvertedToDraftPayload(**sender_kw))
        case "ready_for_review":
            return asdict(ReadyForReviewPayload(**sender_kw))
        case "auto_merge_enabled":
            auto_merge = pull_request.get("auto_merge") or {}
            return asdict(
                AutoMergeEnabledPayload(merge_method=auto_merge.get("merge_method") or "")
            )
        case "auto_merge_disabled":
            return asdict(AutoMergeDisabledPayload())
        case "enqueued":
            return asdict(EnqueuedPayload())
        case "dequeued":
            return asdict(DequeuedPayload(reason=event.get("reason") or ""))
        case _:
            raise ValueError(f"No payload builder for action {action!r}")
