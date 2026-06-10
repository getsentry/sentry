"""Seer judge path for the PR metrics pipeline.

This module owns the Sentry side of the judge round-trip. Today it holds the
inbound ``update_pr_metrics`` handler — the callback Seer makes once it has
judged a forwarded terminal PR event. The forward (Sentry → Seer) half lands
later and will live here alongside it.
"""

from __future__ import annotations

import logging
from collections.abc import Mapping, Sequence
from typing import Any

from django.db import router, transaction

from sentry.models.pullrequest import (
    PullRequest,
    PullRequestAttributionSignalType,
    PullRequestAttributionSource,
    PullRequestMetrics,
    PullRequestVerdict,
)
from sentry.pr_metrics.attribution import record_attribution_signal
from sentry.pr_metrics.emit import emit_pr_metrics_row
from sentry.utils import metrics

logger = logging.getLogger(__name__)


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


def update_pr_metrics(
    *,
    pull_request_id: int,
    organization_id: int,
    repository_id: int,
    verdict: str | None = None,
    attributions: Sequence[Mapping[str, Any]] | None = None,
) -> dict[str, Any]:
    """Persist Seer's judge result for a PR and emit the enriched metrics row.

    Inbound Seer RPC (Seer → Sentry), invoked once Seer has judged a forwarded
    terminal PR event. Updates the ``verdict`` on the PR's ``PullRequestMetrics``
    row (the webhook creates and keeps the row's activity counters current, so
    this leaves them untouched), records any ``attributions`` Seer produced while
    judging, then re-emits the now judge-enriched ``pr_metrics.row``.

    ``attributions`` are new signals Seer surfaced during judging (recorded with
    a ``seer_*`` source), additive to the ones the webhook already detected — not
    an echo or filter of the attributions Sentry forwarded.

    The PR is located by its Sentry id but constrained to the reported
    ``organization_id``/``repository_id``, so a mismatched id can't reach another
    tenant's PR. A missing/unrecognized ``verdict`` or a non-terminal PR is
    rejected up front. Returns ``{"success": bool}`` for the Seer caller.
    """
    log_extra = {
        "pull_request_id": pull_request_id,
        "organization_id": organization_id,
        "repository_id": repository_id,
    }

    # The verdict is the judge result this callback exists to deliver, so a
    # missing one is malformed input — reject it rather than writing a null.
    if verdict is None or verdict not in PullRequestVerdict.values:
        logger.warning("pr_metrics.update.invalid_verdict", extra={**log_extra, "verdict": verdict})
        metrics.incr("pr_metrics.update.skipped", tags={"reason": "invalid_verdict"})
        return {"success": False, "error": "invalid_verdict"}

    try:
        parsed_attributions = _parse_attributions(attributions or ())
    except (KeyError, TypeError, ValueError):
        logger.warning("pr_metrics.update.invalid_attribution", extra=log_extra)
        metrics.incr("pr_metrics.update.skipped", tags={"reason": "invalid_attribution"})
        return {"success": False, "error": "invalid_attribution"}

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
        return {"success": False, "error": "pull_request_not_found"}

    # Emit needs a terminal PR (closed_at + head_commit_sha). Validate it before
    # writing so a non-terminal PR is rejected up front rather than committing the
    # verdict and then failing in emit — i.e. no committed-but-errored state.
    if pull_request.closed_at is None or pull_request.head_commit_sha is None:
        logger.warning("pr_metrics.update.not_terminal", extra=log_extra)
        metrics.incr("pr_metrics.update.skipped", tags={"reason": "not_terminal"})
        return {"success": False, "error": "pull_request_not_terminal"}

    # Only the verdict is written here; the webhook keeps the activity counters
    # current, so this partial update must not clobber them.
    with transaction.atomic(using=router.db_for_write(PullRequestMetrics)):
        PullRequestMetrics.objects.update_or_create(
            pull_request=pull_request,
            defaults={"verdict": verdict},
        )
        for signal_type, source, signal_details in parsed_attributions:
            record_attribution_signal(
                pull_request=pull_request,
                signal_type=signal_type,
                source=source,
                signal_details=signal_details,
            )

    emit_pr_metrics_row(pull_request=pull_request)

    metrics.incr("pr_metrics.update.recorded", tags={"verdict": verdict})
    logger.info("pr_metrics.update.recorded", extra={**log_extra, "verdict": verdict})
    return {"success": True}
