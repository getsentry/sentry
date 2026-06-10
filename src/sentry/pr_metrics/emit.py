"""PR-metrics emission: on a tracked PR's close/merge, emit one analytics row.

The row goes to Sentry's analytics pipeline (which lands in BigQuery in
production). A PR is "tracked" once it has at least one valid
``PullRequestAttribution`` row; untracked PRs are not emitted.
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any, Final, Literal

from sentry import analytics
from sentry.analytics.events.pr_metrics_events import PrCloseMetricsEvent
from sentry.models.grouplink import GroupLink
from sentry.models.pullrequest import (
    PullRequest,
    PullRequestActivity,
    PullRequestActivityType,
    PullRequestAttribution,
    PullRequestMetrics,
    PullRequestVerdict,
)
from sentry.pr_metrics.attribution import SIGNAL_TYPE_CONFIDENCE
from sentry.utils import json, metrics

logger = logging.getLogger(__name__)

# GitHub fires a single ``closed`` action for both outcomes; a set ``merged_at``
# on the PR row disambiguates a merge from a plain close.
CLOSE_ACTION_CLOSED: Final = "closed"
CLOSE_ACTION_MERGED: Final = "merged"

CloseAction = Literal["closed", "merged"]


def _iso(value: datetime | None) -> str | None:
    """Serialize a persisted datetime to an ISO-8601 string for the row, or None."""
    return value.isoformat() if value is not None else None


def select_verdict(pull_request: PullRequest) -> PullRequestVerdict | None:
    """The terminal verdict Sentry can decide on its own, or ``None`` for a judge.

    A judge is needed exactly when the outcome can't be settled deterministically
    from data Sentry already holds — so ``None`` is the "needs a judge" signal, and
    the caller forwards to Seer (the judge path) rather than emitting:

    - Merged with no commits after it opened → ``merged_unchanged``: the merge head
      is the opened head, so nothing changed, by anyone. A merge with later commits
      is ambiguous (Seer's own iteration vs. external changes) and needs the
      diff-similarity judge.
    - Closed with no engagement — no later commits, comments, or review comments →
      ``closed_unmerged``: an abandoned PR with nothing to analyze. A close with any
      engagement needs the comment judge to decide why it was closed.

    The commits-after-open signal is the presence of a ``SYNCHRONIZED`` activity
    row; the webhook logs one per push to the PR branch after it opened.
    """
    has_commits_after_open = PullRequestActivity.objects.filter(
        pull_request=pull_request, event_type=PullRequestActivityType.SYNCHRONIZED
    ).exists()

    if pull_request.merged_at is not None:
        return PullRequestVerdict.MERGED_UNCHANGED if not has_commits_after_open else None

    metrics_row = PullRequestMetrics.objects.filter(pull_request=pull_request).first()
    if metrics_row is None:
        # The metrics row holds the comment counters. handle_metrics persists it
        # before emission, so a miss means it didn't run for this event — we can't
        # confirm "no engagement", so defer to a judge rather than guess abandoned.
        return None
    has_discussion = bool(metrics_row.comments_count or metrics_row.review_comments_count)
    if has_commits_after_open or has_discussion:
        return None
    return PullRequestVerdict.CLOSED_UNMERGED


def _active_attributions(pull_request: PullRequest) -> list[dict[str, Any]]:
    """The PR's valid attribution signals, highest-confidence first.

    Each entry carries the ``signal_type``, ``source``, and ``signal_details`` so
    the consumer sees the full picture, ordered by attribution priority so the
    primary attribution leads. Ties break on ``signal_type`` then ``source`` for
    a deterministic order.
    """
    attributions = PullRequestAttribution.objects.filter(pull_request=pull_request, is_valid=True)
    ordered = sorted(
        attributions,
        key=lambda a: (-SIGNAL_TYPE_CONFIDENCE.get(a.signal_type, -1), a.signal_type, a.source),
    )
    return [
        {"signal_type": a.signal_type, "source": a.source, "signal_details": a.signal_details}
        for a in ordered
    ]


def _resolved_group_ids(pull_request: PullRequest) -> list[int]:
    """Group IDs this PR resolves, from the resolving GroupLink rows.

    Sorted for a deterministic row; empty when the PR resolves no issues.
    """
    return sorted(
        GroupLink.objects.filter(
            linked_type=GroupLink.LinkedType.pull_request,
            relationship=GroupLink.Relationship.resolves,
            linked_id=pull_request.id,
        ).values_list("group_id", flat=True)
    )


def build_pr_metrics_row(
    *,
    pull_request: PullRequest,
    close_action: CloseAction,
    attributions: list[dict[str, Any]],
    group_ids: list[int],
) -> PrCloseMetricsEvent:
    """Assemble the close/merge analytics row.

    Every fact is read from the stored ``PullRequest`` / ``PullRequestMetrics``
    rows, so the judge path (Seer RPC callback, which has no webhook payload) can
    reuse this. ``attributions`` is passed in so the tracking gate and the
    emitted row read the same query. A missing metrics row (a PR Sentry never saw
    active) coalesces every counter to its default.
    """
    head_commit_sha = pull_request.head_commit_sha
    closed_at = pull_request.closed_at
    if head_commit_sha is None or closed_at is None:
        # The webhook always persists both on a close/merge; a null here means
        # emit ran on a PR that never reached a terminal state. Fail loud.
        raise ValueError("PR metrics row requires a persisted head_commit_sha and closed_at")

    # A bare instance carries the model's zero/false field defaults, so a PR with
    # no stored metrics row emits zeroed counters rather than erroring.
    metrics = (
        PullRequestMetrics.objects.filter(pull_request=pull_request).first() or PullRequestMetrics()
    )

    return PrCloseMetricsEvent(
        organization_id=pull_request.organization_id,
        repository_id=pull_request.repository_id,
        pull_request_id=pull_request.id,
        pr_key=pull_request.key,
        group_ids=group_ids,
        close_action=close_action,
        head_commit_sha=head_commit_sha,
        closed_at=closed_at.isoformat(),
        merge_commit_sha=pull_request.merge_commit_sha,
        merged_at=_iso(pull_request.merged_at),
        opened_at=_iso(pull_request.opened_at),
        draft=bool(pull_request.draft),
        additions=metrics.additions,
        deletions=metrics.deletions,
        files_changed=metrics.files_changed,
        commits_count=metrics.commits_count,
        comments_count=metrics.comments_count,
        review_comments_count=metrics.review_comments_count,
        is_assigned=metrics.is_assigned,
        attributions=json.dumps(attributions),
        verdict=metrics.verdict,
    )


def emit_pr_metrics_row(
    *,
    pull_request: PullRequest,
) -> bool:
    """Emit one BigQuery row for a tracked PR's terminal event.

    The tracking gate is ≥1 valid ``PullRequestAttribution`` row. Untracked PRs
    are skipped — we don't pay to record PRs that no Sentry feature can be
    attributed to. Returns whether a row was emitted, for callers/tests.

    Takes only the canonical ``PullRequest`` — no webhook payload — so Seer's
    judge can call it directly via RPC callback.
    """
    # Fetch the attribution snapshot once: it both gates emission (≥1 valid row)
    # and rides along on the emitted row, so the two can't diverge.
    attributions = _active_attributions(pull_request)
    if not attributions:
        metrics.incr("pr_metrics.emit.skipped", tags={"reason": "untracked"})
        return False

    close_action: CloseAction = (
        CLOSE_ACTION_MERGED if pull_request.merged_at is not None else CLOSE_ACTION_CLOSED
    )
    row = build_pr_metrics_row(
        pull_request=pull_request,
        close_action=close_action,
        attributions=attributions,
        group_ids=_resolved_group_ids(pull_request),
    )
    analytics.record(row)
    metrics.incr("pr_metrics.emit.recorded", tags={"close_action": close_action})
    logger.info(
        "pr_metrics.emit.recorded",
        extra={
            "organization_id": pull_request.organization_id,
            "repository_id": pull_request.repository_id,
            "pull_request_id": pull_request.id,
            "close_action": close_action,
        },
    )
    return True
