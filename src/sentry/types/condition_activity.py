from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import Any, Dict


class ConditionActivityType(Enum):
    CREATE_ISSUE = 0
    REGRESSION = 1
    REAPPEARED = 2


@dataclass(frozen=True)
class ConditionActivity:
    group_id: str
    # potentially can have multiple types if even more conditions are supported
    type: ConditionActivityType
    timestamp: datetime
    data: Dict[str, Any] | None = None
