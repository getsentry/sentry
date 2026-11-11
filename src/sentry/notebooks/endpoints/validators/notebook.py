from __future__ import annotations

from typing import Any

from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from sentry.api.helpers.creator import CreatorReference
from sentry.models.organization import Organization
from sentry.notebooks.endpoints.validators.base import StrictCamelSnakeValidator
from sentry.notebooks.models import Notebook, NotebookStatus
from sentry.notebooks.services.notebooks import create_manual_notebook, create_producer_notebook
from sentry.notebooks.services.producer_sources import ProducerSource, get_producer_source_type


@extend_schema_field(
    {
        "type": "object",
        "properties": {"type": {"type": "string"}},
        "required": ["type"],
        "additionalProperties": True,
    }
)
class ProducerSourceField(serializers.Field[ProducerSource, object, object, object]):
    def to_internal_value(self, data: object) -> ProducerSource:
        if not isinstance(data, dict):
            raise serializers.ValidationError("Must be an object.")
        fields = dict(data)
        name = fields.pop("type", None)
        source_type = get_producer_source_type(name) if isinstance(name, str) else None
        if source_type is None:
            raise serializers.ValidationError({"type": "Unknown source type."})
        validator = source_type.validator(data=fields, context=self.context)
        if not validator.is_valid():
            raise serializers.ValidationError(validator.errors)
        resolved = source_type.resolve(self.context["organization"], dict(validator.validated_data))
        return ProducerSource(source_type=source_type, resolved=resolved)


class NotebookCreateValidator(StrictCamelSnakeValidator[tuple[Notebook, bool]]):
    """Create a blank notebook, or find or create a producer's notebook for its source.

    Needs organization and creator in its context.
    """

    title = serializers.CharField(max_length=255, help_text="Investigation title.")
    project_ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        required=False,
        help_text="Unique IDs of accessible projects to include. Defaults to an empty list.",
    )
    filters = serializers.JSONField(
        required=False, help_text="Investigation filter object, stored with its original keys."
    )
    source = ProducerSourceField(
        required=False,
        help_text="What a producer writes this notebook about. type names a registered producer source type, and the other fields depend on it. Projects come from the source, so omit projectIds. An active notebook for the same source is returned instead of a new one.",
    )  # type: ignore[assignment]

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        project_ids = attrs.get("project_ids", [])
        if len(project_ids) != len(set(project_ids)):
            raise serializers.ValidationError({"project_ids": "Project IDs must be unique."})
        if isinstance(attrs.get("source"), ProducerSource) and "project_ids" in attrs:
            raise serializers.ValidationError(
                {"project_ids": "Projects come from the source; omit projectIds."}
            )
        return attrs

    def create(self, validated_data: dict[str, Any]) -> tuple[Notebook, bool]:
        organization: Organization = self.context["organization"]
        creator: CreatorReference = self.context["creator"]
        source: ProducerSource | None = validated_data.get("source")
        if source is not None:
            return create_producer_notebook(
                organization=organization,
                creator=creator,
                title=validated_data["title"],
                source=source,
                filters=validated_data.get("filters", {}),
            )
        notebook = create_manual_notebook(
            organization=organization,
            creator=creator,
            title=validated_data["title"],
            project_ids=validated_data.get("project_ids", []),
            filters=validated_data.get("filters", {}),
        )
        return notebook, True

    def validate_filters(self, value: Any) -> dict[str, Any]:
        if not isinstance(value, dict):
            raise serializers.ValidationError("Must be an object.")
        return value


class NotebookUpdateValidator(StrictCamelSnakeValidator):
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


class NotebookDeleteValidator(StrictCamelSnakeValidator):
    investigation_version = serializers.IntegerField(
        min_value=1,
        help_text="Current investigation version from the latest detail response. Stale versions return 409.",
    )
