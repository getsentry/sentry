from typing import Any, NotRequired, TypedDict

from rest_framework import serializers


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
    triggerGroupId: NotRequired[str]
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


class ConditionEvaluationSerializer(serializers.Serializer[Any]):
    conditionId = serializers.CharField(source="condition_id")
    conditionType = serializers.CharField(source="condition_type")
    inputType = serializers.CharField(source="input_type")
    comparison = serializers.CharField()
    # Condition input is opaque product data. Preserve its keys, types, and nulls.
    input = serializers.JSONField()
    triggered = serializers.BooleanField()
    error = serializers.CharField(required=False)
    result = serializers.JSONField(required=False)


class ConditionGroupEvaluationSerializer(serializers.Serializer[Any]):
    triggered = serializers.BooleanField()
    error = serializers.CharField(required=False)
    logicType = serializers.CharField(source="logic_type")
    result = serializers.BooleanField()
    conditionEvaluations = ConditionEvaluationSerializer(source="condition_evaluations", many=True)


class DeferredWorkflowSerializer(serializers.Serializer[Any]):
    triggerGroupId = serializers.CharField(source="trigger_group_id", required=False)
    filterGroupIds = serializers.ListField(source="filter_group_ids", child=serializers.CharField())
    passingFilterGroupIds = serializers.ListField(
        source="passing_filter_group_ids", child=serializers.CharField()
    )


class EvaluationArtifactSerializer(serializers.Serializer[Any]):
    """The same envelope and condition representation for detector and workflow artifacts."""

    id = serializers.CharField(source="item_id")
    traceId = serializers.CharField(source="trace_id")
    timestamp = serializers.DateTimeField()
    projectId = serializers.CharField(source="project_id")
    evaluationType = serializers.CharField(source="evaluation_type")
    outcome = serializers.CharField()
    error = serializers.CharField(required=False)
    detectorId = serializers.CharField(source="detector_id", required=False)
    detectorType = serializers.CharField(source="detector_type", required=False)
    eventId = serializers.CharField(source="event_id", required=False)
    triggered = serializers.BooleanField(required=False)
    groupKey = serializers.CharField(source="group_key", required=False)
    priority = serializers.IntegerField(required=False)
    triggerEvaluation = ConditionGroupEvaluationSerializer(
        source="trigger_evaluation", required=False
    )
    evaluationPhase = serializers.CharField(source="evaluation_phase", required=False)
    workflowId = serializers.CharField(source="workflow_id", required=False)
    groupId = serializers.CharField(source="group_id", required=False)
    filterEvaluations = ConditionGroupEvaluationSerializer(
        source="filter_evaluations", many=True, required=False
    )
    triggeredActionIds = serializers.ListField(
        source="triggered_action_ids", child=serializers.CharField(), required=False
    )
    delayed = DeferredWorkflowSerializer(required=False)
    eventKind = serializers.CharField(source="event_kind", required=False)
    issueStatus = serializers.IntegerField(source="issue_status", required=False)
    issueSubstatus = serializers.IntegerField(source="issue_substatus", required=False)
    issuePriority = serializers.IntegerField(source="issue_priority", required=False)
    environmentId = serializers.CharField(source="environment_id", required=False)
    isResolved = serializers.BooleanField(source="is_resolved", required=False)
    isNew = serializers.BooleanField(source="is_new", required=False)
    isRegression = serializers.BooleanField(source="is_regression", required=False)
    isNewGroupEnvironment = serializers.BooleanField(
        source="is_new_group_environment", required=False
    )
    hasEscalated = serializers.BooleanField(source="has_escalated", required=False)
    activityType = serializers.JSONField(source="activity_type", required=False)
