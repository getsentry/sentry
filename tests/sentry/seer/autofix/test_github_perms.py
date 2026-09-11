from __future__ import annotations

from collections.abc import Sequence

from sentry.constants import ObjectStatus
from sentry.integrations.models.integration import Integration
from sentry.integrations.services.integration import integration_service
from sentry.integrations.utils.github_permission_tiers import PR_ITERATION_TIER
from sentry.integrations.utils.github_permissions import GITHUB_APP_REQUIRED_PERMISSIONS
from sentry.models.organization import Organization
from sentry.models.repository import Repository
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
    get_missing_permissions_by_repo,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import assume_test_silo_mode_of
from sentry.utils import json

REPO_NAME = "getsentry/sentry"
LOGGER_NAME = "sentry.seer.autofix.github_perms"

_FULL_PERMISSIONS = dict(GITHUB_APP_REQUIRED_PERMISSIONS)
# Holds everything up to and including Autofix; only the PR iteration tier is
# missing (its scopes are dropped from the full set).
_MISSING_PR_ITERATION = {
    scope: level
    for scope, level in _FULL_PERMISSIONS.items()
    if scope not in PR_ITERATION_TIER.introduced
}


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
            metadata={"permissions": _MISSING_PR_ITERATION},
        )
        self.repo = self.create_repo(
            project=self.create_project(organization=self.organization),
            name=REPO_NAME,
            provider="integrations:github",
            integration_id=self.integration.id,
        )

    def test_warns_when_a_pr_exists_and_feedback_is_queued(self) -> None:
        missing = get_blocked_pr_iteration_permissions(
            self.organization, _state(pr_number=7), has_actionable_feedback=True
        )

        assert set(missing) == {REPO_NAME}
        assert [tier.key for tier in missing[REPO_NAME].missing_tiers] == ["pr_iteration"]
        assert missing[REPO_NAME].installation_id == "9999"
        assert missing[REPO_NAME].repository_id == self.repo.id

    def test_silent_without_actionable_feedback(self) -> None:
        assert (
            get_blocked_pr_iteration_permissions(
                self.organization, _state(pr_number=7), has_actionable_feedback=False
            )
            == {}
        )

    def test_silent_before_the_pr_is_created(self) -> None:
        assert (
            get_blocked_pr_iteration_permissions(
                self.organization, _state(pr_number=None), has_actionable_feedback=True
            )
            == {}
        )

    def test_silent_when_the_install_is_healthy(self) -> None:
        healthy = self.create_integration(
            organization=self.organization,
            provider="github",
            external_id="8888",
            metadata={"permissions": _FULL_PERMISSIONS},
        )
        Repository.objects.filter(id=self.repo.id).update(integration_id=healthy.id)

        assert (
            get_blocked_pr_iteration_permissions(
                self.organization, _state(pr_number=7), has_actionable_feedback=True
            )
            == {}
        )


class GetMissingPermissionsByRepoTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.integration = self.create_integration(
            organization=self.organization,
            provider="github",
            external_id="9999",
            metadata={"permissions": _MISSING_PR_ITERATION},
        )
        self.repo = self.create_repo(
            project=self.create_project(organization=self.organization),
            name=REPO_NAME,
            provider="integrations:github",
            integration_id=self.integration.id,
        )

    def test_reports_the_repository_the_install_was_resolved_for(self) -> None:
        missing = get_missing_permissions_by_repo(self.organization, [REPO_NAME])

        assert missing[REPO_NAME].repository_id == self.repo.id
        assert [tier.key for tier in missing[REPO_NAME].missing_tiers] == ["pr_iteration"]

    def _assert_warns(self, organization: Organization, repo_name: str, reason: str) -> None:
        with self.assertLogs(LOGGER_NAME, level="WARNING") as logs:
            assert get_missing_permissions_by_repo(organization, [repo_name]) == {}

        assert len(logs.records) == 1
        assert logs.records[0].__dict__["reason"] == reason
        assert logs.records[0].__dict__["organization_id"] == organization.id

    def test_warns_without_a_repository_row(self) -> None:
        self._assert_warns(self.organization, "org/unknown", "no_repository_row")

    def test_warns_when_the_repository_is_not_active(self) -> None:
        self.repo.update(status=ObjectStatus.PENDING_DELETION)

        self._assert_warns(self.organization, REPO_NAME, "no_repository_row")

    def test_warns_when_the_repository_belongs_to_another_org(self) -> None:
        self._assert_warns(self.create_organization(), REPO_NAME, "no_repository_row")

    def test_warns_when_the_repository_has_no_integration(self) -> None:
        Repository.objects.filter(id=self.repo.id).update(integration_id=None)

        self._assert_warns(self.organization, REPO_NAME, "no_integration_id")

    def test_warns_when_the_integration_is_gone(self) -> None:
        Repository.objects.filter(id=self.repo.id).update(integration_id=self.integration.id + 1000)

        self._assert_warns(self.organization, REPO_NAME, "integration_not_found")

    def test_warns_when_the_install_permissions_are_unknown(self) -> None:
        # Token refresh stores whatever GitHub returned, so None is a real state
        # and means "we never learned what this install holds".
        with assume_test_silo_mode_of(Integration):
            self.integration.update(metadata={"permissions": None})

        self._assert_warns(self.organization, REPO_NAME, "permissions_unknown")

    def test_warns_when_the_metadata_has_no_permissions_at_all(self) -> None:
        with assume_test_silo_mode_of(Integration):
            self.integration.update(metadata={})

        self._assert_warns(self.organization, REPO_NAME, "permissions_unknown")

    def test_known_empty_permissions_are_reported_missing_not_unknown(self) -> None:
        # Unlike None, {} says we checked and the install holds nothing.
        with assume_test_silo_mode_of(Integration):
            self.integration.update(metadata={"permissions": {}})

        missing = get_missing_permissions_by_repo(self.organization, [REPO_NAME])

        assert "pr_iteration" in [tier.key for tier in missing[REPO_NAME].missing_tiers]

    def test_quiet_when_every_repo_resolves(self) -> None:
        with self.assertNoLogs(LOGGER_NAME, level="WARNING"):
            assert set(get_missing_permissions_by_repo(self.organization, [REPO_NAME])) == {
                REPO_NAME
            }


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
            integration=rpc_integration, missing_tiers=[PR_ITERATION_TIER], repository_id=1
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
