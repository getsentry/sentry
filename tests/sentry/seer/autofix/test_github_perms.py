from __future__ import annotations

from collections.abc import Sequence
from unittest.mock import patch

from sentry.integrations.services.integration import integration_service
from sentry.seer.agent.client_models import (
    MemoryBlock,
    Message,
    RepoPRState,
    SeerRunState,
    ToolCall,
    ToolLink,
    ToolResult,
)
from sentry.seer.autofix.github_perms import (
    MissingGithubPermissions,
    blocks_have_failed_tool_call,
    comment_on_out_of_date_github_permissions,
    repos_with_failed_tool_calls,
)
from sentry.testutils.cases import TestCase
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


class CommentOnOutOfDateGithubPermissionsTest(TestCase):
    def _missing_permissions(
        self, account_type: str, account_login: str
    ) -> MissingGithubPermissions:
        integration = self.create_integration(
            organization=self.organization,
            provider="github",
            external_id="123456",
            name=account_login,
            metadata={"account_type": account_type},
        )
        rpc_integration = integration_service.get_integration(integration_id=integration.id)
        assert rpc_integration is not None
        return MissingGithubPermissions(
            integration=rpc_integration, repo_id=1, missing_scopes=["workflows"]
        )

    def _run_state(self) -> SeerRunState:
        return SeerRunState(
            run_id=1,
            blocks=[],
            status="completed",
            updated_at="2023-07-18T12:00:00Z",
            repo_pr_states={
                "getsentry/sentry": RepoPRState(repo_name="getsentry/sentry", pr_number=92)
            },
        )

    def _post_comment(self, account_type: str, account_login: str) -> str:
        info = self._missing_permissions(account_type, account_login)
        with patch(
            "sentry.integrations.github.client.GitHubApiClient.create_comment"
        ) as create_comment:
            commented = comment_on_out_of_date_github_permissions(
                self.organization, self._run_state(), {"getsentry/sentry": info}
            )
        assert commented == ["getsentry/sentry"]
        return create_comment.call_args.args[2]["body"]

    def test_user_installation_links_personal_namespace(self) -> None:
        body = self._post_comment("User", "example-user")
        assert "https://github.com/settings/installations/123456/permissions/update" in body

    def test_org_installation_links_org_namespace(self) -> None:
        body = self._post_comment("Organization", "getsentry")
        assert (
            "https://github.com/organizations/getsentry"
            "/settings/installations/123456/permissions/update" in body
        )

    def test_org_installation_without_account_login_logs_and_skips(self) -> None:
        info = self._missing_permissions("Organization", "")
        with (
            patch(
                "sentry.integrations.github.client.GitHubApiClient.create_comment"
            ) as create_comment,
            patch("sentry.seer.autofix.github_perms.logger") as mock_logger,
        ):
            commented = comment_on_out_of_date_github_permissions(
                self.organization, self._run_state(), {"getsentry/sentry": info}
            )

        assert commented == []
        create_comment.assert_not_called()
        assert (
            mock_logger.error.call_args.args[0] == "autofix.permissions_comment.no_installation_url"
        )
        assert set(mock_logger.error.call_args.kwargs["extra"]) == {
            "run_id",
            "organization_id",
            "repo_id",
            "integration_id",
            "account_type",
        }
