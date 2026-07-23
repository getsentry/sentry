"""ToolResult.structuredContent pass-through (openspec: code-mode-effects-registry).

seer carries frontend-only effects (e.g. `navigation`, RENDERED) on a tool result's
`structuredContent`. The sentry client model must parse it from seer and serialize it back out to
the frontend; it is additive/optional so old seer responses (no field) still parse.
"""

from __future__ import annotations

from sentry.seer.agent.client_models import ToolResult


def test_structured_content_is_parsed_from_seer():
    result = ToolResult(
        tool_call_id="t1",
        tool_call_function="sentry_api_execute",
        content="ran",
        structuredContent={
            "navigation": [{"kind": "get_issue_details", "params": {"issue_id": "123"}}]
        },
    )
    assert result.structuredContent == {
        "navigation": [{"kind": "get_issue_details", "params": {"issue_id": "123"}}]
    }


def test_structured_content_defaults_to_none_for_old_seer():
    result = ToolResult(tool_call_id="t1", tool_call_function="todo_write", content="{}")
    assert result.structuredContent is None


def test_structured_content_round_trips_to_the_frontend_dict():
    payload = {"navigation": [{"kind": "get_trace_waterfall", "params": {"trace_id": "abc"}}]}
    result = ToolResult(
        tool_call_id="t1",
        tool_call_function="sentry_api_execute",
        content="ran",
        structuredContent=payload,
    )
    # The chat endpoint serializes the run state via .dict(); the field must survive with its
    # camelCase name so the frontend can read tool_result.structuredContent.
    assert result.dict()["structuredContent"] == payload
