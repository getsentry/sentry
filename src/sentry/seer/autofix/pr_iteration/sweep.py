"""Backstop for PR-iteration rows nothing ever completed.

A row that ages out here is an iteration no completion hook emitted. The sweep
reports it once, under the last reason a gate wrote on it, and deletes it, so
that every row opened produces at least one event.
"""

from __future__ import annotations

import logging
from datetime import timedelta
from typing import NamedTuple

from django.utils import timezone

from sentry import analytics
from sentry.analytics.events.pr_iteration_events import (
    AiAutofixPrIterationFeedbackBatchBlockedEvent,
)
from sentry.seer.autofix.pr_iteration.emit import (
    BLOCKED_OUTCOMES_DATA_KEY,
    FAILURE_REASON_DATA_KEY,
    PrIterationOutcome,
    build_iteration_event,
)
from sentry.seer.autofix.pr_iteration.logs import LogCtxIteration, PrIterationLogContext
from sentry.seer.models.run import SeerRunPrIteration

logger = logging.getLogger(__name__)

# sweep picks this up after 24 hours
STALE_DETAILS_AGE = timedelta(hours=24)

# Rows swept per pass, oldest first. The sweep is a backstop, not the main
# path, so it stays small and runs often.
STALE_DETAILS_BATCH_SIZE = 100


class SweepResult(NamedTuple):
    # Rows deleted.
    discarded: int
    # Rows that got a blocked event on the way out.
    emitted: int
    # Rows past the cutoff before this pass, swept or not.
    backlog: int


def sweep_stale_pr_iterations() -> SweepResult:
    """Emit and delete one batch of rows untouched for ``STALE_DETAILS_AGE``, oldest first."""
    cutoff = timezone.now() - STALE_DETAILS_AGE
    stale = SeerRunPrIteration.objects.filter(date_updated__lt=cutoff)
    backlog = stale.count()
    rows = list(stale.order_by("date_updated")[:STALE_DETAILS_BATCH_SIZE])
    emitted = 0
    for iteration in rows:
        if iteration.data.get(BLOCKED_OUTCOMES_DATA_KEY):
            continue
        event = _swept_event(iteration)
        if event is None:
            continue
        try:
            analytics.record(event)
            emitted += 1
        except Exception:
            logger.exception(
                "autofix.pr_iteration.details.sweep_emit_failed",
                extra={"iteration_id": iteration.id},
            )

    discarded, _ = SeerRunPrIteration.objects.filter(
        id__in=[iteration.id for iteration in rows]
    ).delete()
    return SweepResult(discarded=discarded, emitted=emitted, backlog=backlog)


def _swept_event(
    iteration: SeerRunPrIteration,
) -> AiAutofixPrIterationFeedbackBatchBlockedEvent | None:
    """The blocked event for a row the sweep is about to delete."""
    fallback = (
        PrIterationOutcome.NEVER_COMPLETED
        if iteration.triggered
        else PrIterationOutcome.NEVER_TRIGGERED
    )
    outcome = iteration.data.get(FAILURE_REASON_DATA_KEY) or fallback.value
    log_ctx = PrIterationLogContext(
        logger,
        iteration=LogCtxIteration.UNTRIGGERED,
        run_state=None,
        organization_id=iteration.data.get("organization_id"),
        group_id=iteration.data.get("group_id"),
    )
    return build_iteration_event(
        log_ctx,
        iteration,
        AiAutofixPrIterationFeedbackBatchBlockedEvent,
        outcome=outcome,
    )
