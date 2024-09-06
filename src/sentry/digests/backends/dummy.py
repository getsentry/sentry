from collections.abc import Iterable
from contextlib import contextmanager
from typing import TYPE_CHECKING, Any

from sentry.digests.backends.base import Backend, ScheduleEntry
from sentry.digests.types import Record

if TYPE_CHECKING:
    from sentry.models.project import Project


class DummyBackend(Backend):
    def add(
        self,
        key: str,
        record: "Record",
        increment_delay: int | None = None,
        maximum_delay: int | None = None,
        timestamp: float | None = None,
    ) -> bool:
        return False

    def enabled(self, project: "Project") -> bool:
        return False

    @contextmanager
    def digest(self, key: str, minimum_delay: int | None = None) -> Any:
        yield []

    def schedule(
        self, deadline: float, timestamp: float | None = None
    ) -> Iterable["ScheduleEntry"]:
        yield from ()

    def maintenance(self, deadline: float, timestamp: float | None = None) -> None:
        pass
