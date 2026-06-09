"""Seer judge path for the PR metrics pipeline.

This module owns the Sentry side of the judge round-trip. Today it holds the
inbound ``upsert_pr_metrics_summary`` handler — the callback Seer makes once it
has judged a forwarded terminal PR event. The forward (Sentry → Seer) half lands
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

    Returns the parsed ``(signal_type, source, signal_details)`` tuples, or raises
    ``ValueError`` if any entry names a signal type or source we don't recognize —
    we reject the whole batch rather than silently drop malformed signals.
    """
    parsed = []
    for entry in raw:
        signal_type = PullRequestAttributionSignalType(entry["signal_type"])
        source = PullRequestAttributionSource(entry["source"])
        parsed.append((signal_type, source, entry.get("signal_details")))
    return parsed


def upsert_pr_metrics_summary(
    *,
    pull_request_id: int,
    organization_id: int,
    repository_id: int,
    verdict: str | None = None,
    attributions: Sequence[Mapping[str, Any]] | None = None,
) -> dict[str, Any]:
    """Persist Seer's judge result for a PR and emit the enriched metrics row.

    Inbound Seer RPC (Seer → Sentry), invoked once Seer has judged a forwarded
    terminal PR event. Persists the ``verdict`` onto ``PullRequestMetrics``
    (leaving the webhook-sourced counters untouched), records any Seer-derived
    ``PullRequestAttribution`` signals, then re-emits the now judge-enriched
    ``pr_metrics.row``.

    The PR is located by its Sentry id but constrained to the reported
    ``organization_id``/``repository_id``, so a mismatched id can't reach another
    tenant's PR. Returns ``{"success": bool}`` for the Seer caller.
    """
    log_extra = {
        "pull_request_id": pull_request_id,
        "organization_id": organization_id,
        "repository_id": repository_id,
    }

    if verdict is not None and verdict not in PullRequestVerdict.values:
        logger.warning("pr_metrics.upsert.invalid_verdict", extra={**log_extra, "verdict": verdict})
        metrics.incr("pr_metrics.upsert.skipped", tags={"reason": "invalid_verdict"})
        return {"success": False, "error": "invalid_verdict"}

    try:
        parsed_attributions = _parse_attributions(attributions or ())
    except (KeyError, ValueError):
        logger.warning("pr_metrics.upsert.invalid_attribution", extra=log_extra)
        metrics.incr("pr_metrics.upsert.skipped", tags={"reason": "invalid_attribution"})
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
        logger.warning("pr_metrics.upsert.pull_request_not_found", extra=log_extra)
        metrics.incr("pr_metrics.upsert.skipped", tags={"reason": "pr_not_found"})
        return {"success": False, "error": "pull_request_not_found"}

    # Only write the verdict, and only when reported: a None verdict means "not
    # provided", so it must not clear a verdict already stored by an earlier call.
    # The webhook keeps the activity counters current, so this partial upsert must
    # not clobber them either.
    defaults = {"verdict": verdict} if verdict is not None else {}
    with transaction.atomic(using=router.db_for_write(PullRequestMetrics)):
        PullRequestMetrics.objects.update_or_create(
            pull_request=pull_request,
            defaults=defaults,
        )
        for signal_type, source, signal_details in parsed_attributions:
            record_attribution_signal(
                pull_request=pull_request,
                signal_type=signal_type,
                source=source,
                signal_details=signal_details,
            )

    emit_pr_metrics_row(pull_request=pull_request)

    metrics.incr("pr_metrics.upsert.recorded", tags={"verdict": verdict or "none"})
    logger.info("pr_metrics.upsert.recorded", extra={**log_extra, "verdict": verdict})
    return {"success": True}
