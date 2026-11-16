from collections.abc import Mapping
from typing import Any, NotRequired, TypedDict, cast

from rest_framework import serializers

from sentry.api.serializers.rest_framework.base import snake_to_camel_case


class ConditionEvaluationResponse(TypedDict):
    conditionId: str
    conditionType: str
    inputType: str
    comparison: str
    input: Any
    triggered: bool
    error: NotRequired[str]
    result: NotRequired[bool | int | float]


class ConditionGroupEvaluationResponse(TypedDict):
    triggered: bool
    error: NotRequired[str]
    logicType: str
    result: bool
    conditionEvaluations: list[ConditionEvaluationResponse]


class DeferredWorkflowResponse(TypedDict):
    triggerGroupId: NotRequired[str | None]
    filterGroupIds: list[str]
    passingFilterGroupIds: list[str]


class EvaluationArtifactResponseOptional(TypedDict, total=False):
    error: str
    detectorId: str
    detectorType: str
    eventId: str
    triggered: bool
    groupKey: str
    priority: int
    triggerEvaluation: ConditionGroupEvaluationResponse
    evaluationPhase: str
    workflowId: str
    groupId: str
    filterEvaluations: list[ConditionGroupEvaluationResponse]
    triggeredActionIds: list[str]
    delayed: DeferredWorkflowResponse
    eventKind: str
    issueStatus: int
    issueSubstatus: int
    issuePriority: int
    environmentId: str
    isResolved: bool
    isNew: bool
    isRegression: bool
    isNewGroupEnvironment: bool
    hasEscalated: bool
    activityType: str | int


class EvaluationArtifactResponse(EvaluationArtifactResponseOptional):
    id: str
    traceId: str
    timestamp: str
    projectId: str
    evaluationType: str
    outcome: str


def _stringify_id(value: Any) -> Any:
    return str(value) if isinstance(value, int) and not isinstance(value, bool) else value


def _convert(key: str, value: Any) -> Any:
    """camelCase nested keys and stringify integer IDs (`*_id`, `*_ids` elements)."""
    if key == "input":
        # Condition input is opaque product data. Preserve its keys, types, and nulls.
        return value
    if isinstance(value, Mapping):
        return {snake_to_camel_case(k): _convert(k, v) for k, v in value.items()}
    if isinstance(value, list):
        if key.endswith("_ids"):
            return [_stringify_id(v) for v in value]
        return [_convert(key, v) for v in value]
    if key.endswith("_id"):
        return _stringify_id(value)
    return value


def serialize_evaluation_artifact(row: Mapping[str, Any]) -> EvaluationArtifactResponse:
    """The same envelope and condition representation for detector and workflow artifacts."""
    attributes = {k: v for k, v in row.items() if k not in ("item_id", "timestamp")}
    return cast(
        EvaluationArtifactResponse,
        {
            "id": row["item_id"],
            "timestamp": serializers.DateTimeField().to_representation(row["timestamp"]),
            **_convert("", attributes),
        },
    )
