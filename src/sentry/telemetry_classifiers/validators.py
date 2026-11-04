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
        scope="project:write",
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
        if _CUSTOM_CLASSIFIER_FIELDS & self.initial_data.keys() or (
            self.instance is not None and self.instance.prebuilt_classifier_key is None
        ):
            raise serializers.ValidationError("Custom classifiers aren't supported yet.")

        project = attrs.get("project", self.instance.project if self.instance else None)
        if self.instance is not None and project != self.instance.project:
            raise serializers.ValidationError(
                {"project": "Classifiers can't be moved to another project."}
            )

        result_attribute = attrs.get(
            "result_attribute", self.instance.result_attribute if self.instance else None
        )
        conflicts = TelemetryClassifier.objects.filter(
            project=project, result_attribute=result_attribute
        )
        if self.instance is not None:
            conflicts = conflicts.exclude(id=self.instance.id)
        if conflicts.exists():
            raise serializers.ValidationError(
                {"result_attribute": "Another classifier in this project uses this attribute."}
            )

        return attrs

    def create(self, validated_data: dict[str, Any]) -> TelemetryClassifier:
        return TelemetryClassifier.objects.create(
            **validated_data,
            created_by_id=acting_user_id(self.context["request"].user),
        )

    def update(
        self, instance: TelemetryClassifier, validated_data: dict[str, Any]
    ) -> TelemetryClassifier:
        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.save()
        return instance
