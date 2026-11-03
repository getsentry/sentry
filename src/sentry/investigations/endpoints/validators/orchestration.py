from __future__ import annotations

from typing import Any

from django.utils import timezone
from django.utils.dateparse import parse_datetime
from drf_spectacular.utils import PolymorphicProxySerializer, extend_schema_field
from rest_framework import serializers

from sentry.db.models.fields.bounded import I32_MAX, I64_MAX
from sentry.notebooks.contracts import StrictContractSerializer
from sentry.notebooks.endpoints.validators.base import StrictCamelSnakeValidator
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
    "action_requested",
    "action_withdrawn",
    "rerun_updated",
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


class InvestigationTimeRangeSchema(StrictContractSerializer):
    start = serializers.DateTimeField(help_text="Inclusive start, with timezone.")
    end = serializers.DateTimeField(help_text="Exclusive end, with timezone; must follow start.")


@extend_schema_field(InvestigationTimeRangeSchema)
class InvestigationTimeRangeField(serializers.JSONField):
    pass


class ManualSourceSchema(StrictContractSerializer):
    """Free-form investigation context supplied by the requesting user."""

    type = serializers.ChoiceField(
        choices=["manual"], help_text="Discriminator identifying this source or command variant."
    )
    prompt = serializers.CharField(
        required=False,
        allow_blank=True,
        max_length=20_000,
        help_text="Investigation question. A manual source without a non-blank prompt waits for input.",
    )
    timeRange = InvestigationTimeRangeField(
        required=False,
        help_text="Optional timezone-aware ISO-8601 start and end timestamps; end must be after start.",
    )
    seed = serializers.DictField(
        required=False, help_text="Optional context object forwarded to the investigation agent."
    )

    def validate_timeRange(self, value: Any) -> dict[str, str]:
        return _validate_time_range(value)


class MetricOpenPeriodRefSchema(StrictContractSerializer):
    """The server-resolved identity of the breached metric being investigated."""

    groupId = serializers.IntegerField(
        min_value=1, help_text="ID of the metric issue in this organization."
    )
    openPeriodId = serializers.IntegerField(
        min_value=1, help_text="ID of the breached metric open period belonging to the issue."
    )


class MetricOpenPeriodSourceSchema(StrictContractSerializer):
    type = serializers.ChoiceField(
        choices=["metric_open_period"],
        help_text="Discriminator identifying this source or command variant.",
    )
    ref = MetricOpenPeriodRefSchema(
        help_text="Reference resolved by the server to the breached metric context."
    )


SOURCE_SCHEMAS: dict[str, type[StrictContractSerializer]] = {
    "manual": ManualSourceSchema,
    "metric_open_period": MetricOpenPeriodSourceSchema,
}


@extend_schema_field(
    PolymorphicProxySerializer(
        component_name="InvestigationSource",
        serializers=list(SOURCE_SCHEMAS.values()),
        resource_type_field_name=None,
    )
)
class InvestigationSourceField(serializers.JSONField):
    pass


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
    type = serializers.ChoiceField(
        choices=["provide_input"],
        help_text="Discriminator identifying this source or command variant.",
    )
    prompt = serializers.CharField(
        required=False,
        max_length=20_000,
        help_text="Investigation question. Supply prompt or timeRange, or both.",
    )
    timeRange = InvestigationTimeRangeField(
        required=False,
        help_text="Optional timezone-aware ISO-8601 start and end timestamps; end must be after start.",
    )

    def validate_timeRange(self, value: Any) -> dict[str, str]:
        return _validate_time_range(value)

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        if "prompt" not in attrs and "timeRange" not in attrs:
            raise serializers.ValidationError("prompt or timeRange is required.")
        return attrs


class AddHypothesisCommandValidator(StrictContractSerializer):
    type = serializers.ChoiceField(
        choices=["add_hypothesis"],
        help_text="Discriminator identifying this source or command variant.",
    )
    statement = serializers.CharField(
        max_length=300, help_text="Hypothesis to investigate, up to 300 characters."
    )
    rationale = serializers.CharField(
        required=False,
        allow_null=True,
        max_length=1_000,
        help_text="Optional rationale for the hypothesis, up to 1,000 characters.",
    )


class SetHypothesisDispositionCommandValidator(StrictContractSerializer):
    type = serializers.ChoiceField(
        choices=["set_hypothesis_disposition"],
        help_text="Discriminator identifying this source or command variant.",
    )
    hypothesisId = serializers.CharField(
        max_length=128, help_text="ID of the hypothesis from the latest projection."
    )
    disposition = serializers.ChoiceField(
        choices=["accepted", "rejected"],
        required=False,
        allow_null=True,
        help_text="Accept or reject a hypothesis; omit or pass null to clear the disposition.",
    )


class SteerCommandValidator(StrictContractSerializer):
    type = serializers.ChoiceField(
        choices=["steer"], help_text="Discriminator identifying this source or command variant."
    )
    target = serializers.ChoiceField(
        choices=["workflow", "hypothesis", "report", "block"], help_text="Scope of the command."
    )
    targetId = serializers.CharField(
        required=False,
        allow_null=True,
        max_length=128,
        help_text="Required for hypothesis targets and block steering; use the ID from the latest projection or block.",
    )
    instruction = serializers.CharField(
        max_length=4_000, help_text="Guidance for the selected target, up to 4,000 characters."
    )

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        if attrs["target"] in {"hypothesis", "block"} and not attrs.get("targetId"):
            raise serializers.ValidationError("hypothesis and block steering require targetId.")
        return attrs


class RetryCommandValidator(StrictContractSerializer):
    type = serializers.ChoiceField(
        choices=["retry"], help_text="Discriminator identifying this source or command variant."
    )
    target = serializers.ChoiceField(
        choices=["run", "hypothesis", "report"], help_text="Scope of the command."
    )
    targetId = serializers.CharField(
        required=False,
        allow_null=True,
        max_length=128,
        help_text="Required when target is hypothesis; use its ID from the latest projection.",
    )

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        if attrs["target"] == "hypothesis" and not attrs.get("targetId"):
            raise serializers.ValidationError("hypothesis retry requires targetId.")
        return attrs


class CancelCommandValidator(StrictContractSerializer):
    type = serializers.ChoiceField(
        choices=["cancel"], help_text="Discriminator identifying this source or command variant."
    )
    reason = serializers.CharField(
        required=False,
        allow_null=True,
        max_length=1_000,
        help_text="Optional reason for cancelling the workflow, up to 1,000 characters.",
    )


COMMAND_VALIDATORS: dict[str, type[StrictContractSerializer]] = {
    "provide_input": ProvideInputCommandValidator,
    "add_hypothesis": AddHypothesisCommandValidator,
    "set_hypothesis_disposition": SetHypothesisDispositionCommandValidator,
    "steer": SteerCommandValidator,
    "retry": RetryCommandValidator,
    "cancel": CancelCommandValidator,
}


@extend_schema_field(
    PolymorphicProxySerializer(
        component_name="InvestigationCommand",
        serializers=list(COMMAND_VALIDATORS.values()),
        resource_type_field_name=None,
    )
)
class InvestigationCommandField(serializers.JSONField):
    pass


class InvestigationOrchestrationCommandValidator(StrictCamelSnakeValidator):
    request_id = serializers.UUIDField(
        help_text="Client-generated UUID for retry-safe submission. Reuse the same ID only for the same request."
    )
    expected_workflow_version = serializers.IntegerField(
        min_value=1,
        help_text="Workflow version from the latest orchestration projection, independent of the notebook version. A stale version returns 409.",
    )
    command = InvestigationCommandField(
        help_text="Workflow command selected by type. Submission acknowledges acceptance; poll orchestration for completion."
    )

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
