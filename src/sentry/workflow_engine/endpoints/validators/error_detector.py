from django.db import router, transaction
from rest_framework import serializers

from sentry import audit_log
from sentry.api.fields.empty_integer import EmptyIntegerField
from sentry.grouping.fingerprinting import FingerprintingRules, InvalidFingerprintingConfig
from sentry.models.project import Project
from sentry.utils.audit import create_audit_entry
from sentry.workflow_engine.endpoints.validators.base import BaseGroupTypeDetectorValidator
from sentry.workflow_engine.models.detector import Detector


class ErrorDetectorValidator(BaseGroupTypeDetectorValidator):
    fingerprinting_rules = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    resolve_age = EmptyIntegerField(
        required=False,
        allow_null=True,
        help_text="Automatically resolve an issue if it hasn't been seen for this many hours. Set to `0` to disable auto-resolve.",
    )

    def validate_group_type(self, value: str):
        detector_type = super().validate_group_type(value)
        if detector_type.slug != "error":
            raise serializers.ValidationError("Group type must be error")

        return detector_type

    def validate_fingerprinting_rules(self, value):
        if not value:
            return value

        try:
            FingerprintingRules.from_config_string(value)
        except InvalidFingerprintingConfig as e:
            raise serializers.ValidationError(str(e))

        return value

    def validate_resolve_age(self, value):
        if value is not None and value < 0:
            raise serializers.ValidationError("Resolve age must be a non-negative number")

        return value

    def create(self, validated_data):
        with transaction.atomic(router.db_for_write(Detector)):
            detector = Detector.objects.create(
                project_id=self.context["project"].id,
                organization_id=self.context["project"].organization_id,
                name=validated_data["name"],
                # no workflow_condition_group
                type=validated_data["group_type"].slug,
                config={},
            )

            project: Project | None = detector.project
            if not project:
                raise serializers.ValidationError("Error detector must have a project")

            # update configs, which are project options. continue using them
            for config in validated_data:
                if config in Detector.error_detector_project_options:
                    project.update_option(
                        Detector.error_detector_project_options[config], validated_data[config]
                    )

            create_audit_entry(
                request=self.context["request"],
                organization=self.context["organization"],
                target_object=detector.id,
                event=audit_log.get_event_id("WORKFLOW_ENGINE_DETECTOR_ADD"),
                data=detector.get_audit_log_data(),
            )
        return detector
