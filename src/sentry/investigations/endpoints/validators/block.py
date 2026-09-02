from __future__ import annotations

from typing import Any

from rest_framework import serializers

from sentry.investigations.contracts import VisualizationSerializer, validate_query_result
from sentry.investigations.endpoints.validators.base import StrictCamelSnakeValidator
from sentry.investigations.models import InvestigationBlockKind

BLOCK_UPDATE_FIELDS = frozenset({"title", "content", "generation_prompt", "config", "display"})
CHART_DISPLAY_TYPES = frozenset({"line", "bar", "area"})
QUERY_DISPLAY_TYPES = CHART_DISPLAY_TYPES | {"table"}
VERSIONED_QUERY_DISPLAY_FIELDS = frozenset(
    {
        "version",
        "type",
        "xAxis",
        "yAxes",
        "seriesField",
        "unit",
        "axisLabel",
        "stacked",
        "showLegend",
        "title",
        "subtitle",
        "sort",
        "topN",
        "defaultView",
        "queryCollapsed",
    }
)


def _validate_axes(display: dict[str, Any]) -> None:
    if not isinstance(display.get("xAxis"), str) or not display["xAxis"]:
        raise serializers.ValidationError("xAxis must be a non-empty string.")
    if (
        not isinstance(display.get("yAxes"), list)
        or not display["yAxes"]
        or any(not isinstance(axis, str) or not axis for axis in display["yAxes"])
    ):
        raise serializers.ValidationError("yAxes must be a non-empty list of strings.")


def _validate_text_display(display: dict[str, Any]) -> dict[str, Any]:
    if set(display) == {"type"} and display.get("type") == "markdown":
        return display
    if (
        display.get("type") != "markdown"
        or type(display.get("version")) is not int
        or display["version"] != 1
        or set(display) - {"version", "type", "promptCollapsed"}
        or ("promptCollapsed" in display and not isinstance(display["promptCollapsed"], bool))
    ):
        raise serializers.ValidationError("Text blocks must use the markdown display.")
    return display


def _validate_legacy_query_display(display: dict[str, Any]) -> dict[str, Any]:
    display_type = display.get("type")
    if not isinstance(display_type, str) or display_type not in CHART_DISPLAY_TYPES:
        raise serializers.ValidationError("Invalid legacy query-block display.")
    if set(display) != {"type", "xAxis", "yAxes"}:
        raise serializers.ValidationError("Charts require exactly type, xAxis, and yAxes.")
    _validate_axes(display)
    return display


def _validate_versioned_query_display(display: dict[str, Any]) -> dict[str, Any]:
    if (
        type(display.get("version")) is not int
        or display["version"] != 1
        or set(display) - VERSIONED_QUERY_DISPLAY_FIELDS
    ):
        raise serializers.ValidationError("Invalid versioned query-block display.")

    display_type = display.get("type")
    if not isinstance(display_type, str) or display_type not in QUERY_DISPLAY_TYPES:
        raise serializers.ValidationError("Invalid visualization type.")

    default_view = display.get("defaultView", "table")
    if not isinstance(default_view, str) or default_view not in {"table", "chart"}:
        raise serializers.ValidationError("defaultView must be table or chart.")
    for flag in ("queryCollapsed", "stacked", "showLegend"):
        if flag in display and not isinstance(display[flag], bool):
            raise serializers.ValidationError(f"{flag} must be a boolean.")
    for field in ("title", "subtitle", "seriesField", "axisLabel"):
        if field in display and display[field] is not None and not isinstance(display[field], str):
            raise serializers.ValidationError(f"{field} must be a string or null.")

    unit = display.get("unit", "number")
    if not isinstance(unit, str) or unit not in {"number", "percentage", "duration", "bytes"}:
        raise serializers.ValidationError("Invalid visualization unit.")
    sort = display.get("sort", "none")
    if not isinstance(sort, str) or sort not in {"none", "ascending", "descending"}:
        raise serializers.ValidationError("Invalid visualization sort.")
    top_n = display.get("topN")
    if top_n is not None and (
        isinstance(top_n, bool) or not isinstance(top_n, int) or not 1 <= top_n <= 20
    ):
        raise serializers.ValidationError("topN must be between 1 and 20.")

    if display_type != "table":
        _validate_axes(display)
    return display


def validate_display(kind: str, display: dict[str, Any]) -> dict[str, Any]:
    if kind == InvestigationBlockKind.TEXT:
        return _validate_text_display(display)

    display_type = display.get("type")
    if display_type == "table" and set(display) == {"type"}:
        return display
    if "version" not in display:
        return _validate_legacy_query_display(display)
    return _validate_versioned_query_display(display)


def _validate_display_field(kind: str, display: dict[str, Any]) -> dict[str, Any]:
    try:
        return validate_display(kind, display)
    except serializers.ValidationError as error:
        raise serializers.ValidationError({"display": error.detail})


class BlockCreateValidator(StrictCamelSnakeValidator):
    investigation_version = serializers.IntegerField(min_value=1)
    kind = serializers.ChoiceField(choices=InvestigationBlockKind.choices)
    title = serializers.CharField(max_length=255, required=False, allow_blank=True)
    content = serializers.CharField(required=False, allow_blank=True)
    generation_prompt = serializers.CharField(required=False, allow_blank=True)
    config = serializers.JSONField(required=False)
    display = serializers.JSONField(required=False)

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        kind = attrs["kind"]
        display = attrs.get(
            "display",
            (
                {"type": "markdown"}
                if kind == InvestigationBlockKind.TEXT
                else {"version": 1, "type": "table", "defaultView": "table"}
            ),
        )
        if not isinstance(display, dict):
            raise serializers.ValidationError({"display": "Must be an object."})
        attrs["display"] = _validate_display_field(kind, display)
        if not isinstance(attrs.get("config", {}), dict):
            raise serializers.ValidationError({"config": "Must be an object."})
        return attrs


class BlockUpdateValidator(StrictCamelSnakeValidator):
    investigation_version = serializers.IntegerField(min_value=1)
    version = serializers.IntegerField(min_value=1)
    title = serializers.CharField(max_length=255, required=False, allow_blank=True)
    content = serializers.CharField(required=False, allow_blank=True)
    generation_prompt = serializers.CharField(required=False, allow_blank=True)
    config = serializers.JSONField(required=False)
    display = serializers.JSONField(required=False)

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        if not BLOCK_UPDATE_FIELDS.intersection(attrs):
            raise serializers.ValidationError(
                {"detail": "Provide at least one block field to update."}
            )
        if "display" in attrs:
            if not isinstance(attrs["display"], dict):
                raise serializers.ValidationError({"display": "Must be an object."})
            block = self.context.get("block")
            if block is None:
                raise serializers.ValidationError(
                    {"display": "Validating a display requires the block in serializer context."}
                )
            attrs["display"] = _validate_display_field(block.kind, attrs["display"])
        if "config" in attrs and not isinstance(attrs["config"], dict):
            raise serializers.ValidationError({"config": "Must be an object."})
        return attrs


class BlockDeleteValidator(StrictCamelSnakeValidator):
    investigation_version = serializers.IntegerField(min_value=1)
    version = serializers.IntegerField(min_value=1)


class BlockExecutionStartValidator(StrictCamelSnakeValidator):
    investigation_version = serializers.IntegerField(min_value=1)
    version = serializers.IntegerField(min_value=1)
    request_id = serializers.UUIDField(required=False)


class BlockExecutionResumeValidator(StrictCamelSnakeValidator):
    input_id = serializers.CharField()
    response_data = serializers.JSONField(allow_null=True)


class BlockOrderValidator(StrictCamelSnakeValidator):
    investigation_version = serializers.IntegerField(min_value=1)
    block_ids = serializers.ListField(child=serializers.IntegerField(min_value=1))


class VisualizationSuggestionValidator(StrictCamelSnakeValidator):
    current_result = serializers.JSONField()
    visualization = serializers.JSONField()
    requested_change = serializers.CharField(max_length=1000)
    current_intent = serializers.CharField(max_length=10_000)

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        try:
            attrs["current_result"] = validate_query_result(attrs["current_result"])
        except serializers.ValidationError as error:
            raise serializers.ValidationError({"current_result": error.detail})

        visualization = VisualizationSerializer(data=attrs["visualization"])
        if not visualization.is_valid():
            raise serializers.ValidationError({"visualization": visualization.errors})
        attrs["visualization"] = dict(visualization.validated_data)
        if not attrs["requested_change"].strip():
            raise serializers.ValidationError(
                {"requested_change": "Describe the visualization change."}
            )
        return attrs
