from __future__ import annotations

import json  # noqa: S003 - tools tests run without the sentry package
from collections.abc import Generator
from pathlib import Path
from unittest import mock

import pytest

from tools.api_guidelines import report_card
from tools.api_guidelines.report_card import (
    find_owners,
    format_table,
    main,
    rule_columns,
    team_findings,
)
from tools.api_guidelines.rules import ApiRule
from tools.flake8_plugin import ApiInputViolation

FEED = "src/sentry/api/endpoints/feed.py"
INGEST = "src/sentry/api/endpoints/ingest.py"
CORE = "src/sentry/core/endpoints/core.py"
OWNER_MAP = {
    FEED: {"FeedEndpoint": "issues-feed"},
    INGEST: {"IngestEndpoint": "ingest"},
}

# issues-feed gets 3 findings in 1 file, ingest 1, and CoreEndpoint isn't in the owner map
FEED_ENDPOINT = """\
class FeedEndpoint(Endpoint):
    publish_status = {"GET": ApiPublishStatus.PUBLIC}

    def get(self, request) -> Response[X]:
        a = request.GET.get("id")
        b = request.GET.get("cursor")
        return Response(request.data.get("name"))
"""
INGEST_ENDPOINT = """\
class IngestEndpoint(Endpoint):
    publish_status = {"GET": ApiPublishStatus.PUBLIC}

    def get(self, request) -> Response[X]:
        return Response(request.GET.get("id"))
"""
CORE_ENDPOINT = """\
class CoreEndpoint(Endpoint):
    publish_status = {"GET": ApiPublishStatus.PUBLIC}

    def get(self, request) -> Response[X]:
        return Response(request.GET.get("id"))
"""


@pytest.fixture
def fake_repo(tmp_path: Path) -> Generator[Path]:
    """A repo with three endpoint files and an owner map, used as the report card's repo root"""
    for path, source in ((FEED, FEED_ENDPOINT), (INGEST, INGEST_ENDPOINT), (CORE, CORE_ENDPOINT)):
        endpoint = tmp_path / path
        endpoint.parent.mkdir(parents=True, exist_ok=True)
        endpoint.write_text(source)

    owner_map = tmp_path / ".artifacts" / "api-endpoint-owners.json"
    owner_map.parent.mkdir()
    owner_map.write_text(json.dumps(OWNER_MAP))

    with mock.patch.object(report_card, "_REPO_ROOT", tmp_path):
        yield tmp_path


def _finding(
    rule: str, path: str = FEED, line: int = 1, scope: str = "FeedEndpoint.get"
) -> tuple[str, ApiInputViolation]:
    """A (path, finding) pair made by hand, without scanning any code"""
    violation = ApiInputViolation(
        rule=ApiRule(rule),
        message="m",
        line=line,
        column=0,
        end_line=line,
        end_column=1,
        severity="warning",
        scope=scope,
        key="query:id",
        caller=None,
    )
    return (path, violation)


def test_columns_are_the_rules_that_report_structured_output() -> None:
    # S027 has no findings but is still checked, so it keeps its column
    assert rule_columns() == ["S025", "S026", "S027", "S028"]


def test_table_counts_each_team_with_unowned_last() -> None:
    findings = [
        _finding("S026"),
        _finding("S026"),
        _finding("S026", INGEST, scope="IngestEndpoint.get"),
    ]

    lines = format_table(find_owners(findings, OWNER_MAP), markdown=True)

    assert lines == [
        "| team | total | S025 | S026 | S027 | S028 | files |",
        "| --- | ---: | ---: | ---: | ---: | ---: | ---: |",
        "| issues-feed | 2 | 0 | 2 | 0 | 0 | 1 |",
        "| ingest | 1 | 0 | 1 | 0 | 0 | 1 |",
        # unowned is always shown, even with 0 findings
        "| unowned | 0 | 0 | 0 | 0 | 0 | 0 |",
        "| total | 3 | 0 | 3 | 0 | 0 | 2 |",
    ]


def test_main_prints_the_owner_map_date_and_the_table(
    fake_repo: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    assert main([]) == 0

    out = capsys.readouterr().out
    assert "API report card: 5 findings" in out
    assert "owner map generated " in out
    assert ", 1 findings unowned" in out
    assert "Not reporting structured output yet: S021, S022, S023, S034" in out
    assert out.endswith(
        "team         total   S025   S026   S027   S028  files\n"
        "issues-feed      3      0      3      0      0      1\n"
        "ingest           1      0      1      0      0      1\n"
        "unowned          1      0      1      0      0      1\n"
        "total            5      0      5      0      0      3\n"
    )


def test_main_prints_markdown(fake_repo: Path, capsys: pytest.CaptureFixture[str]) -> None:
    assert main(["--format", "markdown"]) == 0

    out = capsys.readouterr().out
    assert "| team | total | S025 | S026 | S027 | S028 | files |\n" in out
    assert out.endswith("| total | 5 | 0 | 5 | 0 | 0 | 3 |\n")


def test_main_lists_one_teams_findings(fake_repo: Path, capsys: pytest.CaptureFixture[str]) -> None:
    assert main(["--team", "ingest"]) == 0

    assert capsys.readouterr().out == (
        f"1 findings owned by ingest\n{INGEST}:5  S026  query:id  in IngestEndpoint.get\n"
    )


def test_main_stops_on_a_team_that_isnt_in_the_owner_map(
    fake_repo: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    # a typo would otherwise print "0 findings", which looks like a clean team
    assert main(["--team", "issue-feed"]) == 1

    captured = capsys.readouterr()
    assert captured.out == ""
    assert "Unknown team 'issue-feed'. Teams in the owner map: ingest, issues-feed, unowned" in (
        captured.err
    )


def test_team_findings_are_sorted_by_file_and_line() -> None:
    owned = find_owners(
        [_finding("S026", INGEST), _finding("S028", FEED, line=9), _finding("S026", FEED)],
        {FEED: {"FeedEndpoint": "issues-feed"}, INGEST: {"FeedEndpoint": "issues-feed"}},
    )

    assert team_findings(owned, "issues-feed") == [
        f"{FEED}:1  S026  query:id  in FeedEndpoint.get",
        f"{FEED}:9  S028  query:id  in FeedEndpoint.get",
        f"{INGEST}:1  S026  query:id  in FeedEndpoint.get",
    ]


def test_main_stops_without_the_owner_map(fake_repo: Path) -> None:
    (fake_repo / ".artifacts" / "api-endpoint-owners.json").unlink()

    assert main([]) == 1
