#!/usr/bin/env python
"""Edit setup_work() to profile arbitrary local Python/Django work."""

from __future__ import annotations

import hashlib
import os
import re
import statistics
import subprocess
import sys
import time
from collections.abc import Callable, Iterator, Mapping, Sequence
from contextlib import ExitStack, contextmanager
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import TYPE_CHECKING, Any, TypeVar

import click
from django.db import DatabaseError, connections, transaction

from sentry.silo.base import SiloMode, SingleProcessSiloModeState
from sentry.utils import json

if TYPE_CHECKING:
    from sentry.testutils.cases import TransactionTestCase  # noqa: S007 - development-only script

T = TypeVar("T")

PROFILE_SCHEMA_VERSION = 1
_WHITESPACE = re.compile(r"\s+")


def setup_work(case: TransactionTestCase) -> Callable[[], Any]:
    """Arrange synthetic data here, outside the measured work()."""
    from sentry.models.project import Project

    project = case.create_project()

    def work() -> int:
        count = Project.objects.filter(id=project.id).count()
        assert count == 1
        return count

    return work


@dataclass(frozen=True)
class CapturedQuery:
    alias: str
    sql: str
    params: Any
    many: bool
    duration_ms: float
    silo_mode: SiloMode | None = None

    @property
    def fingerprint(self) -> str:
        normalized_sql = _WHITESPACE.sub(" ", self.sql).strip()
        return hashlib.sha256(normalized_sql.encode()).hexdigest()

    @property
    def is_select(self) -> bool:
        return self.sql.lstrip().upper().startswith("SELECT")


@dataclass(frozen=True)
class QueryPlan:
    planning_time_ms: float
    execution_time_ms: float
    root_node_type: str
    root_actual_rows: float
    rows_processed: float
    rows_removed: float
    shared_hit_blocks: int
    shared_read_blocks: int
    temp_read_blocks: int
    temp_written_blocks: int
    disk_sort_kb: int
    max_estimation_error: float
    sequential_scan_relations: tuple[str, ...]
    indexes: tuple[str, ...]
    node_types: tuple[str, ...]


@dataclass(frozen=True)
class ExplainedQuery:
    captured: CapturedQuery
    plan: QueryPlan | None
    explain_error: str | None = None


@dataclass(frozen=True)
class DatabaseOperationProfile:
    wall_time_samples_ms: tuple[float, ...]
    database_time_samples_ms: tuple[float, ...]
    query_count_samples: tuple[int, ...]
    queries: tuple[ExplainedQuery, ...]

    @property
    def wall_time_ms(self) -> float:
        return statistics.median(self.wall_time_samples_ms)

    @property
    def database_time_ms(self) -> float:
        return statistics.median(self.database_time_samples_ms)

    @property
    def non_database_time_ms(self) -> float:
        return statistics.median(
            max(wall_time - database_time, 0.0)
            for wall_time, database_time in zip(
                self.wall_time_samples_ms, self.database_time_samples_ms, strict=True
            )
        )

    def to_report(self, *, label: str | None = None, include_sql: bool = False) -> dict[str, Any]:
        plans = [query.plan for query in self.queries if query.plan is not None]
        report_queries = []
        for position, query in enumerate(self.queries):
            query_report: dict[str, Any] = {
                "position": position,
                "alias": query.captured.alias,
                "fingerprint": query.captured.fingerprint,
                "captured_duration_ms": query.captured.duration_ms,
                "many": query.captured.many,
                "plan": asdict(query.plan) if query.plan is not None else None,
                "explain_error": query.explain_error,
            }
            if include_sql:
                query_report["sql"] = query.captured.sql
            report_queries.append(query_report)

        return {
            "schema_version": PROFILE_SCHEMA_VERSION,
            "label": label,
            "totals": {
                "wall_time_ms": self.wall_time_ms,
                "wall_time_min_ms": min(self.wall_time_samples_ms),
                "wall_time_max_ms": max(self.wall_time_samples_ms),
                "captured_database_time_ms": self.database_time_ms,
                "captured_database_time_min_ms": min(self.database_time_samples_ms),
                "captured_database_time_max_ms": max(self.database_time_samples_ms),
                "non_database_time_ms": self.non_database_time_ms,
                "query_count": statistics.median(self.query_count_samples),
                "sample_count": len(self.wall_time_samples_ms),
                "explained_query_count": len(plans),
                "plan_execution_time_ms": sum(plan.execution_time_ms for plan in plans),
                "rows_processed": sum(plan.rows_processed for plan in plans),
                "rows_removed": sum(plan.rows_removed for plan in plans),
                "shared_hit_blocks": sum(plan.shared_hit_blocks for plan in plans),
                "shared_read_blocks": sum(plan.shared_read_blocks for plan in plans),
                "temp_read_blocks": sum(plan.temp_read_blocks for plan in plans),
                "temp_written_blocks": sum(plan.temp_written_blocks for plan in plans),
                "disk_sort_kb": sum(plan.disk_sort_kb for plan in plans),
            },
            "queries": report_queries,
        }


class _QueryRecorder:
    def __init__(self, alias: str, queries: list[CapturedQuery]) -> None:
        self.alias = alias
        self.queries = queries

    def __call__(
        self,
        execute: Callable[..., Any],
        sql: str,
        params: Any,
        many: bool,
        context: Mapping[str, Any],
    ) -> Any:
        started = time.perf_counter()
        try:
            return execute(sql, params, many, context)
        finally:
            self.queries.append(
                CapturedQuery(
                    alias=self.alias,
                    sql=sql,
                    params=params,
                    many=many,
                    duration_ms=(time.perf_counter() - started) * 1000,
                    silo_mode=SiloMode.get_current_mode(),
                )
            )


@contextmanager
def capture_database_queries(
    aliases: Sequence[str] | None = None,
) -> Iterator[list[CapturedQuery]]:
    captured: list[CapturedQuery] = []
    selected_aliases = tuple(aliases) if aliases is not None else tuple(connections)

    with ExitStack() as stack:
        for alias in selected_aliases:
            stack.enter_context(connections[alias].execute_wrapper(_QueryRecorder(alias, captured)))
        yield captured


def _estimation_error(node: Mapping[str, Any]) -> float:
    estimated_rows = float(node.get("Plan Rows", 0))
    actual_rows = float(node.get("Actual Rows", 0))
    if estimated_rows <= 0 or actual_rows <= 0:
        return 1.0
    return max(actual_rows / estimated_rows, estimated_rows / actual_rows)


def summarize_query_plan(explain_result: object) -> QueryPlan:
    if isinstance(explain_result, str):
        explain_result = json.loads(explain_result)
    if not isinstance(explain_result, list) or not explain_result:
        raise ValueError("Expected PostgreSQL EXPLAIN JSON to contain one plan")

    statement = explain_result[0]
    if not isinstance(statement, Mapping) or not isinstance(statement.get("Plan"), Mapping):
        raise ValueError("Expected PostgreSQL EXPLAIN JSON to contain a root Plan")

    root = statement["Plan"]
    rows_processed = 0.0
    rows_removed = 0.0
    disk_sort_kb = 0
    max_estimation_error = 1.0
    sequential_scan_relations: set[str] = set()
    indexes: set[str] = set()
    node_types: list[str] = []

    def visit(node: Mapping[str, Any]) -> None:
        nonlocal rows_processed, rows_removed, disk_sort_kb, max_estimation_error

        loops = float(node.get("Actual Loops", 0))
        rows_processed += float(node.get("Actual Rows", 0)) * loops
        rows_removed += sum(
            float(value) * loops
            for key, value in node.items()
            if key.startswith("Rows Removed by ")
        )
        max_estimation_error = max(max_estimation_error, _estimation_error(node))

        node_type = str(node.get("Node Type", "Unknown"))
        node_types.append(node_type)
        if node_type == "Seq Scan" and (relation_name := node.get("Relation Name")):
            sequential_scan_relations.add(str(relation_name))
        if index_name := node.get("Index Name"):
            indexes.add(str(index_name))
        if node.get("Sort Space Type") == "Disk":
            disk_sort_kb += int(node.get("Sort Space Used", 0))

        for child in node.get("Plans", []):
            if isinstance(child, Mapping):
                visit(child)

    visit(root)

    return QueryPlan(
        planning_time_ms=float(statement.get("Planning Time", 0)),
        execution_time_ms=float(statement.get("Execution Time", 0)),
        root_node_type=str(root.get("Node Type", "Unknown")),
        root_actual_rows=float(root.get("Actual Rows", 0)),
        rows_processed=rows_processed,
        rows_removed=rows_removed,
        # PostgreSQL's root counters already include work performed by child nodes.
        shared_hit_blocks=int(root.get("Shared Hit Blocks", 0)),
        shared_read_blocks=int(root.get("Shared Read Blocks", 0)),
        temp_read_blocks=int(root.get("Temp Read Blocks", 0)),
        temp_written_blocks=int(root.get("Temp Written Blocks", 0)),
        disk_sort_kb=disk_sort_kb,
        max_estimation_error=max_estimation_error,
        sequential_scan_relations=tuple(sorted(sequential_scan_relations)),
        indexes=tuple(sorted(indexes)),
        node_types=tuple(node_types),
    )


def explain_captured_query(
    query: CapturedQuery,
    *,
    statement_timeout_ms: int = 30_000,
) -> QueryPlan:
    if query.many or not query.is_select:
        raise ValueError("Only individual SELECT queries can be explained")

    connection = connections[query.alias]
    if connection.vendor != "postgresql":
        raise ValueError(f"EXPLAIN JSON is only supported for PostgreSQL, not {connection.vendor}")

    with (
        SingleProcessSiloModeState.exit(),
        SingleProcessSiloModeState.enter(query.silo_mode or SiloMode.get_current_mode()),
        transaction.atomic(using=query.alias),
        connection.cursor() as cursor,
    ):
        cursor.execute(
            "SELECT set_config('statement_timeout', %s, true)", [str(statement_timeout_ms)]
        )
        cursor.execute(
            f"EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON, TIMING OFF, SUMMARY ON) {query.sql}",
            query.params,
        )
        explain_result = cursor.fetchone()[0]
        # Also restore SET LOCAL when called inside a surrounding test transaction.
        transaction.set_rollback(True, using=query.alias)

    return summarize_query_plan(explain_result)


def profile_database_operation(
    operation: Callable[[], T],
    *,
    aliases: Sequence[str] | None = None,
    should_explain: Callable[[CapturedQuery], bool] | None = None,
    statement_timeout_ms: int = 30_000,
    warmup_iterations: int = 0,
    iterations: int = 1,
) -> tuple[T, DatabaseOperationProfile]:
    if warmup_iterations < 0:
        raise ValueError("warmup_iterations must not be negative")
    if iterations < 1:
        raise ValueError("iterations must be at least one")

    for _ in range(warmup_iterations):
        operation()

    wall_time_samples_ms: list[float] = []
    database_time_samples_ms: list[float] = []
    query_count_samples: list[int] = []
    last_captured: list[CapturedQuery] = []
    result: T
    for _ in range(iterations):
        with capture_database_queries(aliases) as iteration_captured:
            started = time.perf_counter()
            result = operation()
            wall_time_samples_ms.append((time.perf_counter() - started) * 1000)
        database_time_samples_ms.append(sum(query.duration_ms for query in iteration_captured))
        query_count_samples.append(len(iteration_captured))
        last_captured = iteration_captured

    explained_queries: list[ExplainedQuery] = []
    for query in last_captured:
        if (
            not query.is_select
            or query.many
            or (should_explain is not None and not should_explain(query))
        ):
            explained_queries.append(ExplainedQuery(captured=query, plan=None))
            continue

        try:
            plan = explain_captured_query(query, statement_timeout_ms=statement_timeout_ms)
        except DatabaseError as error:
            explained_queries.append(
                ExplainedQuery(
                    captured=query,
                    plan=None,
                    explain_error=f"{type(error).__name__}: {error}",
                )
            )
        else:
            explained_queries.append(ExplainedQuery(captured=query, plan=plan))

    return result, DatabaseOperationProfile(
        wall_time_samples_ms=tuple(wall_time_samples_ms),
        database_time_samples_ms=tuple(database_time_samples_ms),
        query_count_samples=tuple(query_count_samples),
        queries=tuple(explained_queries),
    )


def write_profile_report(
    path: str | Path,
    profile: DatabaseOperationProfile,
    *,
    label: str | None = None,
    include_sql: bool = False,
) -> None:
    Path(path).write_text(
        json.dumps(profile.to_report(label=label, include_sql=include_sql), sort_keys=True) + "\n"
    )


def read_profile_report(path: str | Path) -> dict[str, Any]:
    report = json.loads(Path(path).read_text())
    if not isinstance(report, dict) or report.get("schema_version") != PROFILE_SCHEMA_VERSION:
        raise ValueError(f"Unsupported database profile report: {path}")
    return report


_COMPARISON_METRICS = (
    ("Work wall time", "wall_time_ms", "ms"),
    ("Captured database time", "captured_database_time_ms", "ms"),
    ("Non-database time", "non_database_time_ms", "ms"),
    ("Query count", "query_count", ""),
    ("Explained execution time", "plan_execution_time_ms", "ms"),
    ("Rows processed", "rows_processed", ""),
    ("Rows removed", "rows_removed", ""),
    ("Shared cache blocks", "shared_hit_blocks", ""),
    ("Shared disk blocks", "shared_read_blocks", ""),
    ("Temp blocks read", "temp_read_blocks", ""),
    ("Temp blocks written", "temp_written_blocks", ""),
    ("Disk sort space", "disk_sort_kb", "KiB"),
)


def _format_table(rows: Sequence[Sequence[str]]) -> str:
    widths = [max(len(row[column]) for row in rows) for column in range(len(rows[0]))]
    return "\n".join(
        "  ".join(value.ljust(widths[column]) for column, value in enumerate(row)).rstrip()
        for row in rows
    )


def format_profile_summary(report: Mapping[str, Any]) -> str:
    if report.get("schema_version") != PROFILE_SCHEMA_VERSION:
        raise ValueError("Unsupported profile schema")

    totals = report.get("totals")
    if not isinstance(totals, Mapping):
        raise ValueError("Profile report must contain totals")

    rows = [("Metric", "Value")]
    for label, key, unit in _COMPARISON_METRICS:
        value = float(totals[key])
        suffix = f" {unit}" if unit else ""
        rows.append((label, f"{value:,.2f}{suffix}"))
    rows.append(("Measured samples", f"{int(totals['sample_count']):,}"))
    rows.append(("Explained queries", f"{int(totals['explained_query_count']):,}"))

    return _format_table(rows)


def format_profile_comparison(
    before: Mapping[str, Any],
    after: Mapping[str, Any],
) -> str:
    if before.get("schema_version") != PROFILE_SCHEMA_VERSION:
        raise ValueError("Unsupported before profile schema")
    if after.get("schema_version") != PROFILE_SCHEMA_VERSION:
        raise ValueError("Unsupported after profile schema")

    before_totals = before.get("totals")
    after_totals = after.get("totals")
    if not isinstance(before_totals, Mapping) or not isinstance(after_totals, Mapping):
        raise ValueError("Profile reports must contain totals")

    rows = [("Metric", "Before", "After", "Change")]
    for label, key, unit in _COMPARISON_METRICS:
        before_value = float(before_totals[key])
        after_value = float(after_totals[key])
        if before_value:
            change = f"{(after_value - before_value) / before_value:+.1%}"
        elif after_value:
            change = "+inf"
        else:
            change = "0.0%"

        suffix = f" {unit}" if unit else ""
        rows.append(
            (
                label,
                f"{before_value:,.2f}{suffix}",
                f"{after_value:,.2f}{suffix}",
                change,
            )
        )

    return _format_table(rows)


def run_profile(
    work: Callable[[], Any],
    *,
    output: Path,
    label: str = "baseline",
    warmups: int = 1,
    iterations: int = 5,
    statement_timeout_ms: int = 60_000,
    include_sql: bool = False,
    should_explain: Callable[[CapturedQuery], bool] | None = None,
) -> dict[str, Any]:
    result, profile = profile_database_operation(
        work,
        warmup_iterations=warmups,
        iterations=iterations,
        statement_timeout_ms=statement_timeout_ms,
        should_explain=should_explain,
    )
    error_count = sum(1 for query in profile.queries if query.explain_error)
    if error_count:
        raise RuntimeError(f"EXPLAIN failed for {error_count} queries; no successful report saved")
    report = profile.to_report(label=label, include_sql=include_sql)
    if result is not None:
        report["response_fingerprint"] = hashlib.sha256(
            json.dumps(result, sort_keys=True).encode()
        ).hexdigest()
    report["run"] = {
        "warmups": warmups,
        "iterations": iterations,
        "statement_timeout_ms": statement_timeout_ms,
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, sort_keys=True) + "\n")
    return report


@click.group()
def main() -> None:
    """Profile the work() block in this file, or compare saved reports."""


@main.command()
@click.option("--output", required=True, type=click.Path(dir_okay=False, path_type=Path))
@click.option("--label", default="baseline", show_default=True)
@click.option("--warmups", default=1, show_default=True, type=click.IntRange(0))
@click.option("--iterations", default=5, show_default=True, type=click.IntRange(1))
@click.option("--statement-timeout-ms", default=60_000, show_default=True, type=click.IntRange(1))
@click.option(
    "--include-sql", is_flag=True, help="Include SQL text (may contain sensitive literals)."
)
@click.option("--recreate-db/--reuse-db", default=True, show_default=True)
def run(
    output: Path,
    label: str,
    warmups: int,
    iterations: int,
    statement_timeout_ms: int,
    include_sql: bool,
    recreate_db: bool,
) -> None:
    """Run setup_work() and measure its callable in isolated pytest databases."""
    output = output.resolve()
    config = {
        "output": str(output),
        "label": label,
        "warmups": warmups,
        "iterations": iterations,
        "statement_timeout_ms": statement_timeout_ms,
        "include_sql": include_sql,
    }
    completed = subprocess.run(
        [
            sys.executable,
            "-m",
            "pytest",
            "-n0",
            "-q",
            "-s",
            "--create-db" if recreate_db else "--reuse-db",
            "tests/performance/test_work_profile.py::TestWorkProfile::test_profile",
        ],
        cwd=Path(__file__).resolve().parents[2],
        env={**os.environ, "SENTRY_PERF_CONFIG": json.dumps(config)},
        check=False,
    )
    if completed.returncode:
        raise click.ClickException(f"Work failed with exit code {completed.returncode}")
    click.echo(format_profile_summary(read_profile_report(output)))


@main.command()
@click.argument("before", type=click.Path(exists=True, dir_okay=False, path_type=Path))
@click.argument("after", type=click.Path(exists=True, dir_okay=False, path_type=Path))
def compare(before: Path, after: Path) -> None:
    """Compare BEFORE and AFTER JSON profiles."""
    before_report = read_profile_report(before)
    after_report = read_profile_report(after)
    if before_report.get("response_fingerprint") and after_report.get("response_fingerprint"):
        matches = before_report["response_fingerprint"] == after_report["response_fingerprint"]
        click.echo("Work result: matches" if matches else "Work result: differs")
    else:
        click.echo("Work result: not compared (no result snapshot)")
    click.echo(format_profile_comparison(before_report, after_report))


if __name__ == "__main__":
    main()
