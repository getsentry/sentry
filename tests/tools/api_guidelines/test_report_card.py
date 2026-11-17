from __future__ import annotations

import json  # noqa: S003 - tools tests run without the sentry package
from pathlib import Path

import pytest

from tools.api_guidelines.report_card import (
    format_changes,
    format_table,
    main,
    rule_columns,
    team_findings,
)

FEED = "src/sentry/api/endpoints/feed.py"
INGEST = "src/sentry/api/endpoints/ingest.py"
CORE = "src/sentry/core/endpoints/core.py"


def _entry(
    rule: str,
    path: str,
    scope: str,
    owner: str,
    count: int = 1,
    key: str | None = "query:id",
) -> dict[str, object]:
    """An exceptions.json entry made by hand"""
    return {
        "rule": rule,
        "path": path,
        "scope": scope,
        "key": key,
        "count": count,
        "owner": owner,
        "status": "debt-breaking",
        "reason": f"legacy: predates {rule}",
        "first_seen": "2026-11-02",
    }


# issues-feed has 3 findings in 1 file (one entry counts 2), ingest 1, and CoreEndpoint is unowned
ENTRIES = [
    _entry("S026", FEED, "FeedEndpoint.get", "issues-feed", count=2),
    _entry("S028", FEED, "FeedEndpoint.get", "issues-feed", key=None),
    _entry("S026", INGEST, "IngestEndpoint.get", "ingest"),
    _entry("S026", CORE, "CoreEndpoint.get", "unowned"),
]


def _write(path: Path, entries: list[dict[str, object]], generated: str) -> Path:
    """Writes a small exceptions.json"""
    path.write_text(json.dumps({"version": 1, "generated": generated, "entries": entries}))
    return path


@pytest.fixture
def exceptions(tmp_path: Path) -> Path:
    """An exceptions.json with ENTRIES, generated on 2026-11-16"""
    return _write(tmp_path / "exceptions.json", ENTRIES, "2026-11-16")


def test_columns_are_the_baselined_rules() -> None:
    # S027 has no findings but is still baselined, so it keeps its column
    assert rule_columns() == ["S025", "S026", "S027", "S028"]


def test_table_sums_each_entrys_count_with_unowned_last() -> None:
    lines = format_table(ENTRIES[:3], markdown=True)

    assert lines == [
        "| team | total | S025 | S026 | S027 | S028 | files |",
        "| --- | ---: | ---: | ---: | ---: | ---: | ---: |",
        "| issues-feed | 3 | 0 | 2 | 0 | 1 | 1 |",
        "| ingest | 1 | 0 | 1 | 0 | 0 | 1 |",
        # unowned is always shown, even with 0 findings
        "| unowned | 0 | 0 | 0 | 0 | 0 | 0 |",
        "| total | 4 | 0 | 3 | 0 | 1 | 2 |",
    ]


def test_main_prints_the_header_and_the_table(
    exceptions: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    assert main(["--exceptions", str(exceptions)]) == 0

    out = capsys.readouterr().out
    assert f"API report card: {exceptions}, generated 2026-11-16, 4 entries, 5 findings\n" in out
    assert "Not in exceptions.json (no baseline): S021, S022, S023, S034\n" in out
    assert out.endswith(
        "team         total   S025   S026   S027   S028  files\n"
        "issues-feed      3      0      2      0      1      1\n"
        "ingest           1      0      1      0      0      1\n"
        "unowned          1      0      1      0      0      1\n"
        "total            5      0      4      0      1      3\n"
    )


def test_main_prints_markdown(exceptions: Path, capsys: pytest.CaptureFixture[str]) -> None:
    assert main(["--exceptions", str(exceptions), "--format", "markdown"]) == 0

    out = capsys.readouterr().out
    assert "| team | total | S025 | S026 | S027 | S028 | files |\n" in out
    assert out.endswith("| total | 5 | 0 | 4 | 0 | 1 | 3 |\n")


def test_main_lists_one_teams_entries(exceptions: Path, capsys: pytest.CaptureFixture[str]) -> None:
    assert main(["--exceptions", str(exceptions), "--team", "issues-feed"]) == 0

    assert capsys.readouterr().out.endswith(
        "2 entries owned by issues-feed\n"
        f"S026 {FEED} FeedEndpoint.get query:id (x2)\n"
        # S028 has no key
        f"S028 {FEED} FeedEndpoint.get - (x1)\n"
    )


def test_team_findings_skip_other_teams() -> None:
    assert team_findings(ENTRIES, "ingest") == [f"S026 {INGEST} IngestEndpoint.get query:id (x1)"]


def test_main_stops_on_a_team_that_isnt_in_the_file(
    exceptions: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    # a typo would otherwise print "0 entries", which looks like a clean team
    assert main(["--exceptions", str(exceptions), "--team", "issue-feed"]) == 1

    captured = capsys.readouterr()
    assert captured.out == ""
    assert "Unknown team 'issue-feed'." in captured.err
    assert ": ingest, issues-feed, unowned" in captured.err


def test_main_stops_without_the_file(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    missing = tmp_path / "exceptions.json"

    assert main(["--exceptions", str(missing)]) == 1

    captured = capsys.readouterr()
    assert captured.out == ""
    assert f"{missing} not found. Run `make api-baseline` first." in captured.err


def test_main_stops_without_the_compare_file(
    exceptions: Path, tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    missing = tmp_path / "older.json"

    assert main(["--exceptions", str(exceptions), "--compare", str(missing)]) == 1

    assert f"{missing} not found." in capsys.readouterr().err


# the older file: ingest's entry is fixed since, the feed S026 count was 1, and core's entry is new
OLDER = [
    _entry("S026", FEED, "FeedEndpoint.get", "issues-feed", count=1),
    _entry("S028", FEED, "FeedEndpoint.get", "issues-feed", key=None),
    _entry("S026", INGEST, "IngestEndpoint.get", "ingest"),
    _entry("S027", INGEST, "IngestEndpoint.get", "ingest", key="body:name"),
]
NEWER = [
    _entry("S026", FEED, "FeedEndpoint.get", "issues-feed", count=2),
    _entry("S028", FEED, "FeedEndpoint.get", "issues-feed", key=None),
    _entry("S026", INGEST, "IngestEndpoint.get", "ingest"),
    _entry("S026", CORE, "CoreEndpoint.get", "unowned"),
]


def test_changes_list_new_fixed_and_changed_entries_per_team() -> None:
    assert format_changes(OLDER, NEWER, team=None) == [
        "Changes: 1 new, 1 fixed, 1 changed count",
        "ingest",
        f"  fixed    S027 {INGEST} IngestEndpoint.get body:name (x1)",
        "issues-feed",
        f"  changed  S026 {FEED} FeedEndpoint.get query:id (x1 -> x2)",
        "unowned",
        f"  new      S026 {CORE} CoreEndpoint.get query:id (x1)",
    ]


def test_changes_only_show_one_team_under_team() -> None:
    assert format_changes(OLDER, NEWER, team="ingest") == [
        "Changes: 0 new, 1 fixed, 0 changed count",
        "ingest",
        f"  fixed    S027 {INGEST} IngestEndpoint.get body:name (x1)",
    ]


def test_main_compare_adds_since_to_the_header_and_prints_the_changes(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    newer = _write(tmp_path / "exceptions.json", NEWER, "2026-11-16")
    older = _write(tmp_path / "older.json", OLDER, "2026-11-02")

    assert main(["--exceptions", str(newer), "--compare", str(older)]) == 0

    out = capsys.readouterr().out
    assert ", 4 entries, 5 findings, since 2026-11-02\n" in out
    assert out.endswith(
        "\nChanges: 1 new, 1 fixed, 1 changed count\n"
        "ingest\n"
        f"  fixed    S027 {INGEST} IngestEndpoint.get body:name (x1)\n"
        "issues-feed\n"
        f"  changed  S026 {FEED} FeedEndpoint.get query:id (x1 -> x2)\n"
        "unowned\n"
        f"  new      S026 {CORE} CoreEndpoint.get query:id (x1)\n"
    )


def test_main_compare_handles_files_without_a_generated_date(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    # files written before the generated date was added have only version and entries
    newer = tmp_path / "exceptions.json"
    newer.write_text(json.dumps({"version": 1, "entries": NEWER}))
    older = tmp_path / "older.json"
    older.write_text(json.dumps({"version": 1, "entries": OLDER}))

    assert main(["--exceptions", str(newer), "--compare", str(older)]) == 0

    out = capsys.readouterr().out
    assert ", generated unknown, 4 entries, 5 findings, since unknown\n" in out


def test_main_compare_knows_teams_that_were_fully_fixed(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    # ingest has no entries in the newer file, but it did in the older one
    newer = _write(tmp_path / "exceptions.json", NEWER[:2], "2026-11-16")
    older = _write(tmp_path / "older.json", OLDER, "2026-11-02")

    assert main(["--exceptions", str(newer), "--team", "ingest", "--compare", str(older)]) == 0

    out = capsys.readouterr().out
    assert "0 entries owned by ingest\n" in out
    assert out.endswith(
        "Changes: 0 new, 2 fixed, 0 changed count\n"
        "ingest\n"
        f"  fixed    S026 {INGEST} IngestEndpoint.get query:id (x1)\n"
        f"  fixed    S027 {INGEST} IngestEndpoint.get body:name (x1)\n"
    )
