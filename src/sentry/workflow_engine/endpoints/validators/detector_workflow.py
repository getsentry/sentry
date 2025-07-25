from collections.abc import Sequence
from typing import Literal

from django.db import IntegrityError, router, transaction
from django.db.models import QuerySet
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied
from rest_framework.request import Request

from sentry import audit_log
from sentry.api.serializers.rest_framework.base import CamelSnakeSerializer
from sentry.models.organization import Organization
from sentry.utils.audit import create_audit_entry
from sentry.workflow_engine.models.detector import Detector
from sentry.workflow_engine.models.detector_workflow import DetectorWorkflow
from sentry.workflow_engine.models.workflow import Workflow


def can_edit_detector(detector: Detector, request: Request) -> bool:
    """
    Determine if the requesting user has access to detector edit. If the request does not have the "alerts:write"
    permission, then we must verify that the user is a team admin with "alerts:write" access to the project(s)
    in their request.
    """
    # if the requesting user has any of these org-level permissions, then they can create an alert
    if request.access.has_scope("org:admin") or request.access.has_scope("org:write"):
        return True

    project = detector.project

    if request.access.has_project_scope(project, "alerts:write"):
        # team admins can modify all detectors for projects they have access to
        has_team_admin_access = request.access.has_project_scope(project, "project:write")
        if has_team_admin_access:
            return True
        # members can modify user-created detectors for projects they have access to
        has_project_access = request.access.has_project_scope(project, "project:read")
        if has_project_access and detector.created_by_id is not None:
            return True

    return False


def validate_detectors_exist_and_have_permissions(
    detector_ids: list[int], organization: Organization, request: Request
) -> QuerySet[Detector]:
    detectors = Detector.objects.filter(
        project__organization=organization,
        id__in=detector_ids,
    )
    found_detector_ids = set(detectors.values_list("id", flat=True))
    missing_detector_ids = set(detector_ids) - found_detector_ids

    if missing_detector_ids:
        raise serializers.ValidationError(f"Some detectors do not exist: {missing_detector_ids}")

    for detector in detectors:
        if not can_edit_detector(detector, request):
            raise PermissionDenied

    return detectors


def validate_workflows_exist(
    workflow_ids: list[int], organization: Organization
) -> QuerySet[Workflow]:
    workflows = Workflow.objects.filter(organization=organization, id__in=workflow_ids)
    found_workflow_ids = set(workflows.values_list("id", flat=True))
    missing_workflow_ids = set(workflow_ids) - found_workflow_ids

    if missing_workflow_ids:
        raise serializers.ValidationError(f"Some workflows do not exist: {missing_workflow_ids}")

    return workflows


def perform_bulk_detector_workflow_operations(
    detector_workflows_to_add: list[dict[Literal["detector_id", "workflow_id"], int]],
    detector_workflows_to_remove: Sequence[DetectorWorkflow],
    request: Request,
    organization: Organization,
):
    created_detector_workflows: list[DetectorWorkflow] = []

    with transaction.atomic(router.db_for_write(DetectorWorkflow)):
        if detector_workflows_to_remove:
            DetectorWorkflow.objects.filter(
                id__in=[detector_workflow.id for detector_workflow in detector_workflows_to_remove]
            ).delete()

        if detector_workflows_to_add:
            created_detector_workflows = DetectorWorkflow.objects.bulk_create(
                [
                    DetectorWorkflow(
                        detector_id=pair["detector_id"], workflow_id=pair["workflow_id"]
                    )
                    for pair in detector_workflows_to_add
                ]
            )

    for detector_workflow in detector_workflows_to_remove:
        create_audit_entry(
            request=request,
            organization=organization,
            target_object=detector_workflow.id,
            event=audit_log.get_event_id("DETECTOR_WORKFLOW_REMOVE"),
            data=detector_workflow.get_audit_log_data(),
        )

    for detector_workflow in created_detector_workflows:
        create_audit_entry(
            request=request,
            organization=organization,
            target_object=detector_workflow.id,
            event=audit_log.get_event_id("DETECTOR_WORKFLOW_ADD"),
            data=detector_workflow.get_audit_log_data(),
        )


class DetectorWorkflowValidator(CamelSnakeSerializer):
    detector_id = serializers.IntegerField(required=True)
    workflow_id = serializers.IntegerField(required=True)

    def create(self, validated_data):
        with transaction.atomic(router.db_for_write(DetectorWorkflow)):
            try:
                detector = Detector.objects.get(
                    project__organization=self.context["organization"],
                    id=validated_data["detector_id"],
                )
                if not can_edit_detector(detector, self.context["request"]):
                    raise PermissionDenied
                workflow = Workflow.objects.get(
                    organization=self.context["organization"], id=validated_data["workflow_id"]
                )
            except (Detector.DoesNotExist, Workflow.DoesNotExist) as e:
                raise serializers.ValidationError(str(e))

            try:
                detector_workflow = DetectorWorkflow.objects.create(
                    detector=detector, workflow=workflow
                )
            except IntegrityError as e:
                raise serializers.ValidationError(str(e))

            create_audit_entry(
                request=self.context["request"],
                organization=self.context["organization"],
                target_object=detector_workflow.id,
                event=audit_log.get_event_id("DETECTOR_WORKFLOW_ADD"),
                data=detector_workflow.get_audit_log_data(),
            )

        return detector_workflow


class BulkDetectorWorkflowsValidator(CamelSnakeSerializer):
    """
    Connect/disconnect multiple workflows to a single detector all at once.
    """

    detector_id = serializers.IntegerField(required=True)
    workflow_ids = serializers.ListField(child=serializers.IntegerField(), required=True)

    def create(self, validated_data):
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


class BulkWorkflowDetectorsValidator(CamelSnakeSerializer):
    """
    Connect/disconnect multiple detectors to a single workflow all at once.
    """

    workflow_id = serializers.IntegerField(required=True)
    detector_ids = serializers.ListField(child=serializers.IntegerField(), required=True)

    def create(self, validated_data):
        validate_workflows_exist([validated_data["workflow_id"]], self.context["organization"])
        validate_detectors_exist_and_have_permissions(
            validated_data["detector_ids"], self.context["organization"], self.context["request"]
        )

        existing_detector_workflows = list(
            DetectorWorkflow.objects.filter(
                workflow_id=validated_data["workflow_id"],
            )
        )
        new_detector_ids = set(validated_data["detector_ids"]) - {
            dw.detector_id for dw in existing_detector_workflows
        }

        detector_workflows_to_add: list[dict[Literal["detector_id", "workflow_id"], int]] = [
            {"detector_id": detector_id, "workflow_id": validated_data["workflow_id"]}
            for detector_id in new_detector_ids
        ]
        detector_workflows_to_remove = [
            dw
            for dw in existing_detector_workflows
            if dw.detector_id not in validated_data["detector_ids"]
        ]

        perform_bulk_detector_workflow_operations(
            detector_workflows_to_add,
            detector_workflows_to_remove,
            self.context["request"],
            self.context["organization"],
        )

        return list(DetectorWorkflow.objects.filter(workflow_id=validated_data["workflow_id"]))
