import abc
import dataclasses
import logging
from typing import Any, Generic, TypeVar

from sentry.types.group import PriorityLevel
from sentry.workflow_engine.models import Detector
from sentry.workflow_engine.models.data_source import DataPacket
from sentry.workflow_engine.models.detector_state import DetectorStatus

T = TypeVar("T")

logger = logging.getLogger(__name__)


@dataclasses.dataclass(frozen=True)
class DetectorStateData:
    group_key: str | None
    active: bool
    status: DetectorStatus
    # Stateful detectors always process data packets in order. Once we confirm that a data packet has been fully
    # processed and all workflows have been done, this value will be used by the stateful detector to prevent
    # reprocessing
    dedupe_value: int
    # Stateful detectors allow various counts to be tracked. We need to update these after we process workflows, so
    # include the updates in the state
    counter_updates: dict[str, int]


@dataclasses.dataclass(frozen=True)
class DetectorEvaluationResult:
    is_active: bool
    priority: PriorityLevel
    data: Any
    state_update_data: DetectorStateData | None = None


class DetectorHandler(abc.ABC, Generic[T]):
    def __init__(self, detector: Detector):
        self.detector = detector

    @abc.abstractmethod
    def evaluate(self, data_packet: T) -> list[DetectorEvaluationResult]:
        pass


def process_detectors(
    data_packet: DataPacket, detectors: list[Detector]
) -> list[tuple[Detector, list[DetectorEvaluationResult]]]:
    results = []
    for detector in detectors:
        handler = detector.detector_handler
        if not handler:
            continue
        detector_results = handler.evaluate(data_packet)
        detector_group_keys = set()
        for result in detector_results:
            if result.state_update_data:
                if result.state_update_data.group_key in detector_group_keys:
                    # This shouldn't happen - log an error and continue on, but we should investigate this.
                    logger.error(
                        "Duplicate detector state group keys found",
                        extra={
                            "detector_id": detector.id,
                            "group_key": result.state_update_data.group_key,
                        },
                    )
                detector_group_keys.add(result.state_update_data.group_key)

        if detector_results:
            results.append((detector, detector_results))

    return results
