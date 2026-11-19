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
    assert "issues-feed" in out
    assert out.splitlines()[-1].split() == ["total", "5", "0", "4", "0", "1", "3"]


def test_main_lists_one_teams_entries(exceptions: Path, capsys: pytest.CaptureFixture[str]) -> None:
    assert main(["--exceptions", str(exceptions), "--team", "issues-feed"]) == 0

    out = capsys.readouterr().out
    assert "2 entries owned by issues-feed" in out
    assert out.count(FEED) == 2


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
    assert "not found" in captured.err


def test_main_stops_without_the_compare_file(
    exceptions: Path, tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    missing = tmp_path / "older.json"

    assert main(["--exceptions", str(exceptions), "--compare", str(missing)]) == 1

    assert f"{missing} not found" in capsys.readouterr().err


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


def test_changes_only_show_one_team_under_team() -> None:
    assert format_changes(OLDER, NEWER, team="ingest") == [
        "Changes: 0 new, 1 fixed, 0 changed count",
        "ingest",
        f"  fixed    S027 {INGEST} IngestEndpoint.get body:name (x1)",
    ]


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
