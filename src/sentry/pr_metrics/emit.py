"""PR-metrics emission: on a tracked PR's close/merge, emit one analytics row.

The row goes to Sentry's analytics pipeline (which lands in BigQuery in
production). A PR is "tracked" once it has at least one valid
``PullRequestAttribution`` row; untracked PRs are not emitted.
"""

from __future__ import annotations

import logging
from collections.abc import Sequence
from enum import Enum
from typing import Any

from sentry import analytics
from sentry.analytics.events.pr_metrics_events import PrCloseMetricsEvent
from sentry.models.commit import Commit
from sentry.models.organization import Organization
from sentry.models.pullrequest import (
    PullRequest,
    PullRequestActivity,
    PullRequestActivityType,
    PullRequestAttribution,
    PullRequestMetrics,
    PullRequestVerdict,
)
from sentry.pr_metrics.attribution import SIGNAL_TYPE_CONFIDENCE
from sentry.pr_metrics.contracts import (
    CLOSE_ACTION_CLOSED,
    CLOSE_ACTION_MERGED,
    CloseAction,
    PrConversationAnalysis,
)
from sentry.pr_metrics.utils import is_activity_tracking_enabled, iso_or_none, resolved_group_ids
from sentry.seer.models.run import SeerRun
from sentry.utils import json, metrics

logger = logging.getLogger(__name__)


class VerdictDeferral(Enum):
    """Why ``select_verdict`` couldn't settle a terminal verdict on its own.

    Both are a "needs a judge" signal to ``select_verdict``'s only caller, but
    they aren't interchangeable for ``select_fallback_verdict``, which settles
    judge-*ineligible* PRs (e.g. MCP) without ever reaching Seer:

    - ``NEEDS_JUDGE``: real activity/engagement data says the outcome is
      genuinely ambiguous (commits after open, or discussion on a close).
      Reliable enough to hand to ``select_fallback_verdict`` directly.
    - ``INDETERMINATE``: there's no reliable signal to decide from at all —
      activity tracking is off, or the metrics row is missing — so the data's
      *absence* can't be read as "nothing happened". Judge-eligible PRs still
      forward regardless (Seer fetches the diff itself); judge-ineligible PRs
      have no judge to fall back on and stay unemitted, same as before
      ``select_fallback_verdict`` existed.
    """

    NEEDS_JUDGE = "needs_judge"
    INDETERMINATE = "indeterminate"


def select_verdict(
    pull_request: PullRequest, organization: Organization
) -> PullRequestVerdict | VerdictDeferral:
    """The terminal verdict Sentry can decide on its own, or a ``VerdictDeferral``.

    A judge is needed whenever the outcome can't be settled deterministically from
    data Sentry already holds — so the caller forwards to Seer (the judge path)
    rather than emitting on either ``VerdictDeferral`` outcome:

    - Merged with no commits after it opened → ``merged_unchanged``: the merge head
      is the opened head, so nothing changed, by anyone. A merge with later commits
      is ambiguous (Seer's own iteration vs. external changes) and needs the
      diff-similarity judge → ``NEEDS_JUDGE``.
    - Closed with no engagement — no later commits, comments, or review comments →
      ``closed_unmerged``: an abandoned PR with nothing to analyze. A close with any
      engagement needs the conversation judge to decide why it was closed →
      ``NEEDS_JUDGE``.

    The commits-after-open signal is a ``SYNCHRONIZED`` activity row, one per push
    to the PR branch after it opened. Those rows are only written under
    ``pr-metrics-activity``, which is flagged independently of emission; without it
    a clean merge is indistinguishable from one with later commits, so we defer
    every outcome (``INDETERMINATE``) rather than read its absence as "no later
    commits". A missing ``PullRequestMetrics`` row is an error state —
    ``handle_metrics`` persists it before emission under the same flag, so its
    absence means it failed — and we defer (``INDETERMINATE``) for both outcomes
    rather than emit zeroed counters (merge) or guess abandoned (close).
    """
    if not is_activity_tracking_enabled(organization):
        metrics.incr("pr_metrics.select_verdict.activity_disabled")
        return VerdictDeferral.INDETERMINATE

    metrics_row = PullRequestMetrics.objects.filter(pull_request=pull_request).first()
    if metrics_row is None:
        logger.warning(
            "pr_metrics.select_verdict.metrics_row_missing",
            extra={
                "organization_id": pull_request.organization_id,
                "repository_id": pull_request.repository_id,
                "pull_request_id": pull_request.id,
            },
        )
        metrics.incr("pr_metrics.select_verdict.metrics_row_missing")
        return VerdictDeferral.INDETERMINATE

    has_commits_after_open = PullRequestActivity.objects.filter(
        pull_request=pull_request, event_type=PullRequestActivityType.SYNCHRONIZED
    ).exists()

    if pull_request.merged_at is not None:
        return (
            PullRequestVerdict.MERGED_UNCHANGED
            if not has_commits_after_open
            else VerdictDeferral.NEEDS_JUDGE
        )

    has_discussion = bool(metrics_row.comments_count or metrics_row.review_comments_count)
    if has_commits_after_open or has_discussion:
        return VerdictDeferral.NEEDS_JUDGE
    return PullRequestVerdict.CLOSED_UNMERGED


def select_fallback_verdict(pull_request: PullRequest) -> PullRequestVerdict:
    """The verdict for a ``NEEDS_JUDGE`` PR whose attribution isn't judge-eligible.

    Only valid to call on a ``VerdictDeferral.NEEDS_JUDGE`` outcome — the caller
    must not call this for ``INDETERMINATE``, since there ``select_verdict`` has no
    reliable activity/engagement data to have deferred on, and this function would
    otherwise silently re-derive "no commits after open" from the same absent data
    and mislabel an actually-iterated PR as unchanged.

    Weak attribution (e.g. MCP) never reaches Seer — see
    ``JUDGE_ELIGIBLE_SIGNAL_TYPES`` — so without this fallback a ``NEEDS_JUDGE`` row
    would sit at ``verdict=None`` forever and never emit. Decided directly from
    push activity rather than the judge's conversation/diff analysis:

    - Merged with commits after open → ``MERGED_WITH_ITERATION``, reusing the
      judge's verdict label even though no judge looked at the diff here — weak
      attribution's iteration signal is push activity alone, same outcome bucket.
    - Merged with no commits after open → ``MERGED_UNCHANGED``, same as the
      deterministic case in ``select_verdict``.
    - Closed unmerged → ``CLOSED_UNMERGED`` unconditionally; there's no
      judge-eligible equivalent of the conversation judge for weak attribution, so
      engagement isn't distinguished here.
    """
    if pull_request.merged_at is not None:
        has_commits_after_open = PullRequestActivity.objects.filter(
            pull_request=pull_request, event_type=PullRequestActivityType.SYNCHRONIZED
        ).exists()
        return (
            PullRequestVerdict.MERGED_WITH_ITERATION
            if has_commits_after_open
            else PullRequestVerdict.MERGED_UNCHANGED
        )
    return PullRequestVerdict.CLOSED_UNMERGED


# Diagnosis label Sentry can derive on its own (unlike the judge's free-string
# vocabulary): the deterministic closed-unmerged path's "why", read straight off
# the PR's own check-suite activity rather than a judge's opinion.
CI_FAILING_AT_CLOSE = "ci_failing_at_close"

# Conclusions that unambiguously mean the check errored out, as opposed to
# cancelled/skipped/stale (never ran to completion, not a failure verdict),
# neutral (a soft pass), or action_required (blocked on approval, not broken).
_FAILING_CHECK_CONCLUSIONS = frozenset({"failure", "timed_out", "startup_failure"})


def ci_failing_at_close(pull_request: PullRequest) -> bool:
    """Whether any CI provider's check suite was failing when the PR closed.

    Reads ``CHECK_SUITE_COMPLETED`` activity rows — the aggregate "was CI green
    or red" signal per provider app (``app_slug``), per ``CheckSuiteCompletedPayload``
    — keeping only the latest completion per app: a check suite can be rerun with
    no new push (no ``SYNCHRONIZED`` row), so an earlier failure superseded by a
    passing rerun shouldn't count.

    Only meaningful for ``select_verdict``'s deterministic ``CLOSED_UNMERGED``
    outcome: that path is reached only when there were no commits after open, so
    every recorded check row necessarily belongs to the PR's one and only head
    commit — there's no other commit's CI status to accidentally mix in.
    """
    rows = (
        PullRequestActivity.objects.filter(
            pull_request=pull_request, event_type=PullRequestActivityType.CHECK_SUITE_COMPLETED
        )
        .order_by("date_added", "id")
        .values_list("payload__app_slug", "payload__conclusion")
    )
    # dict() keeps the last entry per key, i.e. each app's latest conclusion.
    latest_conclusion_by_app: dict[str, str] = dict(rows)
    return any(
        conclusion in _FAILING_CHECK_CONCLUSIONS for conclusion in latest_conclusion_by_app.values()
    )


def calculate_deterministic_diagnosis_labels(
    pull_request: PullRequest, verdict: PullRequestVerdict | None
) -> list[str] | None:
    """The diagnosis labels Sentry can derive on its own from a settled verdict.

    Shared by every caller that settles a verdict without a judge (the cooldown
    task's deterministic path, and the judge-reap reconciliation), so a label
    added here reaches all of them rather than being re-derived ad hoc per
    caller. Currently just ``CI_FAILING_AT_CLOSE``, but the shape (verdict in,
    labels out) is meant to grow more deterministic labels over time.
    """
    labels = []
    if verdict == PullRequestVerdict.CLOSED_UNMERGED and ci_failing_at_close(pull_request):
        labels.append(CI_FAILING_AT_CLOSE)
    return labels or None


def is_pr_tracked(pull_request: PullRequest) -> bool:
    """Whether the PR has ≥1 valid attribution — the emission tracking gate.

    Mirrors the gate ``emit_pr_metrics_row`` applies, as a cheap existence check
    so a caller can verify tracking before an irreversible step (claiming a
    verdict) it would otherwise take for a PR that can never emit.
    """
    return PullRequestAttribution.objects.filter(pull_request=pull_request, is_valid=True).exists()


def active_attributions(pull_request: PullRequest) -> list[dict[str, Any]]:
    """The PR's valid attribution signals, highest-confidence first.

    Each entry carries the ``signal_type``, ``source``, and ``signal_details`` so
    the consumer sees the full picture, ordered by attribution priority so the
    primary attribution leads. Ties break on ``signal_type`` then ``source`` for
    a deterministic order. Shared by emission and the Seer judge forward so both
    hand the consumer the same ordered snapshot.
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


def resolve_autofix_referrers(
    pull_request: PullRequest, attributions: list[dict[str, Any]]
) -> list[str]:
    """The distinct ``SeerRun.referrer`` values behind this PR's attributions.

    Order is not meaningful — attributions aren't recorded in any guaranteed
    order — so this returns a plain deduplicated set.

    Both the ``SENTRY_APP`` and ``SEER_DELEGATED_*`` signal paths stamp a Seer
    ``run_id`` onto their ``signal_details`` (see ``SentryAppSignalDetails`` /
    ``DelegatedAgentSignalDetails``). Resolves each distinct run id to its
    mirrored ``SeerRun`` row rather than duplicating the referrer onto
    ``signal_details`` at write time, so this reads correctly even for PRs
    attributed before this field existed. Run ids with no matching (or
    referrer-less) ``SeerRun`` row are skipped — not every run id resolves,
    e.g. Cursor's delegated-agent path doesn't record one today.
    """
    run_ids = {
        details["run_id"]
        for attribution in attributions
        if (details := attribution.get("signal_details")) and details.get("run_id") is not None
    }
    if not run_ids:
        return []

    referrers = (
        SeerRun.objects.filter(
            organization_id=pull_request.organization_id, seer_run_state_id__in=run_ids
        )
        .values_list("referrer", flat=True)
        .distinct()
    )
    return list(filter(None, referrers))


def _merge_commit_id(pull_request: PullRequest) -> int | None:
    """The Sentry Commit row id for the PR's merge commit, if Sentry tracks it.

    Resolved from merge_commit_sha via the (repository_id, key) unique key. Null
    when the PR wasn't merged or Sentry never recorded the landed commit — the
    pr_metrics module never creates Commit rows, so a match isn't guaranteed.
    """
    if pull_request.merge_commit_sha is None:
        return None
    return (
        Commit.objects.filter(
            repository_id=pull_request.repository_id,
            key=pull_request.merge_commit_sha,
        )
        .values_list("id", flat=True)
        .first()
    )


def _conversation_analysis_fields(
    conversation_analysis: PrConversationAnalysis | None,
) -> dict[str, Any]:
    """The ``PrCloseMetricsEvent`` columns from the conversation judge, or ``{}``
    (every column keeps its ``None`` default) when no analysis was supplied. Only
    ``metadata`` is JSON-encoded; the semantic outputs get their own columns.
    """
    if conversation_analysis is None:
        return {}
    return {
        "conversation_sentiment": conversation_analysis.sentiment,
        "conversation_comments_bot": conversation_analysis.comments_bot,
        "conversation_comments_human": conversation_analysis.comments_human,
        "conversation_comments_total": conversation_analysis.comments_total,
        "conversation_comments_judged": conversation_analysis.comments_judged,
        "conversation_comments_truncated": conversation_analysis.comments_truncated,
        "conversation_metadata": (
            json.dumps(conversation_analysis.metadata)
            if conversation_analysis.metadata is not None
            else None
        ),
    }


def build_pr_metrics_row(
    *,
    pull_request: PullRequest,
    close_action: CloseAction,
    attributions: list[dict[str, Any]],
    group_ids: list[int],
    conversation_analysis: PrConversationAnalysis | None = None,
    diagnosis_labels: Sequence[str] | None = None,
) -> PrCloseMetricsEvent:
    """Assemble the close/merge analytics row.

    Every fact is read from the stored ``PullRequest`` / ``PullRequestMetrics``
    rows, so the judge path (Seer RPC callback, which has no webhook payload) can
    reuse this. ``attributions`` is passed in so the tracking gate and the
    emitted row read the same query. A missing metrics row (a PR Sentry never saw
    active) coalesces every counter to its default.

    ``conversation_analysis`` is set on the judge path only: the conversation
    judge's result (semantic outputs become columns, its ``metadata`` is
    JSON-encoded). ``diagnosis_labels`` is the cross-judge close-reason "why" —
    mostly judge-sourced, but ``select_verdict``'s deterministic
    ``CLOSED_UNMERGED`` path can also populate it (see ``ci_failing_at_close``),
    so its presence doesn't by itself mean the row was judged.
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
        merge_commit_id=_merge_commit_id(pull_request),
        merged_at=iso_or_none(pull_request.merged_at),
        opened_at=iso_or_none(pull_request.opened_at),
        draft=bool(pull_request.draft),
        additions=metrics.additions,
        deletions=metrics.deletions,
        files_changed=metrics.files_changed,
        commits_count=metrics.commits_count,
        comments_count=metrics.comments_count,
        review_comments_count=metrics.review_comments_count,
        is_assigned=metrics.is_assigned,
        participants_count=metrics.participants_count,
        reviews_count=metrics.reviews_count,
        reviews_bot_count=metrics.reviews_bot_count,
        reviews_human_count=metrics.reviews_human_count,
        pushes_bot_count=metrics.pushes_bot_count,
        pushes_human_count=metrics.pushes_human_count,
        opened_by_bot=metrics.opened_by_bot,
        closed_by_bot=metrics.closed_by_bot,
        opened_and_closed_by_same_actor=metrics.opened_and_closed_by_same_actor,
        attributions=json.dumps(attributions),
        autofix_referrers=resolve_autofix_referrers(pull_request, attributions),
        verdict=metrics.verdict,
        diagnosis_labels=list(diagnosis_labels) if diagnosis_labels is not None else None,
        **_conversation_analysis_fields(conversation_analysis),
    )


def _is_bot(sender_type: str | None) -> bool:
    """Whether an activity sender is a bot. ``sender_type == "Bot"`` is the only
    signal GitHub gives us; anything else (a human, an empty/absent type) is human.
    """
    return sender_type == "Bot"


def _activity_derived_metrics(pull_request: PullRequest) -> dict[str, Any]:
    """Metrics derived from the PR's stored activity log at its terminal event.

    Computed at emit — not on the Seer callback — so both the no-judge and judge
    paths populate them from data Sentry already holds, independent of whether the
    PR is judged. Read before ``cleanup_pr_activity_task`` sweeps the activity
    rows; the results are persisted onto ``PullRequestMetrics`` so a later
    re-derivation (recovery) reads them off the row, not the deleted activity.

    - ``reviews_count``: total ``REVIEW_SUBMITTED`` rows — every GitHub review
      submission (a reviewer who submits twice counts twice), not distinct
      reviewers. ``reviews_bot_count``/``reviews_human_count`` split that total by
      the reviewer's account class and sum back to it.
    - ``participants_count``: distinct non-empty ``sender_login`` across the PR's
      activity, excluding bots so CI apps and automation don't inflate human
      participation.
    - ``pushes_bot_count``/``pushes_human_count``: ``OPENED`` + ``SYNCHRONIZED``
      rows split by the pusher's account class. A push, not a commit — GitHub's
      synchronize payload carries no commit count — so a bot app that pushes a
      batch of commits counts as one bot push.
    - ``opened_by_bot``/``closed_by_bot``: the account class of the opener/closer,
      or ``None`` when that terminal row was never recorded. The opener is the
      earliest ``OPENED`` row and the closer is the *latest* ``CLOSED``/``MERGED``
      row — a PR can carry more than one terminal row (closed unmerged, reopened,
      then merged), and the latest matches the PR's final state, so the rows are
      read in ``date_added`` order rather than relying on the DB's default order.
    - ``opened_and_closed_by_same_actor``: whether the opener and closer logins
      match, or ``None`` when either is unknown.

    All are only meaningful under ``pr-metrics-activity`` (no activity rows → the
    counts are 0 and the bool signals ``None``).
    """
    rows = list(
        PullRequestActivity.objects.filter(pull_request=pull_request)
        .order_by("date_added", "id")
        .values_list("event_type", "payload__sender_login", "payload__sender_type")
    )

    participant_logins = {
        login for _event_type, login, sender_type in rows if login and not _is_bot(sender_type)
    }

    review_sender_types = [
        sender_type
        for event_type, _login, sender_type in rows
        if event_type == PullRequestActivityType.REVIEW_SUBMITTED
    ]
    reviews_bot_count = sum(1 for sender_type in review_sender_types if _is_bot(sender_type))

    push_sender_types = [
        sender_type
        for event_type, _login, sender_type in rows
        if event_type in (PullRequestActivityType.OPENED, PullRequestActivityType.SYNCHRONIZED)
    ]
    pushes_bot_count = sum(1 for sender_type in push_sender_types if _is_bot(sender_type))

    # Earliest opener, latest closer — rows are ordered oldest-first above.
    opened = next(
        (
            (login, sender_type)
            for event_type, login, sender_type in rows
            if event_type == PullRequestActivityType.OPENED
        ),
        None,
    )
    closed = None
    for event_type, login, sender_type in rows:
        if event_type in (PullRequestActivityType.CLOSED, PullRequestActivityType.MERGED):
            closed = (login, sender_type)
    same_actor = (opened[0] == closed[0]) if opened and closed and opened[0] and closed[0] else None

    return {
        "participants_count": len(participant_logins),
        "reviews_count": len(review_sender_types),
        "reviews_bot_count": reviews_bot_count,
        "reviews_human_count": len(review_sender_types) - reviews_bot_count,
        "pushes_bot_count": pushes_bot_count,
        "pushes_human_count": len(push_sender_types) - pushes_bot_count,
        "opened_by_bot": _is_bot(opened[1]) if opened else None,
        "closed_by_bot": _is_bot(closed[1]) if closed else None,
        "opened_and_closed_by_same_actor": same_actor,
    }


def emit_pr_metrics_row(
    *,
    pull_request: PullRequest,
    conversation_analysis: PrConversationAnalysis | None = None,
    diagnosis_labels: Sequence[str] | None = None,
) -> bool:
    """Emit one BigQuery row for a tracked PR's terminal event.

    The tracking gate is ≥1 valid ``PullRequestAttribution`` row. Untracked PRs
    are skipped — we don't pay to record PRs that no Sentry feature can be
    attributed to. Returns whether a row was emitted, for callers/tests.

    Takes only the canonical ``PullRequest`` — no webhook payload — so Seer's
    judge can call it directly via RPC callback. ``conversation_analysis`` is set
    only on that judge path; ``diagnosis_labels`` is mostly judge-sourced but the
    deterministic ``CLOSED_UNMERGED`` path can also pass one in (see
    ``ci_failing_at_close``).
    """
    # Fetch the attribution snapshot once: it both gates emission (≥1 valid row)
    # and rides along on the emitted row, so the two can't diverge.
    attributions = active_attributions(pull_request)
    if not attributions:
        metrics.incr("pr_metrics.emit.skipped", tags={"reason": "untracked"})
        return False

    # Derive the activity-sourced counters at the terminal event — before the
    # activity rows are swept post-emit — and persist them onto the metrics row so
    # build_pr_metrics_row (and any later re-derivation for recovery) reads the
    # same final counts. A no-op when Sentry never wrote a metrics row.
    PullRequestMetrics.objects.filter(pull_request=pull_request).update(
        **_activity_derived_metrics(pull_request)
    )

    close_action: CloseAction = (
        CLOSE_ACTION_MERGED if pull_request.merged_at is not None else CLOSE_ACTION_CLOSED
    )
    row = build_pr_metrics_row(
        pull_request=pull_request,
        close_action=close_action,
        attributions=attributions,
        group_ids=resolved_group_ids(pull_request),
        conversation_analysis=conversation_analysis,
        diagnosis_labels=diagnosis_labels,
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
    # Imported here to avoid a circular import: tasks → judge → emit.
    from sentry.pr_metrics.tasks import cleanup_pr_activity_task

    cleanup_pr_activity_task.delay(pull_request_id=pull_request.id)
    return True
