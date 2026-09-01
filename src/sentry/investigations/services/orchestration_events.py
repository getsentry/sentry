from __future__ import annotations

import hashlib
from copy import deepcopy
from dataclasses import dataclass
from typing import Any
from uuid import UUID, uuid5

from django.db import IntegrityError, router, transaction
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework import serializers
from rest_framework.exceptions import APIException

from sentry.db.models.fields.bounded import I32_MAX, I64_MAX
from sentry.investigations.contracts import (
    MAX_MARKDOWN_CHARS,
    validate_query_result,
    validate_text_result,
)
from sentry.investigations.models import (
    Investigation,
    InvestigationBlock,
    InvestigationBlockExecution,
    InvestigationBlockExecutionProject,
    InvestigationBlockExecutionStatus,
    InvestigationBlockExecutor,
    InvestigationBlockKind,
    InvestigationOrchestrationEvent,
    InvestigationOrchestrationEventStatus,
    InvestigationOrchestrationPhase,
    InvestigationOrchestrationRun,
    InvestigationOrchestrationStatus,
    InvestigationProject,
    InvestigationStatus,
)
from sentry.models.project import Project
from sentry.utils import json

MAX_ORCHESTRATION_EVENT_BYTES = 1024 * 1024
MAX_ORCHESTRATION_PROJECTION_BYTES = 512 * 1024
MAX_TEXT_DELTA_CHARS = 64 * 1024
MAX_REPORT_BLOCKS = 200
MAX_SUMMARY_DESCRIPTION_CHARS = 10_000
MAX_HYPOTHESES = 50
MAX_VERIFICATION_STEPS = 50
MAX_EVIDENCE_ITEMS = 200
MAX_PROJECTION_ERRORS = 100
MAX_PROJECTION_INTENTS = 200
MAX_TOOL_ACTIVITIES = 50
_REPORT_EXECUTION_NAMESPACE = UUID("7100c312-c3cf-4ba6-92e4-baa54ec227e3")
_CONTROL_KEY = "_sentryControl"
_TERMINAL_STATUSES = {"completed", "failed", "cancelled"}
_WORK_STATUSES = {
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
_EFFECTIVE_HYPOTHESIS_STATUSES = {
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
_REPORT_STATUSES = {
    "not_started",
    "waiting",
    "composing",
    "completed",
    "partial_failed",
    "failed",
    "cancelled",
}
_METADATA_STATUSES = {"not_started", "generating", "completed", "failed"}
_EVIDENCE_KINDS = {
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
_PROJECT_BACKED_EVIDENCE_KINDS = _EVIDENCE_KINDS - {"external", "other"}
_NOTEBOOK_EVENT_TYPES = {
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
}


class InvestigationOrchestrationEventConflict(APIException):
    status_code = 409
    default_detail = "The event identity conflicts with an existing event."
    default_code = "orchestration_event_conflict"


@dataclass(frozen=True)
class OrchestrationEventReceipt:
    duplicate: bool
    application_status: str
    last_applied_sequence: int
    notebook_revision: int

    @property
    def next_expected_sequence(self) -> int:
        return self.last_applied_sequence + 1


@dataclass(frozen=True)
class _OrchestrationEventApplication:
    event: InvestigationOrchestrationEvent
    last_applied_sequence: int
    notebook_revision: int


__all__ = [
    "InvestigationOrchestrationEventConflict",
    "OrchestrationEventReceipt",
    "deliver_orchestration_event",
    "reconcile_orchestration_projection",
    "synchronize_orchestration_projection",
]


def _serialized_size(value: Any) -> int:
    return len(json.dumps(value).encode())


def _require_int(
    payload: dict[str, Any],
    name: str,
    *,
    minimum: int = 0,
    maximum: int = I64_MAX,
) -> int:
    value = payload.get(name)
    if isinstance(value, bool) or not isinstance(value, int) or value < minimum or value > maximum:
        raise serializers.ValidationError({"payload": f"{name} must be an integer."})
    return value


def _require_str(
    payload: dict[str, Any], name: str, *, max_length: int, allow_blank: bool = False
) -> str:
    value = payload.get(name)
    if (
        not isinstance(value, str)
        or len(value) > max_length
        or (not allow_blank and not value.strip())
    ):
        raise serializers.ValidationError({"payload": f"{name} is invalid."})
    return value


def _bounded_list(value: Any, *, name: str, maximum: int) -> list[Any]:
    if not isinstance(value, list) or len(value) > maximum:
        raise serializers.ValidationError(
            {"payload": f"{name} must be a list with at most {maximum} items."}
        )
    return value


def _optional_projection_string(value: Any, *, name: str, max_length: int) -> None:
    if value is not None and (not isinstance(value, str) or len(value) > max_length):
        raise serializers.ValidationError({"payload": f"{name} is invalid."})


def _projection_int(value: Any, *, name: str, minimum: int = 0, maximum: int | None = None) -> int:
    if (
        isinstance(value, bool)
        or not isinstance(value, int)
        or value < minimum
        or (maximum is not None and value > maximum)
    ):
        raise serializers.ValidationError({"payload": f"{name} is invalid."})
    return value


def _validate_projection_error(value: Any, *, name: str) -> None:
    if value is None:
        return
    if not isinstance(value, dict):
        raise serializers.ValidationError({"payload": f"{name} must be an object."})
    _require_str(value, "code", max_length=128)
    _require_str(value, "message", max_length=10_000)
    retryable = value.get("retryable", False)
    if not isinstance(retryable, bool):
        raise serializers.ValidationError({"payload": f"{name}.retryable is invalid."})
    _optional_projection_string(value.get("source"), name=f"{name}.source", max_length=128)
    _optional_projection_string(value.get("occurredAt"), name=f"{name}.occurredAt", max_length=64)


def _validate_tool_activity(value: Any, *, name: str) -> None:
    for index, activity in enumerate(_bounded_list(value, name=name, maximum=MAX_TOOL_ACTIVITIES)):
        item_name = f"{name}[{index}]"
        if not isinstance(activity, dict):
            raise serializers.ValidationError({"payload": f"{item_name} must be an object."})
        _require_str(activity, "id", max_length=128)
        _require_str(activity, "title", max_length=200)
        if activity.get("kind") not in {"api", "library", "tool", "step"}:
            raise serializers.ValidationError({"payload": f"{item_name}.kind is invalid."})
        if activity.get("status") not in {"queued", "running", "completed", "failed"}:
            raise serializers.ValidationError({"payload": f"{item_name}.status is invalid."})


def _validate_evidence(value: Any, *, name: str) -> None:
    for index, evidence in enumerate(_bounded_list(value, name=name, maximum=MAX_EVIDENCE_ITEMS)):
        item_name = f"{name}[{index}]"
        if not isinstance(evidence, dict):
            raise serializers.ValidationError({"payload": f"{item_name} must be an object."})
        _require_str(evidence, "id", max_length=128)
        _require_str(evidence, "title", max_length=500)
        kind = evidence.get("kind")
        if kind not in _EVIDENCE_KINDS:
            raise serializers.ValidationError({"payload": f"{item_name}.kind is invalid."})
        for key, maximum in (("reference", 2_000), ("url", 4_000), ("summary", 20_000)):
            _optional_projection_string(
                evidence.get(key), name=f"{item_name}.{key}", max_length=maximum
            )
        data = evidence.get("data", {})
        if not isinstance(data, dict) or _serialized_size(data) > 128 * 1024:
            raise serializers.ValidationError({"payload": f"{item_name}.data is invalid."})
        _validated_project_ids(evidence, required=kind in _PROJECT_BACKED_EVIDENCE_KINDS)


def _validate_verification_steps(value: Any, *, name: str) -> None:
    for index, step in enumerate(_bounded_list(value, name=name, maximum=MAX_VERIFICATION_STEPS)):
        item_name = f"{name}[{index}]"
        if not isinstance(step, dict):
            raise serializers.ValidationError({"payload": f"{item_name} must be an object."})
        _require_str(step, "id", max_length=128)
        _projection_int(step.get("order"), name=f"{item_name}.order")
        for key, maximum in (("title", 500), ("objective", 5_000), ("method", 5_000)):
            _require_str(step, key, max_length=maximum)
        if step.get("status") not in _WORK_STATUSES:
            raise serializers.ValidationError({"payload": f"{item_name}.status is invalid."})
        _optional_projection_string(
            step.get("result"), name=f"{item_name}.result", max_length=20_000
        )
        _validate_evidence(step.get("evidence", []), name=f"{item_name}.evidence")
        _validate_projection_error(step.get("error"), name=f"{item_name}.error")


def _validate_agent_verdict(value: Any, *, name: str) -> None:
    if value is None:
        return
    if not isinstance(value, dict):
        raise serializers.ValidationError({"payload": f"{name} must be an object."})
    if value.get("verdict") not in {"supported", "refuted", "inconclusive"}:
        raise serializers.ValidationError({"payload": f"{name}.verdict is invalid."})
    confidence = value.get("confidence")
    if (
        isinstance(confidence, bool)
        or not isinstance(confidence, int | float)
        or not 0 <= confidence <= 1
    ):
        raise serializers.ValidationError({"payload": f"{name}.confidence is invalid."})
    _require_str(value, "rationale", max_length=20_000)
    for key in ("supportingEvidenceIds", "refutingEvidenceIds", "remainingGaps"):
        items = _bounded_list(value.get(key, []), name=f"{name}.{key}", maximum=200)
        if any(not isinstance(item, str) or len(item) > 1_000 for item in items):
            raise serializers.ValidationError({"payload": f"{name}.{key} is invalid."})
    _optional_projection_string(value.get("decidedAt"), name=f"{name}.decidedAt", max_length=64)


def _validate_hypotheses(value: Any) -> None:
    for index, hypothesis in enumerate(
        _bounded_list(value, name="hypotheses", maximum=MAX_HYPOTHESES)
    ):
        name = f"hypotheses[{index}]"
        if not isinstance(hypothesis, dict):
            raise serializers.ValidationError({"payload": f"{name} must be an object."})
        _require_str(hypothesis, "id", max_length=128)
        _projection_int(hypothesis.get("order"), name=f"{name}.order")
        _require_str(hypothesis, "statement", max_length=2_000)
        _require_str(hypothesis, "rationale", max_length=20_000, allow_blank=True)
        if hypothesis.get("status") not in _WORK_STATUSES:
            raise serializers.ValidationError({"payload": f"{name}.status is invalid."})
        if hypothesis.get("effectiveStatus") not in _EFFECTIVE_HYPOTHESIS_STATUSES:
            raise serializers.ValidationError({"payload": f"{name}.effectiveStatus is invalid."})
        if hypothesis.get("decisionSource") not in {"none", "agent", "user"}:
            raise serializers.ValidationError({"payload": f"{name}.decisionSource is invalid."})
        confidence = hypothesis.get("confidence")
        if confidence is not None and (
            isinstance(confidence, bool)
            or not isinstance(confidence, int | float)
            or not 0 <= confidence <= 1
        ):
            raise serializers.ValidationError({"payload": f"{name}.confidence is invalid."})
        for key, minimum, maximum in (
            ("generation", 1, None),
            ("attempt", 0, None),
            ("automaticRetryCount", 0, 1),
        ):
            if key in hypothesis:
                _projection_int(
                    hypothesis[key], name=f"{name}.{key}", minimum=minimum, maximum=maximum
                )
        investigator_run_id = hypothesis.get("investigatorRunId")
        if investigator_run_id is not None:
            _projection_int(investigator_run_id, name=f"{name}.investigatorRunId", minimum=1)
        if hypothesis.get("planningStatus", "completed") not in {
            "not_started",
            "running",
            "completed",
            "failed",
        }:
            raise serializers.ValidationError({"payload": f"{name}.planningStatus is invalid."})
        _optional_projection_string(
            hypothesis.get("heartbeatAt"), name=f"{name}.heartbeatAt", max_length=64
        )
        _validate_agent_verdict(hypothesis.get("agentVerdict"), name=f"{name}.agentVerdict")
        disposition = hypothesis.get("userDisposition")
        if disposition is not None:
            if not isinstance(disposition, dict) or disposition.get("disposition") not in {
                "accepted",
                "rejected",
            }:
                raise serializers.ValidationError(
                    {"payload": f"{name}.userDisposition is invalid."}
                )
            user_id = disposition.get("userId")
            if user_id is not None:
                _projection_int(user_id, name=f"{name}.userDisposition.userId", minimum=1)
            _optional_projection_string(
                disposition.get("decidedAt"),
                name=f"{name}.userDisposition.decidedAt",
                max_length=64,
            )
        _validate_verification_steps(
            hypothesis.get("verificationSteps", []), name=f"{name}.verificationSteps"
        )
        _validate_evidence(hypothesis.get("evidence", []), name=f"{name}.evidence")
        _validate_tool_activity(hypothesis.get("toolActivity", []), name=f"{name}.toolActivity")
        _validate_projection_error(hypothesis.get("error"), name=f"{name}.error")


def _validate_projection(projection: dict[str, Any]) -> dict[str, Any]:
    if _serialized_size(projection) > MAX_ORCHESTRATION_PROJECTION_BYTES:
        raise serializers.ValidationError({"payload": "Projection is too large."})
    normalized = deepcopy(projection)
    _projection_int(
        normalized.get("workflowVersion"),
        name="workflowVersion",
        minimum=1,
        maximum=I32_MAX,
    )
    _projection_int(
        normalized.get("generation"),
        name="generation",
        minimum=1,
        maximum=I32_MAX,
    )
    if normalized.get("phase") not in InvestigationOrchestrationPhase.values:
        raise serializers.ValidationError({"payload": "phase is invalid."})
    if normalized.get("status") not in InvestigationOrchestrationStatus.values:
        raise serializers.ValidationError({"payload": "status is invalid."})
    source_type = normalized.get("sourceType")
    if not isinstance(source_type, str) or len(source_type) > 64:
        raise serializers.ValidationError({"payload": "sourceType is invalid."})

    broad_scan = normalized.get("broadScan")
    if not isinstance(broad_scan, dict) or broad_scan.get("status") not in _WORK_STATUSES:
        raise serializers.ValidationError({"payload": "broadScan is invalid."})
    broad_scan.setdefault("summary", None)
    broad_scan.setdefault("error", None)
    broad_scan.setdefault("toolActivity", [])
    _optional_projection_string(
        broad_scan.get("summary"), name="broadScan.summary", max_length=20_000
    )
    _optional_projection_string(
        broad_scan.get("heartbeatAt"), name="broadScan.heartbeatAt", max_length=64
    )
    _validate_tool_activity(broad_scan["toolActivity"], name="broadScan.toolActivity")
    _validate_projection_error(broad_scan["error"], name="broadScan.error")
    for key, minimum, maximum in (
        ("generation", 1, None),
        ("attempt", 0, None),
        ("automaticRetryCount", 0, 1),
    ):
        if key in broad_scan:
            _projection_int(
                broad_scan[key],
                name=f"broadScan.{key}",
                minimum=minimum,
                maximum=maximum,
            )
    broad_scan_run_id = broad_scan.get("runId")
    if broad_scan_run_id is not None:
        _projection_int(broad_scan_run_id, name="broadScan.runId", minimum=1)

    normalized.setdefault("hypotheses", [])
    _validate_hypotheses(normalized["hypotheses"])

    report = normalized.get("report")
    if not isinstance(report, dict) or report.get("status") not in _REPORT_STATUSES:
        raise serializers.ValidationError({"payload": "report is invalid."})
    _projection_int(report.get("revision"), name="report.revision", maximum=I32_MAX)
    _projection_int(
        report.get("notebookRevision"),
        name="report.notebookRevision",
        maximum=I32_MAX,
    )
    report.setdefault("includedHypothesisIds", [])
    report.setdefault("primaryHypothesisId", None)
    report.setdefault("currentBlockKey", None)
    report.setdefault("error", None)
    included = _bounded_list(
        report["includedHypothesisIds"], name="report.includedHypothesisIds", maximum=50
    )
    if any(not isinstance(item, str) or len(item) > 128 for item in included):
        raise serializers.ValidationError({"payload": "report.includedHypothesisIds is invalid."})
    _optional_projection_string(
        report["primaryHypothesisId"], name="report.primaryHypothesisId", max_length=128
    )
    _optional_projection_string(
        report["currentBlockKey"], name="report.currentBlockKey", max_length=128
    )
    _optional_projection_string(report.get("heartbeatAt"), name="report.heartbeatAt", max_length=64)
    if report.get("currentBlockStatus", "not_started") not in _WORK_STATUSES:
        raise serializers.ValidationError({"payload": "report.currentBlockStatus is invalid."})
    report.setdefault("currentBlockToolActivity", [])
    _validate_tool_activity(
        report["currentBlockToolActivity"], name="report.currentBlockToolActivity"
    )
    if "automaticRetryCount" in report:
        _projection_int(
            report["automaticRetryCount"],
            name="report.automaticRetryCount",
            maximum=1,
        )
    clear_intent = report.get("clearIntent")
    if clear_intent is not None:
        if not isinstance(clear_intent, dict):
            raise serializers.ValidationError({"payload": "report.clearIntent is invalid."})
        _require_str(clear_intent, "id", max_length=128)
        _projection_int(clear_intent.get("revision"), name="report.clearIntent.revision")
        _require_str(clear_intent, "reason", max_length=1_000)
        _optional_projection_string(
            clear_intent.get("requestedAt"),
            name="report.clearIntent.requestedAt",
            max_length=64,
        )
        if not isinstance(clear_intent.get("completed", False), bool):
            raise serializers.ValidationError(
                {"payload": "report.clearIntent.completed is invalid."}
            )
    metadata = report.get("metadata")
    if not isinstance(metadata, dict) or metadata.get("status") not in _METADATA_STATUSES:
        raise serializers.ValidationError({"payload": "report.metadata is invalid."})
    for key, maximum in (("title", 255), ("summary", 255), ("summaryDescription", 10_000)):
        _optional_projection_string(
            metadata.get(key), name=f"report.metadata.{key}", max_length=maximum
        )
    _validate_projection_error(metadata.get("error"), name="report.metadata.error")
    if metadata.get("titleStatus", "not_started") not in _METADATA_STATUSES:
        raise serializers.ValidationError({"payload": "report.metadata.titleStatus is invalid."})
    if "automaticRetryCount" in metadata:
        _projection_int(
            metadata["automaticRetryCount"],
            name="report.metadata.automaticRetryCount",
            maximum=1,
        )
    _validate_projection_error(report["error"], name="report.error")
    for index, suggestion in enumerate(
        _bounded_list(
            report.get("suggestedHypotheses", []),
            name="report.suggestedHypotheses",
            maximum=20,
        )
    ):
        name = f"report.suggestedHypotheses[{index}]"
        if not isinstance(suggestion, dict):
            raise serializers.ValidationError({"payload": f"{name} must be an object."})
        _require_str(suggestion, "statement", max_length=2_000)
        _require_str(suggestion, "rationale", max_length=20_000, allow_blank=True)

    normalized.setdefault("errors", [])
    errors = _bounded_list(normalized["errors"], name="errors", maximum=MAX_PROJECTION_ERRORS)
    for index, error in enumerate(errors):
        _validate_projection_error(error, name=f"errors[{index}]")

    pending_input = normalized.get("pendingInput")
    if pending_input is not None:
        if not isinstance(pending_input, dict):
            raise serializers.ValidationError({"payload": "pendingInput is invalid."})
        missing_fields = _bounded_list(
            pending_input.get("missingFields", []), name="pendingInput.missingFields", maximum=2
        )
        if any(field not in {"prompt", "time_range"} for field in missing_fields):
            raise serializers.ValidationError({"payload": "pendingInput.missingFields is invalid."})
        _require_str(pending_input, "prompt", max_length=4_000)

    scheduling = normalized.get("investigatorScheduling")
    if scheduling is not None:
        if not isinstance(scheduling, dict):
            raise serializers.ValidationError({"payload": "investigatorScheduling is invalid."})
        for key in ("maxConcurrency", "availableSlots"):
            if key in scheduling:
                _projection_int(scheduling[key], name=f"investigatorScheduling.{key}", maximum=50)
        for key in ("activeHypothesisIds", "queuedHypothesisIds", "nextHypothesisIds"):
            values = _bounded_list(
                scheduling.get(key, []), name=f"investigatorScheduling.{key}", maximum=50
            )
            if any(not isinstance(value, str) or len(value) > 128 for value in values):
                raise serializers.ValidationError(
                    {"payload": f"investigatorScheduling.{key} is invalid."}
                )

    cancellation_intents = normalized.get("cancellationIntents", [])
    for index, intent in enumerate(
        _bounded_list(
            cancellation_intents,
            name="cancellationIntents",
            maximum=MAX_PROJECTION_INTENTS,
        )
    ):
        name = f"cancellationIntents[{index}]"
        if not isinstance(intent, dict):
            raise serializers.ValidationError({"payload": f"{name} must be an object."})
        _require_str(intent, "id", max_length=128)
        if intent.get("scope") not in {"broad_scan", "hypothesis", "report", "workflow"}:
            raise serializers.ValidationError({"payload": f"{name}.scope is invalid."})
        _optional_projection_string(intent.get("targetId"), name=f"{name}.targetId", max_length=128)
        child_run_id = intent.get("childRunId")
        if child_run_id is not None:
            _projection_int(child_run_id, name=f"{name}.childRunId", minimum=1)
        # Report cancellation uses the report revision as its fence. The first
        # report can therefore be cancelled while that revision is still zero.
        _projection_int(
            intent.get("generation"),
            name=f"{name}.generation",
            minimum=0 if intent["scope"] == "report" else 1,
        )
        _require_str(intent, "reason", max_length=1_000)
        _optional_projection_string(
            intent.get("requestedAt"), name=f"{name}.requestedAt", max_length=64
        )
        if not isinstance(intent.get("completed", False), bool):
            raise serializers.ValidationError({"payload": f"{name}.completed is invalid."})

    steering_intents = normalized.get("steeringIntents", [])
    for index, intent in enumerate(
        _bounded_list(steering_intents, name="steeringIntents", maximum=MAX_PROJECTION_INTENTS)
    ):
        name = f"steeringIntents[{index}]"
        if not isinstance(intent, dict):
            raise serializers.ValidationError({"payload": f"{name} must be an object."})
        for key, maximum in (("id", 128), ("requestId", 128), ("instruction", 4_000)):
            _require_str(intent, key, max_length=maximum)
        if intent.get("target") not in {"workflow", "hypothesis", "report", "block"}:
            raise serializers.ValidationError({"payload": f"{name}.target is invalid."})
        _optional_projection_string(intent.get("targetId"), name=f"{name}.targetId", max_length=128)
        _optional_projection_string(
            intent.get("createdAt"), name=f"{name}.createdAt", max_length=64
        )
        if not isinstance(intent.get("completed", False), bool):
            raise serializers.ValidationError({"payload": f"{name}.completed is invalid."})
    heartbeat = normalized.get("heartbeatAt")
    if not isinstance(heartbeat, str) or len(heartbeat) > 64:
        raise serializers.ValidationError({"payload": "heartbeatAt is invalid."})
    parsed_heartbeat = parse_datetime(heartbeat)
    if parsed_heartbeat is None or not timezone.is_aware(parsed_heartbeat):
        raise serializers.ValidationError({"payload": "heartbeatAt is invalid."})
    _optional_projection_string(normalized.get("updatedAt"), name="updatedAt", max_length=64)
    return normalized


def _projection_evidence_project_ids(projection: dict[str, Any]) -> set[int]:
    project_ids: set[int] = set()
    hypotheses = projection.get("hypotheses")
    if not isinstance(hypotheses, list):
        return project_ids
    for hypothesis in hypotheses:
        if not isinstance(hypothesis, dict):
            continue
        evidence_groups = [hypothesis.get("evidence", [])]
        verification_steps = hypothesis.get("verificationSteps", [])
        if isinstance(verification_steps, list):
            evidence_groups.extend(
                step.get("evidence", []) for step in verification_steps if isinstance(step, dict)
            )
        for evidence_group in evidence_groups:
            if not isinstance(evidence_group, list):
                continue
            for evidence in evidence_group:
                if isinstance(evidence, dict):
                    project_ids.update(
                        _validated_project_ids(
                            evidence,
                            required=evidence.get("kind") in _PROJECT_BACKED_EVIDENCE_KINDS,
                        )
                    )
    return project_ids


def _validate_projection_project_scope(
    run: InvestigationOrchestrationRun, projection: dict[str, Any]
) -> None:
    project_ids = _projection_evidence_project_ids(projection)
    if not project_ids:
        return
    allowed_project_ids = set(
        InvestigationProject.objects.filter(investigation=run.investigation).values_list(
            "project_id", flat=True
        )
    )
    if not project_ids.issubset(allowed_project_ids):
        raise serializers.ValidationError(
            {"payload": "Projection evidence is outside the investigation project scope."}
        )


def _validate_event_payload(event_type: str, payload: dict[str, Any]) -> None:
    if event_type in {"workflow_updated", "state_snapshot"}:
        if not isinstance(payload.get("projection"), dict):
            raise serializers.ValidationError({"payload": "projection must be an object."})
        _validate_projection(payload["projection"])
        if event_type == "state_snapshot" and "blocks" in payload:
            blocks = payload["blocks"]
            if not isinstance(blocks, list) or len(blocks) > MAX_REPORT_BLOCKS:
                raise serializers.ValidationError(
                    {"payload": f"blocks may contain at most {MAX_REPORT_BLOCKS} items."}
                )
        return

    if event_type in {
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
    }:
        _require_int(payload, "reportRevision", minimum=0, maximum=I32_MAX)

    if event_type in {
        "report_block_started",
        "report_text_delta",
        "report_block_upserted",
        "report_block_removed",
        "report_block_moved",
    }:
        _require_str(payload, "stableAgentKey", max_length=128)

    if event_type == "report_block_started":
        if payload.get("kind") not in InvestigationBlockKind.values:
            raise serializers.ValidationError({"payload": "kind must be text or query."})
        _require_int(payload, "position", minimum=0, maximum=I32_MAX)
        _validated_project_ids(payload, required=True)
        if payload.get("producingRunId") is not None:
            _require_int(payload, "producingRunId", minimum=1)
    elif event_type == "report_text_delta":
        _require_str(
            payload,
            "delta",
            max_length=MAX_TEXT_DELTA_CHARS,
            allow_blank=True,
        )
        if "reset" in payload and not isinstance(payload["reset"], bool):
            raise serializers.ValidationError({"payload": "reset must be a boolean."})
    elif event_type == "report_block_upserted":
        normalized = _normalize_block_payload(payload)
        if normalized.get("kind") not in InvestigationBlockKind.values:
            raise serializers.ValidationError({"payload": "kind must be text or query."})
        if "position" in normalized:
            _require_int(normalized, "position", minimum=0, maximum=I32_MAX)
        if normalized.get("kind") == InvestigationBlockKind.QUERY:
            if "result" not in normalized:
                raise serializers.ValidationError({"payload": "A query result is required."})
            validate_query_result(normalized["result"])
        _validated_project_ids(normalized, required=True)
        if normalized.get("producingRunId") is not None:
            _require_int(normalized, "producingRunId", minimum=1)
        for key in ("content", "generatedContent"):
            value = normalized.get(key)
            if value is not None and (
                not isinstance(value, str) or len(value) > MAX_MARKDOWN_CHARS
            ):
                raise serializers.ValidationError({"payload": f"{key} is too large."})
    elif event_type == "report_block_moved":
        _require_int(payload, "position", minimum=0, maximum=I32_MAX)
    elif event_type == "title_delta":
        _require_str(payload, "delta", max_length=1_000, allow_blank=True)
        if "reset" in payload and not isinstance(payload["reset"], bool):
            raise serializers.ValidationError({"payload": "reset must be a boolean."})
    elif event_type == "metadata_completed":
        _require_str(payload, "summary", max_length=255)
        _require_str(
            payload,
            "summaryDescription",
            max_length=MAX_SUMMARY_DESCRIPTION_CHARS,
        )
        if "title" in payload:
            _require_str(payload, "title", max_length=255)
    elif event_type in {"report_failed", "workflow_failed"}:
        if not isinstance(payload.get("error"), dict):
            raise serializers.ValidationError({"payload": "error must be an object."})
        _validate_projection_error(payload["error"], name="error")
        projection = payload.get("projection")
        if projection is not None:
            if not isinstance(projection, dict):
                raise serializers.ValidationError({"payload": "projection must be an object."})
            _validate_projection(projection)


def _normalize_block_payload(payload: dict[str, Any]) -> dict[str, Any]:
    normalized = deepcopy(payload)
    collapsed = normalized.pop("collapsed", None)
    if collapsed is not None:
        if not isinstance(collapsed, bool):
            raise serializers.ValidationError({"payload": "collapsed must be a boolean."})
        display = normalized.get("display")
        if not isinstance(display, dict):
            display = {}
        display["queryCollapsed"] = collapsed
        normalized["display"] = display
    return normalized


def _validated_project_ids(
    payload: dict[str, Any],
    *,
    required: bool,
) -> list[int]:
    project_ids = payload.get("projectIds")
    use_investigation_scope = payload.get("useInvestigationProjectScope", False)
    if not isinstance(use_investigation_scope, bool):
        raise serializers.ValidationError(
            {"payload": "useInvestigationProjectScope must be a boolean."}
        )
    if project_ids is None and (not required or use_investigation_scope):
        return []
    if (
        not isinstance(project_ids, list)
        or (required and not project_ids and not use_investigation_scope)
        or len(project_ids) > 100
        or any(
            isinstance(project_id, bool)
            or not isinstance(project_id, int)
            or project_id < 1
            or project_id > I64_MAX
            for project_id in project_ids
        )
        or len(project_ids) != len(set(project_ids))
    ):
        raise serializers.ValidationError(
            {
                "payload": (
                    "projectIds must contain one or more unique project IDs unless "
                    "investigation project scope is explicitly used."
                )
            }
        )
    return project_ids


def _stored_event_payload(event: dict[str, Any]) -> dict[str, Any]:
    return {
        "schemaVersion": event["schema_version"],
        "runId": event["run_id"],
        "investigationId": event["investigation_id"],
        "generation": event["generation"],
        "payload": deepcopy(event["payload"]),
    }


def _event_generation(event: InvestigationOrchestrationEvent) -> int:
    return int(event.payload["generation"])


def _event_data(event: InvestigationOrchestrationEvent) -> dict[str, Any]:
    value = event.payload.get("payload")
    return value if isinstance(value, dict) else {}


def _control(run: InvestigationOrchestrationRun) -> dict[str, Any]:
    value = run.projection.get(_CONTROL_KEY)
    if not isinstance(value, dict):
        value = {}
        run.projection[_CONTROL_KEY] = value
    return value


def _report_revision(run: InvestigationOrchestrationRun) -> int:
    value = _control(run).get("reportRevision", 0)
    return value if isinstance(value, int) and not isinstance(value, bool) and value >= 0 else 0


def _notebook_writes_are_fenced(
    run: InvestigationOrchestrationRun,
    *,
    event_generation: int,
) -> bool:
    if run.investigation.status == InvestigationStatus.ARCHIVED:
        return True
    fence_generation = _control(run).get("notebookWriteFenceGeneration")
    return (
        isinstance(fence_generation, int)
        and not isinstance(fence_generation, bool)
        and event_generation <= fence_generation
    )


def _set_projection(
    run: InvestigationOrchestrationRun,
    projection: dict[str, Any],
    *,
    event_generation: int,
    authoritative_workflow_version: bool = False,
) -> None:
    projection = _validate_projection(projection)
    _validate_projection_project_scope(run, projection)
    investigation_id = projection.get("investigationId")
    run_id = projection.get("runId")
    generation = projection.get("generation")
    if isinstance(investigation_id, bool) or not isinstance(investigation_id, int | str):
        raise serializers.ValidationError({"payload": "Projection IDs are invalid."})
    if isinstance(run_id, bool) or not isinstance(run_id, int | str):
        raise serializers.ValidationError({"payload": "Projection IDs are invalid."})
    try:
        normalized_investigation_id = int(investigation_id)
        normalized_run_id = int(run_id)
    except (TypeError, ValueError) as error:
        raise serializers.ValidationError({"payload": "Projection IDs are invalid."}) from error
    if (
        normalized_investigation_id != run.investigation_id
        or run.seer_run_id is None
        or normalized_run_id != run.seer_run_id
        or generation != event_generation
    ):
        raise serializers.ValidationError(
            {"payload": "Projection IDs or generation do not match the event."}
        )

    previous_control = deepcopy(_control(run))
    run.projection = deepcopy(projection)
    run.projection[_CONTROL_KEY] = previous_control

    workflow_version = projection.get("workflowVersion")
    if isinstance(workflow_version, int) and not isinstance(workflow_version, bool):
        run.workflow_version = (
            workflow_version
            if authoritative_workflow_version
            else max(run.workflow_version, workflow_version)
        )
    run.generation = event_generation
    phase = projection.get("phase")
    if phase in InvestigationOrchestrationPhase.values:
        run.phase = phase
    status = projection.get("status")
    if status in InvestigationOrchestrationStatus.values:
        run.status = status
    heartbeat = projection["heartbeatAt"]
    assert isinstance(heartbeat, str)
    parsed_heartbeat = parse_datetime(heartbeat)
    assert parsed_heartbeat is not None and timezone.is_aware(parsed_heartbeat)
    run.heartbeat_at = parsed_heartbeat
    projection_error = projection.get("error")
    if projection_error is None or isinstance(projection_error, dict):
        run.error = deepcopy(projection_error)


def _projection_is_stale(
    run: InvestigationOrchestrationRun,
    projection: dict[str, Any],
    *,
    event_generation: int,
) -> bool:
    workflow_version = projection.get("workflowVersion")
    return (
        event_generation == run.generation
        and isinstance(workflow_version, int)
        and not isinstance(workflow_version, bool)
        and workflow_version < run.workflow_version
    )


def _finish_report_executions(
    run: InvestigationOrchestrationRun,
    *,
    status: str,
    error: dict[str, Any],
    revision: int | None = None,
    stable_agent_key: str | None = None,
    block_ids: list[int] | None = None,
) -> int:
    executions = InvestigationBlockExecution.objects.filter(
        block__investigation=run.investigation,
        block__report_revision__isnull=False,
        block__stable_agent_key__isnull=False,
        status__in=(
            InvestigationBlockExecutionStatus.PENDING,
            InvestigationBlockExecutionStatus.RUNNING,
            InvestigationBlockExecutionStatus.AWAITING_INPUT,
            InvestigationBlockExecutionStatus.STOPPING,
        ),
    )
    if revision is not None:
        executions = executions.filter(block__report_revision=revision)
    if stable_agent_key is not None:
        executions = executions.filter(block__stable_agent_key=stable_agent_key)
    if block_ids is not None:
        executions = executions.filter(block_id__in=block_ids)
    now = timezone.now()
    return executions.update(
        status=status,
        error=deepcopy(error),
        completed_at=now,
        date_updated=now,
    )


def _cancel_report_executions(
    run: InvestigationOrchestrationRun,
    *,
    revision: int | None = None,
    stable_agent_key: str | None = None,
    block_ids: list[int] | None = None,
) -> int:
    return _finish_report_executions(
        run,
        status=InvestigationBlockExecutionStatus.CANCELLED,
        error={
            "code": "investigation_report_restarted",
            "message": "The investigation report was restarted.",
        },
        revision=revision,
        stable_agent_key=stable_agent_key,
        block_ids=block_ids,
    )


def _fail_report_executions(
    run: InvestigationOrchestrationRun,
    *,
    revision: int | None = None,
) -> int:
    return _finish_report_executions(
        run,
        status=InvestigationBlockExecutionStatus.FAILED,
        error={
            "code": "investigation_report_failed",
            "message": "The investigation report could not be completed.",
        },
        revision=revision,
    )


def _cancel_workflow_report_executions(run: InvestigationOrchestrationRun) -> int:
    return _finish_report_executions(
        run,
        status=InvestigationBlockExecutionStatus.CANCELLED,
        error={
            "code": "investigation_cancelled",
            "message": "The investigation was cancelled.",
        },
    )


def _adopt_preserved_report_revision(
    run: InvestigationOrchestrationRun, projection: dict[str, Any]
) -> bool:
    report = projection.get("report")
    if not isinstance(report, dict):
        return False
    clear_intent = report.get("clearIntent")
    if isinstance(clear_intent, dict):
        revision = clear_intent.get("revision")
        if (
            clear_intent.get("completed") is True
            and isinstance(revision, int)
            and not isinstance(revision, bool)
        ):
            return _clear_report(run, revision, bump=False)
        return False
    revision = report.get("revision")
    if (
        isinstance(revision, bool)
        or not isinstance(revision, int)
        or revision <= _report_revision(run)
    ):
        return False
    live_blocks = InvestigationBlock.objects.filter(
        investigation=run.investigation,
        report_revision__isnull=False,
        stable_agent_key__isnull=False,
        deleted_at__isnull=True,
    )
    completed_ids = list(
        live_blocks.filter(
            current_execution__status=InvestigationBlockExecutionStatus.COMPLETED
        ).values_list("id", flat=True)
    )
    discarded_ids = list(live_blocks.exclude(id__in=completed_ids).values_list("id", flat=True))
    now = timezone.now()
    if completed_ids:
        InvestigationBlock.objects.filter(id__in=completed_ids).update(
            report_revision=revision,
            date_updated=now,
        )
    if discarded_ids:
        _cancel_report_executions(run, block_ids=discarded_ids)
        InvestigationBlock.objects.filter(id__in=discarded_ids).update(
            deleted_at=now,
            date_updated=now,
        )
    _control(run).update({"reportRevision": revision, "reportCleared": False})
    return bool(discarded_ids)


def _bump_notebook(run: InvestigationOrchestrationRun, investigation: Investigation) -> None:
    run.notebook_revision += 1
    report = run.projection.setdefault("report", {})
    if isinstance(report, dict):
        report["notebookRevision"] = run.notebook_revision
    investigation.version += 1
    investigation.date_updated = timezone.now()
    investigation.save(update_fields=["version", "date_updated"])


def _normalize_positions(run: InvestigationOrchestrationRun, moved: InvestigationBlock) -> None:
    blocks = list(
        InvestigationBlock.objects.filter(
            investigation=run.investigation,
            report_revision__isnull=False,
            stable_agent_key__isnull=False,
            deleted_at__isnull=True,
        )
        .exclude(id=moved.id)
        .order_by("position", "id")
    )
    position = min(max(moved.position, 0), len(blocks))
    blocks.insert(position, moved)
    changed: list[InvestigationBlock] = []
    for index, block in enumerate(blocks):
        if block.position != index:
            block.position = index
            changed.append(block)
    if changed:
        InvestigationBlock.objects.bulk_update(changed, ["position", "date_updated"])


def _default_display(kind: str) -> dict[str, Any]:
    if kind == InvestigationBlockKind.TEXT:
        return {"type": "markdown"}
    return {
        "version": 1,
        "type": "table",
        "defaultView": "table",
        "queryCollapsed": True,
    }


def _upsert_report_block(
    *,
    run: InvestigationOrchestrationRun,
    payload: dict[str, Any],
    complete: bool,
) -> InvestigationBlock:
    payload = _normalize_block_payload(payload)
    investigation = run.investigation
    revision = _require_int(payload, "reportRevision", minimum=0, maximum=I32_MAX)
    key = _require_str(payload, "stableAgentKey", max_length=128)
    kind = payload.get("kind")
    assert kind in InvestigationBlockKind.values
    block = InvestigationBlock.objects.filter(
        investigation=investigation,
        report_revision=revision,
        stable_agent_key=key,
    ).first()
    if block is None:
        position = _require_int(payload, "position", minimum=0, maximum=I32_MAX)
        block = InvestigationBlock(
            investigation=investigation,
            report_revision=revision,
            stable_agent_key=key,
            position=position,
            kind=kind,
        )
    elif block.kind != kind:
        raise serializers.ValidationError({"payload": "A report block cannot change kind."})

    if "position" in payload:
        block.position = _require_int(payload, "position", minimum=0, maximum=I32_MAX)
    title = payload.get("title", block.title)
    if not isinstance(title, str) or len(title) > 255:
        raise serializers.ValidationError({"payload": "title is invalid."})
    config = payload.get("config", block.config)
    display = payload.get("display", block.display or _default_display(kind))
    if not isinstance(config, dict) or not isinstance(display, dict):
        raise serializers.ValidationError({"payload": "config and display must be objects."})
    if kind == InvestigationBlockKind.QUERY:
        display = {**display, "queryCollapsed": display.get("queryCollapsed", True)}

    block.title = title
    block.config = deepcopy(config)
    block.display = deepcopy(display)
    block.producing_seer_run_id = payload.get("producingRunId")
    if block.producing_seer_run_id is not None and (
        isinstance(block.producing_seer_run_id, bool)
        or not isinstance(block.producing_seer_run_id, int)
        or block.producing_seer_run_id < 1
        or block.producing_seer_run_id > I64_MAX
    ):
        raise serializers.ValidationError({"payload": "producingSeerRunId is invalid."})
    block.deleted_at = None
    if complete:
        content = payload.get("content", block.content)
        generated = payload.get("generatedContent", content)
        prompt = payload.get("generationPrompt", block.prompt)
        if not all(isinstance(value, str) for value in (content, generated, prompt)):
            raise serializers.ValidationError({"payload": "Block text fields must be strings."})
        block.content = content
        block.generated_content = generated
        block.prompt = prompt
    if block.pk:
        block.version += 1
    block.save()
    _normalize_positions(run, block)

    project_ids = _validated_project_ids(payload, required=True)
    if payload.get("useInvestigationProjectScope") is True:
        project_scope = run.source.get("projectScope")
        if run.source.get("type") != "manual" or project_scope != {"type": "investigation"}:
            raise serializers.ValidationError(
                {"payload": "Investigation project scope is not available for this run."}
            )
        scoped_project_ids = InvestigationProject.objects.filter(
            investigation=investigation
        ).values_list("project_id", flat=True)
        project_ids = sorted(set(project_ids) | set(scoped_project_ids))
        if not project_ids:
            raise serializers.ValidationError({"payload": "Investigation project scope is empty."})
    projects = list(
        Project.objects.filter(
            organization_id=investigation.organization_id,
            id__in=project_ids,
        ).order_by("id")
    )
    if {project.id for project in projects} != set(project_ids):
        raise serializers.ValidationError(
            {"payload": "A result project is outside the investigation organization."}
        )
    request_id = uuid5(
        _REPORT_EXECUTION_NAMESPACE,
        f"{run.id}:{revision}:{key}:{kind}",
    )
    snapshot = {
        "orchestrationRunId": run.id,
        "reportRevision": revision,
        "stableAgentKey": key,
        "projectIds": project_ids,
    }
    result = (
        validate_query_result(payload["result"])
        if kind == InvestigationBlockKind.QUERY and complete
        else validate_text_result(
            {
                "schemaVersion": 1,
                "markdown": block.generated_content,
            }
        )
        if complete
        else None
    )
    execution, _ = InvestigationBlockExecution.objects.update_or_create(
        request_id=request_id,
        defaults={
            "block": block,
            "executor": InvestigationBlockExecutor.CODE_MODE,
            "status": (
                InvestigationBlockExecutionStatus.COMPLETED
                if complete
                else InvestigationBlockExecutionStatus.RUNNING
            ),
            "block_version": block.version,
            "input_snapshot": snapshot,
            "input_fingerprint": hashlib.sha256(
                json.dumps(snapshot, sort_keys=True).encode()
            ).hexdigest(),
            "result_schema_version": 1,
            "result": result,
            "error": None,
            "started_at": timezone.now(),
            "completed_at": timezone.now() if complete else None,
        },
    )
    InvestigationBlockExecutionProject.objects.filter(execution=execution).delete()
    InvestigationBlockExecutionProject.objects.bulk_create(
        [
            InvestigationBlockExecutionProject(execution=execution, project=project)
            for project in projects
        ]
    )
    block.current_execution = execution
    if kind == InvestigationBlockKind.QUERY:
        if complete or block.result_execution_id is None:
            block.result_execution = execution
    else:
        if complete or block.content_execution_id is None:
            block.content_execution = execution
    if complete:
        block.stale_at = None
    block.save(
        update_fields=[
            "current_execution",
            "content_execution",
            "result_execution",
            "stale_at",
            "date_updated",
        ]
    )
    return block


def _clear_report(
    run: InvestigationOrchestrationRun,
    revision: int,
    *,
    force: bool = False,
    bump: bool = True,
    mutate_projection: bool = True,
) -> bool:
    control = _control(run)
    current_revision = _report_revision(run)
    if revision < current_revision or (
        revision == current_revision and control.get("reportCleared") and not force
    ):
        return False
    now = timezone.now()
    live_blocks = InvestigationBlock.objects.filter(
        investigation=run.investigation,
        report_revision__isnull=False,
        stable_agent_key__isnull=False,
        deleted_at__isnull=True,
    )
    _cancel_report_executions(
        run,
        block_ids=list(live_blocks.values_list("id", flat=True)),
    )
    live_blocks.update(deleted_at=now, date_updated=now)
    control.update(
        {
            "reportRevision": revision,
            "reportCleared": True,
            "titleBuffer": "",
            "titleStarted": False,
        }
    )
    if mutate_projection:
        report = run.projection.setdefault("report", {})
        if isinstance(report, dict):
            report.update({"revision": revision, "status": "composing", "error": None})
    if bump:
        _bump_notebook(run, run.investigation)
    return True


def _complete_metadata(
    run: InvestigationOrchestrationRun,
    payload: dict[str, Any],
    *,
    bump: bool = True,
) -> None:
    investigation = run.investigation
    summary = _require_str(payload, "summary", max_length=255)
    description = _require_str(
        payload,
        "summaryDescription",
        max_length=MAX_SUMMARY_DESCRIPTION_CHARS,
    )
    update_fields = ["summary", "summary_description", "version", "date_updated"]
    investigation.summary = summary
    investigation.summary_description = description
    title = payload.get("title")
    if title is not None:
        title = _require_str(payload, "title", max_length=255)
        control = _control(run)
        if control.get("manualTitleOverride") is not True:
            investigation.title = title
            update_fields.append("title")
            control["titleBuffer"] = title
    investigation.version += 1
    investigation.date_updated = timezone.now()
    investigation.save(update_fields=update_fields)
    metadata = run.projection.setdefault("report", {}).setdefault("metadata", {})
    if isinstance(metadata, dict):
        metadata.update(
            {
                "status": "completed",
                "title": investigation.title,
                "summary": summary,
                "summaryDescription": description,
                "error": None,
            }
        )
    if bump:
        run.notebook_revision += 1
        report = run.projection.setdefault("report", {})
        if isinstance(report, dict):
            report["notebookRevision"] = run.notebook_revision


def _apply_snapshot(
    run: InvestigationOrchestrationRun,
    event: InvestigationOrchestrationEvent,
    payload: dict[str, Any],
) -> None:
    generation = _event_generation(event)
    projection = payload["projection"]
    _set_projection(run, projection, event_generation=generation)
    if "blocks" not in payload:
        return
    blocks = payload["blocks"]
    assert isinstance(blocks, list)
    revision = payload.get("reportRevision", projection.get("report", {}).get("revision", 0))
    if isinstance(revision, bool) or not isinstance(revision, int) or not 0 <= revision <= I32_MAX:
        raise serializers.ValidationError({"payload": "reportRevision is invalid."})
    _clear_report(run, revision, force=True, bump=False, mutate_projection=False)
    seen_keys: set[str] = set()
    for position, raw_block in enumerate(blocks):
        if not isinstance(raw_block, dict):
            raise serializers.ValidationError({"payload": "Each snapshot block must be an object."})
        block_payload = deepcopy(raw_block)
        block_payload.setdefault("reportRevision", revision)
        block_payload.setdefault("position", position)
        _validate_event_payload("report_block_upserted", block_payload)
        key = block_payload["stableAgentKey"]
        if key in seen_keys:
            raise serializers.ValidationError({"payload": "Snapshot block keys must be unique."})
        seen_keys.add(key)
        _upsert_report_block(
            run=run,
            payload=block_payload,
            complete=True,
        )
    metadata = payload.get("metadata")
    if metadata is not None:
        if not isinstance(metadata, dict):
            raise serializers.ValidationError({"payload": "metadata must be an object."})
        metadata = {**metadata, "reportRevision": revision}
        _validate_event_payload("metadata_completed", metadata)
        _complete_metadata(run, metadata, bump=False)
    _bump_notebook(run, run.investigation)


def _apply_event(
    run: InvestigationOrchestrationRun, event: InvestigationOrchestrationEvent
) -> tuple[bool, str | None]:
    payload = _event_data(event)
    generation = _event_generation(event)
    if generation < run.generation:
        return False, "stale_generation"
    if generation > run.generation and event.type not in {"workflow_updated", "state_snapshot"}:
        return False, "future_generation_without_projection"
    notebook_writes_are_fenced = _notebook_writes_are_fenced(
        run,
        event_generation=generation,
    )
    if notebook_writes_are_fenced and event.type in _NOTEBOOK_EVENT_TYPES:
        return False, "notebook_write_fenced"

    if event.type == "workflow_updated":
        if _projection_is_stale(run, payload["projection"], event_generation=generation):
            return False, "stale_workflow_version"
        notebook_changed = False
        if not notebook_writes_are_fenced:
            notebook_changed = _adopt_preserved_report_revision(run, payload["projection"])
        _set_projection(run, payload["projection"], event_generation=generation)
        if (
            not notebook_writes_are_fenced
            and run.status == InvestigationOrchestrationStatus.CANCELLED
        ):
            notebook_changed = bool(_cancel_workflow_report_executions(run)) or notebook_changed
        if notebook_changed:
            _bump_notebook(run, run.investigation)
    elif event.type == "state_snapshot":
        if _projection_is_stale(run, payload["projection"], event_generation=generation):
            return False, "stale_workflow_version"
        if notebook_writes_are_fenced:
            _set_projection(run, payload["projection"], event_generation=generation)
        else:
            _apply_snapshot(run, event, payload)
    elif event.type == "report_clear":
        if not _clear_report(run, payload["reportRevision"]):
            return False, "stale_report_revision"
    elif event.type in {
        "report_block_started",
        "report_text_delta",
        "report_block_upserted",
        "report_block_removed",
        "report_block_moved",
        "report_completed",
        "report_failed",
        "title_delta",
        "metadata_completed",
    }:
        revision = payload["reportRevision"]
        if revision != _report_revision(run):
            return False, "stale_report_revision"

        if event.type == "report_block_started":
            _upsert_report_block(
                run=run,
                payload=payload,
                complete=False,
            )
            _bump_notebook(run, run.investigation)
        elif event.type == "report_text_delta":
            block = InvestigationBlock.objects.filter(
                investigation=run.investigation,
                report_revision=revision,
                stable_agent_key=payload["stableAgentKey"],
                deleted_at__isnull=True,
                kind=InvestigationBlockKind.TEXT,
            ).first()
            if block is None:
                raise serializers.ValidationError({"payload": "Text block was not started."})
            if block.content_execution_id == block.current_execution_id:
                delta = payload["delta"]
                reset = payload.get("reset") is True
                if (0 if reset else len(block.content)) + len(delta) > MAX_MARKDOWN_CHARS:
                    raise serializers.ValidationError(
                        {"payload": "Text block exceeds its size limit."}
                    )
                block.content = delta if reset else block.content + delta
                block.generated_content = delta if reset else block.generated_content + delta
                block.version += 1
                block.save(
                    update_fields=["content", "generated_content", "version", "date_updated"]
                )
                _bump_notebook(run, run.investigation)
        elif event.type == "report_block_upserted":
            _upsert_report_block(
                run=run,
                payload=payload,
                complete=True,
            )
            _bump_notebook(run, run.investigation)
        elif event.type == "report_block_removed":
            now = timezone.now()
            _cancel_report_executions(
                run,
                revision=revision,
                stable_agent_key=payload["stableAgentKey"],
            )
            updated = InvestigationBlock.objects.filter(
                investigation=run.investigation,
                report_revision=revision,
                stable_agent_key=payload["stableAgentKey"],
                deleted_at__isnull=True,
            ).update(deleted_at=now, date_updated=now)
            if updated:
                _bump_notebook(run, run.investigation)
        elif event.type == "report_block_moved":
            block = InvestigationBlock.objects.filter(
                investigation=run.investigation,
                report_revision=revision,
                stable_agent_key=payload["stableAgentKey"],
                deleted_at__isnull=True,
            ).first()
            if block is None:
                raise serializers.ValidationError({"payload": "Report block was not found."})
            block.position = payload["position"]
            block.version += 1
            block.save(update_fields=["position", "version", "date_updated"])
            _normalize_positions(run, block)
            _bump_notebook(run, run.investigation)
        elif event.type == "report_completed":
            report = run.projection.setdefault("report", {})
            if isinstance(report, dict):
                report.update({"status": "completed", "error": None})
        elif event.type == "report_failed":
            execution_updated = _fail_report_executions(run, revision=revision)
            report = run.projection.setdefault("report", {})
            if isinstance(report, dict):
                report.update({"status": "failed", "error": deepcopy(payload.get("error"))})
            if execution_updated:
                _bump_notebook(run, run.investigation)
        elif event.type == "title_delta":
            control = _control(run)
            investigation = run.investigation
            metadata = run.projection.setdefault("report", {}).setdefault("metadata", {})
            if control.get("manualTitleOverride") is True:
                if isinstance(metadata, dict):
                    metadata.update({"status": "generating", "title": investigation.title})
            else:
                title = (
                    control.get("titleBuffer", "")
                    if control.get("titleStarted") and payload.get("reset") is not True
                    else ""
                )
                title = f"{title}{payload['delta']}"[:255]
                control.update({"titleBuffer": title, "titleStarted": True})
                investigation.title = title
                investigation.save(update_fields=["title", "date_updated"])
                if isinstance(metadata, dict):
                    metadata.update({"status": "generating", "title": title})
                _bump_notebook(run, investigation)
        elif event.type == "metadata_completed":
            _complete_metadata(run, payload)
    elif event.type == "workflow_failed":
        projection = payload.get("projection")
        if isinstance(projection, dict):
            _set_projection(run, projection, event_generation=generation)
        run.phase = InvestigationOrchestrationPhase.FAILED
        run.status = InvestigationOrchestrationStatus.FAILED
        run.error = deepcopy(payload.get("error"))
        if _fail_report_executions(run, revision=_report_revision(run)):
            _bump_notebook(run, run.investigation)

    run.heartbeat_at = timezone.now()
    return True, None


def _is_terminal_full_snapshot(
    event: InvestigationOrchestrationEvent, run: InvestigationOrchestrationRun
) -> bool:
    if event.type != "state_snapshot":
        return False
    payload = _event_data(event)
    projection = payload.get("projection")
    return (
        payload.get("terminal") is True
        and payload.get("full") is True
        and isinstance(payload.get("blocks"), list)
        and isinstance(projection, dict)
        and projection.get("status") in _TERMINAL_STATUSES
        and projection.get("generation") == _event_generation(event)
        and not _projection_is_stale(run, projection, event_generation=_event_generation(event))
    )


def _mark_event(
    event: InvestigationOrchestrationEvent,
    status: str,
    *,
    error: dict[str, Any] | None = None,
) -> None:
    event.application_status = status
    event.error = error
    event.applied_at = timezone.now()
    event.save(update_fields=["application_status", "error", "applied_at", "date_updated"])


def _lock_run_after_investigation(
    orchestration_run_id: int,
) -> InvestigationOrchestrationRun:
    Investigation.objects.select_for_update(of=("self",)).get(
        orchestration_run__id=orchestration_run_id
    )
    return (
        InvestigationOrchestrationRun.objects.select_for_update(of=("self",))
        .select_related("investigation")
        .get(id=orchestration_run_id)
    )


def _apply_available_events(
    orchestration_run_id: int, delivered_event_id: int
) -> _OrchestrationEventApplication:
    """Consume contiguous events after rollback; only a valid terminal snapshot may skip a gap."""

    database = router.db_for_write(InvestigationOrchestrationRun)
    with transaction.atomic(using=database):
        run = _lock_run_after_investigation(orchestration_run_id)
        delivered = InvestigationOrchestrationEvent.objects.get(id=delivered_event_id)
        if delivered.sequence <= run.last_event_sequence:
            if delivered.application_status == InvestigationOrchestrationEventStatus.PENDING:
                _mark_event(
                    delivered,
                    InvestigationOrchestrationEventStatus.IGNORED,
                    error={"reason": "superseded_by_snapshot"},
                )
        elif delivered.sequence > run.last_event_sequence + 1 and _is_terminal_full_snapshot(
            delivered, run
        ):
            try:
                with transaction.atomic(using=database):
                    applied, ignored_reason = _apply_event(run, delivered)
            except serializers.ValidationError as error:
                run.refresh_from_db()
                run.investigation.refresh_from_db()
                _mark_event(
                    delivered,
                    InvestigationOrchestrationEventStatus.FAILED,
                    error={"detail": error.detail},
                )
                applied = False
                ignored_reason = None
            if not applied:
                if ignored_reason is not None:
                    _mark_event(
                        delivered,
                        InvestigationOrchestrationEventStatus.IGNORED,
                        error={"reason": ignored_reason},
                    )
                run.date_updated = timezone.now()
                run.save(update_fields=["date_updated"])
                return _OrchestrationEventApplication(
                    event=delivered,
                    last_applied_sequence=run.last_event_sequence,
                    notebook_revision=run.notebook_revision,
                )
            InvestigationOrchestrationEvent.objects.filter(
                orchestration_run=run,
                sequence__lt=delivered.sequence,
                application_status=InvestigationOrchestrationEventStatus.PENDING,
            ).update(
                application_status=InvestigationOrchestrationEventStatus.IGNORED,
                error={"reason": "superseded_by_terminal_snapshot"},
                applied_at=timezone.now(),
                date_updated=timezone.now(),
            )
            _mark_event(delivered, InvestigationOrchestrationEventStatus.APPLIED)
            run.last_event_sequence = delivered.sequence
        else:
            while True:
                next_event = InvestigationOrchestrationEvent.objects.filter(
                    orchestration_run=run,
                    sequence=run.last_event_sequence + 1,
                ).first()
                if next_event is None:
                    break
                if next_event.application_status != InvestigationOrchestrationEventStatus.PENDING:
                    run.last_event_sequence = next_event.sequence
                    continue
                try:
                    with transaction.atomic(using=database):
                        applied, ignored_reason = _apply_event(run, next_event)
                except serializers.ValidationError as error:
                    run.refresh_from_db()
                    run.investigation.refresh_from_db()
                    _mark_event(
                        next_event,
                        InvestigationOrchestrationEventStatus.FAILED,
                        error={"detail": error.detail},
                    )
                else:
                    _mark_event(
                        next_event,
                        (
                            InvestigationOrchestrationEventStatus.APPLIED
                            if applied
                            else InvestigationOrchestrationEventStatus.IGNORED
                        ),
                        error={"reason": ignored_reason} if ignored_reason else None,
                    )
                run.last_event_sequence = next_event.sequence

        run.date_updated = timezone.now()
        run.save(
            update_fields=[
                "seer_run_id",
                "workflow_version",
                "generation",
                "phase",
                "status",
                "projection",
                "notebook_revision",
                "last_event_sequence",
                "heartbeat_at",
                "error",
                "date_updated",
            ]
        )
        delivered.refresh_from_db()
        return _OrchestrationEventApplication(
            event=delivered,
            last_applied_sequence=run.last_event_sequence,
            notebook_revision=run.notebook_revision,
        )


def deliver_orchestration_event(
    *,
    organization_id: int,
    event: dict[str, Any],
) -> OrchestrationEventReceipt:
    """Stage an event, then consume contiguous work or fast-forward with a valid terminal snapshot."""

    if _serialized_size(event) > MAX_ORCHESTRATION_EVENT_BYTES:
        raise serializers.ValidationError({"event": "Event exceeds the maximum size."})
    _validate_event_payload(event["type"], event["payload"])
    stored_payload = _stored_event_payload(event)
    database = router.db_for_write(InvestigationOrchestrationRun)
    duplicate = False
    with transaction.atomic(using=database):
        try:
            run = (
                InvestigationOrchestrationRun.objects.select_for_update(of=("self",))
                .select_related("investigation")
                .get(
                    investigation_id=event["investigation_id"],
                    investigation__organization_id=organization_id,
                )
            )
        except InvestigationOrchestrationRun.DoesNotExist as error:
            raise serializers.ValidationError(
                {"event": "Investigation run was not found."}
            ) from error
        if run.seer_run_id is not None and run.seer_run_id != event["run_id"]:
            raise serializers.ValidationError({"event": "Run ID does not match."})
        if run.seer_run_id is None:
            if InvestigationOrchestrationRun.objects.filter(seer_run_id=event["run_id"]).exists():
                raise InvestigationOrchestrationEventConflict("Run ID is already in use.")
            run.seer_run_id = event["run_id"]
            try:
                with transaction.atomic(using=database):
                    run.save(update_fields=["seer_run_id", "date_updated"])
            except IntegrityError as error:
                raise InvestigationOrchestrationEventConflict(
                    "Run ID is already in use."
                ) from error

        existing = InvestigationOrchestrationEvent.objects.filter(
            orchestration_run=run, event_id=event["event_id"]
        ).first()
        if existing is not None:
            if (
                existing.sequence != event["sequence"]
                or existing.type != event["type"]
                or existing.payload != stored_payload
            ):
                raise InvestigationOrchestrationEventConflict
            delivered = existing
            duplicate = True
        else:
            sequence_collision = InvestigationOrchestrationEvent.objects.filter(
                orchestration_run=run, sequence=event["sequence"]
            ).exists()
            if sequence_collision:
                raise InvestigationOrchestrationEventConflict
            delivered = InvestigationOrchestrationEvent.objects.create(
                orchestration_run=run,
                event_id=event["event_id"],
                sequence=event["sequence"],
                type=event["type"],
                payload=stored_payload,
            )

    outcome = _apply_available_events(run.id, delivered.id)
    return OrchestrationEventReceipt(
        duplicate=duplicate,
        application_status=outcome.event.application_status,
        last_applied_sequence=outcome.last_applied_sequence,
        notebook_revision=outcome.notebook_revision,
    )


def _synchronize_orchestration_projection(
    *,
    orchestration_run_id: int,
    seer_run_id: int,
    projection: dict[str, Any],
    authoritative: bool,
) -> InvestigationOrchestrationRun:
    if (
        isinstance(seer_run_id, bool)
        or not isinstance(seer_run_id, int)
        or not 1 <= seer_run_id <= I64_MAX
    ):
        raise serializers.ValidationError({"seer_run_id": "seer_run_id is invalid."})
    generation = projection.get("generation")
    if (
        isinstance(generation, bool)
        or not isinstance(generation, int)
        or not 1 <= generation <= I32_MAX
    ):
        raise serializers.ValidationError({"projection": "generation is invalid."})
    database = router.db_for_write(InvestigationOrchestrationRun)
    with transaction.atomic(using=database):
        run = _lock_run_after_investigation(orchestration_run_id)
        if run.seer_run_id is not None and run.seer_run_id != seer_run_id:
            raise InvestigationOrchestrationEventConflict("Run ID does not match.")
        run.seer_run_id = seer_run_id
        if authoritative or (
            generation >= run.generation
            and not _projection_is_stale(run, projection, event_generation=generation)
        ):
            notebook_writes_are_fenced = _notebook_writes_are_fenced(
                run,
                event_generation=generation,
            )
            notebook_changed = False
            if not notebook_writes_are_fenced:
                notebook_changed = _adopt_preserved_report_revision(run, projection)
            _set_projection(
                run,
                projection,
                event_generation=generation,
                authoritative_workflow_version=authoritative,
            )
            if (
                not notebook_writes_are_fenced
                and run.status == InvestigationOrchestrationStatus.CANCELLED
            ):
                notebook_changed = bool(_cancel_workflow_report_executions(run)) or notebook_changed
            if notebook_changed:
                _bump_notebook(run, run.investigation)
        run.date_updated = timezone.now()
        run.save(
            update_fields=[
                "seer_run_id",
                "workflow_version",
                "generation",
                "phase",
                "status",
                "projection",
                "notebook_revision",
                "heartbeat_at",
                "error",
                "date_updated",
            ]
        )
        return run


def synchronize_orchestration_projection(
    *,
    orchestration_run_id: int,
    seer_run_id: int,
    projection: dict[str, Any],
) -> InvestigationOrchestrationRun:
    """Apply a monotonic create or command response without consuming callback sequence."""

    return _synchronize_orchestration_projection(
        orchestration_run_id=orchestration_run_id,
        seer_run_id=seer_run_id,
        projection=projection,
        authoritative=False,
    )


def reconcile_orchestration_projection(
    *,
    orchestration_run_id: int,
    seer_run_id: int,
    projection: dict[str, Any],
) -> InvestigationOrchestrationRun:
    """Replace run state from an authoritative recovery response."""

    return _synchronize_orchestration_projection(
        orchestration_run_id=orchestration_run_id,
        seer_run_id=seer_run_id,
        projection=projection,
        authoritative=True,
    )
