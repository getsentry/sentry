from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Dict

FREQUENCY_CONDITION_BUCKET_SIZE = timedelta(minutes=5)


class ConditionActivityType(Enum):
    CREATE_ISSUE = 0
    REGRESSION = 1
    REAPPEARED = 2


@dataclass
class ConditionActivity:
    group_id: str
    type: ConditionActivityType
    timestamp: datetime
    data: Dict[str, Any] | None = None


def round_to_five_minute(date: datetime) -> datetime:
    floor = date - timedelta(
        minutes=date.minute % 5, seconds=date.second, microseconds=date.microsecond
    )
    return floor
