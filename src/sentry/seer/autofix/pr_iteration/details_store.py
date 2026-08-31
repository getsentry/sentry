"""The store behind PR-iteration analytics: one ``SeerRunPrIteration`` row each.

A row is opened when an iteration's first feedback item is queued and deleted
when its row is emitted, so a surviving row is an iteration nothing has recorded
yet. Rows hang off the run rather than living in ``SeerRun.extras``: writing to
one never locks the run, and two iterations never contend with each other.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from sentry.seer.models.run import SeerRun, SeerRunPrIteration


def add_iteration(seer_run: SeerRun, data: dict[str, Any]) -> SeerRunPrIteration:
    """Open a row for an iteration.

    The row's id is the iteration's id -- callers read it off the return value.
    """
    return SeerRunPrIteration.objects.create(seer_run=seer_run, data=data)


def get_iteration(seer_run: SeerRun, iteration_id: int) -> SeerRunPrIteration | None:
    return SeerRunPrIteration.objects.filter(seer_run=seer_run, id=iteration_id).first()


def open_iterations(seer_run: SeerRun) -> list[SeerRunPrIteration]:
    """The run's rows, oldest first."""
    return list(SeerRunPrIteration.objects.filter(seer_run=seer_run).order_by("date_added"))


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


def remove_iterations_before(cutoff: datetime, limit: int) -> int:
    """Delete rows untouched since ``cutoff``. Returns how many went."""
    stale_ids = list(
        SeerRunPrIteration.objects.filter(date_updated__lt=cutoff)
        .order_by("date_updated")
        .values_list("id", flat=True)[:limit]
    )
    if not stale_ids:
        return 0

    deleted, _ = SeerRunPrIteration.objects.filter(id__in=stale_ids).delete()
    return deleted
