from collections.abc import Mapping
from typing import Any, TypedDict, int

from sentry.api.serializers import Serializer, register
from sentry.workflow_engine.models import DetectorWorkflow


class DetectorWorkflowResponse(TypedDict):
    id: str
    detectorId: str
    workflowId: str


@register(DetectorWorkflow)
class DetectorWorkflowSerializer(Serializer):
    def serialize(
        self, obj: DetectorWorkflow, attrs: Mapping[str, Any], user, **kwargs
    ) -> DetectorWorkflowResponse:
        return {
            "id": str(obj.id),
            "detectorId": str(obj.detector.id),
            "workflowId": str(obj.workflow.id),
        }
