from __future__ import annotations

from typing import Any, Literal, TypedDict, cast

import orjson
from django.utils.dateparse import parse_datetime
from rest_framework import serializers

MAX_CHART_SERIES = 5
MAX_POINTS_PER_SERIES = 200
MAX_ARTIFACT_BYTES = 1024 * 1024
MAX_MARKDOWN_CHARS = 100_000


def json_byte_size(value: Any) -> int:
    """Measure a payload in the UTF-8 JSON bytes Seer budgets against.

    `default` keeps the tolerance the previous encoder had for types orjson
    cannot serialize, such as the Decimals a query result can carry.
    """

    try:
        return len(orjson.dumps(value, default=str))
    except TypeError as error:
        raise serializers.ValidationError("Payload is not serializable.") from error


class RelaxedContractSerializer(serializers.Serializer[Any]):
    def to_internal_value(self, data: Any) -> dict[str, Any]:
        validated = cast("dict[str, Any]", super().to_internal_value(data))
        if not isinstance(data, dict):
            return validated
        passthrough = {key: value for key, value in data.items() if key not in self.fields}
        return {**passthrough, **validated}


class StrictCharField(serializers.CharField):
    """A string that rejects the numbers DRF would stringify, and keeps its whitespace."""

    def __init__(self, **kwargs: Any) -> None:
        kwargs.setdefault("trim_whitespace", False)
        super().__init__(**kwargs)

    def to_internal_value(self, data: Any) -> str:
        if not isinstance(data, str):
            self.fail("invalid")
        return super().to_internal_value(data)


class StrictContractSerializer(serializers.Serializer[Any]):
    def to_internal_value(self, data: Any) -> dict[str, Any]:
        if isinstance(data, dict):
            unknown = sorted(set(data) - set(self.fields))
            if unknown:
                raise serializers.ValidationError({field: "Unknown field." for field in unknown})
        return super().to_internal_value(data)


class SeerChartPointSerializer(StrictContractSerializer):
    x = serializers.JSONField()
    y = serializers.FloatField()

    def validate_x(self, value: Any) -> str | int | float:
        if isinstance(value, bool) or not isinstance(value, str | int | float):
            raise serializers.ValidationError("Chart x values must be strings or numbers.")
        return value


class SeerChartSeriesSerializer(StrictContractSerializer):
    name = serializers.CharField()
    data = serializers.ListField(  # type: ignore[assignment]
        child=SeerChartPointSerializer(), min_length=1, max_length=MAX_POINTS_PER_SERIES
    )


class SeerChartEmbedSerializer(StrictContractSerializer):
    title = serializers.CharField()
    subtitle = serializers.CharField(required=False, allow_null=True)
    visualization = serializers.ChoiceField(choices=("line", "area", "bar"), default="line")
    x_axis = serializers.ChoiceField(choices=("time", "category"), default="time")
    y_axis_unit = serializers.ChoiceField(
        choices=("number", "percentage", "duration", "bytes"), default="number"
    )
    y_axis_label = serializers.CharField(required=False, allow_null=True)
    stacked = serializers.BooleanField(required=False, default=True)
    show_legend = serializers.BooleanField(required=False, default=True)
    show_title = serializers.BooleanField(required=False, default=True)
    frameless = serializers.BooleanField(required=False, default=False)
    series = serializers.ListField(
        child=SeerChartSeriesSerializer(), min_length=1, max_length=MAX_CHART_SERIES
    )

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        if attrs["x_axis"] == "category" and attrs["visualization"] != "bar":
            raise serializers.ValidationError(
                "Category-axis charts must use the bar visualization."
            )
        if attrs["x_axis"] != "time":
            return attrs
        for series in attrs["series"]:
            for point in series["data"]:
                value = point["x"]
                parsed = parse_datetime(value) if isinstance(value, str) else None
                if parsed is None or parsed.utcoffset() is None:
                    raise serializers.ValidationError(
                        "Time-axis values must be offset-bearing ISO timestamps."
                    )
        return attrs


class VisualizationSerializer(StrictContractSerializer):
    type = serializers.ChoiceField(choices=("line", "area", "bar"))
    title = serializers.CharField()
    subtitle = serializers.CharField(required=False, allow_null=True)
    xField = serializers.CharField()
    yFields = serializers.ListField(
        child=serializers.CharField(), min_length=1, max_length=MAX_CHART_SERIES
    )
    seriesField = serializers.CharField(required=False, allow_null=True)
    unit = serializers.ChoiceField(
        choices=("number", "percentage", "duration", "bytes"), default="number"
    )
    axisLabel = serializers.CharField(required=False, allow_null=True)
    stacked = serializers.BooleanField(required=False, default=False)
    showLegend = serializers.BooleanField(required=False, default=True)
    sort = serializers.ChoiceField(
        choices=("none", "ascending", "descending"), required=False, default="none"
    )
    topN = serializers.IntegerField(required=False, allow_null=True, min_value=1, max_value=20)


class NotebookQueryLinkSerializer(StrictContractSerializer):
    kind = serializers.CharField(max_length=64)
    params = serializers.DictField()

    def validate_params(self, value: dict[str, Any]) -> dict[str, Any]:
        for item in value.values():
            nested = (
                any(isinstance(entry, dict | list) for entry in item)
                if isinstance(item, list)
                else isinstance(item, dict)
            )
            if nested:
                raise serializers.ValidationError("Link params must not be nested.")
        return value


class NotebookQueryResultSerializer(StrictContractSerializer):
    schemaVersion = serializers.IntegerField(min_value=1, max_value=1)
    tableMarkdown = serializers.CharField(max_length=MAX_MARKDOWN_CHARS, trim_whitespace=False)
    chart = SeerChartEmbedSerializer(required=False, allow_null=True)
    preferredView = serializers.ChoiceField(choices=("table", "chart"), default="table")
    isEmpty = serializers.BooleanField(default=False)
    chartUnavailableReason = serializers.CharField(required=False, allow_null=True)
    queryLinks = serializers.ListField(
        child=NotebookQueryLinkSerializer(), required=False, default=list
    )

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        if attrs["preferredView"] == "chart" and attrs.get("chart") is None:
            attrs["preferredView"] = "table"
        if attrs.get("chart") is None and not attrs.get("chartUnavailableReason"):
            attrs["chartUnavailableReason"] = "No chart was generated for this result."
        return attrs


class NotebookTextResultSerializer(StrictContractSerializer):
    schemaVersion = serializers.IntegerField(min_value=1, max_value=1)
    markdown = serializers.CharField(max_length=MAX_MARKDOWN_CHARS, trim_whitespace=False)


def validate_query_result(value: Any) -> dict[str, Any]:
    if json_byte_size(value) > MAX_ARTIFACT_BYTES:
        raise serializers.ValidationError("Query result exceeds the maximum artifact size.")
    serializer = NotebookQueryResultSerializer(data=value)
    serializer.is_valid(raise_exception=True)
    return dict(serializer.validated_data)


def validate_text_result(value: Any) -> dict[str, Any]:
    if json_byte_size(value) > MAX_ARTIFACT_BYTES:
        raise serializers.ValidationError("Text result exceeds the maximum artifact size.")
    serializer = NotebookTextResultSerializer(data=value)
    serializer.is_valid(raise_exception=True)
    return dict(serializer.validated_data)


class ActionRequestAnchor(TypedDict):
    type: Literal["block", "hypothesis"]
    id: str


class ActionRequestItem(TypedDict):
    """A request from Seer that has passed validation."""

    key: str
    reportRevision: int
    title: str
    rationale: str
    impact: str | None
    primary: bool
    anchor: ActionRequestAnchor | None
    # The action kind owns this, so nothing else should read inside it.
    action: dict[str, Any] | None


class ActionPayloadSerializer(RelaxedContractSerializer):
    """Base class for an action kind's payload. Each kind validates its own fields."""

    kind = StrictCharField(max_length=64)

    @classmethod
    def trim(cls, action: dict[str, Any]) -> dict[str, Any] | None:
        """Remove values this kind won't accept. Return None to keep the request as advice."""
        return action
