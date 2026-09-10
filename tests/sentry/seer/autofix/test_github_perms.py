from __future__ import annotations

from collections.abc import Sequence
from unittest import mock

from sentry.constants import ObjectStatus
from sentry.integrations.models.integration import Integration
from sentry.integrations.services.integration import RpcIntegration, integration_service
from sentry.integrations.services.integration.serial import serialize_integration
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
from sentry.testutils.helpers.options import override_options
from sentry.testutils.silo import assume_test_silo_mode_of
from sentry.utils import json

REPO_NAME = "getsentry/sentry"
LOGGER_NAME = "sentry.seer.autofix.github_perms"

# Both sides of GITHUB_APP_PERMISSIONS_UPDATED_AT, in the naive-UTC isoformat the
# token refresh writes.
FRESH_REFRESH_AT = "2026-08-01T00:00:00"
STALE_REFRESH_AT = "2026-07-01T00:00:00"


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
            metadata={
                "permissions": {"contents": "read"},
                "last_refresh_at": FRESH_REFRESH_AT,
            },
        )
        self.repo = self.create_repo(
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
        assert missing[REPO_NAME].repository_id == self.repo.id

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


class GetMissingPermissionsByRepoTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.integration = self.create_integration(
            organization=self.organization,
            provider="github",
            external_id="9999",
            metadata={
                "permissions": {"contents": "read"},
                "last_refresh_at": FRESH_REFRESH_AT,
            },
        )
        self.repo = self.create_repo(
            project=self.create_project(organization=self.organization),
            name=REPO_NAME,
            provider="integrations:github",
            integration_id=self.integration.id,
        )

    @override_options({"github-app.required-permissions": {"contents": "write"}})
    def test_reports_the_repository_the_install_was_resolved_for(self) -> None:
        missing = get_missing_permissions_by_repo(self.organization, [REPO_NAME])

        assert missing[REPO_NAME].repository_id == self.repo.id
        assert missing[REPO_NAME].missing_scopes == ["contents"]

    def _assert_warns(self, organization: Organization, repo_name: str, reason: str) -> None:
        with self.assertLogs(LOGGER_NAME, level="WARNING") as logs:
            assert get_missing_permissions_by_repo(organization, [repo_name]) == {}

        assert len(logs.records) == 1
        assert logs.records[0].__dict__["reason"] == reason
        assert logs.records[0].__dict__["organization_id"] == organization.id

    @override_options({"github-app.required-permissions": {"contents": "write"}})
    def test_warns_without_a_repository_row(self) -> None:
        self._assert_warns(self.organization, "org/unknown", "no_repository_row")

    @override_options({"github-app.required-permissions": {"contents": "write"}})
    def test_warns_when_the_repository_is_not_active(self) -> None:
        self.repo.update(status=ObjectStatus.PENDING_DELETION)

        self._assert_warns(self.organization, REPO_NAME, "no_repository_row")

    @override_options({"github-app.required-permissions": {"contents": "write"}})
    def test_warns_when_the_repository_belongs_to_another_org(self) -> None:
        self._assert_warns(self.create_organization(), REPO_NAME, "no_repository_row")

    @override_options({"github-app.required-permissions": {"contents": "write"}})
    def test_warns_when_the_repository_has_no_integration(self) -> None:
        Repository.objects.filter(id=self.repo.id).update(integration_id=None)

        self._assert_warns(self.organization, REPO_NAME, "no_integration_id")

    @override_options({"github-app.required-permissions": {"contents": "write"}})
    def test_warns_when_the_integration_is_gone(self) -> None:
        Repository.objects.filter(id=self.repo.id).update(integration_id=self.integration.id + 1000)

        self._assert_warns(self.organization, REPO_NAME, "integration_not_found")

    def _set_last_refresh_at(self, last_refresh_at: str) -> None:
        with assume_test_silo_mode_of(Integration):
            self.integration.update(
                metadata={**self.integration.metadata, "last_refresh_at": last_refresh_at}
            )

    def _refresh_to(self, permissions: dict[str, str]):
        """Stand in for the token mint, which rewrites both permissions and stamp.

        A side_effect rather than a return_value: the row has to still be stale
        when get_missing_permissions_by_repo reads it, or it would never call us.
        """

        def refresh(**kwargs: object) -> RpcIntegration:
            with assume_test_silo_mode_of(Integration):
                self.integration.update(
                    metadata={
                        "permissions": permissions,
                        "last_refresh_at": FRESH_REFRESH_AT,
                    }
                )
            return serialize_integration(self.integration)

        return mock.patch.object(
            integration_service, "refresh_github_permissions", side_effect=refresh
        )

    @override_options({"github-app.required-permissions": {"contents": "write"}})
    def test_refreshes_a_stale_snapshot_and_judges_the_new_one(self) -> None:
        self._set_last_refresh_at(STALE_REFRESH_AT)

        with self._refresh_to({"contents": "write"}) as refresh:
            assert get_missing_permissions_by_repo(self.organization, [REPO_NAME]) == {}

        assert refresh.call_count == 1

    @override_options({"github-app.required-permissions": {"contents": "write"}})
    def test_reports_what_the_refreshed_snapshot_is_still_missing(self) -> None:
        self._set_last_refresh_at(STALE_REFRESH_AT)

        with self._refresh_to({"contents": "read"}):
            missing = get_missing_permissions_by_repo(self.organization, [REPO_NAME])

        assert missing[REPO_NAME].missing_scopes == ["contents"]

    @override_options({"github-app.required-permissions": {"contents": "write"}})
    def test_does_not_refresh_a_snapshot_that_is_recent_enough(self) -> None:
        with self._refresh_to({"contents": "write"}) as refresh:
            missing = get_missing_permissions_by_repo(self.organization, [REPO_NAME])

        assert refresh.call_count == 0
        assert missing[REPO_NAME].missing_scopes == ["contents"]

    @override_options({"github-app.required-permissions": {"contents": "write"}})
    def test_warns_and_stays_quiet_when_the_refresh_finds_no_integration(self) -> None:
        self._set_last_refresh_at(STALE_REFRESH_AT)

        with mock.patch.object(
            integration_service, "refresh_github_permissions", return_value=None
        ):
            self._assert_warns(self.organization, REPO_NAME, "stale_permissions_snapshot")

    @override_options({"github-app.required-permissions": {"contents": "write"}})
    def test_warns_and_stays_quiet_when_the_refresh_raises(self) -> None:
        self._set_last_refresh_at(STALE_REFRESH_AT)

        with mock.patch.object(
            integration_service,
            "refresh_github_permissions",
            side_effect=Exception("github is having a day"),
        ):
            self._assert_warns(self.organization, REPO_NAME, "stale_permissions_snapshot")

    @override_options({"github-app.required-permissions": {"contents": "write"}})
    def test_warns_and_stays_quiet_when_the_snapshot_is_still_stale_after_refreshing(self) -> None:
        self._set_last_refresh_at(STALE_REFRESH_AT)

        with mock.patch.object(
            integration_service,
            "refresh_github_permissions",
            return_value=serialize_integration(self.integration),
        ):
            self._assert_warns(self.organization, REPO_NAME, "stale_permissions_snapshot")

    @override_options({"github-app.required-permissions": {"contents": "write"}})
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
