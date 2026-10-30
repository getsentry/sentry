from __future__ import annotations

from collections.abc import Callable, Generator, Sequence
from decimal import Decimal
from pathlib import Path
from typing import Any
from unittest.mock import patch

import orjson
import pytest
from django.contrib.auth.models import AnonymousUser
from rest_framework.exceptions import ValidationError

from sentry.auth.access import Access
from sentry.db.models.fields.bounded import I32_MAX, I64_MAX
from sentry.investigations.contracts import (
    MAX_ARTIFACT_BYTES,
    MAX_PROJECTION_BYTES,
    ActionPayloadSerializer,
    ActionRequestedPayloadSerializer,
    ActionWithdrawnPayloadSerializer,
    OrchestrationProjectionSerializer,
    RelaxedContractSerializer,
    ReportBlockStartedPayloadSerializer,
    ReportBlockUpsertedPayloadSerializer,
    ReportClearPayloadSerializer,
    ReportTextDeltaPayloadSerializer,
    StrictCharField,
    json_byte_size,
    valid_action_request,
    valid_action_requests,
    validate_query_result,
    validate_text_result,
)
from sentry.investigations.services.action_kinds import ACTION_KINDS
from sentry.investigations.services.action_kinds.base import (
    ActionKind,
    ApplyContext,
    CannotApplyReason,
)
from sentry.notebooks.models import Notebook, NotebookActionRequest
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser
from sentry.utils import json

FIXTURE = Path(__file__).parents[2] / "fixtures" / "investigation_query_result_v1.json"


def golden_payload() -> dict[str, Any]:
    return json.loads(FIXTURE.read_text())


def test_query_result_accepts_the_versioned_wire_shape() -> None:
    result = validate_query_result(
        {
            "schemaVersion": 1,
            "tableMarkdown": "| Time | Errors |\n| --- | ---: |\n| 2026-07-31 | 12 |",
            "chart": {
                "title": "Errors over time",
                "visualization": "area",
                "x_axis": "time",
                "y_axis_unit": "number",
                "series": [
                    {
                        "name": "count()",
                        "data": [{"x": "2026-07-31T12:00:00Z", "y": 12}],
                    }
                ],
            },
            "preferredView": "chart",
            "isEmpty": False,
            "chartUnavailableReason": None,
            "queryLinks": [],
        }
    )

    assert result["schemaVersion"] == 1
    assert result["preferredView"] == "chart"


def test_query_result_rejects_unknown_versions() -> None:
    with pytest.raises(ValidationError):
        validate_query_result(
            {
                "schemaVersion": 2,
                "tableMarkdown": "| Result |\n| --- |",
                "chart": None,
                "preferredView": "table",
                "isEmpty": True,
                "chartUnavailableReason": "No numeric result.",
                "queryLinks": [],
            }
        )


def test_shared_golden_payload_round_trips_without_drift() -> None:
    payload = golden_payload()

    assert validate_query_result(payload) == payload


def test_query_result_rejects_an_empty_chart_series() -> None:
    payload = golden_payload()
    payload["chart"]["series"] = []

    with pytest.raises(ValidationError):
        validate_query_result(payload)


def test_query_result_rejects_non_bar_category_chart() -> None:
    payload = golden_payload()
    payload["chart"]["x_axis"] = "category"
    payload["chart"]["visualization"] = "line"

    with pytest.raises(ValidationError):
        validate_query_result(payload)


def test_query_result_rejects_unknown_fields() -> None:
    payload = golden_payload()
    payload["totallyNewField"] = 1

    with pytest.raises(ValidationError):
        validate_query_result(payload)


def test_query_result_rejects_oversized_payloads() -> None:
    payload = golden_payload()
    payload["tableMarkdown"] = "x" * (MAX_ARTIFACT_BYTES + 1)

    with pytest.raises(ValidationError) as excinfo:
        validate_query_result(payload)
    assert "maximum artifact size" in str(excinfo.value)


def test_query_result_falls_back_to_the_table_view_without_a_chart() -> None:
    payload = golden_payload()
    payload["chart"] = None
    payload["preferredView"] = "chart"

    result = validate_query_result(payload)

    assert result["preferredView"] == "table"
    assert result["chartUnavailableReason"] == "No chart was generated for this result."


def test_query_result_keeps_an_explicit_chart_unavailable_reason() -> None:
    payload = golden_payload()
    payload["chart"] = None
    payload["chartUnavailableReason"] = "Result has no numeric column."

    assert (
        validate_query_result(payload)["chartUnavailableReason"] == "Result has no numeric column."
    )


def test_query_result_rejects_naive_time_axis_values() -> None:
    payload = golden_payload()
    payload["chart"]["series"][0]["data"][0]["x"] = "2026-07-31T12:00:00"

    with pytest.raises(ValidationError) as excinfo:
        validate_query_result(payload)
    assert "offset-bearing" in str(excinfo.value)


def test_text_result_accepts_the_versioned_wire_shape() -> None:
    result = validate_text_result({"schemaVersion": 1, "markdown": "## Overview"})

    assert result == {"schemaVersion": 1, "markdown": "## Overview"}


def test_text_result_rejects_unknown_versions() -> None:
    with pytest.raises(ValidationError):
        validate_text_result({"schemaVersion": 2, "markdown": "## Overview"})


def test_text_result_rejects_oversized_payloads() -> None:
    with pytest.raises(ValidationError) as excinfo:
        validate_text_result({"schemaVersion": 1, "markdown": "x" * (MAX_ARTIFACT_BYTES + 1)})
    assert "maximum artifact size" in str(excinfo.value)


def projection(**overrides: Any) -> dict[str, Any]:
    """The smallest projection Seer can send that Sentry accepts."""

    return {
        "runId": 4815,
        "investigationId": "162342",
        "sourceType": "manual",
        "workflowVersion": 1,
        "generation": 1,
        "phase": "broad_scan",
        "status": "processing",
        "broadScan": {"status": "running"},
        "hypotheses": [],
        "report": {
            "revision": 0,
            "status": "not_started",
            "clearIntent": None,
            "notebookRevision": 0,
            "metadata": {"status": "not_started"},
        },
        "pendingInput": None,
        "errors": [],
        "heartbeatAt": "2025-01-01T00:00:00+00:00",
        **overrides,
    }


def block_payload(**overrides: Any) -> dict[str, Any]:
    return {
        "reportRevision": 0,
        "stableAgentKey": "block",
        "position": 0,
        "kind": "text",
        "title": "Block",
        "content": "body",
        "projectIds": [162342],
        **overrides,
    }


def delta_payload(**overrides: Any) -> dict[str, Any]:
    return {"reportRevision": 0, "stableAgentKey": "block", **overrides}


def validated(serializer: type[RelaxedContractSerializer], payload: dict[str, Any]) -> Any:
    validator = serializer(data=payload)
    validator.is_valid(raise_exception=True)
    return validator.validated_data


def rejects(serializer: type[RelaxedContractSerializer], payload: dict[str, Any]) -> None:
    assert not serializer(data=payload).is_valid()


def test_relaxed_serializer_passes_unknown_fields_through() -> None:
    result = validated(
        OrchestrationProjectionSerializer,
        projection(seerAddedThisLater={"nested": [1, 2, 3]}),
    )

    assert result["seerAddedThisLater"] == {"nested": [1, 2, 3]}


def test_projection_preserves_nested_fields_and_adaptive_checks() -> None:
    completed_step = {
        "id": "step-1",
        "order": 0,
        "title": "Compare releases",
        "objective": "Identify the affected release",
        "method": "Compare errors by release",
        "status": "completed",
        "result": "Errors are concentrated in the latest release.",
        "evidence": [
            {
                "id": "evidence-1",
                "title": "Error in the latest release",
                "kind": "event",
                "projectIds": [1],
            }
        ],
    }
    pending_step = {
        "id": "step-2",
        "order": 1,
        "title": "Compare regions",
        "objective": "Identify regional differences",
        "method": "Compare errors by region",
        "status": "not_started",
    }
    payload = projection(
        phase="investigating",
        broadScan={"status": "completed", "seerAddedThisLater": "kept"},
        hypotheses=[
            hypothesis_with(
                status="running",
                effectiveStatus="investigating",
                decisionSource="none",
                verificationSteps=[completed_step, pending_step],
            )
        ],
    )
    result = validated(OrchestrationProjectionSerializer, payload)

    assert result["hypotheses"][0]["verificationSteps"] == [completed_step, pending_step]
    assert result["broadScan"]["seerAddedThisLater"] == "kept"

    follow_up = {
        "id": "step-3",
        "order": 1,
        "title": "Inspect the new errors",
        "objective": "Identify the failure introduced by the release",
        "method": "Inspect events from the affected release",
        "status": "queued",
        "parentStepId": "step-1",
    }
    skipped_step = {
        **pending_step,
        "order": 2,
        "status": "skipped",
        "skipReason": "Follow the release-specific evidence first.",
    }
    payload["hypotheses"][0]["verificationSteps"] = [completed_step, follow_up, skipped_step]

    result = validated(OrchestrationProjectionSerializer, payload)

    assert result["hypotheses"][0]["verificationSteps"] == [
        completed_step,
        follow_up,
        skipped_step,
    ]


def test_projection_is_bounded_by_its_serialized_size() -> None:
    # An undeclared field is passed through untouched, so nothing but the size
    # guard bounds it.
    rejects(OrchestrationProjectionSerializer, projection(seerAddedThisLater="x" * (600 * 1024)))


def test_projection_phase_and_status_must_be_known_values() -> None:
    rejects(OrchestrationProjectionSerializer, projection(phase="not_a_phase"))
    rejects(OrchestrationProjectionSerializer, projection(status="not_a_status"))


@pytest.mark.parametrize("field", ["startedAt", "finishedAt", "activeSince"])
@pytest.mark.parametrize("value", ["bad", "2025-01-01T00:00:00", "2025-02-30T00:00:00Z", 123])
def test_projection_rejects_invalid_timing_timestamps(field: str, value: Any) -> None:
    rejects(OrchestrationProjectionSerializer, projection(**{field: value}))


@pytest.mark.parametrize("value", [-1, "10", True])
def test_projection_rejects_invalid_active_duration(value: Any) -> None:
    rejects(OrchestrationProjectionSerializer, projection(activeTimeElapsedSeconds=value))


def test_projection_accepts_missing_and_null_timing_from_older_seer() -> None:
    result = validated(OrchestrationProjectionSerializer, projection())
    assert "startedAt" not in result
    assert "activeTimeElapsedSeconds" not in result
    result = validated(
        OrchestrationProjectionSerializer,
        projection(
            startedAt=None, finishedAt=None, activeSince=None, activeTimeElapsedSeconds=None
        ),
    )
    assert result["activeTimeElapsedSeconds"] is None


def test_projection_integers_stay_within_their_database_columns() -> None:
    rejects(OrchestrationProjectionSerializer, projection(workflowVersion=I32_MAX + 1))
    rejects(OrchestrationProjectionSerializer, projection(generation=I32_MAX + 1))
    rejects(ReportClearPayloadSerializer, {"reportRevision": I32_MAX + 1})
    rejects(ReportBlockStartedPayloadSerializer, block_payload(projectIds=[I64_MAX + 1]))
    rejects(ReportBlockStartedPayloadSerializer, block_payload(producingRunId=I64_MAX + 1))


def test_projection_rejects_malformed_nested_shapes() -> None:
    mutations: list[Callable[[dict[str, Any]], object]] = [
        lambda value: value.update(
            {
                "hypotheses": [
                    {
                        "id": "bad",
                        "order": 0,
                        "statement": "Bad projection",
                        "rationale": "Invalid status",
                        "status": "surprise",
                        "effectiveStatus": "pending",
                        "decisionSource": "none",
                    }
                ]
            }
        ),
        lambda value: value["broadScan"].update(
            {"error": {"code": "bad_error", "message": "Malformed", "retryable": "yes"}}
        ),
        lambda value: value["broadScan"].update({"summary": "x" * (512 * 1024)}),
        lambda value: value["report"].pop("metadata"),
        lambda value: value["report"].pop("notebookRevision"),
        lambda value: value.pop("heartbeatAt"),
        lambda value: value.update({"heartbeatAt": "not-a-timestamp"}),
        lambda value: value.update({"heartbeatAt": "2025-01-01T00:00:00"}),
    ]
    for mutate in mutations:
        payload = projection()
        mutate(payload)

        rejects(OrchestrationProjectionSerializer, payload)


def test_declared_fields_reject_the_types_drf_would_coerce() -> None:
    rejects(ReportBlockUpsertedPayloadSerializer, block_payload(title=12))
    rejects(ReportBlockUpsertedPayloadSerializer, block_payload(generatedContent=12))
    rejects(ReportBlockUpsertedPayloadSerializer, block_payload(position="0"))
    rejects(ReportBlockUpsertedPayloadSerializer, block_payload(producingRunId="12"))
    rejects(ReportBlockUpsertedPayloadSerializer, block_payload(producingRunId=True))
    rejects(ReportBlockUpsertedPayloadSerializer, block_payload(useInvestigationProjectScope="yes"))


def test_block_upsert_rejects_malformed_fields() -> None:
    rejects(ReportBlockUpsertedPayloadSerializer, block_payload(title="x" * 256))
    rejects(ReportBlockUpsertedPayloadSerializer, block_payload(config="not-an-object"))
    rejects(ReportBlockUpsertedPayloadSerializer, block_payload(display=["not-an-object"]))
    rejects(ReportBlockUpsertedPayloadSerializer, block_payload(content=None))
    rejects(ReportBlockUpsertedPayloadSerializer, block_payload(generationPrompt={"no": "t"}))
    rejects(ReportBlockUpsertedPayloadSerializer, block_payload(producingRunId=0))


def test_block_upsert_folds_the_legacy_collapsed_flag_into_display() -> None:
    result = validated(ReportBlockUpsertedPayloadSerializer, block_payload(collapsed=True))

    assert result["display"] == {"queryCollapsed": True}
    assert "collapsed" not in result


def test_block_upsert_rejects_a_non_boolean_collapsed_flag() -> None:
    rejects(ReportBlockUpsertedPayloadSerializer, block_payload(collapsed="yes"))


def test_report_blocks_require_project_provenance() -> None:
    rejects(ReportBlockStartedPayloadSerializer, block_payload(projectIds=[]))
    rejects(ReportBlockStartedPayloadSerializer, block_payload(projectIds=None))
    rejects(ReportBlockStartedPayloadSerializer, block_payload(projectIds=[1, 1]))


def test_report_blocks_may_defer_to_the_investigation_project_scope() -> None:
    result = validated(
        ReportBlockStartedPayloadSerializer,
        block_payload(projectIds=None, useInvestigationProjectScope=True),
    )

    assert result["useInvestigationProjectScope"] is True


def hypothesis_with_evidence(evidence: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": "hypothesis-1",
        "order": 0,
        "statement": "A release caused the regression",
        "rationale": "The timing lines up.",
        "status": "completed",
        "effectiveStatus": "supported",
        "decisionSource": "agent",
        "verificationSteps": [],
        "evidence": [evidence],
        "toolActivity": [],
    }


def test_project_backed_evidence_requires_project_provenance() -> None:
    rejects(
        OrchestrationProjectionSerializer,
        projection(
            hypotheses=[
                hypothesis_with_evidence(
                    {"id": "evidence-1", "title": "Event without provenance", "kind": "event"}
                )
            ]
        ),
    )


def test_evidence_without_a_project_needs_no_provenance() -> None:
    result = validated(
        OrchestrationProjectionSerializer,
        projection(
            hypotheses=[
                hypothesis_with_evidence(
                    {"id": "evidence-1", "title": "An external document", "kind": "external"}
                )
            ]
        ),
    )

    assert result["hypotheses"][0]["evidence"][0]["kind"] == "external"


def test_projection_accepts_visible_broad_scan_steps() -> None:
    result = validated(
        OrchestrationProjectionSerializer,
        projection(
            broadScan={
                "status": "running",
                "toolActivity": [
                    {
                        "id": "step-1",
                        "title": "Inspect the error spike",
                        "kind": "step",
                        "status": "queued",
                    }
                ],
            }
        ),
    )

    assert result["broadScan"]["toolActivity"][0]["id"] == "step-1"


def thought(text: str, before_activity_id: str | None = "call-1") -> dict[str, Any]:
    return {"id": "thought-1", "text": text, "beforeActivityId": before_activity_id}


def test_projection_accepts_the_agent_reasoning_beside_its_calls() -> None:
    result = validated(
        OrchestrationProjectionSerializer,
        projection(
            broadScan={
                "status": "running",
                "toolActivity": [
                    {"id": "call-1", "title": "Query spans", "kind": "api", "status": "running"}
                ],
                "thoughts": [
                    thought("Compare the incident window with the baseline."),
                    thought("That settles it.", before_activity_id=None),
                ],
            }
        ),
    )

    thoughts = result["broadScan"]["thoughts"]
    assert [entry["beforeActivityId"] for entry in thoughts] == ["call-1", None]


def test_projection_rejects_reasoning_past_its_length_cap() -> None:
    rejects(
        OrchestrationProjectionSerializer,
        projection(broadScan={"status": "running", "thoughts": [thought("x" * 1_501)]}),
    )


def test_report_cancellation_may_fence_on_the_first_revision() -> None:
    result = validated(
        OrchestrationProjectionSerializer,
        projection(
            cancellationIntents=[
                {
                    "id": "cancel-1",
                    "scope": "report",
                    "generation": 0,
                    "reason": "The user cleared the report.",
                }
            ]
        ),
    )

    assert result["cancellationIntents"][0]["generation"] == 0


def test_other_cancellation_scopes_may_not_fence_on_generation_zero() -> None:
    rejects(
        OrchestrationProjectionSerializer,
        projection(
            cancellationIntents=[
                {
                    "id": "cancel-1",
                    "scope": "workflow",
                    "generation": 0,
                    "reason": "The user stopped the investigation.",
                }
            ]
        ),
    )


def test_strings_keep_the_whitespace_seer_sent() -> None:
    first = validated(ReportTextDeltaPayloadSerializer, {**delta_payload(), "delta": "Hello "})
    second = validated(ReportTextDeltaPayloadSerializer, {**delta_payload(), "delta": " world\n"})

    assert first["delta"] + second["delta"] == "Hello  world\n"


def test_sizes_are_measured_in_the_bytes_seer_counted() -> None:
    # Seer budgets with orjson, which does not escape non-ASCII.
    payload = projection(seerAddedThisLater="错误率升高 🚨" * 20_000)

    assert len(json.dumps(payload).encode()) > MAX_PROJECTION_BYTES
    assert len(orjson.dumps(payload)) < MAX_PROJECTION_BYTES
    validated(OrchestrationProjectionSerializer, payload)


def test_block_upsert_requires_project_provenance() -> None:
    rejects(ReportBlockUpsertedPayloadSerializer, block_payload(projectIds=None))
    rejects(ReportBlockUpsertedPayloadSerializer, block_payload(projectIds=[]))
    rejects(ReportBlockUpsertedPayloadSerializer, block_payload(projectIds=[1, 1]))


def test_floats_reject_the_strings_drf_would_parse() -> None:
    hypothesis = {
        "id": "hypothesis-1",
        "order": 0,
        "statement": "A release caused the regression",
        "rationale": "The timing lines up.",
        "status": "completed",
        "effectiveStatus": "supported",
        "decisionSource": "agent",
        "confidence": "0.5",
    }

    rejects(OrchestrationProjectionSerializer, projection(hypotheses=[hypothesis]))


def test_block_upsert_returns_the_normalized_query_result() -> None:
    result = {**golden_payload(), "chart": None, "preferredView": "chart"}
    validated_block = validated(
        ReportBlockUpsertedPayloadSerializer,
        block_payload(kind="query", result=result),
    )

    assert validated_block["result"]["preferredView"] == "table"


def hypothesis_with(**overrides: Any) -> dict[str, Any]:
    return {
        "id": "hypothesis-1",
        "order": 0,
        "statement": "A release caused the regression",
        "rationale": "The timing lines up.",
        "status": "completed",
        "effectiveStatus": "supported",
        "decisionSource": "user",
        **overrides,
    }


def test_user_disposition_is_validated() -> None:
    for bad in (
        "accepted",
        {"disposition": "maybe"},
        {},
        {"disposition": "accepted", "userId": 0},
        {"disposition": "accepted", "userId": "12"},
        {"disposition": "accepted", "decidedAt": 12},
    ):
        rejects(
            OrchestrationProjectionSerializer,
            projection(hypotheses=[hypothesis_with(userDisposition=bad)]),
        )

    result = validated(
        OrchestrationProjectionSerializer,
        projection(
            hypotheses=[
                hypothesis_with(
                    userDisposition={
                        "disposition": "rejected",
                        "userId": 42,
                        "decidedAt": "2025-01-01T00:00:00+00:00",
                    }
                )
            ]
        ),
    )

    assert result["hypotheses"][0]["userDisposition"]["disposition"] == "rejected"


def test_size_measurement_tolerates_values_orjson_cannot_serialize() -> None:
    # Query results reach this from Snuba, which returns Decimals.
    assert json_byte_size({"total": Decimal("1.5")}) > 0


def test_size_measurement_rejects_input_it_cannot_serialize() -> None:
    # A parsed JSON payload can carry an integer wider than orjson handles.
    with pytest.raises(ValidationError):
        json_byte_size({"x": 2**65})


def test_block_upsert_rejects_a_bad_display_beside_the_collapsed_flag() -> None:
    rejects(
        ReportBlockUpsertedPayloadSerializer,
        block_payload(collapsed=True, display="not-an-object"),
    )


class _Payload(ActionPayloadSerializer):
    target = StrictCharField(max_length=8)

    @classmethod
    def trim(cls, action: dict[str, Any]) -> dict[str, Any] | None:
        return None if action.get("target") == "advice" else action


class RecordingKind(ActionKind):
    kind = "test_kind"
    payload_serializer = _Payload

    def __init__(self) -> None:
        # The requests after_upsert ran for, in order.
        self.upserted: list[NotebookActionRequest] = []
        # The arguments from each cannot_apply_reasons call.
        self.checked: list[tuple[list[int], list[int], Access, User | RpcUser | AnonymousUser]] = []
        # Which of check_remote, check and apply ran, in order.
        self.calls: list[str] = []
        # What check and apply raise, if anything.
        self.raises: Exception | None = None
        # A title for check to write on the request.
        self.check_title: str | None = None
        # What check_remote raises, if anything.
        self.remote_raises: Exception | None = None
        # Why cannot_apply_reasons says the viewer can't apply, if they can't.
        self.reason: CannotApplyReason | None = None

    def after_upsert(self, action_request: NotebookActionRequest) -> None:
        self.upserted.append(action_request)

    def cannot_apply_reasons(
        self,
        action_requests: Sequence[NotebookActionRequest],
        *,
        investigations: dict[int, Notebook],
        access: Access,
        user: User | RpcUser | AnonymousUser,
    ) -> dict[int, CannotApplyReason | None]:
        self.checked.append(
            ([item.id for item in action_requests], sorted(investigations), access, user)
        )
        return {item.id: self.reason for item in action_requests}

    def check_remote(self, investigation: Notebook, action_request: NotebookActionRequest) -> None:
        self.calls.append("check_remote")
        if self.remote_raises is not None:
            raise self.remote_raises

    def check(self, context: ApplyContext) -> None:
        self.calls.append("check")
        if self.check_title is not None:
            context.action_request.update(title=self.check_title)
        if self.raises is not None:
            raise self.raises

    def apply(self, context: ApplyContext) -> dict[str, object]:
        self.calls.append("apply")
        if self.raises is not None:
            raise self.raises
        payload = context.action_request.action_payload
        assert payload is not None
        return {"target": payload["target"]}


def fake_action(target: str = "a") -> dict[str, Any]:
    return {"kind": "test_kind", "target": target}


def fake_action_kind() -> Any:
    """Register the test-only kind, for tests of the shared action request code."""
    return patch.dict(ACTION_KINDS, {"test_kind": RecordingKind()})


@pytest.fixture(autouse=True)
def test_kind() -> Generator[None]:
    with patch.dict(ACTION_KINDS, {"test_kind": RecordingKind()}):
        yield


def action_request(**overrides: Any) -> dict[str, Any]:
    return {
        "key": "widen-time-window",
        "reportRevision": 2,
        "title": "Widen the time window",
        "rationale": "The window fires on short spikes.",
        "impact": None,
        "primary": True,
        "anchor": None,
        "action": {"kind": "test_kind", "target": "a"},
        **overrides,
    }


def requested(item: Any) -> dict[str, Any] | None:
    return validated(ActionRequestedPayloadSerializer, {"request": item})["request"]


def test_action_requested_accepts_the_wire_shape() -> None:
    result = requested(action_request(seerAddedThisLater=True))

    assert result is not None
    assert result["seerAddedThisLater"] is True
    assert result["primary"] is True
    assert result["action"] == {"kind": "test_kind", "target": "a"}


def test_action_requests_default_to_unanchored_advice() -> None:
    item = action_request(action=None)
    del item["primary"], item["anchor"], item["action"]

    result = requested(item)

    assert result is not None
    assert (result["primary"], result["anchor"], result["action"]) == (False, None, None)


def test_action_requests_accept_anchors() -> None:
    result = requested(action_request(primary=False, anchor={"type": "hypothesis", "id": "h-2"}))

    assert result is not None
    assert result["anchor"] == {"type": "hypothesis", "id": "h-2"}


@pytest.mark.parametrize(
    "overrides",
    [
        {"key": "Widen"},
        {"key": "-widen"},
        {"key": "a" * 65},
        {"reportRevision": "2"},
        {"title": ""},
        {"title": "x" * 201},
        {"rationale": "x" * 1_001},
        {"impact": "x" * 1_001},
        {"primary": "true"},
        {"anchor": {"type": "chart", "id": "b-1"}},
        {"anchor": {"type": "block", "id": "x" * 129}},
        {"anchor": {"type": "block", "id": "b-1", "extra": True}},
        {"action": {"kind": "seer_task", "prompt": "Add retry spans"}},
        {"action": {"kind": "test_kind", "target": "x" * 9}},
        {"action": "test_kind"},
    ],
)
def test_malformed_action_requests_are_dropped(overrides: dict[str, Any]) -> None:
    assert requested(action_request(**overrides)) is None
    assert requested("not an object") is None


def test_a_trimmed_away_action_keeps_the_request_as_advice() -> None:
    result = requested(action_request(action={"kind": "test_kind", "target": "advice"}))

    assert result is not None
    assert result["action"] is None
    assert result["title"] == "Widen the time window"


def test_snapshot_action_requests_keep_the_first_valid_unique_keys() -> None:
    result = valid_action_requests(
        [
            "not an object",
            action_request(key="r0"),
            action_request(key="r0", title="Duplicate"),
            action_request(key="r1", action={"kind": "unknown"}),
            action_request(key="r2"),
        ]
    )

    assert [(item["key"], item["title"]) for item in result] == [
        ("r0", "Widen the time window"),
        ("r2", "Widen the time window"),
    ]


def test_action_withdrawn_payload() -> None:
    assert validated(
        ActionWithdrawnPayloadSerializer, {"key": "widen", "reason": "Spikes are real."}
    ) == {"key": "widen", "reason": "Spikes are real."}
    rejects(ActionWithdrawnPayloadSerializer, {"key": "widen"})
    rejects(ActionWithdrawnPayloadSerializer, {"key": "widen", "reason": "x" * 1_001})


def test_projection_passes_the_next_step_through() -> None:
    report = {**projection()["report"], "nextStep": {"status": "unknown"}}

    result = validated(OrchestrationProjectionSerializer, projection(report=report))

    assert result["report"]["nextStep"] == {"status": "unknown"}


def test_dropped_requests_are_logged_only_when_asked() -> None:
    bad = action_request(key="Bad")

    with patch("sentry.investigations.contracts.logger") as logger:
        assert valid_action_request(bad) is None
        logger.warning.assert_not_called()

        assert valid_action_request(bad, log=True) is None
        logger.warning.assert_called_once()
        assert logger.warning.call_args.args == ("investigations.action_requests.dropped",)


def test_trimmed_actions_are_logged_only_when_asked() -> None:
    advice = action_request(action={"kind": "test_kind", "target": "advice"})

    with patch("sentry.investigations.contracts.logger") as logger:
        assert valid_action_request(advice) is not None
        logger.warning.assert_not_called()

        assert valid_action_request(advice, log=True) is not None
        logger.warning.assert_called_once()
        assert logger.warning.call_args.args == ("investigations.action_requests.action_trimmed",)


@pytest.mark.parametrize(
    "action",
    [
        {
            "kind": "update_detector",
            "detectorId": "4821",
            "before": {"timeWindowSeconds": 300},
            "changes": {"timeWindowSeconds": 900},
        },
        {"kind": "connect_telemetry", "provider": "datadog"},
    ],
)
def test_registered_kinds_validate_their_actions(action: dict[str, Any]) -> None:
    result = requested(action_request(action=action))

    assert result is not None
    assert result["action"] == action
