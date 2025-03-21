from django.db import IntegrityError, router, transaction
from rest_framework import serializers

from sentry import audit_log
from sentry.api.serializers.rest_framework.base import CamelSnakeSerializer
from sentry.utils.audit import create_audit_entry
from sentry.workflow_engine.models.detector import Detector
from sentry.workflow_engine.models.detector_workflow import DetectorWorkflow
from sentry.workflow_engine.models.workflow import Workflow


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
