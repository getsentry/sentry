from typing import Any

from rest_framework import serializers

from sentry.workflow_engine.endpoints.validators.base import BaseDetectorTypeValidator
from sentry.workflow_engine.models import Detector


class PerformanceDetectorValidator(BaseDetectorTypeValidator):
    def validate_type(self, value: str):
        type = super().validate_type(value)
        if not type.slug.startswith("performance_"):
            raise serializers.ValidationError("Detector type must be a performance detector")

        return type

    def validate_condition_group(self, value):
        if value is not None:
            raise serializers.ValidationError(
                "Condition group is not supported for performance detectors"
            )
        return value

    @property
    def data_sources(self) -> serializers.ListField:
        # Performance detectors don't use data sources
        return serializers.ListField(required=False, allow_empty=True, default=list)

    @property
    def data_conditions(self):
        # Performance detectors don't use data conditions
        return None

    def update(self, instance: Detector, validated_data: dict[str, Any]):
        # Update config if provided
        if "config" in validated_data:
            instance.config = validated_data["config"]

        # Call parent update for other fields
        return super().update(instance, validated_data)
