from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import Any, Mapping, MutableMapping, Optional

MIN_DATA_POINTS = 6


class TrendType(Enum):
    Regressed = "regressed"
    Improved = "improved"
    Unchanged = "unchanged"


@dataclass
class TrendState:
    timestamp: Optional[datetime]
    count: int
    short_ma: float
    long_ma: float

    VERSION: int = 1

    FIELD_VERSION = "V"
    FIELD_TIMESTAMP = "T"
    FIELD_COUNT = "N"
    FIELD_SHORT_TERM = "S"
    FIELD_LONG_TERM = "L"

    def as_dict(self) -> Mapping[str | bytes, str | float | int]:
        d: MutableMapping[str | bytes, str | float | int] = {
            TrendState.FIELD_VERSION: self.VERSION,
            TrendState.FIELD_COUNT: self.count,
            TrendState.FIELD_SHORT_TERM: self.short_ma,
            TrendState.FIELD_LONG_TERM: self.long_ma,
        }
        if self.timestamp is not None:
            d[TrendState.FIELD_TIMESTAMP] = self.timestamp.isoformat()
        return d

    @classmethod
    def from_dict(cls, d: Any) -> TrendState:
        try:
            version = int(d.get(TrendState.FIELD_VERSION, 0))
        except ValueError:
            version = 0

        if version != cls.VERSION:
            return TrendState(None, 0, 0, 0)

        try:
            count = int(d.get(TrendState.FIELD_COUNT, 0))
        except ValueError:
            count = 0

        try:
            short_ma = float(d.get(TrendState.FIELD_SHORT_TERM, 0))
        except ValueError:
            short_ma = 0

        try:
            long_ma = float(d.get(TrendState.FIELD_LONG_TERM, 0))
        except ValueError:
            long_ma = 0

        try:
            timestamp = datetime.fromisoformat(d.get(TrendState.FIELD_TIMESTAMP, ""))
        except ValueError:
            timestamp = None

        return TrendState(timestamp, count, short_ma, long_ma)


@dataclass
class TrendPayload:
    group: str | int
    count: float
    value: float
    timestamp: datetime
