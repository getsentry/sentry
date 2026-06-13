from datetime import datetime
from enum import StrEnum
from typing import Any

from sentry.issues.derived.framework import Codec, Feature


class IssueStatus(StrEnum):
    OPEN = "open"
    CLOSED = "closed"


class Progress(StrEnum):
    """Where an open issue is in the journey toward resolution."""

    IDENTIFIED = "identified"
    TRIAGED = "triaged"
    DIAGNOSED = "diagnosed"
    FIX_PROPOSED = "fix_proposed"
    FIX_APPLIED = "fix_applied"
    REGRESSED = "regressed"


class EnumCodec[E: StrEnum](Codec[E]):
    def __init__(self, enum_cls: type[E]) -> None:
        self._enum_cls = enum_cls

    def load(self, raw: Any) -> E:
        return self._enum_cls(raw)

    def dump(self, value: E) -> str:
        return value.value


class OptionalCodec[T](Codec[T | None]):
    def __init__(self, inner: Codec[T]) -> None:
        self._inner = inner

    def load(self, raw: Any) -> T | None:
        return self._inner.load(raw) if raw is not None else None

    def dump(self, value: T | None) -> Any:
        return self._inner.dump(value) if value is not None else None


VIEW_COUNT = Feature[int]("view_count", default=0)
STATUS = Feature[IssueStatus]("status", default=IssueStatus.OPEN, codec=EnumCodec(IssueStatus))
PROGRESS = Feature[Progress | None](
    "progress", default=Progress.IDENTIFIED, codec=OptionalCodec(EnumCodec(Progress))
)
LAST_PROGRESSED_AT = Feature[datetime | None]("last_progressed_at", default=None)
