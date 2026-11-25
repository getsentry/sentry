from __future__ import annotations

import json  # noqa: S003 - tools tests run without the sentry package
import os
from pathlib import Path
from unittest import mock

import pytest

from tools.api_guidelines.check_new import Finding, baselined_counts, changed_paths, find_new, main

PATH = "src/sentry/api/endpoints/example.py"

# reads query:id twice in the same method so both findings share one signature
EXAMPLE_ENDPOINT = """\
class ExampleEndpoint(Endpoint):
    publish_status = {"GET": ApiPublishStatus.PUBLIC}

    def get(self, request) -> Response[X]:
        a = request.GET.get("id")
        b = request.GET.get("id")
        return Response(a)
"""


def _entry(count: int) -> dict[str, object]:
    """exceptions.json's entry for EXAMPLE_ENDPOINT's query:id reads"""
    return {
        "rule": "S026",
        "path": PATH,
        "scope": "ExampleEndpoint.get",
        "key": "query:id",
        "count": count,
        "owner": "issues-feed",
        "status": "debt-breaking",
        "reason": "legacy: predates S026",
        "first_seen": "2026-11-19",
    }


def _write_exceptions(root: Path, entries: list[dict[str, object]]) -> Path:
    """Writes `entries` as root's api_exceptions/exceptions.json and returns its path"""
    data = {"version": 1, "generated": "2026-11-19", "commit": None, "entries": entries}
    file = root / "api_exceptions" / "exceptions.json"
    file.parent.mkdir(parents=True, exist_ok=True)
    file.write_text(json.dumps(data))
    return file


@pytest.fixture
def repo(tmp_path: Path) -> Path:
    """A checkout with EXAMPLE_ENDPOINT and an empty exceptions.json"""
    endpoint = tmp_path / PATH
    endpoint.parent.mkdir(parents=True)
    endpoint.write_text(EXAMPLE_ENDPOINT)
    _write_exceptions(tmp_path, [])
    return tmp_path


def _lines(new: list[Finding]) -> list[tuple[str, int]]:
    """(path, line) of each finding"""
    located: list[tuple[str, int]] = []
    for path, violation in new:
        located.append((path, violation.line))
    return located


def test_a_finding_not_in_exceptions_json_is_new(repo: Path) -> None:
    new, unparsed = find_new(repo, [PATH], {})

    assert _lines(new) == [(PATH, 5), (PATH, 6)]
    assert unparsed == []


def test_a_baselined_finding_is_not_new(repo: Path) -> None:
    counts = baselined_counts(_write_exceptions(repo, [_entry(count=2)]))

    new, _ = find_new(repo, [PATH], counts)

    assert new == []


def test_a_count_above_the_baseline_flags_every_line_with_that_signature(repo: Path) -> None:
    counts = baselined_counts(_write_exceptions(repo, [_entry(count=1)]))

    new, _ = find_new(repo, [PATH], counts)

    assert _lines(new) == [(PATH, 5), (PATH, 6)]


def test_only_python_files_under_src_are_checked() -> None:
    raw = json.dumps([PATH, "tests/sentry/test_example.py", "static/app/x.tsx", PATH])

    assert changed_paths(raw) == [PATH]


def test_a_file_that_doesnt_parse_is_skipped_and_the_rest_are_checked(repo: Path) -> None:
    broken = "src/sentry/api/endpoints/broken.py"
    (repo / broken).write_text("def get(:\n")

    new, unparsed = find_new(repo, [broken, PATH], {})

    assert unparsed == [broken]
    assert _lines(new) == [(PATH, 5), (PATH, 6)]


def _run(root: Path, changed_files: str) -> int:
    """main() with CHANGED_FILES set"""
    with mock.patch.dict(os.environ, {"CHANGED_FILES": changed_files}):
        return main(root=root)


@pytest.mark.parametrize("changed_files", ["", "[]"])
def test_nothing_to_check_exits_0(repo: Path, changed_files: str) -> None:
    assert _run(repo, changed_files) == 0


def test_a_missing_exceptions_file_exits_0(repo: Path) -> None:
    (repo / "api_exceptions" / "exceptions.json").unlink()

    assert _run(repo, json.dumps([PATH])) == 0


def test_new_findings_exit_0_with_a_warning_annotation_per_line(
    repo: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    assert _run(repo, json.dumps([PATH])) == 0

    annotations: list[str] = []
    for line in capsys.readouterr().out.splitlines():
        if line.startswith("::warning "):
            annotations.append(line.split("::")[1])
    assert annotations == [
        f"warning file={PATH},line=5,title=New API finding S026",
        f"warning file={PATH},line=6,title=New API finding S026",
    ]


def test_a_file_that_doesnt_parse_gets_a_notice_on_it(
    repo: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    broken = "src/sentry/api/endpoints/broken.py"
    (repo / broken).write_text("def get(:\n")

    assert _run(repo, json.dumps([broken])) == 0

    assert capsys.readouterr().out.startswith(f"::notice file={broken}::")
