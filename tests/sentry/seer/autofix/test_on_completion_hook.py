from __future__ import annotations

from collections.abc import Sequence
from unittest.mock import patch

from sentry.seer.agent.client_models import (
    AgentFilePatch,
    FilePatch,
    MemoryBlock,
    Message,
    RepoPRState,
    SeerRunState,
    ToolCall,
    ToolLink,
    ToolResult,
)
from sentry.seer.autofix.autofix_agent import AutofixStep
from sentry.seer.autofix.coding_agent import IntegrationNotFound
from sentry.seer.autofix.on_completion_hook import AutofixOnCompletionHook
from sentry.seer.autofix.utils import CodingAgentProviderType
from sentry.seer.models.seer_api_models import SeerAutomationHandoffConfiguration
from sentry.testutils.cases import TestCase
from sentry.utils import json


class TestTriggerCodingAgentHandoff(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.organization = self.create_organization()
        self.project = self.create_project(organization=self.organization)
        self.group = self.create_group(project=self.project)

    @patch("sentry.seer.autofix.on_completion_hook.trigger_coding_agent_handoff")
    def test_not_found_clears_automation_handoff(self, mock_trigger) -> None:
        mock_trigger.side_effect = IntegrationNotFound("Integration not found")

        self.project.update_option("sentry:seer_automation_handoff_point", "root_cause")
        self.project.update_option(
            "sentry:seer_automation_handoff_target", CodingAgentProviderType.CURSOR_BACKGROUND_AGENT
        )
        self.project.update_option("sentry:seer_automation_handoff_integration_id", 789)
        self.project.update_option("sentry:seer_automation_handoff_auto_create_pr", True)

        AutofixOnCompletionHook._trigger_coding_agent_handoff(
            organization=self.organization,
            run_id=1,
            group=self.group,
            handoff_config=SeerAutomationHandoffConfiguration(
                handoff_point="root_cause",
                target=CodingAgentProviderType.CURSOR_BACKGROUND_AGENT,
                integration_id=789,
            ),
        )

        assert self.project.get_option("sentry:seer_automation_handoff_point") is None
        assert self.project.get_option("sentry:seer_automation_handoff_target") is None
        assert self.project.get_option("sentry:seer_automation_handoff_integration_id") is None


def _iteration_block(
    index: int,
    *,
    failed: bool = False,
    repos: Sequence[str] = (),
    function: str = "tool",
    commit_sha: str | None = None,
) -> MemoryBlock:
    """An iteration block. When `failed`, holds one errored tool call per repo in
    `repos` (each carrying that repo in its args); with no repos, a single errored
    tool call not attributable to any repo."""
    tool_calls: list[ToolCall] = []
    tool_links: list[ToolLink | None] = []
    tool_results: list[ToolResult | None] = []
    if failed:
        for n, repo in enumerate(list(repos) or [None]):
            call_id = f"call-{index}-{n}"
            args = json.dumps({"repo_name": repo} if repo else {})
            tool_calls.append(ToolCall(id=call_id, function=function, args=args))
            tool_links.append(ToolLink(kind=function, params={"is_error": True}))
            tool_results.append(
                ToolResult(tool_call_id=call_id, tool_call_function=function, content="Error")
            )
    return MemoryBlock(
        id=f"iter-{index}",
        message=Message(
            role="assistant",
            content="",
            tool_calls=tool_calls or None,
            metadata={
                "step": AutofixStep.PR_ITERATION.value,
                "iteration_index": str(index),
            },
        ),
        timestamp="2023-07-18T12:00:00Z",
        tool_links=tool_links or None,
        tool_results=tool_results or None,
        merged_file_patches=[
            AgentFilePatch(
                repo_name="test-repo",
                diff="diff --git a/test.py b/test.py",
                patch=FilePatch(path="test.py", type="M", added=1, removed=0),
            )
        ]
        if commit_sha is not None
        else None,
        pr_commit_shas={"test-repo": commit_sha} if commit_sha is not None else None,
    )


def _state(
    blocks: list[MemoryBlock],
    *,
    repo_pr_states: dict[str, RepoPRState] | None = None,
) -> SeerRunState:
    return SeerRunState(
        run_id=1,
        blocks=blocks,
        status="completed",
        updated_at="2023-07-18T12:00:00Z",
        repo_pr_states=repo_pr_states or {},
    )


@patch("sentry.seer.autofix.on_completion_hook.metrics")
class TestRecordFailedToolCalls(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.organization = self.create_organization()
        self.project = self.create_project(organization=self.organization)
        self.group = self.create_group(project=self.project)

    def _run(self, state: SeerRunState) -> None:
        AutofixOnCompletionHook._record_failed_tool_calls(self.organization, self.group, state)

    def test_no_failed_tools(self, mock_metrics) -> None:
        self._run(_state([_iteration_block(0, failed=False)]))

        mock_metrics.incr.assert_not_called()

    def test_skips_non_pr_iteration(self, mock_metrics) -> None:
        self._run(
            _state(
                [
                    MemoryBlock(
                        id="root",
                        message=Message(
                            role="assistant",
                            content="",
                            tool_calls=[ToolCall(id="c", function="grep", args="{}")],
                            metadata={"step": AutofixStep.ROOT_CAUSE.value},
                        ),
                        timestamp="2023-07-18T12:00:00Z",
                        tool_links=[ToolLink(kind="grep", params={"is_error": True})],
                        tool_results=[
                            ToolResult(tool_call_id="c", tool_call_function="grep", content="Error")
                        ],
                    )
                ]
            )
        )

        mock_metrics.incr.assert_not_called()

    def test_records_latest_iteration_failures(self, mock_metrics) -> None:
        state = _state(
            [
                _iteration_block(0, failed=True, function="old_tool"),
                _iteration_block(1, failed=True, function="summarize_failed_ci_logs"),
            ]
        )
        self._run(state)

        mock_metrics.incr.assert_called_once_with(
            "autofix.pr_iteration.failed_tool_call",
            amount=1,
            tags={"tool": "summarize_failed_ci_logs"},
        )

    def test_counts_duplicate_tool_failures(self, mock_metrics) -> None:
        state = _state(
            [
                _iteration_block(
                    0, failed=True, repos=["repo-a", "repo-b"], function="get_pr_diff"
                ),
            ]
        )
        self._run(state)

        mock_metrics.incr.assert_called_once_with(
            "autofix.pr_iteration.failed_tool_call",
            amount=2,
            tags={"tool": "get_pr_diff"},
        )

    def test_skips_after_changes_are_pushed(self, mock_metrics) -> None:
        """The hook re-fires once the push lands; do not score the same failures again."""
        self._run(
            _state(
                [_iteration_block(0, failed=True, function="get_pr_diff", commit_sha="synced-sha")],
                repo_pr_states={
                    "test-repo": RepoPRState(repo_name="test-repo", commit_sha="synced-sha")
                },
            )
        )

        mock_metrics.incr.assert_not_called()

    def test_records_before_push(self, mock_metrics) -> None:
        self._run(
            _state(
                [
                    _iteration_block(
                        0, failed=True, function="get_pr_diff", commit_sha="iteration-sha"
                    )
                ],
                repo_pr_states={
                    "test-repo": RepoPRState(repo_name="test-repo", commit_sha="synced-sha")
                },
            )
        )

        mock_metrics.incr.assert_called_once_with(
            "autofix.pr_iteration.failed_tool_call",
            amount=1,
            tags={"tool": "get_pr_diff"},
        )
