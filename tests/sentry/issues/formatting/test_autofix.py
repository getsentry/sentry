from typing import Any

from sentry.issues.formatting.autofix import autofix_results, format_autofix
from sentry.seer.agent.client_models import SeerRunState


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


def test_markdown_caps_a_single_huge_diff() -> None:
    data = _autofix_response(
        blocks=[
            {
                "merged_file_patches": [
                    {
                        "repo_name": "r",
                        "patch": {"path": "a.py", "type": "M", "added": 1, "removed": 0},
                        "diff": "+" * 50_000,
                    }
                ]
            }
        ]
    )
    assert len(format_autofix(data)) < 25_000


def test_results_list_each_section_with_a_title_and_markdown() -> None:
    state = SeerRunState.parse_obj(_single_run_response()["autofix"])

    results = autofix_results(state)

    assert [r["type"] for r in results] == ["root_cause", "code_changes", "pull_requests"]
    assert results[0]["title"] == "Root Cause"
    assert results[0]["markdown"] == "Regex rejects ids\nThe regex is too strict."
