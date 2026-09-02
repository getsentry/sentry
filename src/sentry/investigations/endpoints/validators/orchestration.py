from __future__ import annotations

from typing import Any

from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework import serializers

from sentry.investigations.contracts import StrictContractSerializer
from sentry.utils import json

MAX_AGENTIC_SOURCE_BYTES = 200_000


def _validate_time_range(value: Any) -> dict[str, str]:
    if not isinstance(value, dict) or set(value) != {"start", "end"}:
        raise serializers.ValidationError("Must contain only start and end.")
    start_value = value.get("start")
    end_value = value.get("end")
    start = parse_datetime(start_value) if isinstance(start_value, str) else None
    end = parse_datetime(end_value) if isinstance(end_value, str) else None
    if (
        start is None
        or end is None
        or not timezone.is_aware(start)
        or not timezone.is_aware(end)
        or end <= start
    ):
        raise serializers.ValidationError("Must be an ordered timezone-aware range.")
    return value


class ManualSourceSchema(StrictContractSerializer):
    """Free-form investigation context supplied by the requesting user."""

    type = serializers.ChoiceField(choices=["manual"])
    prompt = serializers.CharField(required=False, allow_blank=True, max_length=20_000)
    timeRange = serializers.JSONField(required=False)
    seed = serializers.DictField(required=False)

    def validate_timeRange(self, value: Any) -> dict[str, str]:
        return _validate_time_range(value)


class MetricOpenPeriodRefSchema(StrictContractSerializer):
    """The server-resolved identity of the breached metric being investigated."""

    groupId = serializers.IntegerField(min_value=1)
    openPeriodId = serializers.IntegerField(min_value=1)


class MetricOpenPeriodSourceSchema(StrictContractSerializer):
    type = serializers.ChoiceField(choices=["metric_open_period"])
    ref = MetricOpenPeriodRefSchema()


SOURCE_SCHEMAS: dict[str, type[StrictContractSerializer]] = {
    "manual": ManualSourceSchema,
    "metric_open_period": MetricOpenPeriodSourceSchema,
}


def validate_agentic_source(source: Any) -> dict[str, Any]:
    if not isinstance(source, dict):
        raise serializers.ValidationError({"source": "Must be an object."})
    if len(json.dumps(source).encode()) > MAX_AGENTIC_SOURCE_BYTES:
        raise serializers.ValidationError({"source": "Investigation context is too large."})

    source_type = source.get("type")
    schema = SOURCE_SCHEMAS.get(source_type) if isinstance(source_type, str) else None
    if schema is None:
        raise serializers.ValidationError(
            {"source": "Agentic source type must be manual or metric_open_period."}
        )

    validator = schema(data=source)
    if not validator.is_valid():
        raise serializers.ValidationError({"source": validator.errors})
    return source
