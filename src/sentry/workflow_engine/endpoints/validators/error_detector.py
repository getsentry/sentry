from django.db import router, transaction
from rest_framework import serializers

from sentry import audit_log
from sentry.api.fields.empty_integer import EmptyIntegerField
from sentry.models.project import Project
from sentry.utils.audit import create_audit_entry
from sentry.workflow_engine.endpoints.validators import BaseGroupTypeDetectorValidator
from sentry.workflow_engine.models.detector import Detector, ErrorDetector


class ErrorDetectorValidator(BaseGroupTypeDetectorValidator):
    groupingEnhancements = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    fingerprintingRules = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    resolveAge = EmptyIntegerField(
        required=False,
        allow_null=True,
        help_text="Automatically resolve an issue if it hasn't been seen for this many hours. Set to `0` to disable auto-resolve.",
    )

    def create(self, validated_data):
        with transaction.atomic(router.db_for_write(Detector)):
            detector: ErrorDetector = ErrorDetector.objects.create(
                project_id=self.context["project"].id,
                organization_id=self.context["project"].organization_id,
                name=validated_data["name"],
                # no workflow_condition_group
                type=validated_data["group_type"].slug,
            )

            project: Project | None = detector.project
            if project:
                # update configs, which are project options. continue using them
                for config in validated_data:
                    project.update_option(
                        detector.project_options_config[config], validated_data[config]
                    )

            create_audit_entry(
                request=self.context["request"],
                organization=self.context["organization"],
                target_object=detector.id,
                event=audit_log.get_event_id("DETECTOR_ADD"),
                data=detector.get_audit_log_data(),
            )
        return detector
