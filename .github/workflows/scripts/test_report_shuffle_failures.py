"""Tests for report_shuffle_failures.py"""

from __future__ import annotations

import importlib.util
import json
import os
import sys
from pathlib import Path
from unittest.mock import patch

import pytest

_script_path = Path(__file__).parent / "report_shuffle_failures.py"
_spec = importlib.util.spec_from_file_location("report_shuffle_failures", _script_path)
_mod = importlib.util.module_from_spec(_spec)
sys.modules["report_shuffle_failures"] = _mod
_spec.loader.exec_module(_mod)

from report_shuffle_failures import (
    build_summary,
    deduplicate,
    load_failures,
    main,
    truncate_traceback,
)

FLAKY = {
    "type": "flaky",
    "testid": "tests/sentry/api/test_foo.py::Foo::test_bar",
    "longrepr": "AssertionError: assert 0 == 1",
    "sha": "abc1234",
    "run_url": "https://github.com/getsentry/sentry/actions/runs/1",
}

POLLUTION = {
    "type": "pollution",
    "testid": "tests/sentry/api/test_baz.py::Baz::test_polluted",
    "polluting_testid": "tests/sentry/other/test_polluter.py::P::test_p",
    "pollution_body": "detected test pollution: `pytest tests/... tests/...`",
    "sha": "abc1234",
    "run_url": "https://github.com/getsentry/sentry/actions/runs/1",
}


def write_failure(tmp_path: Path, subdir: str, data: dict) -> None:
    d = tmp_path / subdir
    d.mkdir(parents=True, exist_ok=True)
    (d / "failure.json").write_text(json.dumps(data))


class TestLoadFailures:
    def test_loads_valid_flaky(self, tmp_path):
        write_failure(tmp_path, "failure-0", FLAKY)
        result = load_failures(tmp_path)
        assert len(result) == 1
        assert result[0]["testid"] == FLAKY["testid"]

    def test_loads_multiple_shards(self, tmp_path):
        write_failure(tmp_path, "failure-0", FLAKY)
        write_failure(tmp_path, "failure-3", POLLUTION)
        assert len(load_failures(tmp_path)) == 2

    def test_skips_invalid_json(self, tmp_path):
        d = tmp_path / "failure-0"
        d.mkdir()
        (d / "failure.json").write_text("NOT JSON")
        assert load_failures(tmp_path) == []

    def test_skips_missing_required_fields(self, tmp_path):
        write_failure(tmp_path, "failure-0", {"type": "flaky"})  # no testid
        assert load_failures(tmp_path) == []

    def test_nonexistent_dir_returns_empty(self, tmp_path):
        assert load_failures(tmp_path / "nonexistent") == []

    def test_empty_dir_returns_empty(self, tmp_path):
        assert load_failures(tmp_path) == []


class TestDeduplicate:
    def test_removes_duplicate_testid(self):
        dup = {**FLAKY, "run_url": "https://example.com/other-run"}
        result = deduplicate([FLAKY, dup])
        assert len(result) == 1
        assert result[0]["run_url"] == FLAKY["run_url"]

    def test_keeps_different_testids(self):
        assert len(deduplicate([FLAKY, POLLUTION])) == 2

    def test_empty_input(self):
        assert deduplicate([]) == []


class TestTruncateTraceback:
    def test_short_traceback_unchanged(self):
        text = "line 1\nline 2"
        assert truncate_traceback(text, max_lines=10) == text

    def test_long_traceback_truncated(self):
        text = "\n".join(f"line {i}" for i in range(100))
        result = truncate_traceback(text, max_lines=50)
        assert "line 49" in result
        assert "line 50" not in result
        assert "(50 more lines)" in result

    def test_exact_limit_not_truncated(self):
        text = "\n".join(f"line {i}" for i in range(50))
        assert truncate_traceback(text, max_lines=50) == text


class TestBuildSummary:
    def test_flaky_section_present(self):
        summary = build_summary([FLAKY], run_url="https://example.com/run")
        assert "## Shuffle Test Failures" in summary
        assert "1 flaky test(s)" in summary
        assert FLAKY["testid"] in summary
        assert FLAKY["longrepr"] in summary

    def test_no_pollution_label_for_flaky_only(self):
        summary = build_summary([FLAKY], run_url="https://example.com/run")
        assert "test pollution" not in summary

    def test_pollution_section_present(self):
        summary = build_summary([POLLUTION], run_url="https://example.com/run")
        assert "1 test pollution case(s)" in summary
        assert POLLUTION["testid"] in summary
        assert POLLUTION["polluting_testid"] in summary
        assert POLLUTION["pollution_body"] in summary

    def test_mixed_counts_both_shown(self):
        summary = build_summary([FLAKY, POLLUTION], run_url="https://example.com/run")
        assert "1 flaky test(s)" in summary
        assert "1 test pollution case(s)" in summary

    def test_run_url_included(self):
        summary = build_summary([FLAKY], run_url="https://example.com/my-run")
        assert "https://example.com/my-run" in summary

    def test_empty_failures_still_has_header(self):
        summary = build_summary([], run_url="https://example.com/run")
        assert "## Shuffle Test Failures" in summary
        assert "flaky" not in summary


class TestMain:
    def test_writes_summary_file(self, tmp_path):
        write_failure(tmp_path, "failure-0", FLAKY)
        write_failure(tmp_path, "failure-1", POLLUTION)
        summary_file = tmp_path / "summary.md"

        with patch.dict(
            os.environ,
            {"GITHUB_STEP_SUMMARY": str(summary_file), "RUN_URL": "https://example.com/run"},
        ):
            rc = main([str(tmp_path)])

        assert rc == 0
        summary = summary_file.read_text()
        assert "Shuffle Test Failures" in summary
        assert FLAKY["testid"] in summary
        assert POLLUTION["testid"] in summary

    def test_deduplicates_same_test_across_shards(self, tmp_path):
        write_failure(tmp_path, "failure-0", FLAKY)
        write_failure(tmp_path, "failure-1", FLAKY)  # same test, different shard
        summary_file = tmp_path / "summary.md"

        with patch.dict(
            os.environ,
            {"GITHUB_STEP_SUMMARY": str(summary_file), "RUN_URL": "https://example.com/run"},
        ):
            main([str(tmp_path)])

        summary = summary_file.read_text()
        assert summary.count(FLAKY["testid"]) == 1

    def test_missing_dir_exits_zero(self, tmp_path):
        assert main([str(tmp_path / "nonexistent")]) == 0

    def test_prints_summary_when_no_summary_env(self, tmp_path, capsys):
        write_failure(tmp_path, "failure-0", FLAKY)

        with patch.dict(os.environ, {}, clear=True):
            rc = main([str(tmp_path)])

        assert rc == 0
        assert "Shuffle Test Failures" in capsys.readouterr().out
