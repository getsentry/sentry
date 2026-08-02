from __future__ import annotations

from typing import Any

from rest_framework import serializers

from sentry.utils import json

MAX_TABLE_ROWS = 100
MAX_CHART_SERIES = 5
MAX_POINTS_PER_SERIES = 200
MAX_ARTIFACT_BYTES = 1024 * 1024


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
    columns = TableColumnSerializer(many=True)
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


class VisualizationSerializer(StrictContractSerializer):
    type = serializers.ChoiceField(choices=("line", "area", "bar", "heatmap", "wheel"))
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


class InvestigationQueryResultSerializer(StrictContractSerializer):
    schemaVersion = serializers.IntegerField(min_value=1, max_value=1)
    query = CanonicalQuerySerializer()
    table = TableResultSerializer()
    chart = ChartResultSerializer(required=False, allow_null=True)
    suggestedVisualization = VisualizationSerializer(required=False, allow_null=True)
    chartUnavailableReason = serializers.CharField(required=False, allow_null=True)
    warnings = serializers.ListField(child=serializers.CharField(), required=False, default=list)
    dataProjectIds = serializers.ListField(
        child=serializers.IntegerField(min_value=1), required=False, default=list
    )

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        if attrs.get("chart") is None and not attrs.get("chartUnavailableReason"):
            raise serializers.ValidationError("A missing chart requires chartUnavailableReason.")
        if attrs.get("chart") is not None and attrs.get("suggestedVisualization") is None:
            raise serializers.ValidationError("Chart data requires suggestedVisualization.")
        return attrs


def validate_query_result(value: Any) -> dict[str, Any]:
    if len(json.dumps(value, separators=(",", ":")).encode()) > MAX_ARTIFACT_BYTES:
        raise serializers.ValidationError("Query result exceeds the maximum artifact size.")
    serializer = InvestigationQueryResultSerializer(data=value)
    serializer.is_valid(raise_exception=True)
    return dict(serializer.validated_data)
