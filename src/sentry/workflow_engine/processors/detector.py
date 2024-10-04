import abc
import dataclasses
from typing import TypeVar, Generic

from sentry.workflow_engine.models import Detector
from sentry.workflow_engine.models.data_source import DataPacket

T = TypeVar("T")


class DetectorHandler(abc.ABC, Generic[T]):
    def __init__(self, detector: Detector):
        self.detector = detector

    @abc.abstractmethod
    def evaluate(self, data_packet: T):
        pass


def process_detectors(data_packet: DataPacket, detectors: list[Detector]):
    for detector in detectors:
        detector.evaluate(data_packet)



@dataclasses.dataclass(frozen=True)
class DetectorEvaluationResult:
    pass