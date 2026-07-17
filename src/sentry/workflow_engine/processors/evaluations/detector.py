from dataclasses import dataclass
from typing import Any, TypedDict

from sentry.workflow_engine.types import DetectorGroupKey, DetectorPriorityLevel, DetectorResult

from .base import BaseWorkflowEngineEvaluation
from .condition_group import DataConditionGroupEvaluation


class DetectorEvaluationData(TypedDict):
    group_key: DetectorGroupKey
    trigger_group_evaluation: DataConditionGroupEvaluation
    event_data: dict[str, Any] | None


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
        or if it will send an update to an existing Issue (StatusChangeMessage). May be None when a
        detector triggers without an accompanying occurrence/status change.
    - data: DetectorEvaluationData - This data includes the group key, the evaluation of the Detector
        triggers (DataConditionGroupEvaluation), and the event data that triggered the detector evaluation.
    - error: ConditionError - An error during the processing of the conditions in the trigger group.
    - triggered: bool - If there is an event that should trigger the next phase in the system.
    """

    result: DetectorResult = None
    priority: DetectorPriorityLevel
