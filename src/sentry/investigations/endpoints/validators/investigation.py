from __future__ import annotations

from typing import Any

from rest_framework import serializers

from sentry.investigations.endpoints.validators.orchestration import (
    InvestigationSourceField,
    validate_agentic_source,
)
from sentry.notebooks.endpoints.validators import (
    NotebookCreateValidator,
    StrictCamelSnakeValidator,
)


class InvestigationStartValidator(NotebookCreateValidator):
    title = serializers.CharField(
        max_length=255,
        required=False,
        help_text="Investigation title. Generated when omitted.",
    )
    source = InvestigationSourceField(
        help_text="Manual prompt or metric open-period reference. Agentic sources have a maximum serialized size of 200,000 bytes.",
    )  # type: ignore[assignment]

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        validate_agentic_source(attrs["source"])
        return super().validate(attrs)


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
