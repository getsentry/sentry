from __future__ import annotations

from typing import Any

from rest_framework import serializers

from sentry.notebooks.endpoints.validators.base import StrictCamelSnakeValidator
from sentry.notebooks.models import NotebookStatus


class InvestigationCreateValidator(StrictCamelSnakeValidator):
    title = serializers.CharField(max_length=255, help_text="Investigation title.")
    project_ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        required=False,
        help_text="Unique IDs of accessible projects to include. Defaults to an empty list.",
    )
    filters = serializers.JSONField(
        required=False, help_text="Investigation filter object, stored with its original keys."
    )

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        project_ids = attrs.get("project_ids", [])
        if len(project_ids) != len(set(project_ids)):
            raise serializers.ValidationError({"project_ids": "Project IDs must be unique."})
        return attrs

    def validate_filters(self, value: Any) -> dict[str, Any]:
        if not isinstance(value, dict):
            raise serializers.ValidationError("Must be an object.")
        return value


class InvestigationUpdateValidator(StrictCamelSnakeValidator):
    investigation_version = serializers.IntegerField(
        min_value=1,
        help_text="Current investigation version from the latest detail response. Stale versions return 409.",
    )
    title = serializers.CharField(
        max_length=255,
        required=False,
        help_text="New investigation title. A manual edit stops automatic title generation.",
    )
    status = serializers.ChoiceField(
        choices=NotebookStatus.choices,
        required=False,
        help_text="Set active to restore a manual notebook, or archived to archive. Archiving must be the only changed field.",
    )
    filters = serializers.JSONField(
        required=False, help_text="Investigation filter object, stored with its original keys."
    )
    project_ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        required=False,
        help_text="Unique IDs of accessible projects to include. Defaults to an empty list.",
    )

    def validate_project_ids(self, value: list[int]) -> list[int]:
        if len(value) != len(set(value)):
            raise serializers.ValidationError("Project IDs must be unique.")
        return value

    def validate_filters(self, value: Any) -> dict[str, Any]:
        if not isinstance(value, dict):
            raise serializers.ValidationError("Must be an object.")
        return value


class InvestigationDeleteValidator(StrictCamelSnakeValidator):
    investigation_version = serializers.IntegerField(
        min_value=1,
        help_text="Current investigation version from the latest detail response. Stale versions return 409.",
    )
