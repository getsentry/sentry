from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import Any, Dict


class ActivityType(Enum):
    CREATE_ISSUE = 0


@dataclass(frozen=True)
class ConditionActivity:
    group_id: str
    # potentially can have multiple types if even more conditions are supported
    type: ActivityType
    timestamp: datetime
    data: Dict[str, Any] | None = None
