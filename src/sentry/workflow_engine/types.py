from __future__ import annotations

from enum import IntEnum
from typing import TYPE_CHECKING, Any, ClassVar, Generic, TypedDict, TypeVar

from sentry.types.group import PriorityLevel

if TYPE_CHECKING:
    from sentry.eventstore.models import GroupEvent
    from sentry.eventstream.base import GroupState
    from sentry.workflow_engine.models import Action, Detector, Workflow

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


class EventJob(TypedDict):
    event: GroupEvent


class WorkflowJob(EventJob, total=False):
    group_state: GroupState
    is_reprocessed: bool
    has_reappeared: bool
    has_alert: bool
    has_escalated: bool
    workflow: Workflow
    snuba_results: list[int]


class ActionHandler:
    @staticmethod
    def execute(job: WorkflowJob, action: Action, detector: Detector) -> None:
        raise NotImplementedError


class DataSourceTypeHandler(Generic[T]):
    @staticmethod
    def bulk_get_query_object(data_sources) -> dict[int, T | None]:
        raise NotImplementedError


class DataConditionHandler(Generic[T]):
    comparison_json_schema: ClassVar[dict[str, Any]] = {}

    @staticmethod
    def evaluate_value(value: T, comparison: Any) -> DataConditionResult:
        raise NotImplementedError
