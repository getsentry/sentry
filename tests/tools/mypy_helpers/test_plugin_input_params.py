"""Tests for the input-parameter half of the mypy plugin.

The recording hooks append facts during a type check; the renderer joins them
into the per-pattern inventory. The renderer is pure, so most scenarios are
exercised through it directly.
"""

from __future__ import annotations

import os

from sentry.utils import json
from tools.mypy_helpers.plugin import BASE_CLASS_READS, _render_inventory


def _inventory(tmp_path, *records: dict) -> str:
    path = os.path.join(tmp_path, "inventory.jsonl")
    with open(path, "w") as fh:
        for record in records:
            fh.write(json.dumps(record) + "\n")
    return path


def _declared(**kwargs) -> dict:
    record = {
        "kind": "declared",
        "path": "src/sentry/api/endpoints/t.py",
        "cls": "sentry.api.endpoints.t.E",
        "method": "get",
        "declared": [],
        "unresolved": [],
        "serializers": [],
        "factory": False,
        "body_fields": None,
    }
    record.update(kwargs)
    return record


def _read(name: str, line: int = 10, **kwargs) -> dict:
    record = {
        "kind": "read",
        "path": "src/sentry/api/endpoints/t.py",
        "cls": "sentry.api.endpoints.t.E",
        "method": "get",
        "name": name,
        "line": line,
    }
    record.update(kwargs)
    return record


def test_read_but_undeclared_parameter_is_a_violation(tmp_path) -> None:
    report = _render_inventory(
        _inventory(tmp_path, _declared(declared=["statsPeriod"]), _read("truncate"))
    )
    assert "query parameter 'truncate' is read but not declared" in report
    assert "statsPeriod" not in report


def test_declared_parameter_is_not_reported(tmp_path) -> None:
    report = _render_inventory(
        _inventory(tmp_path, _declared(declared=["statsPeriod"]), _read("statsPeriod"))
    )
    assert "is read but not declared" not in report


def test_unresolved_declaration_suppresses_violations(tmp_path) -> None:
    report = _render_inventory(
        _inventory(
            tmp_path,
            _declared(declared=["statsPeriod"], unresolved=["GlobalParams.MYSTERY"]),
            _read("truncate"),
        )
    )
    assert "unresolved declaration GlobalParams.MYSTERY; coverage suppressed" in report
    assert "is read but not declared" not in report


def test_serializer_derived_declaration_covers_its_fields(tmp_path) -> None:
    report = _render_inventory(
        _inventory(
            tmp_path,
            _declared(declared=["statsPeriod"], serializers=["t.ReplayValidator"]),
            _read("statsPeriod"),
        )
    )
    assert "is read but not declared" not in report
    assert "Pattern F: 0 finding(s)" in report


def test_base_class_reads_are_attributed_once_to_the_base(tmp_path) -> None:
    records = [
        _read("dataset", cls="sentry.api.bases.organization_events.Base", method=BASE_CLASS_READS),
        _read("query", cls="sentry.api.bases.organization_events.Base", method=BASE_CLASS_READS),
    ]
    report = _render_inventory(_inventory(tmp_path, *records))
    assert report.count("Base reads dataset, query for its inheritors") == 1
    assert "is read but not declared" not in report


def test_body_key_absent_from_the_request_serializer_is_a_violation(tmp_path) -> None:
    report = _render_inventory(
        _inventory(
            tmp_path,
            _declared(body_fields=["name", "slug"]),
            {
                "kind": "body_read",
                "path": "src/sentry/api/endpoints/t.py",
                "cls": "sentry.api.endpoints.t.E",
                "method": "post",
                "name": "origin",
                "line": 20,
            },
            _declared(method="post", body_fields=["name", "slug"]),
        )
    )
    assert "body key 'origin' is absent from the serializer declared in request=" in report


def test_body_key_present_in_the_request_serializer_is_silent(tmp_path) -> None:
    report = _render_inventory(
        _inventory(
            tmp_path,
            _declared(method="post", body_fields=["userName"]),
            {
                "kind": "body_read",
                "path": "src/sentry/api/endpoints/t.py",
                "cls": "sentry.api.endpoints.t.E",
                "method": "post",
                "name": "userName",
                "line": 20,
            },
        )
    )
    assert "body key" not in report


def test_body_is_unchecked_when_no_request_serializer_resolves(tmp_path) -> None:
    report = _render_inventory(
        _inventory(
            tmp_path,
            _declared(method="post"),
            {
                "kind": "body_read",
                "path": "src/sentry/api/endpoints/t.py",
                "cls": "sentry.api.endpoints.t.E",
                "method": "post",
                "name": "origin",
                "line": 20,
            },
        )
    )
    assert "body key" not in report


def test_dynamic_key_makes_the_method_pattern_E(tmp_path) -> None:
    report = _render_inventory(
        _inventory(
            tmp_path,
            _declared(),
            {
                "kind": "dynamic",
                "path": "src/sentry/api/endpoints/t.py",
                "cls": "sentry.api.endpoints.t.E",
                "method": "get",
                "line": 12,
            },
        )
    )
    assert "Pattern E: " in report
    assert "\nE " in report or "E " in report


def test_factory_declaration_makes_the_method_pattern_B(tmp_path) -> None:
    report = _render_inventory(_inventory(tmp_path, _declared(factory=True)))
    lines = [ln for ln in report.splitlines() if ln.startswith("B ")]
    assert lines and lines[0].split()[1] == "1"


def test_every_diagnostic_carries_its_pattern(tmp_path) -> None:
    report = _render_inventory(_inventory(tmp_path, _declared(), _read("truncate")))
    findings = [ln for ln in report.splitlines() if "is read but not declared" in ln]
    assert findings and all("[A]" in line for line in findings)


def test_single_file_records_are_grouped_with_the_coverage_findings(tmp_path) -> None:
    report = _render_inventory(
        _inventory(
            tmp_path,
            {
                "kind": "single_file",
                "path": "src/sentry/api/endpoints/t.py",
                "cls": "E",
                "method": "get",
                "pattern": "F-prime",
                "line": 5,
                "message": "S025 [F-prime] Q validates the query string but is not declared",
            },
        )
    )
    assert "Pattern F-prime: 1 finding(s)" in report
    assert "S025 [F-prime]" in report


def test_report_can_be_filtered_to_one_pattern(tmp_path) -> None:
    records = [
        _declared(),
        _read("truncate"),
        {
            "kind": "single_file",
            "path": "src/sentry/api/endpoints/t.py",
            "cls": "E",
            "method": "get",
            "pattern": "F-prime",
            "line": 5,
            "message": "S025 [F-prime] undeclared validator",
        },
    ]
    report = _render_inventory(_inventory(tmp_path, *records), only="F-prime")
    assert "Pattern F-prime" in report
    assert "Pattern A" not in report


def test_summary_reports_counts_per_pattern(tmp_path) -> None:
    report = _render_inventory(_inventory(tmp_path, _declared(), _read("truncate")))
    assert "pattern     PUBLIC  reading  violating  unresolved" in report
    row = [ln for ln in report.splitlines() if ln.startswith("A ")][0].split()
    assert row[1:] == ["1", "1", "1", "0"]


def test_clean_method_produces_no_finding_line(tmp_path) -> None:
    report = _render_inventory(
        _inventory(tmp_path, _declared(declared=["statsPeriod"]), _read("statsPeriod"))
    )
    assert "Pattern A: 0 finding(s)" in report


def test_empty_enforced_set_gates_nothing(tmp_path) -> None:
    report = _render_inventory(_inventory(tmp_path, _declared(), _read("truncate")))
    assert "ENFORCED = none, so nothing gates" in report


def _call_mypy_collecting(tmp_path, src: str) -> list[dict]:
    """Type-check `src` with collection on, and return the facts the hooks appended."""
    import subprocess
    import sys

    def _stub(path: str, body: str) -> None:
        full = os.path.join(tmp_path, path)
        os.makedirs(os.path.dirname(full), exist_ok=True)
        package = os.path.dirname(full)
        while package != str(tmp_path):
            open(os.path.join(package, "__init__.pyi"), "a").close()
            package = os.path.dirname(package)
        with open(full, "w") as fh:
            fh.write(body)

    _stub(
        "django/http/request.pyi",
        "from typing import Any, overload\n"
        "class _ImmutableQueryDict:\n"
        "    @overload\n"
        "    def get(self, key: str) -> Any: ...\n"
        "    @overload\n"
        "    def get(self, key: str, default: Any) -> Any: ...\n",
    )
    _stub("sentry/api/base.pyi", "class Endpoint: ...\n")

    config = os.path.join(tmp_path, "mypy.toml")
    with open(config, "w") as fh:
        fh.write(
            "[tool.mypy]\n"
            "plugins = ['tools.mypy_helpers.plugin']\n"
            f"mypy_path = ['{tmp_path}']\n"
            "num_workers = 1\n"
        )
    source = os.path.join(tmp_path, "endpoint_under_test.py")
    with open(source, "w") as fh:
        fh.write(src)
    inventory = os.path.join(tmp_path, "collected.jsonl")
    env = {**os.environ, "SENTRY_INPUT_PARAM_INVENTORY": inventory}
    proc = subprocess.run(
        (
            sys.executable,
            "-m",
            "mypy",
            "--config",
            config,
            source,
            "--no-incremental",
            "--ignore-missing-imports",
            # sentry is installed in the venv; without this the stubs lose to the
            # real package and the whole tree gets pulled into the check.
            "--no-site-packages",
            "--cache-dir",
            os.path.join(tmp_path, "cache"),
        ),
        capture_output=True,
        env=env,
        cwd=os.path.join(os.path.dirname(__file__), "../../.."),
    )
    if not os.path.exists(inventory):
        # No file means nothing was recorded, which is the expected outcome for a
        # method the linter skips. Carry mypy's output so a real failure is legible.
        assert proc.returncode == 0, proc.stdout.decode() + proc.stderr.decode()
        return []
    with open(inventory) as fh:
        return [json.loads(line) for line in fh if line.strip()]


def test_hooks_record_a_query_read_in_a_public_method(tmp_path) -> None:
    src = """\
from django.http.request import _ImmutableQueryDict
from sentry.api.base import Endpoint


class ApiPublishStatus:
    PUBLIC = "public"


class Req:
    GET: _ImmutableQueryDict


class E(Endpoint):
    publish_status = {"GET": ApiPublishStatus.PUBLIC}

    def get(self, request: Req) -> None:
        request.GET.get("truncate")
"""
    records = _call_mypy_collecting(str(tmp_path), src)
    reads = [r for r in records if r["kind"] == "read"]
    assert [(r["name"], r["method"]) for r in reads] == [("truncate", "get")], records


def test_hooks_skip_a_read_in_a_private_method(tmp_path) -> None:
    src = """\
from django.http.request import _ImmutableQueryDict
from sentry.api.base import Endpoint


class ApiPublishStatus:
    PRIVATE = "private"


class Req:
    GET: _ImmutableQueryDict


class E(Endpoint):
    publish_status = {"GET": ApiPublishStatus.PRIVATE}

    def get(self, request: Req) -> None:
        request.GET.get("truncate")
"""
    records = _call_mypy_collecting(str(tmp_path), src)
    assert [r for r in records if r["kind"] == "read"] == []
