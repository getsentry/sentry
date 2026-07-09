"""Seer judge path for the PR metrics pipeline.

This module owns both halves of the judge round-trip:

- ``forward_pr_to_seer_judge`` — the forward (Sentry → Seer): a terminal PR event
  whose outcome ``select_verdict`` can't settle locally is handed to Seer to judge.
- ``update_pr_metrics`` — the inbound callback (Seer → Sentry): Seer reports the
  judged verdict, which settles the row and emits.
"""

from __future__ import annotations

import logging
from collections.abc import Mapping, Sequence
from typing import Any

from django.conf import settings
from django.db import router, transaction
from django.db.models import Q
from pydantic import ValidationError
from urllib3.exceptions import HTTPError

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
from sentry.net.http import connection_from_url
from sentry.pr_metrics.attribution import record_attribution_signal
from sentry.pr_metrics.contracts import (
    CloseAction,
    PrActivityEvent,
    PrCloseJudgeRequest,
    PrConversationAnalysis,
)
from sentry.pr_metrics.emit import active_attributions, emit_pr_metrics_row
from sentry.pr_metrics.utils import iso_or_none, resolved_group_ids
from sentry.seer.code_review.models import SeerCodeReviewRepoDefinition
from sentry.seer.code_review.utils import build_repo_definition
from sentry.seer.sentry_data_models import (
    UpdatePrMetricsErrorResponse,
    UpdatePrMetricsSuccessResponse,
)
from sentry.seer.signed_seer_api import SeerViewerContext, make_signed_seer_api_request
from sentry.utils import json, metrics

logger = logging.getLogger(__name__)

# PR metrics is part of the prevent-AI domain, so the judge forward shares its
# Seer host with code review but owns its own path namespace. The path must match
# the Seer route on the other side — the one value that has to agree on both ends.
SEER_PR_METRICS_JUDGE_PATH = "/v1/pr-metrics/pr-close-judge"

seer_pr_metrics_connection_pool = connection_from_url(
    settings.SEER_PREVENT_AI_URL,
    timeout=settings.SEER_DEFAULT_TIMEOUT,
)

# The verdicts Seer may return: every real outcome, never an internal sentinel.
# The callback rejects JUDGE_IN_PROGRESS / WAITING_EVENT_COOLDOWN coming back from Seer.
RESULT_VERDICTS = frozenset(PullRequestVerdict.values) - {
    PullRequestVerdict.JUDGE_IN_PROGRESS,
    PullRequestVerdict.WAITING_EVENT_COOLDOWN,
}


# check_run fires per check per push, so a busy PR can accumulate far more check
# rows than the aggregate "was CI green or red at close" signal needs. Lifecycle
# rows (reviews, labels, the close itself) are bounded in practice and forwarded
# in full; only the most recent check rows are forwarded, which preserves the
# final CI state while keeping the request from ballooning.
_CHECK_EVENT_TYPES = frozenset(
    {
        PullRequestActivityType.CHECK_RUN_COMPLETED,
        PullRequestActivityType.CHECK_SUITE_COMPLETED,
    }
)
_MAX_FORWARDED_CHECK_ROWS = 100


def _pr_activity_timeline(pull_request: PullRequest) -> list[PrActivityEvent]:
    """The PR's captured activity rows, oldest first, projected for the judge.

    All lifecycle rows are forwarded; check rows are capped to the most recent
    ``_MAX_FORWARDED_CHECK_ROWS`` (see comment above) so CI noise on busy PRs
    can't balloon the Seer request.
    """
    rows = list(
        PullRequestActivity.objects.filter(pull_request=pull_request).order_by("date_added")
    )
    check_rows = [row for row in rows if row.event_type in _CHECK_EVENT_TYPES]
    if len(check_rows) > _MAX_FORWARDED_CHECK_ROWS:
        # The cap is sized above what a normal PR produces, so hitting it is a
        # signal worth watching: it means CI noise is dropping rows from the
        # forward, and a persistently high rate would argue for raising the cap.
        dropped = len(check_rows) - _MAX_FORWARDED_CHECK_ROWS
        logger.warning(
            "pr_metrics.judge.check_rows_capped",
            extra={
                "pull_request_id": pull_request.id,
                "check_rows": len(check_rows),
                "dropped": dropped,
            },
        )
        metrics.incr("pr_metrics.judge.check_rows_capped")
        kept_check_ids = {row.id for row in check_rows[-_MAX_FORWARDED_CHECK_ROWS:]}
        rows = [
            row
            for row in rows
            if row.event_type not in _CHECK_EVENT_TYPES or row.id in kept_check_ids
        ]
    return [
        PrActivityEvent(
            event_type=row.event_type, timestamp=row.date_added.isoformat(), payload=row.payload
        )
        for row in rows
    ]


def _build_judge_request(pull_request: PullRequest, repository: Repository) -> PrCloseJudgeRequest:
    """Assemble the Sentry → Seer judge request for a needs-judge terminal event.

    Hands Seer the PR's terminal facts, stored counters, attribution snapshot, and
    repo identity so it can fetch the diff/comments from the provider and judge.
    Mirrors the facts on the emitted analytics row, but the Seer API is a distinct
    contract boundary, so it's assembled here rather than reshaped from the row.
    """
    head_commit_sha = pull_request.head_commit_sha
    closed_at = pull_request.closed_at
    if head_commit_sha is None or closed_at is None:
        # A close/merge always persists both; a null means the PR never reached a
        # terminal state, so there's nothing for Seer to judge. Fail loud.
        raise ValueError("PR judge request requires a persisted head_commit_sha and closed_at")

    # A bare instance carries zero/false defaults, so a PR with no stored metrics
    # row (the row-missing defer-to-judge case) forwards zeroed counters.
    metrics_row = (
        PullRequestMetrics.objects.filter(pull_request=pull_request).first() or PullRequestMetrics()
    )
    close_action: CloseAction = "merged" if pull_request.merged_at is not None else "closed"
    return PrCloseJudgeRequest(
        organization_id=pull_request.organization_id,
        repository_id=pull_request.repository_id,
        pull_request_id=pull_request.id,
        # The shared Seer RepoDefinition shape (split owner/name, bare provider
        # slug); head_commit_sha is the PR tip Seer resolves the repo at, with the
        # merge/head SHAs also sent below. parse_obj validates the built shape.
        repo=SeerCodeReviewRepoDefinition.parse_obj(
            build_repo_definition(repository, head_commit_sha)
        ),
        pr_number=pull_request.key,
        close_action=close_action,
        head_commit_sha=head_commit_sha,
        merge_commit_sha=pull_request.merge_commit_sha,
        opened_at=iso_or_none(pull_request.opened_at),
        closed_at=closed_at.isoformat(),
        merged_at=iso_or_none(pull_request.merged_at),
        draft=bool(pull_request.draft),
        additions=metrics_row.additions,
        deletions=metrics_row.deletions,
        files_changed=metrics_row.files_changed,
        commits_count=metrics_row.commits_count,
        comments_count=metrics_row.comments_count,
        review_comments_count=metrics_row.review_comments_count,
        is_assigned=metrics_row.is_assigned,
        attributions=active_attributions(pull_request),
        group_ids=resolved_group_ids(pull_request),
        activity=_pr_activity_timeline(pull_request),
    )


def forward_pr_to_seer_judge(pull_request: PullRequest, repository: Repository) -> None:
    """Forward a needs-judge terminal PR event to Seer (Sentry → Seer).

    The outbound half of the round-trip: when ``select_verdict`` can't settle the
    outcome locally, Sentry hands Seer the terminal facts and Seer calls back via
    ``update_pr_metrics`` with the judged verdict. The webhook has already claimed
    the ``JUDGE_IN_PROGRESS`` sentinel before dispatch, so this never double-fires
    on a redelivery.

    Raises ``HTTPError`` on a retryable Seer status (5xx/429) so the enclosing task
    retries. A permanent rejection (4xx) is logged and dropped — observe-only: the
    row stays claimed and simply never emits, an accepted loss until a reaper lands.
    """
    payload = _build_judge_request(pull_request, repository)
    log_extra = {
        "organization_id": pull_request.organization_id,
        "repository_id": pull_request.repository_id,
        "repo_name": repository.name,
        "pull_request_id": pull_request.id,
    }
    response = make_signed_seer_api_request(
        connection_pool=seer_pr_metrics_connection_pool,
        path=SEER_PR_METRICS_JUDGE_PATH,
        body=payload.json().encode("utf-8"),
        viewer_context=SeerViewerContext(organization_id=pull_request.organization_id),
    )
    if response.status >= 500 or response.status == 429:
        raise HTTPError(f"Seer judge forward returned retryable status {response.status}")
    if response.status >= 400:
        logger.warning(
            "pr_metrics.judge.forward_rejected", extra={**log_extra, "status": response.status}
        )
        metrics.incr("pr_metrics.judge.forward_failed", tags={"reason": "client_error"})
        return
    metrics.incr("pr_metrics.judge.forwarded")
    logger.info("pr_metrics.judge.forwarded", extra=log_extra)


def _parse_attributions(
    raw: Sequence[Mapping[str, Any]],
) -> list[tuple[PullRequestAttributionSignalType, PullRequestAttributionSource, Any]]:
    """Validate Seer-supplied attribution signals at the trust boundary.

    Returns the parsed ``(signal_type, source, signal_details)`` tuples. Raises if
    the payload is the wrong shape (not a list of objects → ``TypeError``), is
    missing a required key (``KeyError``), names a signal type or source we don't
    recognize, or carries a non-object ``signal_details`` (``ValueError``) — the
    caller rejects the whole batch rather than silently dropping malformed signals.
    """
    parsed = []
    for entry in raw:
        signal_type = PullRequestAttributionSignalType(entry["signal_type"])
        source = PullRequestAttributionSource(entry["source"])
        signal_details = entry.get("signal_details")
        # signal_details is persisted as a JSON object; reject scalars/arrays here
        # so record_attribution_signal's dict(...) can't raise mid-transaction.
        if signal_details is not None and not isinstance(signal_details, Mapping):
            raise ValueError("signal_details must be an object or null")
        parsed.append((signal_type, source, signal_details))
    return parsed


def _parse_conversation_analysis(
    raw: Mapping[str, Any] | None, log_extra: Mapping[str, Any]
) -> PrConversationAnalysis | None:
    """Parse ``conversation_analysis``, or ``None`` if absent or malformed.

    Being BigQuery-only enrichment (unlike ``attributions``, which writes to
    Postgres), a broken payload degrades gracefully — log + metric, emit without it
    — rather than 422-ing and blocking the verdict from settling.
    """
    if raw is None:
        return None
    try:
        analysis = PrConversationAnalysis.parse_obj(raw)
        # ``metadata`` is an Any-typed bag emitted verbatim as JSON later, outside
        # this guard and after the verdict is committed. Round-trip it now so a
        # non-serializable value is dropped here (honoring the graceful-drop
        # contract) rather than raising mid-emit. Real RPC payloads are JSON-derived
        # and so always serializable; this guards direct/synthetic callers.
        if analysis.metadata is not None:
            json.dumps(analysis.metadata)
        return analysis
    except (ValidationError, TypeError, ValueError):
        logger.warning("pr_metrics.update.invalid_conversation_analysis", extra=dict(log_extra))
        metrics.incr("pr_metrics.update.invalid_conversation_analysis")
        return None


def _clean_diagnosis_labels(raw: Any, log_extra: Mapping[str, Any]) -> list[str] | None:
    """Sanitize ``diagnosis_labels`` (a list of free-string labels) at the boundary.

    Like ``conversation_analysis`` it's BigQuery-only enrichment, so a wrong-typed
    value (not a list of strings, e.g. a bare string or a mixed-type list) is
    dropped gracefully — log + metric, emit without it — rather than 422-ing the
    callback. Only the shape is checked, never the label values, so the shared
    diagnosis vocabulary can iterate freely. An empty list is valid and returns
    ``[]`` (the judge ran, found no labels), distinct from ``None`` (none supplied).
    """
    if raw is None:
        return None
    if (
        isinstance(raw, Sequence)
        and not isinstance(raw, str)
        and all(isinstance(x, str) for x in raw)
    ):
        return list(raw)
    logger.warning("pr_metrics.update.invalid_diagnosis_labels", extra=dict(log_extra))
    metrics.incr("pr_metrics.update.invalid_diagnosis_labels")
    return None


def update_pr_metrics(
    *,
    pull_request_id: int,
    organization_id: int,
    repository_id: int,
    verdict: str | None = None,
    diagnosis_labels: Sequence[str] | None = None,
    attributions: Sequence[Mapping[str, Any]] | None = None,
    conversation_analysis: Mapping[str, Any] | None = None,
) -> UpdatePrMetricsSuccessResponse | UpdatePrMetricsErrorResponse:
    """Persist Seer's judge result for a PR and emit the enriched metrics row.

    Inbound Seer RPC (Seer → Sentry), invoked once Seer has judged a forwarded
    terminal PR event. Updates the ``verdict`` on the PR's ``PullRequestMetrics``
    row (the webhook creates and keeps the row's activity counters current, so
    this leaves them untouched), records any ``attributions`` Seer produced while
    judging, then re-emits the now judge-enriched ``pr_metrics.row``.

    ``attributions`` are new signals Seer surfaced during judging (recorded with
    a ``seer_*`` source), additive to the ones the webhook already detected — not
    an echo or filter of the attributions Sentry forwarded.

    ``conversation_analysis`` is the conversation judge's result — one of several
    judges (others, e.g. diff-similarity, arrive as their own args). Its semantic
    outputs become emitted columns; its ``metadata`` rides along as a verbatim JSON
    blob. ``diagnosis_labels`` is the cross-judge close-reason "why" (a shared
    vocabulary). Both are optional (null for old Seer pods / the no-judge path →
    rolling-deploy safe) and BigQuery-only — never persisted. A malformed value is
    dropped, not rejected — see ``_parse_conversation_analysis`` /
    ``_clean_diagnosis_labels``.

    The PR is located by its Sentry id but constrained to the reported
    ``organization_id``/``repository_id``, so a mismatched id can't reach another
    tenant's PR. A missing/unrecognized ``verdict`` or a non-terminal PR is
    rejected up front. Emission is single-shot: only the callback that transitions
    the row off the ``JUDGE_IN_PROGRESS`` sentinel (or an unclaimed null) emits, so
    a retried Seer callback settles to a no-op rather than a duplicate row. Returns
    ``{"success": bool}`` for the Seer caller.
    """
    log_extra = {
        "pull_request_id": pull_request_id,
        "organization_id": organization_id,
        "repository_id": repository_id,
    }

    # The verdict is the judge result this callback exists to deliver, so a missing,
    # unrecognized, or sentinel value (Seer must return a real outcome, never the
    # internal forward sentinel) is malformed input — reject rather than write it.
    if verdict is None or verdict not in RESULT_VERDICTS:
        logger.warning("pr_metrics.update.invalid_verdict", extra={**log_extra, "verdict": verdict})
        metrics.incr("pr_metrics.update.skipped", tags={"reason": "invalid_verdict"})
        return UpdatePrMetricsErrorResponse(error="invalid_verdict")

    try:
        parsed_attributions = _parse_attributions(attributions or ())
    except (KeyError, TypeError, ValueError):
        logger.warning("pr_metrics.update.invalid_attribution", extra=log_extra)
        metrics.incr("pr_metrics.update.skipped", tags={"reason": "invalid_attribution"})
        return UpdatePrMetricsErrorResponse(error="invalid_attribution")

    parsed_conversation_analysis = _parse_conversation_analysis(conversation_analysis, log_extra)
    clean_diagnosis_labels = _clean_diagnosis_labels(diagnosis_labels, log_extra)

    # Scope the lookup to the reported org+repo: the id alone is attacker-influenced
    # (it round-trips through Seer), so trusting it unscoped would be an IDOR.
    try:
        pull_request = PullRequest.objects.get(
            id=pull_request_id,
            organization_id=organization_id,
            repository_id=repository_id,
        )
    except PullRequest.DoesNotExist:
        logger.warning("pr_metrics.update.pull_request_not_found", extra=log_extra)
        metrics.incr("pr_metrics.update.skipped", tags={"reason": "pr_not_found"})
        return UpdatePrMetricsErrorResponse(error="pull_request_not_found")

    # Emit needs a terminal PR (closed_at + head_commit_sha). Validate it before
    # writing so a non-terminal PR is rejected up front rather than committing the
    # verdict and then failing in emit — i.e. no committed-but-errored state.
    if pull_request.closed_at is None or pull_request.head_commit_sha is None:
        logger.warning("pr_metrics.update.not_terminal", extra=log_extra)
        metrics.incr("pr_metrics.update.skipped", tags={"reason": "not_terminal"})
        return UpdatePrMetricsErrorResponse(error="pull_request_not_terminal")

    # Only the verdict is written here; the webhook keeps the activity counters
    # current, so this partial update must not clobber them.
    with transaction.atomic(using=router.db_for_write(PullRequestMetrics)):
        # Ensure the row exists so the guard below has something to compare-and-set
        # against; a valid callback for a PR Sentry never wrote a row for still
        # settles. The forward path normally creates it (as JUDGE_IN_PROGRESS) first.
        PullRequestMetrics.objects.get_or_create(pull_request=pull_request)
        # Single-emit guard: claim the transition off the forward sentinel (or an
        # unclaimed null) to the judged verdict. A retried Seer callback finds the
        # row already settled, claims nothing, and must not emit a second row.
        settled = (
            PullRequestMetrics.objects.filter(pull_request=pull_request)
            .filter(Q(verdict=PullRequestVerdict.JUDGE_IN_PROGRESS) | Q(verdict__isnull=True))
            .update(verdict=verdict)
        )
        if not settled:
            logger.info(
                "pr_metrics.update.already_settled", extra={**log_extra, "verdict": verdict}
            )
            metrics.incr("pr_metrics.update.skipped", tags={"reason": "already_settled"})
            return UpdatePrMetricsSuccessResponse()
        for signal_type, source, signal_details in parsed_attributions:
            record_attribution_signal(
                pull_request=pull_request,
                signal_type=signal_type,
                source=source,
                signal_details=signal_details,
            )

    emit_pr_metrics_row(
        pull_request=pull_request,
        conversation_analysis=parsed_conversation_analysis,
        diagnosis_labels=clean_diagnosis_labels,
    )

    metrics.incr("pr_metrics.update.recorded", tags={"verdict": verdict})
    logger.info("pr_metrics.update.recorded", extra={**log_extra, "verdict": verdict})
    return UpdatePrMetricsSuccessResponse()
