from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path
from typing import Any

import pytest
from django.db import connection
from perf_harness.query_profile import (
    CapturedQuery,
    DatabaseOperationProfile,
    explain_captured_query,
    format_profile_comparison,
    format_profile_summary,
    profile_database_operation,
    read_profile_report,
    summarize_query_plan,
    write_profile_report,
)
from perf_harness.workload import Workload, integer_parameters, run_workload

from sentry.testutils.cases import TestCase


def test_summarize_query_plan() -> None:
    plan = summarize_query_plan(
        [
            {
                "Planning Time": 1.25,
                "Execution Time": 8.5,
                "Plan": {
                    "Node Type": "Aggregate",
                    "Plan Rows": 10,
                    "Actual Rows": 5,
                    "Actual Loops": 1,
                    "Shared Hit Blocks": 20,
                    "Shared Read Blocks": 4,
                    "Temp Read Blocks": 3,
                    "Temp Written Blocks": 2,
                    "Plans": [
                        {
                            "Node Type": "Seq Scan",
                            "Relation Name": "example_table",
                            "Plan Rows": 10,
                            "Actual Rows": 100,
                            "Actual Loops": 2,
                            "Rows Removed by Filter": 30,
                        },
                        {
                            "Node Type": "Index Scan",
                            "Index Name": "example_index",
                            "Plan Rows": 5,
                            "Actual Rows": 5,
                            "Actual Loops": 1,
                        },
                        {
                            "Node Type": "Sort",
                            "Plan Rows": 5,
                            "Actual Rows": 5,
                            "Actual Loops": 1,
                            "Sort Space Type": "Disk",
                            "Sort Space Used": 64,
                        },
                    ],
                },
            }
        ]
    )

    assert plan.planning_time_ms == 1.25
    assert plan.execution_time_ms == 8.5
    assert plan.root_node_type == "Aggregate"
    assert plan.root_actual_rows == 5
    assert plan.rows_processed == 215
    assert plan.rows_removed == 60
    assert plan.shared_hit_blocks == 20
    assert plan.shared_read_blocks == 4
    assert plan.temp_read_blocks == 3
    assert plan.temp_written_blocks == 2
    assert plan.disk_sort_kb == 64
    assert plan.max_estimation_error == 10
    assert plan.sequential_scan_relations == ("example_table",)
    assert plan.indexes == ("example_index",)
    assert plan.node_types == ("Aggregate", "Seq Scan", "Index Scan", "Sort")


def test_summarize_query_plan_rejects_invalid_json() -> None:
    with pytest.raises(ValueError, match="one plan"):
        summarize_query_plan([])


def test_write_read_and_compare_profile_report(tmp_path: Path) -> None:
    before_profile = DatabaseOperationProfile(
        wall_time_samples_ms=(90, 100, 110),
        database_time_samples_ms=(40, 50, 60),
        query_count_samples=(2, 2, 2),
        queries=(),
    )
    after_profile = DatabaseOperationProfile(
        wall_time_samples_ms=(70, 75, 80),
        database_time_samples_ms=(20, 25, 30),
        query_count_samples=(1, 1, 1),
        queries=(),
    )
    before_path = tmp_path / "before.json"
    after_path = tmp_path / "after.json"

    write_profile_report(before_path, before_profile, label="before")
    write_profile_report(after_path, after_profile, label="after")

    comparison = format_profile_comparison(
        read_profile_report(before_path), read_profile_report(after_path)
    )
    summary = format_profile_summary(read_profile_report(before_path))
    assert "Measured samples" in summary
    assert "3" in summary
    assert "Endpoint wall time" in comparison
    assert "100.00 ms" in comparison
    assert "75.00 ms" in comparison
    assert "-25.0%" in comparison


def test_profile_database_operation_uses_warmups_and_median_samples() -> None:
    calls = 0

    def operation() -> int:
        nonlocal calls
        calls += 1
        return calls

    result, profile = profile_database_operation(
        operation,
        warmup_iterations=1,
        iterations=3,
        should_explain=lambda query: False,
    )

    assert result == 4
    assert calls == 4
    assert len(profile.wall_time_samples_ms) == 3
    assert len(profile.database_time_samples_ms) == 3
    assert profile.query_count_samples == (0, 0, 0)


@pytest.mark.parametrize(
    ("warmup_iterations", "iterations", "message"),
    [(-1, 1, "warmup_iterations"), (0, 0, "iterations")],
)
def test_profile_database_operation_rejects_invalid_iteration_counts(
    warmup_iterations: int, iterations: int, message: str
) -> None:
    with pytest.raises(ValueError, match=message):
        profile_database_operation(
            lambda: None,
            warmup_iterations=warmup_iterations,
            iterations=iterations,
        )


def test_workload_reports_parameters_and_compares_variants(tmp_path: Path) -> None:
    contexts = []

    @contextmanager
    def variant() -> Iterator[None]:
        contexts.append("entered")
        try:
            yield
        finally:
            contexts.append("exited")

    def validate(response: dict[str, int]) -> None:
        assert response == {"count": 3}

    workload = Workload(
        operation=lambda: {"count": 3},
        validate=validate,
        snapshot=lambda response: response,
        parameters={"groups": 3},
        variants={"candidate": variant},
    )
    report = run_workload(
        workload,
        output=tmp_path / "profile.json",
        label="test",
        workload_name="example:factory",
        warmups=0,
        iterations=2,
        compare_variants=True,
    )
    assert report["workload"]["parameters"] == {"groups": 3}
    assert report["totals"]["sample_count"] == 2
    assert contexts == ["entered", "exited"]
    assert read_profile_report(tmp_path / "profile-candidate.json")["label"] == "candidate"
    assert (
        read_profile_report(tmp_path / "profile-candidate.json")["response_fingerprint"]
        == report["response_fingerprint"]
    )
    assert read_profile_report(tmp_path / "profile-baseline-repeat.json")


def test_workload_rejects_changed_response_and_cleans_up(tmp_path: Path) -> None:
    state = {"count": 1}

    @contextmanager
    def variant() -> Iterator[None]:
        state["count"] = 2
        try:
            yield
        finally:
            state["count"] = 1

    workload = Workload(
        operation=lambda: dict(state),
        validate=lambda response: None,
        snapshot=lambda response: response,
        variants={"candidate": variant},
    )
    with pytest.raises(AssertionError, match="candidate"):
        run_workload(
            workload,
            output=tmp_path / "profile.json",
            label="test",
            workload_name="example:factory",
            warmups=0,
            iterations=1,
            compare_variants=True,
        )
    assert state == {"count": 1}
    assert not (tmp_path / "profile-candidate.json").exists()


@pytest.mark.parametrize(
    "parameters", [{"typo": 1}, {"groups": True}, {"groups": 0}, {"groups": "3"}]
)
def test_invalid_workload_parameters(parameters: dict[str, Any]) -> None:
    with pytest.raises(ValueError):
        integer_parameters(parameters, {"groups": (3, 1, None)})


class TestExplainIsolation(TestCase):
    def test_restores_timeout_in_outer_transaction(self) -> None:
        with connection.cursor() as cursor:
            cursor.execute("SHOW statement_timeout")
            original = cursor.fetchone()[0]
        plan = explain_captured_query(
            CapturedQuery(
                alias=connection.alias, sql="SELECT 1", params=(), many=False, duration_ms=0
            ),
            statement_timeout_ms=1234,
        )
        assert plan.root_actual_rows == 1
        with connection.cursor() as cursor:
            cursor.execute("SHOW statement_timeout")
            assert cursor.fetchone()[0] == original
