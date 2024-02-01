from contextlib import contextmanager
from typing import TYPE_CHECKING, Any, Iterable, Optional

from sentry.digests.backends.base import Backend

if TYPE_CHECKING:
    from sentry.digests import Record, ScheduleEntry
    from sentry.models.project import Project


class DummyBackend(Backend):
    def add(
        self,
        key: str,
        record: "Record",
        increment_delay: Optional[int] = None,
        maximum_delay: Optional[int] = None,
        timestamp: Optional[float] = None,
    ) -> bool:
        return False

    def enabled(self, project: "Project") -> bool:
        return False

    @contextmanager
    def digest(self, key: str, minimum_delay: Optional[int] = None) -> Any:
        yield []

    def schedule(
        self, deadline: float, timestamp: Optional[float] = None
    ) -> Iterable["ScheduleEntry"]:
        yield from ()

    def maintenance(self, deadline: float, timestamp: Optional[float] = None) -> None:
        pass
