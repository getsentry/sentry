from __future__ import annotations

from collections.abc import Callable
from pathlib import Path
from typing import Any

import pytest
from rest_framework.exceptions import ValidationError

from sentry.db.models.fields.bounded import I32_MAX, I64_MAX
from sentry.investigations.contracts import (
    MAX_ARTIFACT_BYTES,
    OrchestrationProjectionSerializer,
    RelaxedContractSerializer,
    ReportBlockStartedPayloadSerializer,
    ReportBlockUpsertedPayloadSerializer,
    ReportClearPayloadSerializer,
    validate_query_result,
    validate_text_result,
)
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


def test_relaxed_serializer_passes_unknown_nested_fields_through() -> None:
    result = validated(
        OrchestrationProjectionSerializer,
        projection(broadScan={"status": "running", "seerAddedThisLater": "kept"}),
    )

    assert result["broadScan"]["seerAddedThisLater"] == "kept"


def test_projection_is_bounded_by_its_serialized_size() -> None:
    # An undeclared field is passed through untouched, so nothing but the size
    # guard bounds it.
    rejects(OrchestrationProjectionSerializer, projection(seerAddedThisLater="x" * (600 * 1024)))


def test_projection_phase_and_status_must_be_known_values() -> None:
    rejects(OrchestrationProjectionSerializer, projection(phase="not_a_phase"))
    rejects(OrchestrationProjectionSerializer, projection(status="not_a_status"))


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
