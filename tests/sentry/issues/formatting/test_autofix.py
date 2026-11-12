from typing import Any

from sentry.issues.formatting.autofix import format_autofix
from sentry.utils import json


def _block(**fields: Any) -> dict[str, Any]:
    artifacts = [{"reason": "", **a} for a in fields.pop("artifacts", [])]
    return {
        "id": "b",
        "message": {"role": "assistant"},
        "timestamp": "t",
        "artifacts": artifacts,
        **fields,
    }


def _autofix_response(**overrides: Any) -> dict[str, Any]:
    autofix: dict[str, Any] = {
        "run_id": 1,
        "status": "completed",
        "updated_at": "2023-07-18T12:00:00Z",
        "blocks": [
            {
                "artifacts": [
                    {
                        "key": "root_cause",
                        "data": {
                            "one_line_description": "The device id is parsed with the wrong regex.",
                            "five_whys": ["parse fails", "regex too strict"],
                            "reproduction_steps": ["call crash()", "observe RuntimeError"],
                        },
                    }
                ]
            },
            {
                "artifacts": [
                    {
                        "key": "solution",
                        "data": {
                            "one_line_summary": "Loosen the device id regex.",
                            "steps": [
                                {"title": "Update regex", "description": "Allow alphanumerics"},
                            ],
                        },
                    }
                ]
            },
        ],
        "repo_pr_states": {
            "getsentry/sentry": {
                "repo_name": "getsentry/sentry",
                "pr_url": "https://github.com/getsentry/sentry/pull/1",
            }
        },
    }
    autofix.update(overrides)
    autofix["blocks"] = [_block(**block) for block in autofix["blocks"]]
    return {"autofix": autofix}


def test_markdown_renders_root_cause_solution_and_prs() -> None:
    out = format_autofix(_autofix_response())
    assert "## Root Cause" in out
    assert "The device id is parsed with the wrong regex." in out
    assert "1. parse fails" in out
    assert "- call crash()" in out
    assert "## Solution" in out
    assert "**Update regex:** Allow alphanumerics" in out
    assert "## Pull Requests" in out
    assert "- getsentry/sentry: https://github.com/getsentry/sentry/pull/1" in out


def test_xml_renders_solution_steps_with_field_tags() -> None:
    out = format_autofix(_autofix_response(), format="xml")
    assert "<root_cause>" in out
    assert "<solution>" in out
    assert "<update_regex>Allow alphanumerics</update_regex>" in out
    assert "**" not in out
    assert "<pull_requests>" in out


def test_no_autofix_run_returns_empty() -> None:
    assert format_autofix({"autofix": None}) == ""
    assert format_autofix({}) == ""


def test_only_present_sections_render() -> None:
    # a run with a root cause but no solution / PRs yet
    data = _autofix_response(
        blocks=[
            {"artifacts": [{"key": "root_cause", "data": {"one_line_description": "boom"}}]},
        ],
        repo_pr_states={},
    )
    out = format_autofix(data)
    assert "## Root Cause" in out
    assert "## Solution" not in out
    assert "## Pull Requests" not in out


def test_latest_artifact_per_key_wins() -> None:
    # two root_cause artifacts across blocks; the later one should win
    data = _autofix_response(
        blocks=[
            {"artifacts": [{"key": "root_cause", "data": {"one_line_description": "old"}}]},
            {"artifacts": [{"key": "root_cause", "data": {"one_line_description": "new"}}]},
        ],
        repo_pr_states={},
    )
    out = format_autofix(data)
    assert "new" in out
    assert "old" not in out


def test_no_autofix_run_still_renders_valid_json() -> None:
    # the common no-run GET: "" is not parseable json, so a caller that json.loads the
    # formatted content would fail on it
    assert format_autofix({}, "json") == "{}"
    assert format_autofix({}, "markdown") == ""


def _single_run_response() -> dict[str, Any]:
    return _autofix_response(
        blocks=[
            {
                "artifacts": [
                    {
                        "key": "single_run_root_cause",
                        "data": {
                            "headline": "Regex rejects ids",
                            "cause": "The regex is too strict.",
                        },
                    }
                ],
                "merged_file_patches": [
                    {
                        "repo_name": "getsentry/sentry",
                        "patch": {"path": "src/old.py", "type": "M", "added": 9, "removed": 9},
                        "diff": "stale diff",
                    }
                ],
            },
            {
                "merged_file_patches": [
                    {
                        "repo_name": "getsentry/sentry",
                        "patch": {"path": "src/old.py", "type": "M", "added": 1, "removed": 1},
                        "diff": "-old\n+new",
                    }
                ],
            },
        ]
    )


def test_markdown_renders_a_single_run_root_cause_and_its_code_changes() -> None:
    out = format_autofix(_single_run_response())
    assert "## Root Cause" in out
    assert "Regex rejects ids" in out
    assert "The regex is too strict." in out
    assert "## Code Changes" in out
    assert "getsentry/sentry: src/old.py (+1 -1)" in out
    assert "-old\n+new" in out
    assert "stale diff" not in out


def _patch(path: str, diff: str, code_url: str | None = None) -> dict[str, Any]:
    return {
        "repo_name": "r",
        "patch": {"path": path, "type": "M", "added": 1, "removed": 0},
        "diff": diff,
        "code_url": code_url,
    }


def test_markdown_links_a_diff_too_large_to_show() -> None:
    data = _autofix_response(
        blocks=[{"merged_file_patches": [_patch("a.py", "+x\n" * 4_000, "https://code/a.py")]}],
        repo_pr_states={},
    )
    out = format_autofix(data)
    assert "r: a.py (+1 -0)" in out
    assert "Diff not shown (4001 lines). See the full change: https://code/a.py" in out
    assert "+x" not in out


def test_markdown_lists_every_file_once_the_diff_budget_runs_out() -> None:
    patches = [_patch(f"f{i}.py", "+" * 7_000) for i in range(4)]
    data = _autofix_response(
        blocks=[{"merged_file_patches": patches}],
        repo_pr_states={"r": {"repo_name": "r", "pr_url": "https://github.com/r/pull/1"}},
    )
    out = format_autofix(data)
    assert all(f"r: f{i}.py (+1 -0)" in out for i in range(4))
    assert out.count("+" * 7_000) == 2
    assert "Diff not shown (1 lines). See the full change: https://github.com/r/pull/1" in out


def test_markdown_renders_a_root_cause_returned_under_root_cause() -> None:
    data = _autofix_response(
        blocks=[
            {
                "artifacts": [
                    {
                        "key": "root_cause",
                        "data": {"headline": "Regex rejects ids", "cause": "Too strict."},
                    }
                ]
            }
        ],
        repo_pr_states={},
    )
    assert "## Root Cause\nRegex rejects ids\nToo strict." in format_autofix(data)


def test_json_keeps_each_file_with_its_own_diff() -> None:
    data = _autofix_response(
        blocks=[{"merged_file_patches": [_patch("a.py", ""), _patch("b.py", "+b")]}],
        repo_pr_states={},
    )
    files = json.loads(format_autofix(data, "json"))["code_changes"]
    assert [file.get("code") for file in files] == [None, ["+b"]]
