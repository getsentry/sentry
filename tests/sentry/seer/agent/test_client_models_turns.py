from typing import Any

import pytest

from sentry.seer.agent.client_models import (
    MemoryBlock,
    Message,
    PushLogEntry,
    PushRequest,
    SeerRunState,
    ToolResult,
)


def _block(
    block_id: str, role: str, content: str | None = None, push_key: str | None = None
) -> MemoryBlock:
    calls = (
        [{"kind": "lib", "name": "write_pull_request", "params": {"idempotency_key": push_key}}]
        if push_key
        else []
    )
    return MemoryBlock(
        id=block_id,
        message=Message(role=role, content=content),
        timestamp="2024-01-01T00:00:00Z",
        tool_results=[
            None,
            ToolResult(
                tool_call_id="t", tool_call_function="execute", structuredContent={"calls": calls}
            ),
        ],
    )


def _state(*blocks: MemoryBlock, push_log: list[PushLogEntry] | None = None) -> SeerRunState:
    return SeerRunState(
        run_id=1,
        blocks=list(blocks),
        status="completed",
        updated_at="2024-01-01T00:00:00Z",
        pr_push_log=push_log or [],
    )


def test_turns_split_at_each_user_message() -> None:
    state = _state(
        _block("1", "user", "question"),
        _block("2", "assistant", "first"),
        _block("3", "assistant", "last"),
        _block("4", "user", "follow-up"),
        _block("5", "tool_use"),
    )

    first, second = state.get_turns()

    assert [block.id for block in first.blocks] == ["1", "2", "3"]
    assert first.answer is not None
    assert first.answer.id == "3"
    # Doesn't fall back to the previous turn's answer.
    assert second.answer is None


@pytest.mark.parametrize("push_log_fields", [{}, {"pr_push_log": None}, {"pr_push_log": []}])
def test_turns_and_pr_states_without_push_log(push_log_fields: dict[str, Any]) -> None:
    state = SeerRunState.parse_obj(
        {
            "run_id": 1,
            "blocks": [
                _block("1", "user", "open a PR"),
                _block("2", "assistant", "opened", push_key="codemode:1"),
            ],
            "status": "completed",
            "updated_at": "2024-01-01T00:00:00Z",
            "repo_pr_states": {
                "acme/web": {
                    "repo_name": "acme/web",
                    "pr_number": 42,
                    "pr_creation_status": "completed",
                }
            },
            **push_log_fields,
        }
    )

    assert state.get_push_log_index() == {}
    (turn,) = state.get_turns()
    assert turn.answer is not None
    assert turn.answer.id == "2"
    (call,) = turn.get_code_mode_calls()
    assert call.name == "write_pull_request"
    assert state.get_push_log_index().get(call.params["idempotency_key"]) is None
    assert [pr.pr_number for pr in state.get_created_pull_request_states()] == [42]
    assert "pr_push_log" not in state.dict()


def test_push_log_index_links_each_call_to_its_push() -> None:
    old = PushLogEntry(
        request=PushRequest(repo_name="acme/old", action="create", idempotency_key="codemode:1")
    )
    new = PushLogEntry(
        request=PushRequest(repo_name="acme/web", action="update", idempotency_key="codemode:2")
    )
    unkeyed = PushLogEntry(request=PushRequest(repo_name="acme/api", action="create"))
    state = _state(
        _block("1", "user", "open a PR"),
        _block("2", "assistant", "opened", push_key="codemode:1"),
        _block("3", "user", "update it"),
        _block("4", "assistant", "updated", push_key="codemode:2"),
        push_log=[old, new, unkeyed],
    )

    push_log = state.get_push_log_index()
    first, second = state.get_turns()

    assert push_log == {"codemode:1": old, "codemode:2": new}
    assert [push_log[call.params["idempotency_key"]] for call in first.get_code_mode_calls()] == [
        old
    ]
    assert [push_log[call.params["idempotency_key"]] for call in second.get_code_mode_calls()] == [
        new
    ]


def test_code_mode_calls_keep_only_valid_lib_records() -> None:
    result = ToolResult(
        tool_call_id="t",
        tool_call_function="execute",
        structuredContent={
            "calls": [
                {"id": 1, "kind": "api", "method": "GET", "path": "/issues/", "status": 200},
                {"id": 2, "kind": "note", "llm_description": "picking the newest issue"},
                {"id": 3, "kind": "lib", "name": "write_pull_request", "params": {"repo": "a/b"}},
                {"id": 4, "kind": "lib", "name": "get_issue", "params": None},
                {"id": 5, "kind": "lib", "name": None},
                {"id": 6, "kind": "future_kind", "name": "something"},
                {"id": 7, "name": "no_kind"},
            ]
        },
    )

    assert [(call.name, call.params) for call in result.get_code_mode_calls()] == [
        ("write_pull_request", {"repo": "a/b"}),
        ("get_issue", {}),
    ]


@pytest.mark.parametrize("structured_content", [None, {}, {"calls": None}, {"calls": []}])
def test_code_mode_calls_without_calls(structured_content: dict[str, Any] | None) -> None:
    result = ToolResult(
        tool_call_id="t", tool_call_function="execute", structuredContent=structured_content
    )

    assert result.get_code_mode_calls() == []
