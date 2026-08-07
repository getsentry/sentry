from __future__ import annotations

from typing import Any

from rest_framework import serializers

from sentry.investigations.endpoints.validators.base import StrictCamelSnakeValidator
from sentry.investigations.models import InvestigationStatus


class InvestigationCreateValidator(StrictCamelSnakeValidator):
    title = serializers.CharField(max_length=255, required=False)
    template_key = serializers.CharField(max_length=128, required=False)
    template_version = serializers.IntegerField(min_value=1, required=False)
    source_ref = serializers.JSONField(required=False)
    parameters = serializers.JSONField(required=False)
    project_ids = serializers.ListField(child=serializers.IntegerField(min_value=1), required=False)
    filters = serializers.JSONField(required=False)

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        has_key = "template_key" in attrs
        has_version = "template_version" in attrs
        if has_key != has_version:
            raise serializers.ValidationError(
                {"template_key": "templateKey and templateVersion must be provided together."}
            )
        if has_key:
            if "source_ref" not in attrs:
                raise serializers.ValidationError({"source_ref": "This field is required."})
            if not isinstance(attrs["source_ref"], dict):
                raise serializers.ValidationError({"source_ref": "Must be an object."})
            if not isinstance(attrs.get("parameters", {}), dict):
                raise serializers.ValidationError({"parameters": "Must be an object."})
            forbidden = set(attrs).intersection({"project_ids", "filters"})
            if forbidden:
                raise serializers.ValidationError(
                    {field: "Template creation controls this field." for field in forbidden}
                )
        else:
            if "title" not in attrs:
                raise serializers.ValidationError({"title": "This field is required."})
            forbidden = set(attrs).intersection({"source_ref", "parameters"})
            if forbidden:
                raise serializers.ValidationError(
                    {field: "Requires a template." for field in forbidden}
                )
        project_ids = attrs.get("project_ids", [])
        if len(project_ids) != len(set(project_ids)):
            raise serializers.ValidationError({"project_ids": "Project IDs must be unique."})
        return attrs

    def validate_filters(self, value: Any) -> dict[str, Any]:
        if not isinstance(value, dict):
            raise serializers.ValidationError("Must be an object.")
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
