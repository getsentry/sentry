from django.db import router, transaction
from rest_framework import serializers

from sentry import audit_log
from sentry.api.fields.empty_integer import EmptyIntegerField
from sentry.grouping.fingerprinting import FingerprintingConfig
from sentry.grouping.fingerprinting.exceptions import InvalidFingerprintingConfig
from sentry.shared_integrations.exceptions import ApiForbiddenError
from sentry.utils.audit import create_audit_entry
from sentry.workflow_engine.endpoints.validators.base import BaseDetectorTypeValidator
from sentry.workflow_engine.models.detector import Detector


class ErrorDetectorValidator(BaseDetectorTypeValidator):
    fingerprinting_rules = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    resolve_age = EmptyIntegerField(
        required=False,
        allow_null=True,
        help_text="Automatically resolve an issue if it hasn't been seen for this many hours. Set to `0` to disable auto-resolve.",
    )

    def validate_type(self, value: str):
        type = super().validate_type(value)
        if type.slug != "error":
            raise serializers.ValidationError("Detector type must be error")

        return type

    def validate_condition_group(self, value):
        if value is not None:
            raise serializers.ValidationError(
                "Condition group is not supported for error detectors"
            )
        return value

    def validate_name(self, value):
        # if name is different from existing, raise an error
        if self.instance and self.instance.name != value:
            raise serializers.ValidationError("Name changes are not supported for error detectors")
        return value

    def validate_fingerprinting_rules(self, value):
        if not value:
            return value

        try:
            FingerprintingConfig.from_config_string(value)
        except InvalidFingerprintingConfig as e:
            raise serializers.ValidationError(str(e))

        return value

    def validate_resolve_age(self, value):
        if value is not None and value < 0:
            raise serializers.ValidationError("Resolve age must be a non-negative number")

        return value

    def create(self, validated_data):
        raise ApiForbiddenError("Creating error detectors is not supported")

    def update(self, instance, validated_data):
        with transaction.atomic(router.db_for_write(Detector)):
            # ignores name update

            project = instance.project
            # update configs, which are project options. continue using them
            for config in validated_data:
                if config in Detector.error_detector_project_options:
                    project.update_option(
                        Detector.error_detector_project_options[config], validated_data[config]
                    )

            create_audit_entry(
                request=self.context["request"],
                organization=self.context["organization"],
                target_object=instance.id,
                event=audit_log.get_event_id("DETECTOR_EDIT"),
                data=instance.get_audit_log_data(),
            )
        return instance
