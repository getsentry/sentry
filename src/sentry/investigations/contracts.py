from __future__ import annotations

import logging
import re
from typing import Any, Literal, TypedDict, cast

import orjson
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework import serializers

from sentry.db.models.fields.bounded import I32_MAX, I64_MAX
from sentry.investigations.models.block import InvestigationBlockKind
from sentry.investigations.models.orchestration import (
    InvestigationOrchestrationPhase,
    InvestigationOrchestrationStatus,
)

logger = logging.getLogger(__name__)

MAX_TABLE_ROWS = 100
MAX_CHART_SERIES = 5
MAX_POINTS_PER_SERIES = 200
MAX_ARTIFACT_BYTES = 1024 * 1024
MAX_MARKDOWN_CHARS = 100_000
MAX_PROJECTION_BYTES = 512 * 1024
MAX_THOUGHT_TEXT_CHARS = 1_500


def json_byte_size(value: Any) -> int:
    """Measure a payload in the UTF-8 JSON bytes Seer budgets against.

    `default` keeps the tolerance the previous encoder had for types orjson
    cannot serialize, such as the Decimals a query result can carry.
    """

    try:
        return len(orjson.dumps(value, default=str))
    except TypeError as error:
        raise serializers.ValidationError("Payload is not serializable.") from error


class StrictContractSerializer(serializers.Serializer[Any]):
    def to_internal_value(self, data: Any) -> dict[str, Any]:
        if isinstance(data, dict):
            unknown = sorted(set(data) - set(self.fields))
            if unknown:
                raise serializers.ValidationError({field: "Unknown field." for field in unknown})
        return super().to_internal_value(data)


class RelaxedContractSerializer(serializers.Serializer[Any]):
    def to_internal_value(self, data: Any) -> dict[str, Any]:
        validated = super().to_internal_value(data)
        if not isinstance(data, dict):
            return validated
        passthrough = {key: value for key, value in data.items() if key not in self.fields}
        return {**passthrough, **validated}


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
    if json_byte_size(value) > MAX_ARTIFACT_BYTES:
        raise serializers.ValidationError("Query result exceeds the maximum artifact size.")
    serializer = InvestigationQueryResultSerializer(data=value)
    serializer.is_valid(raise_exception=True)
    return dict(serializer.validated_data)


def validate_text_result(value: Any) -> dict[str, Any]:
    if json_byte_size(value) > MAX_ARTIFACT_BYTES:
        raise serializers.ValidationError("Text result exceeds the maximum artifact size.")
    serializer = InvestigationTextResultSerializer(data=value)
    serializer.is_valid(raise_exception=True)
    return dict(serializer.validated_data)


WORK_STATUSES = {
    "not_started",
    "queued",
    "running",
    "blocked",
    "reauth_required",
    "stalled",
    "completed",
    "failed",
    "cancelled",
}
EFFECTIVE_HYPOTHESIS_STATUSES = {
    "pending",
    "investigating",
    "supported",
    "refuted",
    "inconclusive",
    "accepted",
    "rejected",
    "failed",
    "cancelled",
}
REPORT_STATUSES = {
    "not_started",
    "waiting",
    "composing",
    "completed",
    "partial_failed",
    "failed",
    "cancelled",
}
METADATA_STATUSES = {"not_started", "generating", "completed", "failed"}
EVIDENCE_KINDS = {
    "issue",
    "event",
    "trace",
    "profile",
    "replay",
    "query",
    "chart",
    "release",
    "monitor",
    "external",
    "other",
}
PROJECT_BACKED_EVIDENCE_KINDS = EVIDENCE_KINDS - {"external", "other"}

MAX_HYPOTHESES = 50
MAX_VERIFICATION_STEPS = 50
MAX_EVIDENCE_ITEMS = 200
MAX_TOOL_ACTIVITIES = 50
MAX_EVIDENCE_DATA_BYTES = 128 * 1024
MAX_PROJECT_IDS = 100
MAX_PROJECTION_ERRORS = 50
MAX_PROJECTION_INTENTS = 50


class StrictCharField(serializers.CharField):
    """A string that rejects the numbers DRF would stringify, and keeps its whitespace."""

    def __init__(self, **kwargs: Any) -> None:
        kwargs.setdefault("trim_whitespace", False)
        super().__init__(**kwargs)

    def to_internal_value(self, data: Any) -> str:
        if not isinstance(data, str):
            self.fail("invalid")
        return super().to_internal_value(data)


class StrictIntegerField(serializers.IntegerField):
    """An integer that rejects the numeric strings DRF would otherwise parse."""

    def to_internal_value(self, data: Any) -> int:
        if isinstance(data, bool) or not isinstance(data, int):
            self.fail("invalid")
        return super().to_internal_value(data)


class StrictFloatField(serializers.FloatField):
    """A number that rejects the booleans and numeric strings DRF would coerce."""

    def to_internal_value(self, data: Any) -> float:
        if isinstance(data, bool) or not isinstance(data, (int, float)):
            self.fail("invalid")
        return super().to_internal_value(data)


class StrictBooleanField(serializers.BooleanField):
    def to_internal_value(self, data: Any) -> bool:
        if not isinstance(data, bool):
            self.fail("invalid", input=data)
        return data


class OptionalStrictCharField(StrictCharField):
    def __init__(self, max_length: int, **kwargs: Any) -> None:
        kwargs.setdefault("required", False)
        kwargs.setdefault("allow_null", True)
        kwargs.setdefault("allow_blank", True)
        super().__init__(max_length=max_length, **kwargs)


class TimingTimestampField(StrictCharField):
    def __init__(self) -> None:
        super().__init__(max_length=64, required=False, allow_null=True)

    def to_internal_value(self, data: Any) -> str:
        value = super().to_internal_value(data)
        try:
            parsed = parse_datetime(value)
        except ValueError:
            parsed = None
        if parsed is None or not timezone.is_aware(parsed):
            raise serializers.ValidationError("Must be a timezone-aware timestamp.")
        return value


class ProjectionErrorSerializer(RelaxedContractSerializer):
    code = StrictCharField(max_length=128)
    message = StrictCharField(max_length=10_000)
    retryable = StrictBooleanField(required=False)
    source = OptionalStrictCharField(128)  # type: ignore[assignment]
    occurredAt = OptionalStrictCharField(64)


class ToolActivitySerializer(RelaxedContractSerializer):
    id = StrictCharField(max_length=128)
    title = StrictCharField(max_length=200)
    kind = serializers.ChoiceField(choices=["api", "library", "tool", "step"])
    status = serializers.ChoiceField(choices=["queued", "running", "completed", "failed"])


class ThoughtSerializer(RelaxedContractSerializer):
    """The agent's reasoning before the calls that follow it in the same phase's tool activity."""

    id = StrictCharField(max_length=128)
    text = StrictCharField(max_length=MAX_THOUGHT_TEXT_CHARS)
    # The tool activity entry this reasoning came before; null until a call follows it.
    beforeActivityId = OptionalStrictCharField(128)


class ProjectScopedSerializer(RelaxedContractSerializer):
    projectIds = serializers.ListField(
        child=StrictIntegerField(min_value=1, max_value=I64_MAX),
        required=False,
        allow_null=True,
        max_length=MAX_PROJECT_IDS,
    )
    useInvestigationProjectScope = StrictBooleanField(required=False)

    def project_ids_are_required(self, attrs: dict[str, Any]) -> bool:
        return True

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        project_ids = attrs.get("projectIds")
        scoped = attrs.get("useInvestigationProjectScope", False)
        required = self.project_ids_are_required(attrs) and not scoped
        if project_ids is None:
            if required:
                raise serializers.ValidationError(
                    {"projectIds": "Required unless investigation project scope is used."}
                )
            return attrs
        if required and not project_ids:
            raise serializers.ValidationError(
                {"projectIds": "Must not be empty unless investigation project scope is used."}
            )
        if len(project_ids) != len(set(project_ids)):
            raise serializers.ValidationError({"projectIds": "Must be unique."})
        return attrs


class EvidenceSerializer(ProjectScopedSerializer):
    id = StrictCharField(max_length=128)
    title = StrictCharField(max_length=500)
    kind = serializers.ChoiceField(choices=sorted(EVIDENCE_KINDS))
    reference = OptionalStrictCharField(2_000)
    url = OptionalStrictCharField(4_000)
    summary = OptionalStrictCharField(20_000)
    data = serializers.DictField(required=False)  # type: ignore[assignment]

    def project_ids_are_required(self, attrs: dict[str, Any]) -> bool:
        return attrs.get("kind") in PROJECT_BACKED_EVIDENCE_KINDS

    def validate_data(self, value: dict[str, Any]) -> dict[str, Any]:
        if json_byte_size(value) > MAX_EVIDENCE_DATA_BYTES:
            raise serializers.ValidationError("Evidence data is too large.")
        return value


class AgentVerdictSerializer(RelaxedContractSerializer):
    verdict = serializers.ChoiceField(choices=["supported", "refuted", "inconclusive"])
    confidence = StrictFloatField(min_value=0, max_value=1)
    rationale = StrictCharField(max_length=20_000)
    supportingEvidenceIds = serializers.ListField(
        child=StrictCharField(max_length=1_000), required=False, max_length=200
    )
    refutingEvidenceIds = serializers.ListField(
        child=StrictCharField(max_length=1_000), required=False, max_length=200
    )
    remainingGaps = serializers.ListField(
        child=StrictCharField(max_length=1_000), required=False, max_length=200
    )
    decidedAt = OptionalStrictCharField(64)


class VerificationStepSerializer(RelaxedContractSerializer):
    id = StrictCharField(max_length=128)
    order = StrictIntegerField(min_value=0)
    title = StrictCharField(max_length=500)
    objective = StrictCharField(max_length=5_000)
    method = StrictCharField(max_length=5_000)
    status = serializers.ChoiceField(choices=sorted(WORK_STATUSES | {"skipped"}))
    result = OptionalStrictCharField(20_000)
    evidence = serializers.ListField(
        child=EvidenceSerializer(), required=False, max_length=MAX_EVIDENCE_ITEMS
    )
    error = ProjectionErrorSerializer(required=False, allow_null=True)


class UserDispositionSerializer(RelaxedContractSerializer):
    disposition = serializers.ChoiceField(choices=["accepted", "rejected"])
    userId = StrictIntegerField(required=False, allow_null=True, min_value=1, max_value=I64_MAX)
    decidedAt = OptionalStrictCharField(64)


class HypothesisSerializer(RelaxedContractSerializer):
    id = StrictCharField(max_length=128)
    order = StrictIntegerField(min_value=0)
    statement = StrictCharField(max_length=2_000)
    rationale = StrictCharField(max_length=20_000, allow_blank=True)
    status = serializers.ChoiceField(choices=sorted(WORK_STATUSES))
    effectiveStatus = serializers.ChoiceField(choices=sorted(EFFECTIVE_HYPOTHESIS_STATUSES))
    decisionSource = serializers.ChoiceField(choices=["none", "agent", "user"])
    confidence = StrictFloatField(required=False, allow_null=True, min_value=0, max_value=1)
    generation = StrictIntegerField(required=False, min_value=1)
    attempt = StrictIntegerField(required=False, min_value=0)
    automaticRetryCount = StrictIntegerField(required=False, min_value=0, max_value=1)
    investigatorRunId = StrictIntegerField(
        required=False, allow_null=True, min_value=1, max_value=I64_MAX
    )
    planningStatus = serializers.ChoiceField(
        choices=["not_started", "running", "completed", "failed"],
        required=False,
    )
    heartbeatAt = OptionalStrictCharField(64)
    toolActivity = serializers.ListField(
        child=ToolActivitySerializer(),
        required=False,
        max_length=MAX_TOOL_ACTIVITIES,
    )
    thoughts = serializers.ListField(
        child=ThoughtSerializer(),
        required=False,
        max_length=MAX_TOOL_ACTIVITIES,
    )
    evidence = serializers.ListField(
        child=EvidenceSerializer(), required=False, max_length=MAX_EVIDENCE_ITEMS
    )
    verificationSteps = serializers.ListField(
        child=VerificationStepSerializer(),
        required=False,
        max_length=MAX_VERIFICATION_STEPS,
    )
    agentVerdict = AgentVerdictSerializer(required=False, allow_null=True)
    userDisposition = UserDispositionSerializer(required=False, allow_null=True)
    error = ProjectionErrorSerializer(required=False, allow_null=True)


class BroadScanSerializer(RelaxedContractSerializer):
    status = serializers.ChoiceField(choices=sorted(WORK_STATUSES))
    summary = OptionalStrictCharField(20_000)
    heartbeatAt = OptionalStrictCharField(64)
    error = ProjectionErrorSerializer(required=False, allow_null=True, default=None)
    toolActivity = serializers.ListField(
        child=ToolActivitySerializer(),
        required=False,
        default=list,
        max_length=MAX_TOOL_ACTIVITIES,
    )
    thoughts = serializers.ListField(
        child=ThoughtSerializer(),
        required=False,
        default=list,
        max_length=MAX_TOOL_ACTIVITIES,
    )
    generation = StrictIntegerField(required=False, min_value=1)
    attempt = StrictIntegerField(required=False, min_value=0)
    automaticRetryCount = StrictIntegerField(required=False, min_value=0, max_value=1)
    runId = StrictIntegerField(required=False, allow_null=True, min_value=1, max_value=I64_MAX)


class ClearIntentSerializer(RelaxedContractSerializer):
    id = StrictCharField(max_length=128)
    revision = StrictIntegerField(min_value=0)
    reason = StrictCharField(max_length=1_000)
    requestedAt = OptionalStrictCharField(64)
    completed = StrictBooleanField(required=False)


class ReportMetadataSerializer(RelaxedContractSerializer):
    status = serializers.ChoiceField(choices=sorted(METADATA_STATUSES))
    title = OptionalStrictCharField(255)
    summary = OptionalStrictCharField(255)
    summaryDescription = OptionalStrictCharField(10_000)
    titleStatus = serializers.ChoiceField(choices=sorted(METADATA_STATUSES), required=False)
    automaticRetryCount = StrictIntegerField(required=False, min_value=0, max_value=1)
    error = ProjectionErrorSerializer(required=False, allow_null=True)


class SuggestedHypothesisSerializer(RelaxedContractSerializer):
    statement = StrictCharField(max_length=2_000)
    rationale = StrictCharField(max_length=20_000, allow_blank=True)


class ReportSerializer(RelaxedContractSerializer):
    status = serializers.ChoiceField(choices=sorted(REPORT_STATUSES))
    revision = StrictIntegerField(min_value=0, max_value=I32_MAX)
    notebookRevision = StrictIntegerField(min_value=0, max_value=I32_MAX)
    includedHypothesisIds = serializers.ListField(
        child=StrictCharField(max_length=128), required=False, default=list, max_length=50
    )
    primaryHypothesisId = OptionalStrictCharField(128)
    currentBlockKey = OptionalStrictCharField(128)
    currentBlockStatus = serializers.ChoiceField(choices=sorted(WORK_STATUSES), required=False)
    currentBlockToolActivity = serializers.ListField(
        child=ToolActivitySerializer(),
        required=False,
        default=list,
        max_length=MAX_TOOL_ACTIVITIES,
    )
    currentBlockThoughts = serializers.ListField(
        child=ThoughtSerializer(),
        required=False,
        default=list,
        max_length=MAX_TOOL_ACTIVITIES,
    )
    heartbeatAt = OptionalStrictCharField(64)
    automaticRetryCount = StrictIntegerField(required=False, min_value=0, max_value=1)
    clearIntent = ClearIntentSerializer(required=False, allow_null=True)
    metadata = ReportMetadataSerializer()
    suggestedHypotheses = serializers.ListField(
        child=SuggestedHypothesisSerializer(), required=False, max_length=20
    )
    error = ProjectionErrorSerializer(required=False, allow_null=True, default=None)


class PendingInputSerializer(RelaxedContractSerializer):
    prompt = StrictCharField(max_length=4_000)
    missingFields = serializers.ListField(
        child=serializers.ChoiceField(choices=["prompt", "time_range"]),
        required=False,
        max_length=2,
    )


class InvestigatorSchedulingSerializer(RelaxedContractSerializer):
    maxConcurrency = StrictIntegerField(required=False, min_value=0, max_value=50)
    availableSlots = StrictIntegerField(required=False, min_value=0, max_value=50)
    activeHypothesisIds = serializers.ListField(
        child=StrictCharField(max_length=128), required=False, max_length=50
    )
    queuedHypothesisIds = serializers.ListField(
        child=StrictCharField(max_length=128), required=False, max_length=50
    )
    nextHypothesisIds = serializers.ListField(
        child=StrictCharField(max_length=128), required=False, max_length=50
    )


class CancellationIntentSerializer(RelaxedContractSerializer):
    id = StrictCharField(max_length=128)
    scope = serializers.ChoiceField(choices=["broad_scan", "hypothesis", "report", "workflow"])
    targetId = OptionalStrictCharField(128)
    childRunId = StrictIntegerField(required=False, allow_null=True, min_value=1, max_value=I64_MAX)
    generation = StrictIntegerField(min_value=0)
    reason = StrictCharField(max_length=1_000)
    requestedAt = OptionalStrictCharField(64)
    completed = StrictBooleanField(required=False)

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        # Report cancellation fences on the report revision, which is zero for
        # the first report, so only that scope may use generation zero.
        if attrs["scope"] != "report" and attrs["generation"] < 1:
            raise serializers.ValidationError({"generation": "Must be at least 1."})
        return attrs


class SteeringIntentSerializer(RelaxedContractSerializer):
    id = StrictCharField(max_length=128)
    requestId = StrictCharField(max_length=128)
    instruction = StrictCharField(max_length=4_000)
    target = serializers.ChoiceField(choices=["workflow", "hypothesis", "report", "block"])
    targetId = OptionalStrictCharField(128)
    createdAt = OptionalStrictCharField(64)
    completed = StrictBooleanField(required=False)


class OrchestrationProjectionSerializer(RelaxedContractSerializer):
    """The projection blob Seer sends with every orchestration event."""

    def to_internal_value(self, data: Any) -> dict[str, Any]:
        if json_byte_size(data) > MAX_PROJECTION_BYTES:
            raise serializers.ValidationError("Projection is too large.")
        return super().to_internal_value(data)

    workflowVersion = StrictIntegerField(min_value=1, max_value=I32_MAX)
    generation = StrictIntegerField(min_value=1, max_value=I32_MAX)
    phase = serializers.ChoiceField(choices=InvestigationOrchestrationPhase.values)
    status = serializers.ChoiceField(choices=InvestigationOrchestrationStatus.values)
    sourceType = StrictCharField(max_length=64)
    broadScan = BroadScanSerializer()
    hypotheses = serializers.ListField(
        child=HypothesisSerializer(), required=False, default=list, max_length=MAX_HYPOTHESES
    )
    report = ReportSerializer()
    pendingInput = PendingInputSerializer(required=False, allow_null=True)
    investigatorScheduling = InvestigatorSchedulingSerializer(required=False, allow_null=True)
    cancellationIntents = serializers.ListField(
        child=CancellationIntentSerializer(),
        required=False,
        max_length=MAX_PROJECTION_INTENTS,
    )
    steeringIntents = serializers.ListField(
        child=SteeringIntentSerializer(),
        required=False,
        max_length=MAX_PROJECTION_INTENTS,
    )
    errors = serializers.ListField(  # type: ignore[assignment]
        child=ProjectionErrorSerializer(),
        required=False,
        default=list,
        max_length=MAX_PROJECTION_ERRORS,
    )
    heartbeatAt = StrictCharField(max_length=64)
    updatedAt = OptionalStrictCharField(64)
    startedAt = TimingTimestampField()
    finishedAt = TimingTimestampField()
    activeSince = TimingTimestampField()
    activeTimeElapsedSeconds = StrictFloatField(required=False, allow_null=True, min_value=0)

    def validate_heartbeatAt(self, value: str) -> str:
        parsed = parse_datetime(value)
        if parsed is None or not timezone.is_aware(parsed):
            raise serializers.ValidationError("Must be a timezone-aware timestamp.")
        return value


MAX_REPORT_BLOCKS = 200
MAX_ACTION_REQUESTS = 50
ACTION_REQUEST_KEY_PATTERN = re.compile(r"[a-z0-9][a-z0-9_-]{0,63}")
ANCHOR_TYPES = ("block", "hypothesis")


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


MAX_TEXT_DELTA_CHARS = 64 * 1024
MAX_SUMMARY_DESCRIPTION_CHARS = 10_000


class _ReportRevisionMixin(RelaxedContractSerializer):
    reportRevision = StrictIntegerField(min_value=0, max_value=I32_MAX)


class _BlockKeyMixin(_ReportRevisionMixin):
    stableAgentKey = StrictCharField(max_length=128)


class WorkflowUpdatedPayloadSerializer(RelaxedContractSerializer):
    projection = OrchestrationProjectionSerializer()


class StateSnapshotPayloadSerializer(RelaxedContractSerializer):
    projection = OrchestrationProjectionSerializer()
    reportRevision = StrictIntegerField(required=False, min_value=0, max_value=I32_MAX)
    blocks = serializers.ListField(
        child=serializers.DictField(), required=False, max_length=MAX_REPORT_BLOCKS
    )
    metadata = serializers.DictField(required=False, allow_null=True)
    actionRequests = serializers.ListField(child=serializers.JSONField(), required=False)


class ReportClearPayloadSerializer(_ReportRevisionMixin):
    pass


class ReportCompletedPayloadSerializer(_ReportRevisionMixin):
    pass


class ReportBlockRemovedPayloadSerializer(_BlockKeyMixin):
    pass


class ReportBlockStartedPayloadSerializer(_BlockKeyMixin, ProjectScopedSerializer):
    kind = serializers.ChoiceField(choices=InvestigationBlockKind.values)
    position = StrictIntegerField(min_value=0, max_value=I32_MAX)
    producingRunId = StrictIntegerField(
        required=False, allow_null=True, min_value=1, max_value=I64_MAX
    )


class ReportBlockMovedPayloadSerializer(_BlockKeyMixin):
    position = StrictIntegerField(min_value=0, max_value=I32_MAX)


class ReportTextDeltaPayloadSerializer(_BlockKeyMixin):
    delta = StrictCharField(max_length=MAX_TEXT_DELTA_CHARS, allow_blank=True)
    reset = StrictBooleanField(required=False)


class TitleDeltaPayloadSerializer(_ReportRevisionMixin):
    delta = StrictCharField(max_length=1_000, allow_blank=True)
    reset = StrictBooleanField(required=False)


class MetadataCompletedPayloadSerializer(_ReportRevisionMixin):
    summary = StrictCharField(max_length=255)
    summaryDescription = StrictCharField(max_length=MAX_SUMMARY_DESCRIPTION_CHARS)
    title = StrictCharField(required=False, max_length=255)


class ActionPayloadSerializer(RelaxedContractSerializer):
    """Base class for an action kind's payload. Each kind validates its own fields."""

    kind = StrictCharField(max_length=64)

    @classmethod
    def trim(cls, action: dict[str, Any]) -> dict[str, Any] | None:
        """Remove values this kind won't accept. Return None to keep the request as advice."""
        return action


def _payload_serializer(action: Any) -> type[ActionPayloadSerializer] | None:
    from sentry.investigations.services.action_kinds import get_action_kind

    kind = action.get("kind") if isinstance(action, dict) else None
    action_kind = get_action_kind(kind) if isinstance(kind, str) else None
    return action_kind.payload_serializer if action_kind is not None else None


class ActionRequestAnchorSerializer(StrictContractSerializer):
    type = serializers.ChoiceField(choices=ANCHOR_TYPES)
    id = StrictCharField(max_length=128)


class ActionRequestSerializer(RelaxedContractSerializer):
    key = StrictCharField(max_length=64)
    reportRevision = StrictIntegerField(min_value=0, max_value=I32_MAX)
    title = StrictCharField(max_length=200)
    rationale = StrictCharField(max_length=1_000)
    impact = OptionalStrictCharField(1_000)
    primary = StrictBooleanField(required=False, default=False)
    anchor = ActionRequestAnchorSerializer(required=False, allow_null=True, default=None)
    action = serializers.JSONField(required=False, allow_null=True, default=None)

    def validate_key(self, value: str) -> str:
        if ACTION_REQUEST_KEY_PATTERN.fullmatch(value) is None:
            raise serializers.ValidationError("Must be a lowercase slug.")
        return value

    def validate_action(self, value: Any) -> dict[str, Any] | None:
        if value is None:
            return None
        serializer_cls = _payload_serializer(value)
        if serializer_cls is None:
            raise serializers.ValidationError("Unknown action kind.")
        validator = serializer_cls(data=value)
        if not validator.is_valid():
            raise serializers.ValidationError(validator.errors)
        return dict(validator.validated_data)


def _log_extra(item: Any) -> dict[str, Any]:
    key = item.get("key") if isinstance(item, dict) else None
    action = item.get("action") if isinstance(item, dict) else None
    kind = action.get("kind") if isinstance(action, dict) else None
    return {
        "key": key[:64] if isinstance(key, str) else None,
        "kind": kind[:64] if isinstance(kind, str) else None,
    }


def _trimmed(item: Any, *, log: bool) -> Any:
    action = item.get("action") if isinstance(item, dict) else None
    serializer_cls = _payload_serializer(action)
    if serializer_cls is None or not isinstance(action, dict):
        return item
    trimmed = serializer_cls.trim(action)
    if log and trimmed != action:
        logger.warning("investigations.action_requests.action_trimmed", extra=_log_extra(item))
    return {**item, "action": trimmed}


def valid_action_request(item: Any, *, log: bool = False) -> ActionRequestItem | None:
    """Return the request in a form Sentry can store, or None if we can't use it.

    Seer can ship kinds, providers, or fields before Sentry knows about them, so we drop a bad
    request instead of rejecting its whole event. Only the apply path logs, so each drop is
    logged once.
    """
    trimmed = _trimmed(item, log=log)
    validator = ActionRequestSerializer(data=trimmed)
    if validator.is_valid():
        return cast(ActionRequestItem, dict(validator.validated_data))
    if log:
        logger.warning(
            "investigations.action_requests.dropped",
            extra={**_log_extra(item), "fields": sorted(validator.errors)[:10]},
        )
    return None


def valid_action_requests(items: list[Any], *, log: bool = False) -> list[ActionRequestItem]:
    kept: list[ActionRequestItem] = []
    for item in items[:MAX_ACTION_REQUESTS]:
        request = valid_action_request(item, log=log)
        if request is not None and all(other["key"] != request["key"] for other in kept):
            kept.append(request)
    return kept


class ActionRequestedPayloadSerializer(RelaxedContractSerializer):
    request = serializers.JSONField()

    def validate_request(self, value: Any) -> ActionRequestItem | None:
        return valid_action_request(value, log=self.context.get("log_drops", False))


class ActionWithdrawnPayloadSerializer(RelaxedContractSerializer):
    key = StrictCharField(max_length=64)
    reason = StrictCharField(max_length=1_000)


class WorkflowFailedPayloadSerializer(RelaxedContractSerializer):
    error = ProjectionErrorSerializer()
    projection = OrchestrationProjectionSerializer(required=False, allow_null=True)


class ReportFailedPayloadSerializer(_ReportRevisionMixin):
    error = ProjectionErrorSerializer()
    projection = OrchestrationProjectionSerializer(required=False, allow_null=True)


class ReportBlockUpsertedPayloadSerializer(_BlockKeyMixin, ProjectScopedSerializer):
    kind = serializers.ChoiceField(choices=InvestigationBlockKind.values)
    position = StrictIntegerField(required=False, min_value=0, max_value=I32_MAX)
    producingRunId = StrictIntegerField(
        required=False, allow_null=True, min_value=1, max_value=I64_MAX
    )
    title = StrictCharField(required=False, max_length=255, allow_blank=True)
    config = serializers.DictField(required=False)
    display = serializers.DictField(required=False)
    content = StrictCharField(required=False, allow_blank=True, max_length=MAX_MARKDOWN_CHARS)
    generatedContent = StrictCharField(
        required=False, allow_blank=True, max_length=MAX_MARKDOWN_CHARS
    )
    generationPrompt = StrictCharField(
        required=False, allow_blank=True, max_length=MAX_MARKDOWN_CHARS
    )
    result = serializers.JSONField(required=False)

    def to_internal_value(self, data: Any) -> dict[str, Any]:
        if isinstance(data, dict) and "collapsed" in data:
            data = {**data}
            collapsed = data.pop("collapsed")
            if not isinstance(collapsed, bool):
                raise serializers.ValidationError({"collapsed": "Must be a boolean."})
            display = data.get("display")
            if display is not None and not isinstance(display, dict):
                raise serializers.ValidationError({"display": "Must be an object."})
            data["display"] = {**(display or {}), "queryCollapsed": collapsed}
        return super().to_internal_value(data)

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        attrs = super().validate(attrs)
        if attrs.get("kind") != InvestigationBlockKind.QUERY:
            return attrs
        if "result" not in attrs:
            raise serializers.ValidationError({"result": "A query result is required."})
        attrs["result"] = validate_query_result(attrs["result"])
        return attrs


EVENT_PAYLOAD_SERIALIZERS: dict[str, type[RelaxedContractSerializer]] = {
    "workflow_updated": WorkflowUpdatedPayloadSerializer,
    "state_snapshot": StateSnapshotPayloadSerializer,
    "report_clear": ReportClearPayloadSerializer,
    "report_block_started": ReportBlockStartedPayloadSerializer,
    "report_text_delta": ReportTextDeltaPayloadSerializer,
    "report_block_upserted": ReportBlockUpsertedPayloadSerializer,
    "report_block_removed": ReportBlockRemovedPayloadSerializer,
    "report_block_moved": ReportBlockMovedPayloadSerializer,
    "report_completed": ReportCompletedPayloadSerializer,
    "report_failed": ReportFailedPayloadSerializer,
    "title_delta": TitleDeltaPayloadSerializer,
    "metadata_completed": MetadataCompletedPayloadSerializer,
    "action_requested": ActionRequestedPayloadSerializer,
    "action_withdrawn": ActionWithdrawnPayloadSerializer,
    "workflow_failed": WorkflowFailedPayloadSerializer,
}
