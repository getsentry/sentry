from __future__ import annotations

from typing import Any

from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied

from sentry.db.models.fields.bounded import BoundedPositiveIntegerField
from sentry.notebooks.contracts import (
    MAX_MARKDOWN_CHARS,
    VisualizationSerializer,
    validate_query_result,
)
from sentry.notebooks.endpoints.validators.base import (
    NotebookVersionValidator,
    StrictCamelSnakeValidator,
)
from sentry.notebooks.models import Notebook, NotebookBlock, NotebookBlockKind
from sentry.notebooks.services.notebooks import create_block
from sentry.notebooks.services.producer_sources import get_producer_source_type
from sentry.notebooks.services.producer_writes import (
    MAX_REVISION_STEP,
    UNSET,
    write_api_producer_block,
)

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
    if kind == NotebookBlockKind.TEXT:
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


class BlockCreateValidator(NotebookVersionValidator[tuple[NotebookBlock, bool]]):
    """Append a user's block, or write a producer's block by key and revision.

    Needs notebook, user_id and producer_writer in its context.
    """

    notebook_version = serializers.IntegerField(
        min_value=1,
        required=False,
        help_text="Current notebook version from the latest detail response. Stale versions return 409. Send this, or key and revision.",
    )
    key = serializers.CharField(
        max_length=128,
        required=False,
        help_text="The producer's stable key for the block. Writing the same key again updates the block, even if a user edited or deleted it. Send with revision instead of notebookVersion. Only service accounts and Seer agents can send it.",
    )
    revision = serializers.IntegerField(
        min_value=1,
        max_value=BoundedPositiveIntegerField.MAX_VALUE,
        required=False,
        help_text=f"The producer's revision for the block. A block with a newer revision returns 409, and a write can raise it by at most {MAX_REVISION_STEP}.",
    )
    position = serializers.IntegerField(
        min_value=0,
        max_value=BoundedPositiveIntegerField.MAX_VALUE,
        required=False,
        help_text="Index among the notebook's blocks where a producer's block goes. Later blocks shift down, and a larger index puts it last. A new block goes last when omitted, and an existing block stays put.",
    )
    kind = serializers.ChoiceField(
        choices=NotebookBlockKind.choices,
        help_text="Block kind: text for Markdown or query for an agent-generated data query. A producer's block must be text.",
    )
    title = serializers.CharField(
        max_length=255, required=False, allow_blank=True, help_text="Block title. May be empty."
    )
    content = serializers.CharField(
        required=False,
        allow_blank=True,
        help_text="Markdown content. May be empty, except in a producer's block.",
    )
    generation_prompt = serializers.CharField(
        required=False,
        allow_blank=True,
        help_text="Instructions used when executing the block. May be empty.",
    )
    config = serializers.JSONField(
        required=False, help_text="Block configuration object. Nested keys are preserved."
    )
    display = serializers.JSONField(
        required=False,
        help_text="Display settings. Text uses type markdown; query uses table, line, bar, or area. Versioned settings use version 1. Charts require xAxis and non-empty yAxes. Defaults to Markdown for text and table for query.",
    )

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        producer_fields = {"key", "revision", "position"}.intersection(attrs)
        if "notebook_version" in attrs:
            if producer_fields:
                raise serializers.ValidationError(
                    {"detail": "Send notebookVersion, or key and revision, not both."}
                )
        elif not {"key", "revision"}.issubset(attrs):
            raise serializers.ValidationError(
                {"notebook_version": "Send notebookVersion, or key and revision."}
            )
        elif not self.context["producer_writer"]:
            raise PermissionDenied("Only service accounts and Seer agents write by key.")
        elif attrs["kind"] != NotebookBlockKind.TEXT:
            raise serializers.ValidationError({"kind": "A producer's block must be text."})
        elif not attrs.get("content"):
            raise serializers.ValidationError({"content": "A producer's block needs content."})
        elif len(attrs["content"]) > MAX_MARKDOWN_CHARS:
            raise serializers.ValidationError(
                {"content": f"Ensure this field has no more than {MAX_MARKDOWN_CHARS} characters."}
            )
        elif (
            source_type := get_producer_source_type(self.context["notebook"].source_type)
        ) is None:
            raise serializers.ValidationError(
                {"detail": "Only a notebook made for a producer source takes key and revision."},
                code="not_producer_notebook",
            )
        else:
            stored_key = source_type.block_key(attrs["key"])
            max_length = NotebookBlock._meta.get_field("producer_key").max_length
            if max_length is not None and len(stored_key) > max_length:
                limit = max_length - len(source_type.block_key(""))
                raise serializers.ValidationError(
                    {"key": f"Ensure this field has no more than {limit} characters."}
                )
            attrs["key"] = stored_key
        kind = attrs["kind"]
        display = attrs.get(
            "display",
            (
                {"type": "markdown"}
                if kind == NotebookBlockKind.TEXT
                else {"version": 1, "type": "table", "defaultView": "table"}
            ),
        )
        if not isinstance(display, dict):
            raise serializers.ValidationError({"display": "Must be an object."})
        attrs["display"] = _validate_display_field(kind, display)
        if not isinstance(attrs.get("config", {}), dict):
            raise serializers.ValidationError({"config": "Must be an object."})
        return attrs

    def create(self, validated_data: dict[str, Any]) -> tuple[NotebookBlock, bool]:
        notebook: Notebook = self.context["notebook"]
        values = dict(validated_data)
        if "notebook_version" not in values:
            return write_api_producer_block(
                notebook,
                key=values["key"],
                revision=values["revision"],
                kind=values["kind"],
                position=values.get("position"),
                title=values.get("title", UNSET),
                content=values.get("content", UNSET),
                prompt=values.get("generation_prompt", UNSET),
                config=values.get("config", UNSET),
                display=values["display"],
            )
        notebook_version = values.pop("notebook_version")
        values["prompt"] = values.pop("generation_prompt", "")
        block = create_block(
            notebook=notebook,
            expected_notebook_version=notebook_version,
            user_id=self.context["user_id"],
            values=values,
        )
        return block, True


class BlockUpdateValidator(NotebookVersionValidator):
    version = serializers.IntegerField(
        min_value=1,
        help_text="Current block version from the latest block response. Stale versions return 409.",
    )
    title = serializers.CharField(
        max_length=255, required=False, allow_blank=True, help_text="Block title. May be empty."
    )
    content = serializers.CharField(
        required=False, allow_blank=True, help_text="User-authored content. May be empty."
    )
    generation_prompt = serializers.CharField(
        required=False,
        allow_blank=True,
        help_text="Instructions used when executing the block. May be empty.",
    )
    config = serializers.JSONField(
        required=False, help_text="Block configuration object. Nested keys are preserved."
    )
    display = serializers.JSONField(
        required=False,
        help_text="Display settings. Text uses type markdown; query uses table, line, bar, or area. Versioned settings use version 1. Charts require xAxis and non-empty yAxes. Defaults to Markdown for text and table for query.",
    )

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


class BlockDeleteValidator(NotebookVersionValidator):
    version = serializers.IntegerField(
        min_value=1,
        help_text="Current block version from the latest block response. Stale versions return 409.",
    )


class BlockExecutionStartValidator(NotebookVersionValidator):
    version = serializers.IntegerField(
        min_value=1,
        help_text="Current block version from the latest block response. Stale versions return 409.",
    )
    request_id = serializers.UUIDField(
        required=False,
        help_text="Client-generated UUID for retry-safe submission. Reuse the same ID only for the same request.",
    )


@extend_schema_field(OpenApiTypes.ANY)
class NotebookInputResponseField(serializers.JSONField):
    pass


class BlockExecutionResumeValidator(StrictCamelSnakeValidator):
    input_id = serializers.CharField(
        help_text="ID of the pending user input returned by execution polling."
    )
    response_data = NotebookInputResponseField(
        allow_null=True,
        help_text="Answer to the pending input. Any JSON value is accepted, including strings, arrays, objects, and null.",
    )


class BlockOrderValidator(NotebookVersionValidator):
    block_ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        help_text="Every active block ID exactly once, in the desired order.",
    )


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
