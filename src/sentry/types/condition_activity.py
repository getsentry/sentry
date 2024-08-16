from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Any

FREQUENCY_CONDITION_BUCKET_SIZE = timedelta(minutes=5)


class ConditionActivityType(Enum):
    CREATE_ISSUE = 0
    REGRESSION = 1
    REAPPEARED = 2
    # condition activity created from frequency condition buckets
    FREQUENCY_CONDITION = 3
    NEW_HIGH_PRIORITY_ISSUE = 4
    EXISTING_HIGH_PRIORITY_ISSUE = 5


@dataclass
class ConditionActivity:
    group_id: int
    type: ConditionActivityType
    timestamp: datetime
    data: dict[str, Any] = field(default_factory=dict)


def round_to_five_minute(time: datetime) -> datetime:
    return time - timedelta(
        minutes=time.minute % 5, seconds=time.second, microseconds=time.microsecond
    )
