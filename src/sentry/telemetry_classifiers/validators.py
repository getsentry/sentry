from __future__ import annotations

from typing import Any

from rest_framework import serializers

from sentry.api.serializers.rest_framework import CamelSnakeSerializer
from sentry.api.serializers.rest_framework.project import ProjectField
from sentry.auth.principal import acting_user_id
from sentry.telemetry_classifiers.models import (
    TelemetryClassifier,
    TelemetryClassifierDataset,
    TelemetryClassifierOutputType,
    TelemetryClassifierStatus,
)


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
        required=False,
        help_text="Defaults to enabled for prebuilt classifiers and disabled for custom ones.",
    )
    prebuilt_classifier_key = serializers.CharField(
        max_length=256,
        required=False,
        help_text="Key of a prebuilt classifier. Mutually exclusive with naturalLanguagePrompt and outputType.",
    )
    natural_language_prompt = serializers.CharField(
        required=False,
        help_text="What a custom classifier should detect. Requires outputType.",
    )
    output_type = serializers.ChoiceField(
        choices=TelemetryClassifierOutputType.choices,
        required=False,
        help_text="The result shape of a custom classifier. Requires naturalLanguagePrompt.",
    )

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        is_prebuilt = "prebuilt_classifier_key" in attrs
        custom_fields = {"natural_language_prompt", "output_type"} & attrs.keys()

        if is_prebuilt and custom_fields:
            raise serializers.ValidationError(
                "Set either prebuiltClassifierKey or naturalLanguagePrompt and outputType, not both."
            )
        if not is_prebuilt and len(custom_fields) != 2:
            raise serializers.ValidationError(
                "Set prebuiltClassifierKey, or both naturalLanguagePrompt and outputType."
            )

        if is_prebuilt:
            attrs.setdefault("status", TelemetryClassifierStatus.ENABLED)
        else:
            # A custom classifier only runs once its prompt is compiled, and nothing compiles
            # prompts at creation time yet.
            if attrs.get("status") == TelemetryClassifierStatus.ENABLED:
                raise serializers.ValidationError(
                    {"status": "A custom classifier can't be enabled until its prompt is compiled."}
                )
            attrs["status"] = TelemetryClassifierStatus.DISABLED

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
