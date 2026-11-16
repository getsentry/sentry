from __future__ import annotations

import json  # noqa: S003 - tools tests run without the sentry package
import os
import subprocess
import sys
from collections.abc import Generator
from pathlib import Path
from unittest import mock

import pytest

from tools.api_guidelines import generate_baseline
from tools.api_guidelines.generate_baseline import (
    build_entries,
    main,
    write_exceptions,
)
from tools.api_guidelines.rules import ApiRule
from tools.flake8_plugin import INPUT_LINT_ALL_ENV, ApiInputViolation

PATH = "src/sentry/api/endpoints/example.py"
OWNER_MAP = {PATH: {"ExampleEndpoint": "issues-feed"}}
TODAY = "2026-11-09"
REPO_ROOT = Path(__file__).resolve().parents[3]

# this example endpoint has 4 findings and all of them are in 3 entries: lines 5 and 6 read the same key in the same method (one entry
# but count is 2), and _build is a helper reached from both get and put but reported once only at the helper
EXAMPLE_ENDPOINT = """\
class ExampleEndpoint(Endpoint):
    publish_status = {"GET": ApiPublishStatus.PUBLIC, "PUT": ApiPublishStatus.PUBLIC}

    def get(self, request) -> Response[X]:
        a = request.GET.get("id") # line 5
        b = request.GET.get("id") # line 6
        return _build(request)

    def put(self, request) -> Response[X]:
        name = request.data.get("name")
        return _build(request)


def _build(request):
    return request.GET.get("cursor")
"""


def _violation(
    rule: str, scope: str, key: str, line: int = 1, caller: str | None = None, path: str = PATH
) -> tuple[str, ApiInputViolation]:
    """A (path, finding) pair, the shape `build_entries` takes"""
    violation = ApiInputViolation(
        rule=ApiRule(rule),
        message="m",
        line=line,
        column=0,
        end_line=line,
        end_column=1,
        severity="warning",
        scope=scope,
        key=key,
        caller=caller,
    )
    return (path, violation)


def test_findings_with_the_same_signature_become_one_counted_entry() -> None:
    entries = build_entries(
        [
            _violation("S026", "ExampleEndpoint.get", "query:id", line=5),
            _violation("S026", "ExampleEndpoint.get", "query:id", line=9),
        ],
        OWNER_MAP,
        TODAY,
    )
    assert len(entries) == 1
    assert entries[0]["count"] == 2


def test_same_key_in_different_scopes_stays_separate() -> None:
    entries = build_entries(
        [
            _violation("S026", "ExampleEndpoint.get", "query:id"),
            _violation("S026", "ExampleEndpoint.put", "query:id"),
        ],
        OWNER_MAP,
        TODAY,
    )
    assert len(entries) == 2
    assert entries[0]["count"] == 1
    assert entries[1]["count"] == 1


def test_entry_has_the_imported_defaults_and_field_order() -> None:
    entries = build_entries(
        [_violation("S028", "ExampleEndpoint.get", "body:helper")], OWNER_MAP, TODAY
    )
    assert entries == [
        {
            "rule": "S028",
            "path": PATH,
            "scope": "ExampleEndpoint.get",
            "key": "body:helper",
            "count": 1,
            "owner": "issues-feed",
            "status": "debt-breaking",
            "reason": "legacy: predates S028",
            "first_seen": TODAY,
        }
    ]
    assert list(entries[0].keys()) == [
        "rule",
        "path",
        "scope",
        "key",
        "count",
        "owner",
        "status",
        "reason",
        "first_seen",
    ]
    assert type(entries[0]["rule"]) is str


def test_module_level_helper_gets_its_owner_through_the_caller() -> None:
    entries = build_entries(
        [_violation("S026", "build_query", "query:id", caller="ExampleEndpoint.get")],
        OWNER_MAP,
        TODAY,
    )
    assert entries[0]["owner"] == "issues-feed"


def test_caller_comes_from_the_first_finding_of_a_signature() -> None:
    owner_map = {PATH: {"ExampleEndpoint": "issues-feed", "OtherEndpoint": "ingest"}}
    entries = build_entries(
        [
            _violation("S026", "build_query", "query:id", line=5, caller="OtherEndpoint.get"),
            _violation("S026", "build_query", "query:id", line=9, caller="ExampleEndpoint.get"),
        ],
        owner_map,
        TODAY,
    )
    assert entries[0]["count"] == 2
    assert entries[0]["owner"] == "ingest"


def test_file_missing_from_the_owner_map_is_unowned() -> None:
    entries = build_entries(
        [_violation("S026", "OtherEndpoint.get", "query:id", path="src/sentry/other.py")],
        OWNER_MAP,
        TODAY,
    )
    assert entries[0]["owner"] == "unowned"


def test_path_is_normalized() -> None:
    entries = build_entries(
        [_violation("S026", "ExampleEndpoint.get", "query:id", path=f"./{PATH}")],
        OWNER_MAP,
        TODAY,
    )
    assert entries[0]["path"] == PATH
    # the owner lookup uses the normalized path too
    assert entries[0]["owner"] == "issues-feed"


def test_entries_are_sorted_by_path_scope_rule_then_key() -> None:
    other_path = "src/sentry/api/endpoints/aaa.py"
    entries = build_entries(
        [
            _violation("S026", "ExampleEndpoint.put", "query:b"),
            _violation("S028", "ExampleEndpoint.get", "query:a"),
            _violation("S026", "ExampleEndpoint.get", "query:b"),
            _violation("S026", "ExampleEndpoint.get", "query:a"),
            _violation("S026", "OtherEndpoint.get", "query:a", path=other_path),
        ],
        OWNER_MAP,
        TODAY,
    )
    order = []
    for entry in entries:
        order.append((entry["path"], entry["scope"], entry["rule"], entry["key"]))
    assert order == [
        (other_path, "OtherEndpoint.get", "S026", "query:a"),
        (PATH, "ExampleEndpoint.get", "S026", "query:a"),
        (PATH, "ExampleEndpoint.get", "S026", "query:b"),
        (PATH, "ExampleEndpoint.get", "S028", "query:a"),
        (PATH, "ExampleEndpoint.put", "S026", "query:b"),
    ]


def test_no_findings_gives_no_entries() -> None:
    assert build_entries([], OWNER_MAP, TODAY) == []


@pytest.fixture
def fake_repo(tmp_path: Path) -> Generator[Path]:
    """A repo with one endpoint file and an owner map used as the generator's repo root"""
    endpoint = tmp_path / PATH
    endpoint.parent.mkdir(parents=True)
    endpoint.write_text(EXAMPLE_ENDPOINT)

    owner_map = tmp_path / ".artifacts" / "api-endpoint-owners.json"
    owner_map.parent.mkdir()
    owner_map.write_text(json.dumps(OWNER_MAP))

    with mock.patch.object(generate_baseline, "_REPO_ROOT", tmp_path):
        yield tmp_path


def _run_main(repo: Path, *extra: str) -> int:
    """Runs the generator on `repo` with a fixed date
    `repo` the fake repo from the `fake_repo` fixture
    `extra` any more arguments, i.e "--force"
    Returns the generator's exit code
    """
    return main(["--output", str(repo / "out.json"), "--date", TODAY, *extra])


def _counted_findings(output: Path) -> int:
    """Adds up the count of every entry in a generated file"""
    total = 0
    for entry in json.loads(output.read_text())["entries"]:
        total += entry["count"]
    return total


def test_main_keeps_only_baselined_rules(fake_repo: Path) -> None:
    # the scan returns every rule's findings. No real file gives a structured S034 finding today,
    # so the scan's output is faked
    s026 = _violation("S026", "ExampleEndpoint.get", "query:id")
    s034 = _violation("S034", "ExampleEndpoint.get", "status:404")

    with mock.patch.object(generate_baseline, "collect_findings", return_value=[s026, s034]):
        assert _run_main(fake_repo) == 0

    entries = json.loads((fake_repo / "out.json").read_text())["entries"]
    assert len(entries) == 1
    assert entries[0]["rule"] == "S026"


def test_write_exceptions_writes_one_entry_per_line(tmp_path: Path) -> None:
    dest_file = tmp_path / "new_folder" / "exceptions.json"
    entries: list[dict[str, object]] = [{"rule": "S026", "count": 1}, {"rule": "S028", "count": 2}]

    write_exceptions(entries, dest_file, generated=TODAY)

    assert dest_file.read_text() == (
        '{"version": 1, "generated": "2026-11-09", "entries": [\n'
        '{"rule": "S026", "count": 1},\n'
        '{"rule": "S028", "count": 2}\n'
        "]}\n"
    )
    assert json.loads(dest_file.read_text()) == {
        "version": 1,
        "generated": TODAY,
        "entries": entries,
    }


def test_write_exceptions_with_no_entries(tmp_path: Path) -> None:
    dest_file = tmp_path / "exceptions.json"

    write_exceptions([], dest_file, generated=TODAY)

    assert dest_file.read_text() == '{"version": 1, "generated": "2026-11-09", "entries": []}\n'


def test_main_writes_the_baseline(fake_repo: Path, capsys: pytest.CaptureFixture[str]) -> None:
    assert _run_main(fake_repo) == 0

    entries = json.loads((fake_repo / "out.json").read_text())["entries"]
    summary = []
    for entry in entries:
        summary.append((entry["scope"], entry["key"], entry["count"], entry["owner"]))
    assert summary == [
        ("ExampleEndpoint.get", "query:id", 2, "issues-feed"),
        ("ExampleEndpoint.put", "body:name", 1, "issues-feed"),
        # the helper isn't in the owner map so it's owned through its caller
        ("_build", "query:cursor", 1, "issues-feed"),
    ]
    assert entries[0]["first_seen"] == TODAY
    assert "Wrote 3 entries (4 findings)" in capsys.readouterr().out


def test_main_stops_without_the_owner_map(fake_repo: Path) -> None:
    (fake_repo / ".artifacts" / "api-endpoint-owners.json").unlink()

    assert _run_main(fake_repo) == 1
    assert not (fake_repo / "out.json").exists()


def test_main_does_not_replace_an_existing_file_without_force(fake_repo: Path) -> None:
    (fake_repo / "out.json").write_text("reviewed")

    assert _run_main(fake_repo) == 1
    assert (fake_repo / "out.json").read_text() == "reviewed"


def test_main_replaces_an_existing_file_with_force(fake_repo: Path) -> None:
    (fake_repo / "out.json").write_text("reviewed")

    assert _run_main(fake_repo, "--force") == 0
    assert _counted_findings(fake_repo / "out.json") == 4


def test_main_stops_before_writing_when_the_counts_dont_add_up(fake_repo: Path) -> None:
    def drop_last_entry(
        findings: list[tuple[str, ApiInputViolation]],
        owner_map: dict[str, dict[str, str]],
        today: str,
    ) -> list[dict[str, object]]:
        return build_entries(findings, owner_map, today)[:-1]

    with mock.patch.object(generate_baseline, "build_entries", drop_last_entry):
        assert _run_main(fake_repo) == 1
    assert not (fake_repo / "out.json").exists()


def test_generator_total_matches_flake_on_the_same_tree(fake_repo: Path) -> None:
    assert _run_main(fake_repo) == 0

    # flake only prints S025-S028 when they're enforced or SENTRY_INPUT_LINT_ALL is set
    result = subprocess.run(
        [
            sys.executable,
            "-m",
            "flake8",
            "--select=S025,S026,S027,S028",
            str(fake_repo / "src"),
        ],
        cwd=REPO_ROOT,
        env={**os.environ, INPUT_LINT_ALL_ENV: "1"},
        capture_output=True,
        text=True,
    )
    flake_findings = result.stdout.splitlines()

    # if flake itself breaks (maybe the plugin fails to import), stdout is empty, so show its error
    assert len(flake_findings) == 4, result.stderr
    assert _counted_findings(fake_repo / "out.json") == len(flake_findings)


OTHER_PATH = "src/sentry/api/endpoints/other.py"

# one finding, in a file that a --files run on PATH shouldn't touch
OTHER_ENDPOINT = """\
class OtherEndpoint(Endpoint):
    publish_status = {"GET": ApiPublishStatus.PUBLIC}

    def get(self, request) -> Response[X]:
        return request.GET.get("q")
"""


def _entries(output: Path) -> list[dict[str, object]]:
    """Reads the entries of a generated file"""
    return json.loads(output.read_text())["entries"]


def _find(entries: list[dict[str, object]], scope: str, key: str) -> dict[str, object] | None:
    """The entry with this scope and key, or None when there isn't one"""
    for entry in entries:
        if entry["scope"] == scope and entry["key"] == key:
            return entry
    return None


def _edit_endpoint(repo: Path, old: str, new: str) -> None:
    """Changes the example endpoint's code, i.e to fix or add a finding before a --files run"""
    endpoint = repo / PATH
    endpoint.write_text(endpoint.read_text().replace(old, new))


def test_files_stops_without_an_existing_file(fake_repo: Path) -> None:
    assert _run_main(fake_repo, "--files", PATH) == 1
    assert not (fake_repo / "out.json").exists()


def test_files_keeps_status_reason_and_first_seen_and_takes_the_new_count(
    fake_repo: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    assert _run_main(fake_repo) == 0

    # mark the get entry as reviewed as if the file had been edited by hand
    output = fake_repo / "out.json"
    entries = _entries(output)
    reviewed = _find(entries, "ExampleEndpoint.get", "query:id")
    assert reviewed is not None
    reviewed["status"] = "accepted"
    reviewed["reason"] = "id selects the object"
    reviewed["first_seen"] = "2026-11-02"
    write_exceptions(entries, output, generated="2026-11-02")

    # one of the two reads of id goes away -> the count drops from 2 to 1
    _edit_endpoint(fake_repo, '        b = request.GET.get("id") # line 6\n', "")
    assert _run_main(fake_repo, "--files", PATH) == 0

    entry = _find(_entries(output), "ExampleEndpoint.get", "query:id")
    assert entry is not None
    assert entry["count"] == 1
    assert entry["status"] == "accepted"
    assert entry["reason"] == "id selects the object"
    assert entry["first_seen"] == "2026-11-02"
    assert "0 new, 0 fixed, 1 with a changed count" in capsys.readouterr().out


def test_files_reports_new_and_fixed_findings(
    fake_repo: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    assert _run_main(fake_repo) == 0

    # reading title instead of name fixes body:name and adds body:title
    _edit_endpoint(fake_repo, 'request.data.get("name")', 'request.data.get("title")')
    assert _run_main(fake_repo, "--files", PATH, "--date", "2026-11-16") == 0

    entries = _entries(fake_repo / "out.json")
    assert _find(entries, "ExampleEndpoint.put", "body:name") is None
    new = _find(entries, "ExampleEndpoint.put", "body:title")
    assert new is not None
    # a new finding gets this run's date and the defaults
    assert new["first_seen"] == "2026-11-16"
    assert new["status"] == "debt-breaking"
    # the entries that didn't change keep the first run's date
    old = _find(entries, "ExampleEndpoint.get", "query:id")
    assert old is not None
    assert old["first_seen"] == TODAY

    out = capsys.readouterr().out
    assert "1 new, 1 fixed, 0 with a changed count" in out
    assert "new    S026 src/sentry/api/endpoints/example.py ExampleEndpoint.put body:title" in out
    assert "fixed  S026 src/sentry/api/endpoints/example.py ExampleEndpoint.put body:name" in out


def test_files_drops_the_entries_of_a_deleted_file(
    fake_repo: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    assert _run_main(fake_repo) == 0

    (fake_repo / PATH).unlink()
    assert _run_main(fake_repo, "--files", PATH) == 0

    assert _entries(fake_repo / "out.json") == []
    assert "0 new, 3 fixed, 0 with a changed count" in capsys.readouterr().out


def test_files_leaves_unlisted_files_alone(fake_repo: Path) -> None:
    (fake_repo / OTHER_PATH).write_text(OTHER_ENDPOINT)
    assert _run_main(fake_repo) == 0
    output = fake_repo / "out.json"
    before = _find(_entries(output), "OtherEndpoint.get", "query:q")
    assert before is not None

    # other.py's finding is fixed on disk but it isn't in `--files` so its entry stays
    (fake_repo / OTHER_PATH).unlink()
    assert _run_main(fake_repo, "--files", PATH) == 0

    assert _find(_entries(output), "OtherEndpoint.get", "query:q") == before
    assert _counted_findings(output) == 5


def test_files_skips_paths_outside_src_and_non_python_files(
    fake_repo: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    assert _run_main(fake_repo) == 0
    output = fake_repo / "out.json"
    before = output.read_text()

    # PATH is deleted so if it were rescanned its entries would go away
    (fake_repo / PATH).unlink()
    assert (
        _run_main(fake_repo, "--files", "README.md", "tests/example.py", "src/sentry/foo.txt") == 0
    )

    assert output.read_text() == before
    assert "Rescanned 0 files" in capsys.readouterr().out


def test_files_normalizes_dot_slash_paths(fake_repo: Path) -> None:
    assert _run_main(fake_repo) == 0

    _edit_endpoint(fake_repo, '        b = request.GET.get("id") # line 6\n', "")
    assert _run_main(fake_repo, "--files", f"./{PATH}") == 0

    entries = _entries(fake_repo / "out.json")
    entry = _find(entries, "ExampleEndpoint.get", "query:id")
    assert entry is not None
    assert entry["count"] == 1
    # the old entry was replaced and not left next to the new one
    assert len(entries) == 3


def test_root_scans_another_checkout(
    fake_repo: Path, tmp_path_factory: pytest.TempPathFactory
) -> None:
    # an older checkout where put doesn't read name yet
    older = tmp_path_factory.mktemp("older")
    endpoint = older / PATH
    endpoint.parent.mkdir(parents=True)
    endpoint.write_text(EXAMPLE_ENDPOINT.replace('request.data.get("name")', "None"))

    assert _run_main(fake_repo, "--root", str(older)) == 0

    entries = _entries(fake_repo / "out.json")
    assert _find(entries, "ExampleEndpoint.put", "body:name") is None
    assert _counted_findings(fake_repo / "out.json") == 3
    # the owner map still comes from this checkout
    entry = _find(entries, "ExampleEndpoint.get", "query:id")
    assert entry is not None
    assert entry["owner"] == "issues-feed"


def test_root_without_a_src_folder_stops(
    fake_repo: Path, tmp_path_factory: pytest.TempPathFactory
) -> None:
    empty = tmp_path_factory.mktemp("empty")

    assert _run_main(fake_repo, "--root", str(empty)) == 1
    assert not (fake_repo / "out.json").exists()


def test_files_listing_the_same_file_twice_counts_it_once(
    fake_repo: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    assert _run_main(fake_repo) == 0
    before = (fake_repo / "out.json").read_text()

    assert _run_main(fake_repo, "--files", PATH, f"./{PATH}") == 0

    assert (fake_repo / "out.json").read_text() == before
    out = capsys.readouterr().out
    assert "Rescanned 1 files (4 findings)" in out
    assert "0 new, 0 fixed, 0 with a changed count" in out


def test_files_updates_the_generated_date(fake_repo: Path) -> None:
    assert _run_main(fake_repo) == 0

    assert _run_main(fake_repo, "--files", PATH, "--date", "2026-11-16") == 0

    assert json.loads((fake_repo / "out.json").read_text())["generated"] == "2026-11-16"
