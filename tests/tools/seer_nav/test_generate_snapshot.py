# make test-tools runs without the sentry package, so sentry.utils.json can't be imported here.
import json  # noqa: S003
from pathlib import Path
from unittest import mock

import pytest

from tools.seer_nav import generate_snapshot
from tools.seer_nav.entries import NavEntry
from tools.seer_nav.generate_snapshot import refresh_snapshot

LOGS = NavEntry(crumbs="Explore → Logs", path="/explore/logs/")
TRACES = NavEntry(crumbs="Explore → Traces", path="/explore/traces/")


def test_unchanged_entries_leave_the_file_untouched(tmp_path: Path) -> None:
    path = tmp_path / "snapshot.json"
    assert refresh_snapshot([LOGS], path) == [
        '+ {"crumbs": "Explore → Logs", "path": "/explore/logs/"}'
    ]
    written = path.read_text()

    assert refresh_snapshot([LOGS], path) == []
    assert path.read_text() == written


def test_changed_entries_rewrite_the_snapshot(tmp_path: Path) -> None:
    path = tmp_path / "snapshot.json"
    refresh_snapshot([LOGS], path)

    assert refresh_snapshot([TRACES], path) == [
        '+ {"crumbs": "Explore → Traces", "path": "/explore/traces/"}',
        '- {"crumbs": "Explore → Logs", "path": "/explore/logs/"}',
    ]
    assert json.loads(path.read_text()) == {
        "version": 1,
        "entries": [{"crumbs": "Explore → Traces", "path": "/explore/traces/"}],
    }


def test_check_reports_a_stale_snapshot_with_the_update_command(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    path = tmp_path / "snapshot.json"
    refresh_snapshot([LOGS], path)

    with (
        mock.patch.object(generate_snapshot, "SNAPSHOT_PATH", path),
        mock.patch.object(generate_snapshot, "parse_checkout", return_value=[LOGS, TRACES]),
    ):
        assert generate_snapshot.main(["--check"]) == 1
    out = capsys.readouterr().out
    assert '+ {"crumbs": "Explore → Traces", "path": "/explore/traces/"}' in out
    assert "python -m tools.seer_nav.generate_snapshot" in out
    assert json.loads(path.read_text())["entries"] == [LOGS.to_dict()]

    with (
        mock.patch.object(generate_snapshot, "SNAPSHOT_PATH", path),
        mock.patch.object(generate_snapshot, "parse_checkout", return_value=[LOGS]),
    ):
        assert generate_snapshot.main(["--check"]) == 0


def test_entry_defaults_are_left_out_of_the_snapshot() -> None:
    page = NavEntry(crumbs="Explore → Logs → New", path="/explore/logs/new/", sub_page=True)
    assert page.to_dict() == {
        "crumbs": "Explore → Logs → New",
        "path": "/explore/logs/new/",
        "sub_page": True,
    }
    assert LOGS.to_dict() == {"crumbs": "Explore → Logs", "path": "/explore/logs/"}
