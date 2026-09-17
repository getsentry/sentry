from __future__ import annotations

from typing import Any

from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework import serializers

from sentry.db.models.fields.bounded import I32_MAX, I64_MAX
from sentry.investigations.contracts import StrictContractSerializer
from sentry.investigations.endpoints.validators.base import StrictCamelSnakeValidator
from sentry.utils import json

MAX_AGENTIC_SOURCE_BYTES = 200_000
ORCHESTRATION_EVENT_TYPES = (
    "state_snapshot",
    "workflow_updated",
    "report_clear",
    "report_block_started",
    "report_text_delta",
    "report_block_upserted",
    "report_block_removed",
    "report_block_moved",
    "report_completed",
    "report_failed",
    "title_delta",
    "metadata_completed",
    "workflow_failed",
)


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


class ProvideInputCommandValidator(StrictContractSerializer):
    type = serializers.ChoiceField(choices=["provide_input"])
    prompt = serializers.CharField(required=False, max_length=20_000)
    timeRange = serializers.JSONField(required=False)

    def validate_timeRange(self, value: Any) -> dict[str, str]:
        return _validate_time_range(value)

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        if "prompt" not in attrs and "timeRange" not in attrs:
            raise serializers.ValidationError("prompt or timeRange is required.")
        return attrs


class AddHypothesisCommandValidator(StrictContractSerializer):
    type = serializers.ChoiceField(choices=["add_hypothesis"])
    statement = serializers.CharField(max_length=300)
    rationale = serializers.CharField(required=False, allow_null=True, max_length=1_000)


class SetHypothesisDispositionCommandValidator(StrictContractSerializer):
    type = serializers.ChoiceField(choices=["set_hypothesis_disposition"])
    hypothesisId = serializers.CharField(max_length=128)
    disposition = serializers.ChoiceField(
        choices=["accepted", "rejected"], required=False, allow_null=True
    )


class SteerCommandValidator(StrictContractSerializer):
    type = serializers.ChoiceField(choices=["steer"])
    target = serializers.ChoiceField(choices=["workflow", "hypothesis", "report", "block"])
    targetId = serializers.CharField(required=False, allow_null=True, max_length=128)
    instruction = serializers.CharField(max_length=4_000)

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        if attrs["target"] in {"hypothesis", "block"} and not attrs.get("targetId"):
            raise serializers.ValidationError("hypothesis and block steering require targetId.")
        return attrs


class RetryCommandValidator(StrictContractSerializer):
    type = serializers.ChoiceField(choices=["retry"])
    target = serializers.ChoiceField(choices=["run", "hypothesis", "report"])
    targetId = serializers.CharField(required=False, allow_null=True, max_length=128)

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        if attrs["target"] == "hypothesis" and not attrs.get("targetId"):
            raise serializers.ValidationError("hypothesis retry requires targetId.")
        return attrs


class CancelCommandValidator(StrictContractSerializer):
    type = serializers.ChoiceField(choices=["cancel"])
    reason = serializers.CharField(required=False, allow_null=True, max_length=1_000)


COMMAND_VALIDATORS: dict[str, type[StrictContractSerializer]] = {
    "provide_input": ProvideInputCommandValidator,
    "add_hypothesis": AddHypothesisCommandValidator,
    "set_hypothesis_disposition": SetHypothesisDispositionCommandValidator,
    "steer": SteerCommandValidator,
    "retry": RetryCommandValidator,
    "cancel": CancelCommandValidator,
}


class InvestigationOrchestrationCommandValidator(StrictCamelSnakeValidator):
    request_id = serializers.UUIDField()
    expected_workflow_version = serializers.IntegerField(min_value=1)
    command = serializers.JSONField()

    def validate_command(self, value: Any) -> dict[str, Any]:
        if not isinstance(value, dict):
            raise serializers.ValidationError("Must be an object.")
        command_type = value.get("type")
        if not isinstance(command_type, str):
            raise serializers.ValidationError("type is required.")
        validator_type = COMMAND_VALIDATORS.get(command_type)
        if validator_type is None:
            raise serializers.ValidationError("Unsupported command type.")
        validator = validator_type(data=value)
        if not validator.is_valid():
            raise serializers.ValidationError(validator.errors)
        return dict(validator.validated_data)


class InvestigationOrchestrationEventValidator(StrictCamelSnakeValidator):
    schema_version = serializers.IntegerField(min_value=1, max_value=1)
    event_id = serializers.UUIDField()
    run_id = serializers.IntegerField(min_value=1, max_value=I64_MAX)
    investigation_id = serializers.IntegerField(min_value=1, max_value=I64_MAX)
    sequence = serializers.IntegerField(min_value=1, max_value=I32_MAX)
    generation = serializers.IntegerField(min_value=1, max_value=I32_MAX)
    type = serializers.ChoiceField(choices=ORCHESTRATION_EVENT_TYPES)
    payload = serializers.JSONField()

    def validate_payload(self, value: Any) -> dict[str, Any]:
        if not isinstance(value, dict):
            raise serializers.ValidationError("Must be an object.")
        return value
