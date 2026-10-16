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
        [{"name": "write_pull_request", "params": {"idempotency_key": push_key}}]
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
