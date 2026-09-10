from __future__ import annotations

from pathlib import Path

import pytest
from click.testing import CliRunner
from django.db import connection
from profile_work import (
    CapturedQuery,
    DatabaseOperationProfile,
    explain_captured_query,
    format_profile_comparison,
    format_profile_summary,
    main,
    profile_database_operation,
    read_profile_report,
    run_profile,
    summarize_query_plan,
    write_profile_report,
)

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
    assert "Work wall time" in comparison
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


def test_generic_work_reports_and_compares_results(tmp_path: Path) -> None:
    before = tmp_path / "before.json"
    after = tmp_path / "after.json"
    report = run_profile(lambda: {"fixture_marker": 3}, output=before, warmups=0, iterations=2)
    run_profile(lambda: {"fixture_marker": 3}, output=after, warmups=0, iterations=2)
    assert report["totals"]["sample_count"] == 2
    assert report["run"]["warmups"] == 0
    assert (
        read_profile_report(before)["response_fingerprint"]
        == read_profile_report(after)["response_fingerprint"]
    )
    assert "fixture_marker" not in before.read_text()

    result = CliRunner().invoke(main, ["compare", str(before), str(after)])
    assert result.exit_code == 0
    assert "Work result: matches" in result.output
    assert "Work wall time" in result.output


def test_compare_detects_changed_work_result(tmp_path: Path) -> None:
    before = tmp_path / "before.json"
    after = tmp_path / "after.json"
    run_profile(lambda: 1, output=before, warmups=0, iterations=1)
    run_profile(lambda: 2, output=after, warmups=0, iterations=1)
    result = CliRunner().invoke(main, ["compare", str(before), str(after)])
    assert result.exit_code == 0
    assert "Work result: differs" in result.output


def test_work_without_result_does_not_claim_equivalence(tmp_path: Path) -> None:
    path = tmp_path / "profile.json"
    report = run_profile(lambda: None, output=path, warmups=0, iterations=1)
    assert "response_fingerprint" not in report
    result = CliRunner().invoke(main, ["compare", str(path), str(path)])
    assert result.exit_code == 0
    assert "not compared" in result.output


def test_work_failure_does_not_save_report(tmp_path: Path) -> None:
    def work() -> None:
        raise RuntimeError("work failed")

    path = tmp_path / "profile.json"
    with pytest.raises(RuntimeError, match="work failed"):
        run_profile(work, output=path, warmups=0, iterations=1)
    assert not path.exists()


def test_run_cli_exposes_no_endpoint_or_workload_argument() -> None:
    result = CliRunner().invoke(main, ["run", "--help"])
    assert result.exit_code == 0
    assert "--output" in result.output
    assert "WORKLOAD" not in result.output


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
