"""Per-repo feature markers stored in ``SeerRun.extras``.

Several PR-iteration features (review requests, cap-exhausted handoffs)
persist a durable "we already pinged a human" marker on the run, keyed by
feature and repo full name. Each feature serializes its own side effects
with its own advisory lock, but the features run concurrently with each
other — and a plain read-modify-write of the whole ``extras`` blob would
let one feature's write erase another's marker. ``record_run_marker``
therefore re-reads the row under a row lock and merges only its own key.
"""

from __future__ import annotations

from typing import Any

from django.db import router, transaction

from sentry.seer.models.run import SeerRun


def get_run_marker(seer_run: SeerRun, extra_key: str, repo_name: str) -> dict[str, Any] | None:
    return ((seer_run.extras or {}).get(extra_key) or {}).get(repo_name)


def record_run_marker(
    seer_run: SeerRun, extra_key: str, repo_name: str, marker: dict[str, Any]
) -> None:
    """Atomically set ``extras[extra_key][repo_name] = marker`` on the run.

    The merge happens against a freshly locked row, so a stale ``seer_run``
    instance can't clobber markers written concurrently under other keys.
    """
    with transaction.atomic(router.db_for_write(SeerRun)):
        locked = SeerRun.objects.select_for_update().get(id=seer_run.id)
        extras = dict(locked.extras or {})
        markers = dict(extras.get(extra_key) or {})
        markers[repo_name] = marker
        extras[extra_key] = markers
        locked.update(extras=extras)
    seer_run.extras = extras
