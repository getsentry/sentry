"""PR-metrics emission: on a tracked PR's close/merge, emit one analytics row.

The row goes to Sentry's analytics pipeline (which lands in BigQuery in
production). A PR is "tracked" once it has at least one valid
``PullRequestAttribution`` row; untracked PRs are not emitted.
"""

from __future__ import annotations

import logging
from collections.abc import Mapping
from datetime import datetime
from typing import Any, Final, Literal

from sentry import analytics
from sentry.analytics.events.pr_metrics_events import PrCloseMetricsEvent
from sentry.models.pullrequest import PullRequest, PullRequestAttribution
from sentry.pr_metrics.attribution import SIGNAL_TYPE_CONFIDENCE
from sentry.utils import json, metrics

logger = logging.getLogger(__name__)

# GitHub fires a single ``closed`` action for both outcomes; the ``merged`` flag
# on the payload disambiguates.
CLOSE_ACTION_CLOSED: Final = "closed"
CLOSE_ACTION_MERGED: Final = "merged"

CloseAction = Literal["closed", "merged"]


def _iso(value: datetime | None) -> str | None:
    """Serialize a persisted datetime to an ISO-8601 string for the row, or None."""
    return value.isoformat() if value is not None else None


def needs_judge(pull_request: PullRequest) -> bool:
    """Whether this PR's terminal event must round-trip to Seer for a judge.

    Currently always ``False``: the judge path isn't wired yet, so every tracked
    close/merge is emitted immediately. Once judges exist this gates the
    forward-to-Seer path that emits a judge-enriched row on the result.
    """
    return False


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


def build_pr_metrics_row(
    *,
    pull_request: PullRequest,
    close_action: CloseAction,
    payload: Mapping[str, Any],
    attributions: list[dict[str, Any]],
) -> PrCloseMetricsEvent:
    """Assemble the provisional close/merge row.

    Lifecycle facts are read from the ``PullRequest`` row (the webhook keeps it
    current; it's also the only source on the judge path, which has no payload).
    ``payload`` supplies the fields with no persisted column — ``opened_at`` and
    the activity counters. ``attributions`` is the active-attribution snapshot,
    passed in so the tracking gate and the emitted row read the same query.
    """
    head_commit_sha = pull_request.head_commit_sha
    closed_at = pull_request.closed_at
    if head_commit_sha is None or closed_at is None:
        # The webhook always persists both on a close/merge; a null here means
        # emit ran on a PR that never reached a terminal state. Fail loud.
        raise ValueError("PR metrics row requires a persisted head_commit_sha and closed_at")

    return PrCloseMetricsEvent(
        organization_id=pull_request.organization_id,
        repository_id=pull_request.repository_id,
        pull_request_id=pull_request.id,
        pr_key=pull_request.key,
        close_action=close_action,
        head_commit_sha=head_commit_sha,
        closed_at=closed_at.isoformat(),
        merge_commit_sha=pull_request.merge_commit_sha,
        merged_at=_iso(pull_request.merged_at),
        opened_at=payload["created_at"],
        draft=bool(payload.get("draft")),
        additions=payload.get("additions") or 0,
        deletions=payload.get("deletions") or 0,
        files_changed=payload.get("changed_files") or 0,
        commits_count=payload.get("commits") or 0,
        comments_count=payload.get("comments") or 0,
        review_comments_count=payload.get("review_comments") or 0,
        is_assigned=bool(payload.get("assignees") or payload.get("assignee")),
        attributions=json.dumps(attributions),
    )


def emit_pr_metrics_row(
    *,
    pull_request: PullRequest,
    close_action: CloseAction,
    payload: Mapping[str, Any],
) -> bool:
    """Emit one BigQuery row for a tracked PR's terminal event.

    The tracking gate is ≥1 valid ``PullRequestAttribution`` row. Untracked PRs
    are skipped — we don't pay to record PRs that no Sentry feature can be
    attributed to. Returns whether a row was emitted, for callers/tests.

    This is the seam the judge path can also call once it has the canonical
    ``PullRequest`` and the close action.
    """
    # Fetch the attribution snapshot once: it both gates emission (≥1 valid row)
    # and rides along on the emitted row, so the two can't diverge.
    attributions = _active_attributions(pull_request)
    if not attributions:
        metrics.incr("pr_metrics.emit.skipped", tags={"reason": "untracked"})
        return False

    row = build_pr_metrics_row(
        pull_request=pull_request,
        close_action=close_action,
        payload=payload,
        attributions=attributions,
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
