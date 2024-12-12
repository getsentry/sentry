from abc import ABC, abstractmethod
from typing import Generic, TypeVar

from sentry.issues.issue_occurrence import IssueOccurrence
from sentry.workflow_engine.models import DataPacket
from sentry.workflow_engine.processors import process_data_packets
from sentry.workflow_engine.types import DetectorEvaluationResult

T = TypeVar("T")


class WorkflowEngineProcessor(Generic[T], ABC):
    # This could just be cleanup to the DetectorHandler, maybe we just rename the StatfuleDetectorHandler to WorkflowEngineStatefulProcessor and WorkflowEngineProcessor?
    # then we could add some helper methods like process and use it to process the data packets in all the places.

    @abstractmethod
    def build_issue_occurrence(self, result: DetectorEvaluationResult) -> IssueOccurrence:
        # TODO - figure out how we can map the build_occurrence_and_event_data to full results mapping the detector handler
        # TODO - figure out the return type here
        pass

    def process(self, data_packets: list[DataPacket[T]]):
        # TODO - figure out a simplified return type interface
        # can we convert the type to a string or something here? :thinking:
        # maybe we just remove the process_data_packets method and replace it process_* methods
        return process_data_packets[T](data_packets)
