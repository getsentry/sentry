"""Report and delete PR-iteration rows that nothing completed."""

from __future__ import annotations

import logging
from datetime import timedelta
from typing import NamedTuple

from django.utils import timezone

from sentry import analytics
from sentry.analytics.events.pr_iteration_events import (
    AiAutofixPrIterationFeedbackBatchBlockedEvent,
)
from sentry.seer.autofix.pr_iteration.details_store import remove_unchanged_iteration
from sentry.seer.autofix.pr_iteration.emit import (
    BLOCKED_OUTCOMES_DATA_KEY,
    FAILURE_REASON_DATA_KEY,
    PrIterationOutcome,
    build_iteration_event,
)
from sentry.seer.autofix.pr_iteration.logs import PrIterationLogContext
from sentry.seer.models.run import SeerRunPrIteration

logger = logging.getLogger(__name__)

# How long a row sits untouched before the sweep takes it.
STALE_DETAILS_AGE = timedelta(hours=24)

# Rows swept per pass. Kept small because the task runs often.
STALE_DETAILS_BATCH_SIZE = 100


class SweepResult(NamedTuple):
    # Rows deleted.
    discarded: int
    # Rows that got an event.
    emitted: int
    # Stale rows found before this pass.
    backlog: int


def sweep_stale_pr_iterations() -> SweepResult:
    """Emit and delete one batch of rows untouched for ``STALE_DETAILS_AGE``, oldest first."""
    cutoff = timezone.now() - STALE_DETAILS_AGE
    stale = SeerRunPrIteration.objects.filter(date_updated__lt=cutoff)
    backlog = stale.count()
    rows = list(stale.order_by("date_updated")[:STALE_DETAILS_BATCH_SIZE])
    discarded = 0
    emitted = 0
    for iteration in rows:
        event = None
        # Skip rows that already sent a blocked event, unless triggered since.
        if iteration.triggered or not iteration.data.get(BLOCKED_OUTCOMES_DATA_KEY):
            event = _swept_event(iteration)
        # The row changed since we read it, so the event may be wrong.
        if not remove_unchanged_iteration(iteration):
            continue
        discarded += 1
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
    log_ctx = PrIterationLogContext.for_run_id(
        logger,
        run_id=iteration.data.get("run_id"),
        organization_id=iteration.data.get("organization_id"),
        group_id=iteration.data.get("group_id"),
    )
    return build_iteration_event(
        log_ctx,
        iteration,
        AiAutofixPrIterationFeedbackBatchBlockedEvent,
        outcome=outcome,
    )
