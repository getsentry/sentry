"""Durable feature markers stored in ``SeerRun.extras``.

Markers are per-repo (feature plus repo full name) or run-level (feature
alone). Features write concurrently, so every writer here re-reads the row
under a row lock and merges only its own key.
"""

from __future__ import annotations

from collections.abc import Generator
from contextlib import contextmanager
from typing import Any

from django.db import router, transaction

from sentry.seer.models.run import SeerRun


def get_run_marker(seer_run: SeerRun, extra_key: str, repo_name: str) -> dict[str, Any] | None:
    return ((seer_run.extras or {}).get(extra_key) or {}).get(repo_name)


def get_run_extra(seer_run: SeerRun, extra_key: str) -> Any | None:
    return (seer_run.extras or {}).get(extra_key)


@contextmanager
def record_run_extras(seer_run: SeerRun) -> Generator[dict[str, Any]]:
    """Yield ``extras`` from a locked row and save the edits on exit.
    The row stays locked inside the ``with`` block, so keep the body short.
    """
    with transaction.atomic(router.db_for_write(SeerRun)):
        locked = SeerRun.objects.select_for_update().get(id=seer_run.id)
        extras = dict(locked.extras or {})
        yield extras
        locked.update(extras=extras)
    seer_run.extras = extras


def record_run_marker(
    seer_run: SeerRun, extra_key: str, repo_name: str, marker: dict[str, Any]
) -> None:
    """Atomically set ``extras[extra_key][repo_name] = marker`` on the run."""
    with record_run_extras(seer_run) as extras:
        markers = dict(extras.get(extra_key) or {})
        markers[repo_name] = marker
        extras[extra_key] = markers
