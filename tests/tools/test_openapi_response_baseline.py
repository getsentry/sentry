from __future__ import annotations

import json  # noqa: S003 - tools tests run without the sentry package
from pathlib import Path

import pytest

from tools.openapi_response_baseline import main

TODAY = "2026-11-17"
PATH = "src/sentry/api/endpoints/example.py"


def _finding(scope: str, key: str, rule: str = "S036") -> dict[str, object]:
    return {"rule": rule, "path": PATH, "scope": scope, "key": key, "owner": "issues-feed"}


def _report(
    tmp_path: Path, name: str, exercised: list[str], findings: list[dict[str, object]]
) -> Path:
    path = tmp_path / f"report-{name}.json"
    path.write_text(
        json.dumps({"exercised": [[PATH, scope] for scope in exercised], "findings": findings})
    )
    return path


def _entry(scope: str, key: str, rule: str = "S036", **fields: object) -> dict[str, object]:
    entry: dict[str, object] = {
        "rule": rule,
        "path": PATH,
        "scope": scope,
        "key": key,
        "count": 1,
        "owner": "issues-feed",
        "status": "debt-breaking",
        "reason": f"legacy: predates {rule}",
        "first_seen": TODAY,
    }
    return entry | fields


def _run(tmp_path: Path, *reports: Path) -> list[dict[str, object]]:
    output = tmp_path / "baseline.json"
    assert main([*map(str, reports), "--output", str(output), "--date", TODAY]) == 0
    return json.loads(output.read_text())["entries"]


def test_creates_the_file_with_one_entry_per_signature(tmp_path: Path) -> None:
    a = _report(tmp_path, "gw0", ["A.get"], [_finding("A.get", "status:402")])
    b = _report(
        tmp_path,
        "gw1",
        ["A.get", "A.post"],
        [_finding("A.get", "status:402"), _finding("A.post", "status:202", rule="S037")],
    )

    assert _run(tmp_path, a, b) == [
        _entry("A.get", "status:402"),
        _entry("A.post", "status:202", rule="S037"),
    ]


def test_only_replaces_the_entries_of_exercised_endpoint_methods(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    reviewed = _entry("A.get", "status:402", status="accepted", first_seen="2026-11-01")
    fixed = _entry("A.get", "status:409")
    untouched = _entry("B.get", "status:400")
    (tmp_path / "baseline.json").write_text(
        json.dumps(
            {"version": 1, "generated": "2026-11-01", "entries": [reviewed, fixed, untouched]}
        )
    )
    report = _report(tmp_path, "main", ["A.get"], [_finding("A.get", "status:402")])

    assert _run(tmp_path, report) == [reviewed, untouched]
    out = capsys.readouterr().out
    assert "0 new, 1 fixed" in out
    assert f"fixed  S036 {PATH} A.get status:409" in out
