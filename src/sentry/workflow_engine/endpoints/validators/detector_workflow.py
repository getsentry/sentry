from typing import Any, Literal

from rest_framework import serializers

from sentry.api.serializers.rest_framework.base import CamelSnakeSerializer
from sentry.workflow_engine.endpoints.validators.utils import (
    perform_bulk_detector_workflow_operations,
    validate_detectors_exist_and_have_permissions,
    validate_workflows_exist,
)
from sentry.workflow_engine.models.detector_workflow import DetectorWorkflow


class BulkDetectorWorkflowsValidator(CamelSnakeSerializer[Any]):
    """
    Connect/disconnect multiple workflows to a single detector all at once.
    """

    detector_id = serializers.IntegerField(required=True)
    workflow_ids = serializers.ListField(child=serializers.IntegerField(), required=True)

    def create(self, validated_data: dict[str, Any]) -> list[DetectorWorkflow]:
        validate_workflows_exist(validated_data["workflow_ids"], self.context["organization"])
        validate_detectors_exist_and_have_permissions(
            [validated_data["detector_id"]], self.context["organization"], self.context["request"]
        )

        existing_detector_workflows = list(
            DetectorWorkflow.objects.filter(
                detector_id=validated_data["detector_id"],
            )
        )
        new_workflow_ids = set(validated_data["workflow_ids"]) - {
            dw.workflow_id for dw in existing_detector_workflows
        }

        detector_workflows_to_add: list[dict[Literal["detector_id", "workflow_id"], int]] = [
            {"detector_id": validated_data["detector_id"], "workflow_id": workflow_id}
            for workflow_id in new_workflow_ids
        ]
        detector_workflows_to_remove = [
            dw
            for dw in existing_detector_workflows
            if dw.workflow_id not in validated_data["workflow_ids"]
        ]

        perform_bulk_detector_workflow_operations(
            detector_workflows_to_add,
            detector_workflows_to_remove,
            self.context["request"],
            self.context["organization"],
        )

        return list(DetectorWorkflow.objects.filter(detector_id=validated_data["detector_id"]))
