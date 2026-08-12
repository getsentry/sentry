from __future__ import annotations

from pathlib import Path
from typing import Any

import pytest
from rest_framework.exceptions import ValidationError

from sentry.investigations.contracts import (
    MAX_ARTIFACT_BYTES,
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
