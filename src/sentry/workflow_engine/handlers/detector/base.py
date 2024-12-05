import abc
import dataclasses
import logging
from typing import Any, Generic, TypeVar

from sentry.issues.issue_occurrence import IssueOccurrence
from sentry.issues.status_change_message import StatusChangeMessage
from sentry.workflow_engine.models import DataConditionGroup, DataPacket, Detector
from sentry.workflow_engine.types import DetectorGroupKey, DetectorPriorityLevel

logger = logging.getLogger(__name__)
T = TypeVar("T")


@dataclasses.dataclass(frozen=True)
class DetectorEvaluationResult:
    group_key: DetectorGroupKey
    # TODO: Are these actually necessary? We're going to produce the occurrence in the detector, so we probably don't
    # need to know the other results externally
    is_active: bool
    priority: DetectorPriorityLevel
    # TODO: This is only temporarily optional. We should always have a value here if returning a result
    result: IssueOccurrence | StatusChangeMessage | None = None
    # Event data to supplement the `IssueOccurrence`, if passed.
    event_data: dict[str, Any] | None = None


@dataclasses.dataclass(frozen=True)
class DetectorStateData:
    group_key: DetectorGroupKey
    active: bool
    status: DetectorPriorityLevel
    # Stateful detectors always process data packets in order. Once we confirm that a data packet has been fully
    # processed and all workflows have been done, this value will be used by the stateful detector to prevent
    # reprocessing
    dedupe_value: int
    # Stateful detectors allow various counts to be tracked. We need to update these after we process workflows, so
    # include the updates in the state.
    # This dictionary is in the format {counter_name: counter_value, ...}
    # If a counter value is `None` it means to unset the value
    counter_updates: dict[str, int | None]


class DetectorHandler(abc.ABC, Generic[T]):
    def __init__(self, detector: Detector):
        self.detector = detector
        if detector.workflow_condition_group_id is not None:
            try:
                group = DataConditionGroup.objects.get_from_cache(
                    id=detector.workflow_condition_group_id
                )
                self.condition_group: DataConditionGroup | None = group
            except DataConditionGroup.DoesNotExist:
                logger.exception(
                    "Failed to find the data condition group for detector",
                    extra={"detector_id": detector.id},
                )
                self.condition_group = None
        else:
            self.condition_group = None

    @abc.abstractmethod
    def evaluate(
        self, data_packet: DataPacket[T]
    ) -> dict[DetectorGroupKey, DetectorEvaluationResult]:
        pass

    def commit_state_updates(self):
        pass
