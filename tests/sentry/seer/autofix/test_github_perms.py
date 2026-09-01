from __future__ import annotations

from collections.abc import Sequence

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
    failed_tool_calls,
    get_blocked_pr_iteration_permissions,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.options import override_options
from sentry.utils import json

REPO_NAME = "getsentry/sentry"


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


def _state(*, pr_number: int | None) -> SeerRunState:
    return SeerRunState(
        run_id=1,
        blocks=[],
        status="completed",
        updated_at="2023-07-18T12:00:00Z",
        repo_pr_states={REPO_NAME: RepoPRState(repo_name=REPO_NAME, pr_number=pr_number)},
    )


def test_failed_tool_calls_returns_errored_calls() -> None:
    block = _block(
        calls=[
            ("code_file_edit", "org/repo-a", False),
            ("summarize_failed_ci_logs", "org/repo-b", True),
        ]
    )
    calls = failed_tool_calls([block])
    assert [call.function for call in calls] == ["summarize_failed_ci_logs"]


def test_failed_tool_calls_aggregates_across_blocks() -> None:
    blocks = [
        _block(calls=[("t", "org/repo-a", True)]),
        _block(calls=[("u", "org/repo-b", True)]),
    ]
    assert [call.function for call in failed_tool_calls(blocks)] == ["t", "u"]


class GetBlockedPrIterationPermissionsTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.integration = self.create_integration(
            organization=self.organization,
            provider="github",
            external_id="9999",
            metadata={"permissions": {"contents": "read"}},
        )
        self.create_repo(
            project=self.create_project(organization=self.organization),
            name=REPO_NAME,
            provider="integrations:github",
            integration_id=self.integration.id,
        )

    @override_options({"github-app.required-permissions": {"contents": "write"}})
    def test_warns_when_a_pr_exists_and_feedback_is_queued(self) -> None:
        missing = get_blocked_pr_iteration_permissions(
            self.organization, _state(pr_number=7), has_actionable_feedback=True
        )

        assert set(missing) == {REPO_NAME}
        assert missing[REPO_NAME].missing_scopes == ["contents"]
        assert missing[REPO_NAME].installation_id == "9999"

    @override_options({"github-app.required-permissions": {"contents": "write"}})
    def test_silent_without_actionable_feedback(self) -> None:
        assert (
            get_blocked_pr_iteration_permissions(
                self.organization, _state(pr_number=7), has_actionable_feedback=False
            )
            == {}
        )

    @override_options({"github-app.required-permissions": {"contents": "write"}})
    def test_silent_before_the_pr_is_created(self) -> None:
        assert (
            get_blocked_pr_iteration_permissions(
                self.organization, _state(pr_number=None), has_actionable_feedback=True
            )
            == {}
        )

    @override_options({"github-app.required-permissions": {"contents": "read"}})
    def test_silent_when_the_install_is_healthy(self) -> None:
        assert (
            get_blocked_pr_iteration_permissions(
                self.organization, _state(pr_number=7), has_actionable_feedback=True
            )
            == {}
        )


class InstallationUrlTest(TestCase):
    def _info(self, account_type: str, account_login: str) -> MissingGithubPermissions:
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
            integration=rpc_integration, missing_scopes=["workflows"], repository_id=1
        )

    def test_user_installation_links_personal_namespace(self) -> None:
        assert (
            self._info("User", "example-user").installation_url
            == "https://github.com/settings/installations/123456/permissions/update"
        )

    def test_org_installation_links_org_namespace(self) -> None:
        assert self._info("Organization", "getsentry").installation_url == (
            "https://github.com/organizations/getsentry"
            "/settings/installations/123456/permissions/update"
        )

    def test_org_installation_without_account_login_has_no_url(self) -> None:
        assert self._info("Organization", "").installation_url is None
