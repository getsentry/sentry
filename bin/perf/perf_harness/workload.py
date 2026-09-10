from __future__ import annotations

import hashlib
import importlib
import re
from collections.abc import Callable, Mapping
from contextlib import AbstractContextManager, nullcontext
from copy import deepcopy
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import click

from perf_harness.query_profile import (
    CapturedQuery,
    format_profile_comparison,
    profile_database_operation,
)
from sentry.testutils.cases import APITransactionTestCase  # noqa: S007 - development-only harness
from sentry.utils import json


class EndpointContext(APITransactionTestCase):
    endpoint = ""


@dataclass
class Workload:
    operation: Callable[[], Any]
    validate: Callable[[Any], None]
    parameters: Mapping[str, Any] = field(default_factory=dict)
    should_explain: Callable[[CapturedQuery], bool] | None = None
    variants: Mapping[str, Callable[[], AbstractContextManager[Any]]] = field(default_factory=dict)
    snapshot: Callable[[Any], Any] = lambda response: response.data


def load_workload(name: str, case: EndpointContext, parameters: dict[str, Any]) -> Workload:
    """Load a trusted local factory, not a remote endpoint or downloaded code."""
    if ":" not in name:
        name = f"perf_harness.workloads.{name.replace('-', '_')}:build_workload"
    module_name, factory_name = name.split(":", 1)
    factory = getattr(importlib.import_module(module_name), factory_name)
    workload = factory(case, parameters)
    if not isinstance(workload, Workload):
        raise TypeError("Workload factory must return Workload")
    return workload


def integer_parameters(
    supplied: Mapping[str, Any], defaults: Mapping[str, tuple[int, int, int | None]]
) -> dict[str, int]:
    unknown = supplied.keys() - defaults.keys()
    if unknown:
        raise ValueError(f"Unknown workload parameters: {', '.join(sorted(unknown))}")
    result = {}
    for name, (default, minimum, maximum) in defaults.items():
        value = supplied.get(name, default)
        if type(value) is not int or value < minimum or (maximum is not None and value > maximum):
            raise ValueError(f"Invalid {name}: expected integer in [{minimum}, {maximum}]")
        result[name] = value
    return result


def run_workload(
    workload: Workload,
    *,
    output: Path,
    label: str,
    workload_name: str,
    warmups: int = 1,
    iterations: int = 5,
    statement_timeout_ms: int = 60_000,
    compare_variants: bool = False,
    include_sql: bool = False,
) -> dict[str, Any]:
    variants = dict(workload.variants) if compare_variants else {}
    if "baseline-repeat" in variants or any(
        not re.fullmatch(r"[a-z0-9][a-z0-9-]*", name) for name in variants
    ):
        raise ValueError("Variant names must be filename-safe and not 'baseline-repeat'")
    if compare_variants:
        variants["baseline-repeat"] = nullcontext

    baseline_snapshot = None
    baseline_report: dict[str, Any] = {}
    for variant, context in [(None, nullcontext), *variants.items()]:
        with context():

            def operation() -> Any:
                response = workload.operation()
                workload.validate(response)
                if variant is not None:
                    assert workload.snapshot(response) == baseline_snapshot, variant
                return response

            response, profile = profile_database_operation(
                operation,
                warmup_iterations=warmups,
                iterations=iterations,
                statement_timeout_ms=statement_timeout_ms,
                should_explain=workload.should_explain,
            )
        errors = [query.explain_error for query in profile.queries if query.explain_error]
        if errors:
            raise RuntimeError(
                f"EXPLAIN failed for {len(errors)} queries; no successful report saved"
            )
        report = profile.to_report(label=variant or label, include_sql=include_sql)
        report["response_fingerprint"] = hashlib.sha256(
            json.dumps(workload.snapshot(response), sort_keys=True).encode()
        ).hexdigest()
        report["workload"] = {
            "name": workload_name,
            "parameters": dict(workload.parameters),
            "warmups": warmups,
            "iterations": iterations,
            "statement_timeout_ms": statement_timeout_ms,
            "variant": variant or "baseline",
        }
        path = (
            output
            if variant is None
            else output.with_name(f"{output.stem}-{variant}{output.suffix}")
        )
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(report, sort_keys=True) + "\n")
        click.echo(f"Profile written to {path}")
        if variant is None:
            baseline_snapshot = deepcopy(workload.snapshot(response))
            baseline_report = report
        else:
            click.echo(f"{variant}: response matches baseline")
            click.echo(format_profile_comparison(baseline_report, report))
    return baseline_report
