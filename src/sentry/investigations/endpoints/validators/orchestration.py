from __future__ import annotations

from typing import Any

from rest_framework import serializers

from sentry.investigations.endpoints.validators.base import StrictCamelSnakeValidator

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


class InvestigationOrchestrationEventValidator(StrictCamelSnakeValidator):
    schema_version = serializers.IntegerField(min_value=1, max_value=1)
    event_id = serializers.UUIDField()
    run_id = serializers.IntegerField(min_value=1)
    investigation_id = serializers.IntegerField(min_value=1)
    sequence = serializers.IntegerField(min_value=1)
    generation = serializers.IntegerField(min_value=1)
    type = serializers.ChoiceField(choices=ORCHESTRATION_EVENT_TYPES)
    payload = serializers.JSONField()

    def validate_payload(self, value: Any) -> dict[str, Any]:
        if not isinstance(value, dict):
            raise serializers.ValidationError("Must be an object.")
        return value


class ProvideInputCommandValidator(StrictCamelSnakeValidator):
    type = serializers.ChoiceField(choices=["provide_input"])
    prompt = serializers.CharField(required=False, max_length=20_000)
    time_range = serializers.JSONField(required=False)

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        if "prompt" not in attrs and "time_range" not in attrs:
            raise serializers.ValidationError("prompt or timeRange is required.")
        if "time_range" in attrs and not isinstance(attrs["time_range"], dict):
            raise serializers.ValidationError({"time_range": "Must be an object."})
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


class RetryCommandValidator(StrictCamelSnakeValidator):
    type = serializers.ChoiceField(choices=["retry"])
    target = serializers.ChoiceField(choices=["run", "hypothesis", "report"])
    target_id = serializers.CharField(required=False, allow_null=True, max_length=128)


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
