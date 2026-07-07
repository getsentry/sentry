from __future__ import annotations

from collections.abc import Sequence

from sentry.seer.agent.client_models import (
    MemoryBlock,
    Message,
    ToolCall,
    ToolLink,
    ToolResult,
)
from sentry.seer.autofix.github_perms import (
    blocks_have_failed_tool_call,
    repos_with_failed_tool_calls,
)
from sentry.utils import json


def _block(
    *,
    calls: Sequence[tuple[str, str | None, bool]] = (),
) -> MemoryBlock:
    """Build a block from (function, repo_name, is_error) tuples. tool_links and
    tool_results are kept index-aligned with the tool calls, mirroring seer."""
    tool_calls: list[ToolCall] = []
    tool_links: list[ToolLink | None] = []
    tool_results: list[ToolResult | None] = []
    for i, (fn, repo, is_error) in enumerate(calls):
        call_id = f"call-{i}"
        args = json.dumps({"repo_name": repo} if repo is not None else {})
        tool_calls.append(ToolCall(id=call_id, function=fn, args=args))
        tool_links.append(ToolLink(kind=fn, params={"is_error": True}) if is_error else None)
        tool_results.append(ToolResult(tool_call_id=call_id, tool_call_function=fn, content="x"))
    return MemoryBlock(
        id="b",
        message=Message(role="assistant", content="", tool_calls=tool_calls or None),
        timestamp="2023-07-18T12:00:00Z",
        tool_links=tool_links or None,
        tool_results=tool_results or None,
    )


def test_no_blocks() -> None:
    assert repos_with_failed_tool_calls([]) == set()
    assert blocks_have_failed_tool_call([]) is False


def test_ignores_successful_tool_calls() -> None:
    block = _block(calls=[("code_file_edit", "org/repo", False)])
    assert repos_with_failed_tool_calls([block]) == set()
    assert blocks_have_failed_tool_call([block]) is False


def test_returns_repo_of_failed_tool_call() -> None:
    block = _block(calls=[("summarize_failed_ci_logs", "org/repo", True)])
    assert repos_with_failed_tool_calls([block]) == {"org/repo"}
    assert blocks_have_failed_tool_call([block]) is True


def test_failed_tool_call_without_repo_is_not_attributed() -> None:
    block = _block(calls=[("get_issue_details", None, True)])
    assert repos_with_failed_tool_calls([block]) == set()
    # It still counts as a failed tool call, just not against a repo.
    assert blocks_have_failed_tool_call([block]) is True


def test_only_failed_call_repo_is_returned() -> None:
    # A success against repo-a and a failure against repo-b in the same block.
    block = _block(
        calls=[
            ("code_file_edit", "org/repo-a", False),
            ("summarize_failed_ci_logs", "org/repo-b", True),
        ]
    )
    assert repos_with_failed_tool_calls([block]) == {"org/repo-b"}


def test_aggregates_across_blocks() -> None:
    blocks = [
        _block(calls=[("t", "org/repo-a", True)]),
        _block(calls=[("t", "org/repo-b", True)]),
    ]
    assert repos_with_failed_tool_calls(blocks) == {"org/repo-a", "org/repo-b"}
