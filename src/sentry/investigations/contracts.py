from __future__ import annotations

from typing import Any

from django.utils.dateparse import parse_datetime
from rest_framework import serializers

from sentry.utils import json

MAX_TABLE_ROWS = 100
MAX_CHART_SERIES = 5
MAX_POINTS_PER_SERIES = 200
MAX_ARTIFACT_BYTES = 1024 * 1024
MAX_MARKDOWN_CHARS = 100_000


class StrictContractSerializer(serializers.Serializer[Any]):
    def to_internal_value(self, data: Any) -> dict[str, Any]:
        if isinstance(data, dict):
            unknown = sorted(set(data) - set(self.fields))
            if unknown:
                raise serializers.ValidationError({field: "Unknown field." for field in unknown})
        return super().to_internal_value(data)


class QueryTimeRangeSerializer(StrictContractSerializer):
    statsPeriod = serializers.CharField(required=False, allow_null=True)
    start = serializers.CharField(required=False, allow_null=True)
    end = serializers.CharField(required=False, allow_null=True)

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        if bool(attrs.get("start")) != bool(attrs.get("end")):
            raise serializers.ValidationError("start and end must be provided together")
        if attrs.get("statsPeriod") and attrs.get("start"):
            raise serializers.ValidationError("Use a relative or absolute time range, not both.")
        return attrs


class CanonicalQuerySerializer(StrictContractSerializer):
    dataset = serializers.ChoiceField(choices=("spans", "issues", "errors", "logs", "metrics"))
    query = serializers.CharField(allow_blank=True)
    mode = serializers.CharField(allow_blank=True)
    fields = serializers.ListField(  # type: ignore[assignment]
        child=serializers.CharField(), required=False, default=list
    )
    yAxes = serializers.ListField(child=serializers.CharField(), required=False, default=list)
    groupBy = serializers.ListField(child=serializers.CharField(), required=False, default=list)
    sort = serializers.CharField(required=False, allow_blank=True, default="")
    interval = serializers.CharField(required=False, allow_null=True)
    timeRange = QueryTimeRangeSerializer()
    projectIds = serializers.ListField(
        child=serializers.IntegerField(min_value=1), required=False, default=list
    )
    projectSlugs = serializers.ListField(
        child=serializers.CharField(), required=False, default=list
    )
    spanQuery = serializers.CharField(required=False, allow_null=True)
    logQuery = serializers.CharField(required=False, allow_null=True)
    metricQuery = serializers.CharField(required=False, allow_null=True)
    linkParams = serializers.DictField(required=False, default=dict)


class TableColumnSerializer(StrictContractSerializer):
    key = serializers.CharField()
    label = serializers.CharField()  # type: ignore[assignment]
    type = serializers.ChoiceField(
        choices=(
            "string",
            "number",
            "boolean",
            "datetime",
            "duration",
            "percentage",
            "bytes",
            "issue",
            "trace",
            "event",
            "project",
            "release",
        ),
        default="string",
    )
    unit = serializers.CharField(required=False, allow_null=True)


class TableResultSerializer(StrictContractSerializer):
    columns = serializers.ListField(child=TableColumnSerializer(), min_length=1)
    rows = serializers.ListField(child=serializers.ListField(), max_length=MAX_TABLE_ROWS)
    totalRows = serializers.IntegerField(min_value=0)
    returnedRows = serializers.IntegerField(min_value=0)
    truncated = serializers.BooleanField(required=False, default=False)

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        width = len(attrs["columns"])
        if any(len(row) != width for row in attrs["rows"]):
            raise serializers.ValidationError("Every table row must match the column count.")
        if attrs["returnedRows"] != len(attrs["rows"]):
            raise serializers.ValidationError("returnedRows must match the number of rows.")
        if attrs["totalRows"] < attrs["returnedRows"]:
            raise serializers.ValidationError("totalRows cannot be smaller than returnedRows.")
        if any(
            not isinstance(value, (str, int, float, bool)) and value is not None
            for row in attrs["rows"]
            for value in row
        ):
            raise serializers.ValidationError("Table cells must be JSON scalar values.")
        return attrs


class ChartPointSerializer(StrictContractSerializer):
    x = serializers.JSONField()
    y = serializers.FloatField()

    def validate_x(self, value: Any) -> str | int | float:
        if isinstance(value, bool) or not isinstance(value, (str, int, float)):
            raise serializers.ValidationError("Chart x values must be strings or numbers.")
        return value


class ChartSeriesSerializer(StrictContractSerializer):
    name = serializers.CharField()
    data = serializers.ListField(  # type: ignore[assignment]
        child=ChartPointSerializer(), min_length=1, max_length=MAX_POINTS_PER_SERIES
    )


class ChartResultSerializer(StrictContractSerializer):
    xAxis = serializers.ChoiceField(choices=("time", "category"))
    series = serializers.ListField(
        child=ChartSeriesSerializer(), min_length=1, max_length=MAX_CHART_SERIES
    )
    truncated = serializers.BooleanField(required=False, default=False)


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


class InvestigationQueryLinkSerializer(StrictContractSerializer):
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


class InvestigationQueryResultSerializer(StrictContractSerializer):
    schemaVersion = serializers.IntegerField(min_value=1, max_value=1)
    tableMarkdown = serializers.CharField(max_length=MAX_MARKDOWN_CHARS, trim_whitespace=False)
    chart = SeerChartEmbedSerializer(required=False, allow_null=True)
    preferredView = serializers.ChoiceField(choices=("table", "chart"), default="table")
    isEmpty = serializers.BooleanField(default=False)
    chartUnavailableReason = serializers.CharField(required=False, allow_null=True)
    queryLinks = serializers.ListField(
        child=InvestigationQueryLinkSerializer(), required=False, default=list
    )

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        if attrs["preferredView"] == "chart" and attrs.get("chart") is None:
            attrs["preferredView"] = "table"
        if attrs.get("chart") is None and not attrs.get("chartUnavailableReason"):
            attrs["chartUnavailableReason"] = "No chart was generated for this result."
        return attrs


class InvestigationTextResultSerializer(StrictContractSerializer):
    schemaVersion = serializers.IntegerField(min_value=1, max_value=1)
    markdown = serializers.CharField(max_length=MAX_MARKDOWN_CHARS, trim_whitespace=False)


def validate_query_result(value: Any) -> dict[str, Any]:
    if len(json.dumps(value).encode()) > MAX_ARTIFACT_BYTES:
        raise serializers.ValidationError("Query result exceeds the maximum artifact size.")
    serializer = InvestigationQueryResultSerializer(data=value)
    serializer.is_valid(raise_exception=True)
    return dict(serializer.validated_data)


def validate_text_result(value: Any) -> dict[str, Any]:
    if len(json.dumps(value).encode()) > MAX_ARTIFACT_BYTES:
        raise serializers.ValidationError("Text result exceeds the maximum artifact size.")
    serializer = InvestigationTextResultSerializer(data=value)
    serializer.is_valid(raise_exception=True)
    return dict(serializer.validated_data)
