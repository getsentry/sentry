from collections.abc import Generator, Iterable, Mapping
from contextlib import ExitStack, contextmanager
from typing import Any

from sentry.digests.backends.base import Backend, InvalidState, ScheduleEntry, load
from sentry.digests.types import Record


class MigratingBackend(Backend):
    """
    Moves digests from one backend to another. New records go to ``new``, while ``old`` is
    still scheduled and digested until it drains.
    """

    def __init__(self, old: Mapping[str, Any], new: Mapping[str, Any]) -> None:
        super().__init__()
        self.old = load(old)
        self.new = load(new)

    def validate(self) -> None:
        self.old.validate()
        self.new.validate()

    def add(
        self,
        key: str,
        record: Record,
        increment_delay: int | None = None,
        maximum_delay: int | None = None,
        timestamp: float | None = None,
    ) -> bool:
        return self.new.add(key, record, increment_delay, maximum_delay, timestamp)

    @contextmanager
    def digest(self, key: str, minimum_delay: int | None = None) -> Generator[list[Record]]:
        with ExitStack() as stack:
            # Only entering is guarded, so InvalidState from the caller's block isn't retried on new
            try:
                records = stack.enter_context(self.old.digest(key, minimum_delay))
            except InvalidState:
                records = stack.enter_context(self.new.digest(key, minimum_delay))
            yield records

    def schedule(self, deadline: float, timestamp: float | None = None) -> Iterable[ScheduleEntry]:
        yield from self.old.schedule(deadline, timestamp)
        yield from self.new.schedule(deadline, timestamp)

    def maintenance(self, deadline: float, timestamp: float | None = None) -> None:
        self.old.maintenance(deadline, timestamp)
        self.new.maintenance(deadline, timestamp)

    def delete(self, key: str) -> None:
        self.old.delete(key)
        self.new.delete(key)
