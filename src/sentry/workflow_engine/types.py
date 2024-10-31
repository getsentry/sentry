from __future__ import annotations

from enum import IntEnum

from sentry.types.group import PriorityLevel


class DetectorPriorityLevel(IntEnum):
    OK = 0
    LOW = PriorityLevel.LOW
    MEDIUM = PriorityLevel.MEDIUM
    HIGH = PriorityLevel.HIGH
