from __future__ import annotations

from typing import Any

from rest_framework import serializers

from sentry.investigations.endpoints.validators.base import StrictCamelSnakeValidator
from sentry.investigations.endpoints.validators.orchestration import (
    _validate_time_range,
    validate_agentic_source,
    validate_object_reference,
)
from sentry.investigations.models import InvestigationStatus


class InvestigationCreateValidator(StrictCamelSnakeValidator):
    title = serializers.CharField(max_length=255, required=False)
    template_key = serializers.CharField(max_length=128, required=False)
    template_version = serializers.IntegerField(min_value=1, required=False)
    source = serializers.JSONField(required=False)  # type: ignore[assignment]
    primary_object = serializers.JSONField(required=False)
    supporting_objects = serializers.ListField(
        child=serializers.JSONField(), required=False, max_length=10
    )
    prompt = serializers.CharField(required=False, allow_blank=True, max_length=20_000)
    time_range = serializers.JSONField(required=False)
    parameters = serializers.JSONField(required=False)
    project_ids = serializers.ListField(child=serializers.IntegerField(min_value=1), required=False)
    filters = serializers.JSONField(required=False)

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        has_key = "template_key" in attrs
        has_version = "template_version" in attrs
        has_source = "source" in attrs
        has_primary = "primary_object" in attrs
        if has_primary:
            if has_source or has_key:
                raise serializers.ValidationError(
                    {"primary_object": "Use either primaryObject or source/template creation."}
                )
            if "parameters" in attrs:
                raise serializers.ValidationError(
                    {"parameters": "Agentic investigations do not use template parameters."}
                )
        elif "time_range" in attrs or (
            "prompt" in attrs
            and not (
                has_source
                and isinstance(attrs["source"], dict)
                and attrs["source"].get("type") == "metric_open_period"
            )
        ):
            raise serializers.ValidationError(
                {"primary_object": "A primaryObject is required for prompt or timeRange."}
            )
        if (
            has_primary
            and attrs["primary_object"]["type"] == "metric_open_period"
            and "time_range" in attrs
        ):
            raise serializers.ValidationError(
                {"time_range": "Metric open periods use their server-resolved monitor windows."}
            )
        if "supporting_objects" in attrs and (has_key or not (has_source or has_primary)):
            raise serializers.ValidationError(
                {"supporting_objects": "Requires an agentic source or primaryObject."}
            )
        if has_key != has_version:
            raise serializers.ValidationError(
                {"template_key": "templateKey and templateVersion must be provided together."}
            )
        if has_key:
            if "source" not in attrs:
                raise serializers.ValidationError({"source": "This field is required."})
            if not isinstance(attrs["source"], dict):
                raise serializers.ValidationError({"source": "Must be an object."})
            if not isinstance(attrs.get("parameters", {}), dict):
                raise serializers.ValidationError({"parameters": "Must be an object."})
            forbidden = set(attrs).intersection({"project_ids", "filters", "prompt", "time_range"})
            if forbidden:
                raise serializers.ValidationError(
                    {field: "Template creation controls this field." for field in forbidden}
                )
        elif has_source:
            validate_agentic_source(attrs["source"])
            if "parameters" in attrs:
                raise serializers.ValidationError(
                    {"parameters": "Agentic investigations do not use template parameters."}
                )
        elif not has_primary:
            if "title" not in attrs:
                raise serializers.ValidationError({"title": "This field is required."})
            forbidden = set(attrs).intersection({"parameters"})
            if forbidden:
                raise serializers.ValidationError(
                    {field: "Requires a template." for field in forbidden}
                )
        project_ids = attrs.get("project_ids", [])
        if len(project_ids) != len(set(project_ids)):
            raise serializers.ValidationError({"project_ids": "Project IDs must be unique."})
        return attrs

    def validate_primary_object(self, value: Any) -> dict[str, Any]:
        return validate_object_reference(value)

    def validate_supporting_objects(self, value: list[Any]) -> list[dict[str, Any]]:
        return [validate_object_reference(item) for item in value]

    def validate_time_range(self, value: Any) -> dict[str, str]:
        return _validate_time_range(value)

    def validate_filters(self, value: Any) -> dict[str, Any]:
        if not isinstance(value, dict):
            raise serializers.ValidationError("Must be an object.")
        return value


class InvestigationCandidatesValidator(StrictCamelSnakeValidator):
    template_key = serializers.CharField(max_length=128)
    template_version = serializers.IntegerField(min_value=1)
    sources = serializers.ListField(child=serializers.JSONField(), min_length=1, max_length=100)

    def validate_sources(self, value: list[Any]) -> list[dict[str, Any]]:
        if not all(isinstance(source, dict) for source in value):
            raise serializers.ValidationError("Each source must be an object.")
        return value


class InvestigationUpdateValidator(StrictCamelSnakeValidator):
    investigation_version = serializers.IntegerField(min_value=1)
    title = serializers.CharField(max_length=255, required=False)
    status = serializers.ChoiceField(choices=InvestigationStatus.choices, required=False)
    filters = serializers.JSONField(required=False)
    project_ids = serializers.ListField(child=serializers.IntegerField(min_value=1), required=False)

    def validate_project_ids(self, value: list[int]) -> list[int]:
        if len(value) != len(set(value)):
            raise serializers.ValidationError("Project IDs must be unique.")
        return value

    def validate_filters(self, value: Any) -> dict[str, Any]:
        if not isinstance(value, dict):
            raise serializers.ValidationError("Must be an object.")
        return value


class InvestigationDeleteValidator(StrictCamelSnakeValidator):
    investigation_version = serializers.IntegerField(min_value=1)


class PermissionsUpdateValidator(StrictCamelSnakeValidator):
    investigation_version = serializers.IntegerField(min_value=1)
    is_editable_by_everyone = serializers.BooleanField()
    team_ids = serializers.ListField(child=serializers.IntegerField(min_value=1))

    def validate_team_ids(self, value: list[int]) -> list[int]:
        if len(value) != len(set(value)):
            raise serializers.ValidationError("Team IDs must be unique.")
        return value


class FavoriteUpdateValidator(StrictCamelSnakeValidator):
    should_favorite = serializers.BooleanField()
