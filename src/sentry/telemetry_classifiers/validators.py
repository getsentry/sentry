from __future__ import annotations

from typing import Any

from rest_framework import serializers

from sentry.api.serializers.rest_framework import CamelSnakeSerializer
from sentry.api.serializers.rest_framework.project import ProjectField
from sentry.auth.principal import acting_user_id
from sentry.telemetry_classifiers.models import (
    TelemetryClassifier,
    TelemetryClassifierDataset,
    TelemetryClassifierStatus,
)

_CUSTOM_CLASSIFIER_FIELDS = {"natural_language_prompt", "output_type"}


class TelemetryClassifierValidator(CamelSnakeSerializer[TelemetryClassifier]):
    project = ProjectField(
        scope="project:read",
        id_allowed=True,
        help_text="The ID or slug of the project the classifier runs on.",
    )
    name = serializers.CharField(max_length=256)
    result_attribute = serializers.CharField(
        max_length=256,
        help_text="The attribute the classifier writes its result to. Must be unique per project.",
    )
    dataset = serializers.ChoiceField(choices=TelemetryClassifierDataset.choices)
    filter_query = serializers.CharField(
        required=False,
        allow_blank=True,
        default="",
        help_text="Search query selecting the telemetry to classify.",
    )
    status = serializers.ChoiceField(
        choices=TelemetryClassifierStatus.choices,
        default=TelemetryClassifierStatus.ENABLED,
    )
    prebuilt_classifier_key = serializers.CharField(
        max_length=256,
        help_text="Key of the prebuilt classifier to run.",
    )

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        # TODO: Support custom classifiers once their prompts can be compiled.
        if _CUSTOM_CLASSIFIER_FIELDS & self.initial_data.keys():
            raise serializers.ValidationError("Custom classifiers aren't supported yet.")

        if TelemetryClassifier.objects.filter(
            project=attrs["project"], result_attribute=attrs["result_attribute"]
        ).exists():
            raise serializers.ValidationError(
                {"result_attribute": "Another classifier in this project uses this attribute."}
            )

        return attrs

    def create(self, validated_data: dict[str, Any]) -> TelemetryClassifier:
        return TelemetryClassifier.objects.create(
            **validated_data,
            created_by_id=acting_user_id(self.context["request"].user),
        )
