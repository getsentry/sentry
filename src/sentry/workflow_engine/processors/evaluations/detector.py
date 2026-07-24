from dataclasses import dataclass
from typing import Any, TypedDict

from sentry.workflow_engine.types import DetectorGroupKey, DetectorPriorityLevel, DetectorResult

from .base import BaseWorkflowEngineEvaluation
from .condition_group import DataConditionGroupEvaluation


class DetectorEvaluationData(TypedDict):
    group_key: DetectorGroupKey
    trigger_group_evaluation: DataConditionGroupEvaluation
    event_data: dict[str, Any] | None  # TODO - improve this typing, for now migrating


@dataclass(frozen=True, kw_only=True)
class DetectorEvaluation(
    BaseWorkflowEngineEvaluation[
        DetectorResult,
        DetectorEvaluationData,
    ]
):
    """
    Defines the Evaluation of a Detector.

    Properties
    - priority: DetectorPriorityLevel - The resulting priority for the detector

    Inherited properties
    - result: DetectorResult - The information to send to the issue platforms Kafka topic,
        each individual DetectorHandler will determine if they should create a new issue (IssueOccurrence)
        or if it will send an update to an existing Issue (StatusChangeMessage). Set to None when the detector
        is not triggered. By default this is set to None, to signify a detector's not expected to be triggered.
    - data: DetectorEvaluationData - This data includes the group key (DetectorGroupKey), the evaluation of the Detector
        triggers (DataConditionGroupEvaluation), and the event data (dict) that triggered the detector evaluation.
    - error: ConditionError - An error during the processing of the conditions in the trigger group.
    - triggered: bool - If there is an event that should trigger the next phase in the system.
    """

    log_name = "detector"

    result: DetectorResult = None
    priority: DetectorPriorityLevel

    def to_artifact(self) -> dict[str, Any]:
        return {
            "group_key": self.data["group_key"],
            # priority is a DetectorPriorityLevel enum; unwrap to its value.
            "priority": getattr(self.priority, "value", self.priority),
            # result is an IssueOccurrence / StatusChangeMessage / None; log its type, not the payload.
            "result": type(self.result).__name__ if self.result is not None else None,
            "triggered": self.triggered,
            "error": self.error_message(),
            "trigger_group_evaluation": self.data["trigger_group_evaluation"].to_artifact(),
        }
