from __future__ import annotations

from typing import Any

from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework import serializers

from sentry.investigations.endpoints.validators.base import StrictCamelSnakeValidator
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


def validate_agentic_source(source: Any) -> dict[str, Any]:
    if not isinstance(source, dict):
        raise serializers.ValidationError({"source": "Must be an object."})
    if len(json.dumps(source).encode()) > MAX_AGENTIC_SOURCE_BYTES:
        raise serializers.ValidationError({"source": "Investigation context is too large."})
    source_type = source.get("type")
    if source_type not in {"manual", "metric_open_period"}:
        raise serializers.ValidationError(
            {"source": "Agentic source type must be manual or metric_open_period."}
        )
    if source_type == "metric_open_period":
        if set(source) != {"type", "ref"}:
            raise serializers.ValidationError(
                {"source": "metric_open_period accepts only its server-resolved ref."}
            )
        source_ref = source.get("ref")
        if not isinstance(source_ref, dict) or set(source_ref) != {"groupId", "openPeriodId"}:
            raise serializers.ValidationError(
                {"source": "metric_open_period requires groupId and openPeriodId."}
            )
        for value in source_ref.values():
            if isinstance(value, bool) or not isinstance(value, int | str):
                raise serializers.ValidationError(
                    {"source": "groupId and openPeriodId must be IDs."}
                )
            try:
                if int(value) < 1:
                    raise ValueError
            except (TypeError, ValueError):
                raise serializers.ValidationError(
                    {"source": "groupId and openPeriodId must be positive IDs."}
                )
        return source

    if not set(source).issubset({"type", "prompt", "timeRange", "seed"}):
        raise serializers.ValidationError(
            {"source": "manual accepts only type, prompt, timeRange, and seed."}
        )
    seed = source.get("seed", {})
    if not isinstance(seed, dict):
        raise serializers.ValidationError({"source": "seed must be an object."})
    prompt = source.get("prompt")
    if "prompt" in source and (not isinstance(prompt, str) or len(prompt) > 20_000):
        raise serializers.ValidationError(
            {"source": "prompt must be a string no longer than 20,000 characters."}
        )
    if "timeRange" in source:
        try:
            _validate_time_range(source["timeRange"])
        except serializers.ValidationError as error:
            raise serializers.ValidationError({"source": error.detail})
    return source


class ProvideInputCommandValidator(StrictCamelSnakeValidator):
    type = serializers.ChoiceField(choices=["provide_input"])
    prompt = serializers.CharField(required=False, max_length=20_000)
    time_range = serializers.JSONField(required=False)

    def validate_time_range(self, value: Any) -> dict[str, str]:
        return _validate_time_range(value)

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        if "prompt" not in attrs and "time_range" not in attrs:
            raise serializers.ValidationError("prompt or timeRange is required.")
        return attrs


class AddHypothesisCommandValidator(StrictCamelSnakeValidator):
    type = serializers.ChoiceField(choices=["add_hypothesis"])
    statement = serializers.CharField(max_length=300)
    rationale = serializers.CharField(required=False, allow_null=True, max_length=1_000)


class SetHypothesisDispositionCommandValidator(StrictCamelSnakeValidator):
    type = serializers.ChoiceField(choices=["set_hypothesis_disposition"])
    hypothesis_id = serializers.CharField(max_length=128)
    disposition = serializers.ChoiceField(
        choices=["accepted", "rejected"], required=False, allow_null=True
    )


class SteerCommandValidator(StrictCamelSnakeValidator):
    type = serializers.ChoiceField(choices=["steer"])
    target = serializers.ChoiceField(choices=["workflow", "hypothesis", "report", "block"])
    target_id = serializers.CharField(required=False, allow_null=True, max_length=128)
    instruction = serializers.CharField(max_length=4_000)

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        if attrs["target"] in {"hypothesis", "block"} and not attrs.get("target_id"):
            raise serializers.ValidationError("hypothesis and block steering require targetId.")
        return attrs


class RetryCommandValidator(StrictCamelSnakeValidator):
    type = serializers.ChoiceField(choices=["retry"])
    target = serializers.ChoiceField(choices=["run", "hypothesis", "report"])
    target_id = serializers.CharField(required=False, allow_null=True, max_length=128)

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        if attrs["target"] == "hypothesis" and not attrs.get("target_id"):
            raise serializers.ValidationError("hypothesis retry requires targetId.")
        return attrs


class CancelCommandValidator(StrictCamelSnakeValidator):
    type = serializers.ChoiceField(choices=["cancel"])
    reason = serializers.CharField(required=False, allow_null=True, max_length=1_000)


COMMAND_VALIDATORS: dict[str, type[StrictCamelSnakeValidator]] = {
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
