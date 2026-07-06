from __future__ import annotations

from collections.abc import Sequence
from unittest.mock import patch

from sentry.integrations.services.integration import RpcIntegration
from sentry.seer.agent.client_models import (
    MemoryBlock,
    Message,
    SeerRunState,
    ToolCall,
    ToolLink,
    ToolResult,
)
from sentry.seer.autofix.autofix_agent import AutofixStep
from sentry.seer.autofix.coding_agent import IntegrationNotFound
from sentry.seer.autofix.github_perms import MissingGithubPermissions
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


def _iteration_block(index: int, *, failed: bool = False, repos: Sequence[str] = ()) -> MemoryBlock:
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
            tool_calls.append(ToolCall(id=call_id, function="tool", args=args))
            tool_links.append(ToolLink(kind="tool", params={"is_error": True}))
            tool_results.append(
                ToolResult(tool_call_id=call_id, tool_call_function="tool", content="Error")
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
    )


def _perms(integration_id: int) -> MissingGithubPermissions:
    return MissingGithubPermissions(
        integration=RpcIntegration(
            id=integration_id,
            provider="github",
            external_id=str(integration_id),
            name="octocat",
            metadata={},
            status=0,
        ),
        missing_scopes=["contents"],
    )


def _state(blocks: list[MemoryBlock]) -> SeerRunState:
    return SeerRunState(
        run_id=1,
        blocks=blocks,
        status="completed",
        updated_at="2023-07-18T12:00:00Z",
    )


@patch("sentry.seer.autofix.on_completion_hook.comment_on_out_of_date_github_permissions")
@patch("sentry.seer.autofix.on_completion_hook.get_out_of_date_github_permissions")
class TestMaybeCommentOnMissingPermissions(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.organization = self.create_organization()

    def _run(self, state: SeerRunState) -> None:
        AutofixOnCompletionHook._maybe_comment_on_missing_permissions(
            self.organization, run_id=1, state=state
        )

    def test_no_iterations(self, mock_get_perms, mock_comment) -> None:
        self._run(_state([]))

        mock_get_perms.assert_not_called()
        mock_comment.assert_not_called()

    def test_latest_iteration_did_not_fail(self, mock_get_perms, mock_comment) -> None:
        self._run(_state([_iteration_block(0, failed=False, repos=["repo-a"])]))

        mock_get_perms.assert_not_called()
        mock_comment.assert_not_called()

    def test_no_missing_permissions(self, mock_get_perms, mock_comment) -> None:
        mock_get_perms.return_value = {}

        self._run(_state([_iteration_block(0, failed=True, repos=["repo-a"])]))

        mock_get_perms.assert_called_once()
        mock_comment.assert_not_called()

    def test_comments_on_missing_permissions(self, mock_get_perms, mock_comment) -> None:
        perms = _perms(42)
        mock_get_perms.return_value = {"repo-a": perms}

        state = _state([_iteration_block(0, failed=True, repos=["repo-a"])])
        self._run(state)

        mock_comment.assert_called_once_with(self.organization, state, {"repo-a": perms})

    def test_skips_repo_with_prior_failing_iteration(self, mock_get_perms, mock_comment) -> None:
        perms = _perms(42)
        mock_get_perms.return_value = {"repo-a": perms}

        # repo-a already failed in an earlier iteration -> excluded from the latest.
        state = _state(
            [
                _iteration_block(0, failed=True, repos=["repo-a"]),
                _iteration_block(1, failed=True, repos=["repo-a"]),
            ]
        )
        self._run(state)

        mock_comment.assert_not_called()

    def test_comments_only_on_newly_failing_repo(self, mock_get_perms, mock_comment) -> None:
        perms_a = _perms(1)
        perms_b = _perms(2)
        mock_get_perms.return_value = {"repo-a": perms_a, "repo-b": perms_b}

        # repo-a failed before; repo-b is failing for the first time now.
        state = _state(
            [
                _iteration_block(0, failed=True, repos=["repo-a"]),
                _iteration_block(1, failed=True, repos=["repo-a", "repo-b"]),
            ]
        )
        self._run(state)

        mock_comment.assert_called_once_with(self.organization, state, {"repo-b": perms_b})
