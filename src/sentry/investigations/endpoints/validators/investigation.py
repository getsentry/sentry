from __future__ import annotations

from typing import Any

from rest_framework import serializers

from sentry.investigations.endpoints.validators.orchestration import (
    InvestigationSourceField,
    validate_agentic_source,
)
from sentry.notebooks.endpoints.validators.base import StrictCamelSnakeValidator
from sentry.notebooks.models import NotebookStatus


class InvestigationCreateValidator(StrictCamelSnakeValidator):
    title = serializers.CharField(
        max_length=255,
        required=False,
        help_text="Investigation title, required when source is omitted; otherwise generated when omitted.",
    )
    source = InvestigationSourceField(
        required=False,
        help_text="Manual prompt or metric open-period reference. Starts an agentic investigation. Omit to create a blank notebook. Agentic sources have a maximum serialized size of 200,000 bytes.",
    )  # type: ignore[assignment]
    project_ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        required=False,
        help_text="Unique IDs of accessible projects to include. Defaults to an empty list.",
    )
    filters = serializers.JSONField(
        required=False, help_text="Investigation filter object, stored with its original keys."
    )

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        if "source" in attrs:
            validate_agentic_source(attrs["source"])
        elif "title" not in attrs:
            raise serializers.ValidationError({"title": "This field is required."})
        project_ids = attrs.get("project_ids", [])
        if len(project_ids) != len(set(project_ids)):
            raise serializers.ValidationError({"project_ids": "Project IDs must be unique."})
        return attrs

    def validate_filters(self, value: Any) -> dict[str, Any]:
        if not isinstance(value, dict):
            raise serializers.ValidationError("Must be an object.")
        return value


class InvestigationCandidatesValidator(StrictCamelSnakeValidator):
    sources = serializers.ListField(
        child=serializers.JSONField(),
        min_length=1,
        max_length=100,
        help_text="Metric open-period sources to resolve, in input order. Between 1 and 100 sources.",
    )

    def validate_sources(self, value: list[Any]) -> list[dict[str, Any]]:
        if not all(isinstance(source, dict) for source in value):
            raise serializers.ValidationError("Each source must be an object.")
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


class PermissionsUpdateValidator(StrictCamelSnakeValidator):
    investigation_version = serializers.IntegerField(min_value=1)
    is_editable_by_everyone = serializers.BooleanField()
    team_ids = serializers.ListField(child=serializers.IntegerField(min_value=1))

    def validate_team_ids(self, value: list[int]) -> list[int]:
        if len(value) != len(set(value)):
            raise serializers.ValidationError("Team IDs must be unique.")
        return value
