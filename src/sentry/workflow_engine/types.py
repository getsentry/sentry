from __future__ import annotations

from enum import IntEnum, StrEnum
from typing import Any, Generic, TypeVar

from sentry.types.group import PriorityLevel

T = TypeVar("T")


class DetectorPriorityLevel(IntEnum):
    OK = 0
    LOW = PriorityLevel.LOW
    MEDIUM = PriorityLevel.MEDIUM
    HIGH = PriorityLevel.HIGH


# The unique key used to identify a group within a DataPacket result.
# For DataPackets that don't contain multiple values the key is just None.
# This is stored in 'DetectorState.detector_group_key'
DetectorGroupKey = str | None

DataConditionResult = DetectorPriorityLevel | int | float | bool | None
ProcessedDataConditionResult = tuple[bool, list[DataConditionResult]]


class DataSourceTypeHandler(Generic[T]):
    @staticmethod
    def bulk_get_query_object(data_sources) -> dict[int, T | None]:
        raise NotImplementedError


class DataConditionHandler(Generic[T]):
    @staticmethod
    def evaluate_value(value: T, comparison: Any, condition: str) -> DataConditionResult:
        raise NotImplementedError


class DetectorType(StrEnum):
    ERROR = "ErrorDetector"
