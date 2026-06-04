"""PR-metrics emission: on a tracked PR's close/merge, emit one analytics row.

The row goes to Sentry's analytics pipeline (which lands in BigQuery in
production). A PR is "tracked" once it has at least one valid
``PullRequestAttribution`` row; untracked PRs are not emitted.
"""

from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import Any

from sentry import analytics
from sentry.analytics.events.pr_metrics_events import PrCloseMetricsEvent
from sentry.models.pullrequest import PullRequest, PullRequestAttribution
from sentry.pr_metrics.attribution import SIGNAL_TYPE_CONFIDENCE
from sentry.utils import json, metrics

logger = logging.getLogger(__name__)

# GitHub fires a single ``closed`` action for both outcomes; the ``merged`` flag
# on the payload disambiguates.
CLOSE_ACTION_CLOSED = "closed"
CLOSE_ACTION_MERGED = "merged"


def needs_judge(pull_request: PullRequest) -> bool:
    """Whether this PR's terminal event must round-trip to Seer for a judge.

    Currently always ``False``: the judge path isn't wired yet, so every tracked
    close/merge is emitted immediately with no verdict. Once judges exist this
    gates the forward-to-Seer path that emits a judge-enriched row on the result.
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
    close_action: str,
    payload: Mapping[str, Any],
) -> PrCloseMetricsEvent:
    """Assemble the provisional close/merge row from stored + payload data.

    ``payload`` is the GitHub ``pull_request`` object from the webhook; we read
    lifecycle facts from it directly rather than from the ``PullRequest`` row,
    which isn't updated with close/merge state on this path.
    """
    head_commit_sha = (payload.get("head") or {}).get("sha")
    merge_commit_sha = payload.get("merge_commit_sha") if payload.get("merged") else None

    return PrCloseMetricsEvent(
        organization_id=pull_request.organization_id,
        repository_id=pull_request.repository_id,
        pull_request_id=pull_request.id,
        pr_key=pull_request.key,
        close_action=close_action,
        verdict=None,
        head_commit_sha=head_commit_sha,
        merge_commit_sha=merge_commit_sha,
        opened_at=payload.get("created_at"),
        closed_at=payload.get("closed_at"),
        merged_at=payload.get("merged_at"),
        draft=bool(payload.get("draft")),
        # GitHub includes these aggregate counts on the PR object in the
        # close/merge payload, so we get size/activity for free without an SCM
        # fetch. Default to 0 when a provider omits a field.
        additions=payload.get("additions") or 0,
        deletions=payload.get("deletions") or 0,
        files_changed=payload.get("changed_files") or 0,
        commits_count=payload.get("commits") or 0,
        comments_count=payload.get("comments") or 0,
        review_comments_count=payload.get("review_comments") or 0,
        is_assigned=bool(payload.get("assignees") or payload.get("assignee")),
        attributions=json.dumps(_active_attributions(pull_request)),
    )


def emit_pr_metrics_row(
    *,
    pull_request: PullRequest,
    close_action: str,
    payload: Mapping[str, Any],
) -> bool:
    """Emit one BigQuery row for a tracked PR's terminal event.

    The tracking gate is the existence of ≥1 valid ``PullRequestAttribution`` row.
    Untracked PRs are skipped — we don't pay to record PRs that no Sentry feature
    can be attributed to. Returns whether a row was emitted, for callers/tests.

    This is the seam the judge path can also call once it has the canonical
    ``PullRequest`` and the close action.
    """
    is_tracked = PullRequestAttribution.objects.filter(
        pull_request=pull_request, is_valid=True
    ).exists()
    if not is_tracked:
        metrics.incr("pr_metrics.emit.skipped", tags={"reason": "untracked"})
        return False

    row = build_pr_metrics_row(
        pull_request=pull_request, close_action=close_action, payload=payload
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
