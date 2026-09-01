"""The store behind PR-iteration analytics: one ``SeerRunPrIteration`` row each.

A row is opened when an iteration's first feedback item is queued and deleted
when its row is emitted, so a surviving row is an iteration nothing has recorded
yet. Rows hang off the run rather than living in ``SeerRun.extras``: writing to
one never locks the run, and two iterations never contend with each other.
"""

from __future__ import annotations

from collections import Counter
from datetime import datetime
from typing import Any

from django.db import IntegrityError, router, transaction
from django.utils import timezone

from sentry.seer.models.run import SeerRun, SeerRunPrIteration
from sentry.utils import metrics


def add_iteration(seer_run: SeerRun, data: dict[str, Any]) -> SeerRunPrIteration | None:
    """Open a row for an iteration, or reset the row left by an abandoned one.

    A unique constraint allows one waiting row for each run. A conflict means
    the feedback of the waiting row will never run, so this feedback takes the
    row over. The row's id is the iteration's id.
    """
    try:
        with transaction.atomic(using=router.db_for_write(SeerRunPrIteration)):
            return SeerRunPrIteration.objects.create(seer_run=seer_run, data=data)
    except IntegrityError:
        pass

    metrics.incr("autofix.pr_iteration.details.reset")
    iteration = untriggered_iteration(seer_run)
    if iteration is None:
        # A drain claimed the row between the failed insert and this read.
        return None

    iteration.update(data=data, date_added=timezone.now())
    return iteration


def get_iteration(seer_run: SeerRun, iteration_id: int) -> SeerRunPrIteration | None:
    return SeerRunPrIteration.objects.filter(seer_run=seer_run, id=iteration_id).first()


def open_iterations(seer_run: SeerRun) -> list[SeerRunPrIteration]:
    """The run's rows, oldest first."""
    return list(SeerRunPrIteration.objects.filter(seer_run=seer_run).order_by("date_added"))


def untriggered_iteration(seer_run: SeerRun) -> SeerRunPrIteration | None:
    """The run's oldest row no drain has handed to the agent yet."""
    return (
        SeerRunPrIteration.objects.filter(seer_run=seer_run, triggered=False)
        .order_by("date_added")
        .first()
    )


def claim_iteration(iteration: SeerRunPrIteration) -> bool:
    """Mark one row triggered. False when another writer got there first."""
    return bool(
        SeerRunPrIteration.objects.filter(id=iteration.id, triggered=False).update(triggered=True)
    )


def update_iteration(iteration: SeerRunPrIteration, **updates: Any) -> SeerRunPrIteration:
    """Fold what an iteration has learned into its row."""
    iteration.update(data={**iteration.data, **updates})
    return iteration


def remove_iteration(iteration: SeerRunPrIteration) -> bool:
    """Delete one row. False when another writer got there first.

    Deleting is how a caller claims the iteration: the row goes exactly once,
    so two callers racing to emit it produce one row between them.
    """
    deleted, _ = SeerRunPrIteration.objects.filter(id=iteration.id).delete()
    return bool(deleted)


def count_iterations_before(cutoff: datetime) -> int:
    """How many rows are untouched since ``cutoff``."""
    return SeerRunPrIteration.objects.filter(date_updated__lt=cutoff).count()


def remove_iterations_before(cutoff: datetime, limit: int) -> dict[bool, int]:
    """Delete rows untouched since ``cutoff``. Returns how many went, by ``triggered``."""
    stale = list(
        SeerRunPrIteration.objects.filter(date_updated__lt=cutoff)
        .order_by("date_updated")
        .values_list("id", "triggered")[:limit]
    )
    if not stale:
        return {}

    SeerRunPrIteration.objects.filter(id__in=[row_id for row_id, _ in stale]).delete()
    return dict(Counter(triggered for _, triggered in stale))
