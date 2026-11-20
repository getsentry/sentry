from collections.abc import Mapping
from typing import Annotated, Any, NotRequired, TypedDict, cast

from rest_framework import serializers

from sentry.api.serializers.rest_framework.base import snake_to_camel_case
from sentry.apidocs.descriptions import ApiDescription
from sentry.apidocs.formats import JsonValue


class ConditionEvaluationResponse(TypedDict):
    conditionId: Annotated[str, ApiDescription("ID of the data condition")]
    conditionType: Annotated[str, ApiDescription("Type of the data condition, such as `gt`")]
    inputType: Annotated[str, ApiDescription("Type name of the value the condition evaluated")]
    comparison: Annotated[str, ApiDescription("The condition's comparison value, JSON-encoded")]
    input: Annotated[JsonValue, ApiDescription("The value the condition evaluated")]
    triggered: Annotated[bool, ApiDescription("Whether the condition passed")]
    error: NotRequired[
        Annotated[str, ApiDescription("Error raised while evaluating the condition")]
    ]
    result: NotRequired[
        Annotated[
            bool | int | float,
            ApiDescription("The condition's result, such as a boolean or a priority level"),
        ]
    ]


class ConditionGroupEvaluationResponse(TypedDict):
    triggered: Annotated[bool, ApiDescription("Whether the condition group passed")]
    error: NotRequired[
        Annotated[str, ApiDescription("Error that may have changed the group's result")]
    ]
    logicType: Annotated[
        str, ApiDescription("How the conditions combine: `any`, `any-short`, `all` or `none`")
    ]
    result: Annotated[bool, ApiDescription("Result of combining the condition results")]
    conditionEvaluations: Annotated[
        list[ConditionEvaluationResponse], ApiDescription("Each evaluated condition, in order")
    ]


class DeferredWorkflowResponse(TypedDict):
    triggerGroupId: NotRequired[
        Annotated[
            str | None,
            ApiDescription("ID of the trigger condition group deferred to delayed processing"),
        ]
    ]
    filterGroupIds: Annotated[
        list[str],
        ApiDescription("IDs of the filter condition groups deferred to delayed processing"),
    ]
    passingFilterGroupIds: Annotated[
        list[str], ApiDescription("IDs of the filter condition groups that already passed")
    ]


class EvaluationArtifactResponseOptional(TypedDict, total=False):
    error: Annotated[str, ApiDescription("Error that failed or may have changed the evaluation")]
    detectorId: Annotated[
        str, ApiDescription("ID of the detector that was evaluated or that the workflow ran for")
    ]
    detectorType: Annotated[str, ApiDescription("Type of the detector, such as `error`")]
    eventId: Annotated[
        str, ApiDescription("ID of the evaluated event. For an issue activity, the activity ID")
    ]
    triggered: Annotated[
        bool,
        ApiDescription(
            "Whether the detector group triggered, or whether the workflow's trigger conditions passed"
        ),
    ]
    groupKey: Annotated[
        str, ApiDescription("Key of the detector group, for detectors that evaluate several")
    ]
    priority: Annotated[
        int,
        ApiDescription(
            "Priority the detector group evaluated to: 0 (ok), 25 (low), 50 (medium) or 75 (high)"
        ),
    ]
    triggerEvaluation: Annotated[
        ConditionGroupEvaluationResponse,
        ApiDescription("Evaluation of the detector's or workflow's trigger condition group"),
    ]
    evaluationPhase: Annotated[
        str,
        ApiDescription(
            "When the workflow was evaluated: `initial` with the event, or `delayed` for "
            "conditions evaluated later in batches"
        ),
    ]
    workflowId: Annotated[str, ApiDescription("ID of the evaluated workflow")]
    groupId: Annotated[str, ApiDescription("ID of the issue the workflow was evaluated for")]
    filterEvaluations: Annotated[
        list[ConditionGroupEvaluationResponse],
        ApiDescription("Evaluations of the workflow's filter condition groups"),
    ]
    triggeredActionIds: Annotated[
        list[str], ApiDescription("IDs of the actions the workflow fired")
    ]
    delayed: Annotated[
        DeferredWorkflowResponse,
        ApiDescription("Condition groups the workflow deferred to delayed processing"),
    ]
    eventKind: Annotated[
        str, ApiDescription("What the workflow evaluated: `group_event` or `activity`")
    ]
    issueStatus: Annotated[int, ApiDescription("Status of the issue when evaluated")]
    issueSubstatus: Annotated[int, ApiDescription("Substatus of the issue when evaluated")]
    issuePriority: Annotated[int, ApiDescription("Priority of the issue when evaluated")]
    environmentId: Annotated[str, ApiDescription("ID of the environment the workflow ran for")]
    isResolved: Annotated[bool, ApiDescription("Whether the issue was resolved when evaluated")]
    isNew: Annotated[bool, ApiDescription("Whether the event created the issue")]
    isRegression: Annotated[bool, ApiDescription("Whether the event regressed the issue")]
    isNewGroupEnvironment: Annotated[
        bool, ApiDescription("Whether the event was the issue's first in its environment")
    ]
    hasEscalated: Annotated[bool, ApiDescription("Whether the issue escalated")]
    activityType: Annotated[
        str | int,
        ApiDescription(
            "Type of the evaluated issue activity, such as `set_resolved`. "
            "An unknown type is its numeric ID"
        ),
    ]


class EvaluationArtifactResponse(EvaluationArtifactResponseOptional):
    id: Annotated[str, ApiDescription("ID of the evaluation artifact")]
    traceId: Annotated[
        str,
        ApiDescription(
            "Shared by artifacts from the same project and event, or issue or detector "
            "when there's no event"
        ),
    ]
    timestamp: Annotated[str, ApiDescription("When the evaluation was recorded")]
    projectId: Annotated[str, ApiDescription("ID of the project")]
    evaluationType: Annotated[str, ApiDescription("What was evaluated: `detector` or `workflow`")]
    outcome: Annotated[str, ApiDescription("Outcome of the evaluation, such as `triggered`")]


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
