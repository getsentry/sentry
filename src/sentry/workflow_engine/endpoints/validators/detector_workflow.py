from django.db import IntegrityError, router, transaction
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied
from rest_framework.request import Request

from sentry import audit_log
from sentry.api.serializers.rest_framework.base import CamelSnakeSerializer
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
    Same as DetectorWorkflowValidator, but for connecting multiple workflows
    to a single detector all at once.
    """

    detector_id = serializers.IntegerField(required=True)
    workflow_ids = serializers.ListField(child=serializers.IntegerField(), required=True)

    def create(self, validated_data) -> list[DetectorWorkflow]:
        if not validated_data["workflow_ids"]:
            return []

        try:
            detector = Detector.objects.get(
                project__organization=self.context["organization"],
                id=validated_data["detector_id"],
            )
            if not can_edit_detector(detector, self.context["request"]):
                raise PermissionDenied
        except Detector.DoesNotExist:
            raise serializers.ValidationError("Detector matching query does not exist.")

        # Validate all workflows exist and belong to organization
        workflows = Workflow.objects.filter(
            organization=self.context["organization"], id__in=validated_data["workflow_ids"]
        )
        found_workflow_ids = set(workflows.values_list("id", flat=True))
        missing_workflow_ids = set(validated_data["workflow_ids"]) - found_workflow_ids

        if missing_workflow_ids:
            raise serializers.ValidationError(
                f"Some workflows do not exist: {missing_workflow_ids}"
            )

        existing_detector_workflows_ids = DetectorWorkflow.objects.filter(
            detector_id=validated_data["detector_id"],
        ).values_list("workflow_id", flat=True)

        workflows_to_add = set(validated_data["workflow_ids"]) - set(
            existing_detector_workflows_ids
        )

        with transaction.atomic(router.db_for_write(DetectorWorkflow)):
            detector_workflows = DetectorWorkflow.objects.bulk_create(
                [
                    DetectorWorkflow(
                        detector_id=validated_data["detector_id"], workflow_id=workflow_id
                    )
                    for workflow_id in workflows_to_add
                ]
            )

            for detector_workflow in detector_workflows:
                create_audit_entry(
                    request=self.context["request"],
                    organization=self.context["organization"],
                    target_object=detector_workflow.id,
                    event=audit_log.get_event_id("DETECTOR_WORKFLOW_ADD"),
                    data=detector_workflow.get_audit_log_data(),
                )

            return detector_workflows
