from __future__ import annotations

from datetime import UTC, datetime, timedelta

import time_machine

__all__ = ["before_now"]


def before_now(**kwargs: float) -> datetime:
    date = datetime.now(UTC) - timedelta(**kwargs)
    return date - timedelta(microseconds=date.microsecond % 1000)


class MockClock:
    """Returns a distinct, increasing timestamp each time it is called."""

    def __init__(self, initial=None):
        self.time = initial or datetime.now(UTC)

    def __call__(self):
        self.time += timedelta(seconds=1)
        return self.time


def freeze_time(t: str | datetime | None = None) -> time_machine.travel:
    if t is None:
        t = datetime.now(UTC)
    return time_machine.travel(t, tick=False)
