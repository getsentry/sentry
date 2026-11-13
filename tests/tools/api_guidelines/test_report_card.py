from __future__ import annotations

import json  # noqa: S003 - tools tests run without the sentry package
from collections.abc import Generator
from pathlib import Path
from unittest import mock

import pytest

from tools.api_guidelines import report_card
from tools.api_guidelines.report_card import format_table, main, rule_columns, team_findings
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


def _finding(rule: str, path: str = FEED, line: int = 1) -> tuple[str, ApiInputViolation]:
    """A (path, finding) pair made by hand, without scanning any code"""
    violation = ApiInputViolation(
        rule=ApiRule(rule),
        message="m",
        line=line,
        column=0,
        end_line=line,
        end_column=1,
        severity="warning",
        scope="FeedEndpoint.get",
        key="query:id",
        caller=None,
    )
    return (path, violation)


def test_columns_always_have_the_baselined_rules_in_rule_order() -> None:
    # S027 has no findings but is still checked, so it keeps its column
    assert rule_columns([_finding("S026")]) == ["S025", "S026", "S027", "S028"]


def test_a_rule_with_findings_gets_a_column_on_its_own() -> None:
    # i.e S034 once it reports structured output: no report card change needed
    assert rule_columns([_finding("S034"), _finding("S026")]) == [
        "S025",
        "S026",
        "S027",
        "S028",
        "S034",
    ]


def test_table_counts_each_team_with_unowned_last() -> None:
    findings = [_finding("S026"), _finding("S026"), _finding("S026", INGEST)]
    # the hand-made findings are all scoped to FeedEndpoint, so map it in both files
    owner_map = {FEED: {"FeedEndpoint": "issues-feed"}, INGEST: {"FeedEndpoint": "ingest"}}

    lines = format_table(findings, owner_map, markdown=True)

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
    assert "No structured findings: S021, S022, S023, S034" in out
    assert out.endswith(
        "team         total   S025   S026   S027   S028  files\n"
        "issues-feed      3      0      3      0      0      1\n"
        "ingest           1      0      1      0      0      1\n"
        "unowned          1      0      1      0      0      1\n"
        "total            5      0      5      0      0      3\n"
    )


def test_main_lists_one_teams_findings(fake_repo: Path, capsys: pytest.CaptureFixture[str]) -> None:
    assert main(["--team", "ingest"]) == 0

    assert capsys.readouterr().out == (
        f"1 findings owned by ingest\n{INGEST}:5  S026  query:id  in IngestEndpoint.get\n"
    )


def test_team_findings_are_sorted_by_file_and_line() -> None:
    _path, first = _finding("S026", INGEST)
    _path, second = _finding("S028", FEED, line=9)
    _path, third = _finding("S026", FEED)

    lines = team_findings(
        [(INGEST, first), (FEED, second), (FEED, third)],
        {FEED: {"FeedEndpoint": "issues-feed"}, INGEST: {"FeedEndpoint": "issues-feed"}},
        "issues-feed",
    )

    assert lines == [
        f"{FEED}:1  S026  query:id  in FeedEndpoint.get",
        f"{FEED}:9  S028  query:id  in FeedEndpoint.get",
        f"{INGEST}:1  S026  query:id  in FeedEndpoint.get",
    ]


def test_main_stops_without_the_owner_map(fake_repo: Path) -> None:
    (fake_repo / ".artifacts" / "api-endpoint-owners.json").unlink()

    assert main([]) == 1
