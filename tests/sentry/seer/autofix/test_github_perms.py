from __future__ import annotations

from sentry.constants import ObjectStatus
from sentry.integrations.models.integration import Integration
from sentry.integrations.services.integration import integration_service
from sentry.integrations.utils.github_permission_tiers import PR_ITERATION_TIER
from sentry.integrations.utils.github_permissions import GITHUB_APP_LATEST_PERMISSIONS
from sentry.models.organization import Organization
from sentry.models.repository import Repository
from sentry.seer.autofix.github_perms import (
    MissingGithubPermissions,
    get_missing_permissions_by_repo,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import assume_test_silo_mode_of

REPO_NAME = "getsentry/sentry"
LOGGER_NAME = "sentry.seer.autofix.github_perms"

_FULL_PERMISSIONS = dict(GITHUB_APP_LATEST_PERMISSIONS)
# Holds everything up to and including Autofix; only the PR iteration tier is
# missing (its scopes are dropped from the full set).
_MISSING_PR_ITERATION = {
    scope: level
    for scope, level in _FULL_PERMISSIONS.items()
    if scope not in PR_ITERATION_TIER.introduced
}


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
