from typing import Any

from sentry.issues.formatting.autofix import format_autofix


def _autofix_response(**overrides: Any) -> dict[str, Any]:
    autofix: dict[str, Any] = {
        "run_id": 1,
        "status": "COMPLETED",
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
            "getsentry/sentry": {"pr_url": "https://github.com/getsentry/sentry/pull/1"}
        },
    }
    autofix.update(overrides)
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
