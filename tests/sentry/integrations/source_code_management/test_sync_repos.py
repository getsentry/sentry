from unittest.mock import MagicMock, patch

import pytest
import responses
from taskbroker_client.retry import RetryTaskError

from sentry import audit_log
from sentry.constants import ObjectStatus
from sentry.integrations.github.integration import GitHubIntegrationProvider
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.integrations.source_code_management.sync_repos import sync_repos_for_org
from sentry.models.auditlogentry import AuditLogEntry
from sentry.models.repository import Repository
from sentry.silo.base import SiloMode
from sentry.testutils.cases import IntegrationTestCase, TestCase
from sentry.testutils.silo import assume_test_silo_mode, assume_test_silo_mode_of, control_silo_test


@control_silo_test
@patch("sentry.integrations.github.client.get_jwt", return_value="jwt_token_1")
class SyncReposForOrgTestCase(IntegrationTestCase):
    provider = GitHubIntegrationProvider
    base_url = "https://api.github.com"
    key = "github"

    def setUp(self) -> None:
        super().setUp()
        self.oi = OrganizationIntegration.objects.get(
            organization_id=self.organization.id, integration=self.integration
        )

    def _add_repos_response(self, repos: list[dict[str, object]]) -> None:
        responses.add(
            responses.GET,
            self.base_url + "/installation/repositories?per_page=100",
            status=200,
            json={
                "total_count": len(repos),
                "repositories": repos,
            },
        )

    @responses.activate
    def test_creates_new_repos(self, _: MagicMock) -> None:
        self._add_repos_response(
            [
                {"id": 1, "full_name": "getsentry/sentry", "name": "sentry"},
                {"id": 2, "full_name": "getsentry/snuba", "name": "snuba"},
            ]
        )

        with self.feature(
            ["organizations:github-repo-auto-sync", "organizations:github-repo-auto-sync-apply"]
        ):
            sync_repos_for_org(self.oi.id)

        with assume_test_silo_mode(SiloMode.CELL):
            repos = Repository.objects.filter(organization_id=self.organization.id).order_by("name")

        assert len(repos) == 2
        assert repos[0].name == "getsentry/sentry"
        assert repos[0].provider == "integrations:github"
        assert repos[1].name == "getsentry/snuba"

        with assume_test_silo_mode_of(AuditLogEntry):
            entries = AuditLogEntry.objects.filter(
                organization_id=self.organization.id,
                event=audit_log.get_event_id("REPO_ADDED"),
            )
            assert entries.count() == 2

    @responses.activate
    def test_disables_removed_repos(self, _: MagicMock) -> None:
        with assume_test_silo_mode(SiloMode.CELL):
            repo = Repository.objects.create(
                organization_id=self.organization.id,
                name="getsentry/old-repo",
                external_id="99",
                provider="integrations:github",
                integration_id=self.integration.id,
                status=ObjectStatus.ACTIVE,
            )

        # GitHub no longer returns this repo
        self._add_repos_response([{"id": 1, "full_name": "getsentry/sentry", "name": "sentry"}])

        with self.feature(
            ["organizations:github-repo-auto-sync", "organizations:github-repo-auto-sync-apply"]
        ):
            sync_repos_for_org(self.oi.id)

        with assume_test_silo_mode(SiloMode.CELL):
            repo.refresh_from_db()
            assert repo.status == ObjectStatus.DISABLED

            # The new repo should also be created
            assert Repository.objects.filter(
                organization_id=self.organization.id, external_id="1"
            ).exists()

        with assume_test_silo_mode_of(AuditLogEntry):
            assert AuditLogEntry.objects.filter(
                organization_id=self.organization.id,
                event=audit_log.get_event_id("REPO_DISABLED"),
            ).exists()
            assert AuditLogEntry.objects.filter(
                organization_id=self.organization.id,
                event=audit_log.get_event_id("REPO_ADDED"),
            ).exists()

    @responses.activate
    def test_re_enables_restored_repos(self, _: MagicMock) -> None:
        with assume_test_silo_mode(SiloMode.CELL):
            repo = Repository.objects.create(
                organization_id=self.organization.id,
                name="getsentry/sentry",
                external_id="1",
                provider="integrations:github",
                integration_id=self.integration.id,
                status=ObjectStatus.DISABLED,
            )

        # GitHub returns the repo again
        self._add_repos_response([{"id": 1, "full_name": "getsentry/sentry", "name": "sentry"}])

        with self.feature(
            ["organizations:github-repo-auto-sync", "organizations:github-repo-auto-sync-apply"]
        ):
            sync_repos_for_org(self.oi.id)

        with assume_test_silo_mode(SiloMode.CELL):
            repo.refresh_from_db()
            assert repo.status == ObjectStatus.ACTIVE

        with assume_test_silo_mode_of(AuditLogEntry):
            assert AuditLogEntry.objects.filter(
                organization_id=self.organization.id,
                event=audit_log.get_event_id("REPO_ENABLED"),
            ).exists()

    @responses.activate
    def test_no_changes_needed(self, _: MagicMock) -> None:
        with assume_test_silo_mode(SiloMode.CELL):
            Repository.objects.create(
                organization_id=self.organization.id,
                name="getsentry/sentry",
                external_id="1",
                provider="integrations:github",
                integration_id=self.integration.id,
                status=ObjectStatus.ACTIVE,
            )

        self._add_repos_response([{"id": 1, "full_name": "getsentry/sentry", "name": "sentry"}])

        with self.feature(
            ["organizations:github-repo-auto-sync", "organizations:github-repo-auto-sync-apply"]
        ):
            sync_repos_for_org(self.oi.id)

        with assume_test_silo_mode(SiloMode.CELL):
            repos = Repository.objects.filter(organization_id=self.organization.id)
            assert len(repos) == 1
            assert repos[0].status == ObjectStatus.ACTIVE

    def test_missing_org_integration(self, _: MagicMock) -> None:
        sync_repos_for_org(0)

        with assume_test_silo_mode(SiloMode.CELL):
            assert Repository.objects.count() == 0

    def test_inactive_integration(self, _: MagicMock) -> None:
        self.integration.update(status=ObjectStatus.DISABLED)

        with self.feature(
            ["organizations:github-repo-auto-sync", "organizations:github-repo-auto-sync-apply"]
        ):
            sync_repos_for_org(self.oi.id)

        with assume_test_silo_mode(SiloMode.CELL):
            assert Repository.objects.count() == 0

    @responses.activate
    def test_dry_run_without_apply_flag(self, _: MagicMock) -> None:
        """With auto-sync on but apply off, the task computes the diff but doesn't apply changes."""
        self._add_repos_response(
            [
                {"id": 1, "full_name": "getsentry/sentry", "name": "sentry"},
                {"id": 2, "full_name": "getsentry/snuba", "name": "snuba"},
            ]
        )

        # Only the sync flag, not the apply flag
        with self.feature("organizations:github-repo-auto-sync"):
            sync_repos_for_org(self.oi.id)

        # No repos should be created
        with assume_test_silo_mode(SiloMode.CELL):
            assert Repository.objects.count() == 0

    def test_skips_without_sync_flag(self, _: MagicMock) -> None:
        """Without the auto-sync flag, the task returns early without fetching from GitHub."""
        sync_repos_for_org(self.oi.id)

        with assume_test_silo_mode(SiloMode.CELL):
            assert Repository.objects.count() == 0

    @responses.activate
    def test_rate_limited_raises_for_retry(self, _: MagicMock) -> None:
        responses.add(
            responses.GET,
            self.base_url + "/installation/repositories?per_page=100",
            status=403,
            json={
                "message": "API rate limit exceeded",
                "documentation_url": "https://docs.github.com/rest/overview/resources-in-the-rest-api#rate-limiting",
            },
        )

        with self.feature("organizations:github-repo-auto-sync"), pytest.raises(RetryTaskError):
            sync_repos_for_org(self.oi.id)


@control_silo_test
class SyncReposForOrgGHETestCase(TestCase):
    @patch("sentry.integrations.github.client.GitHubBaseClient.get_repos")
    def test_creates_new_repos_for_ghe(self, mock_get_repos: MagicMock) -> None:
        from sentry.integrations.github_enterprise.integration import (
            GitHubEnterpriseIntegrationProvider,
        )

        GitHubEnterpriseIntegrationProvider().setup()

        integration = self.create_integration(
            organization=self.organization,
            external_id="35.232.149.196:12345",
            provider="github_enterprise",
            metadata={
                "domain_name": "35.232.149.196/testorg",
                "installation_id": "12345",
                "installation": {
                    "id": "2",
                    "private_key": "private_key",
                    "verify_ssl": True,
                },
            },
        )
        oi = OrganizationIntegration.objects.get(
            organization_id=self.organization.id, integration=integration
        )

        mock_get_repos.return_value = [
            {"id": 1, "full_name": "testorg/repo1", "name": "repo1"},
            {"id": 2, "full_name": "testorg/repo2", "name": "repo2"},
        ]

        with self.feature(
            [
                "organizations:github_enterprise-repo-auto-sync",
                "organizations:github_enterprise-repo-auto-sync-apply",
            ]
        ):
            sync_repos_for_org(oi.id)

        with assume_test_silo_mode(SiloMode.CELL):
            repos = Repository.objects.filter(organization_id=self.organization.id).order_by("name")

        assert len(repos) == 2
        assert repos[0].provider == "integrations:github_enterprise"


# TODO: Add GitLab and Bitbucket tests once create_repositories is fixed to
# not call build_repository_config (which creates webhooks) for every repo
# upfront. See SyncReposForOrgGitLabTestCase and SyncReposForOrgBitbucketTestCase
# in git history for the test implementations.


@control_silo_test
class SyncReposForOrgVstsTestCase(TestCase):
    @patch("sentry.integrations.vsts.integration.VstsIntegration.get_client")
    def test_creates_new_repos_for_vsts(self, mock_get_client: MagicMock) -> None:
        from sentry.users.models.identity import Identity

        integration = self.create_provider_integration(
            provider="vsts",
            external_id="vsts-account-id",
            name="MyVSTSAccount",
            metadata={"domain_name": "https://myvstsaccount.visualstudio.com/"},
        )
        identity = Identity.objects.create(
            idp=self.create_identity_provider(type="vsts"),
            user=self.user,
            external_id="vsts123",
            data={
                "access_token": "123456789",
                "expires": 9999999999,
                "refresh_token": "rxxx",
                "token_type": "jwt-bearer",
            },
        )
        integration.add_organization(self.organization, self.user, identity.id)

        oi = OrganizationIntegration.objects.get(
            organization_id=self.organization.id, integration=integration
        )

        mock_client = MagicMock()
        mock_client.get_repos.return_value = {
            "value": [
                {
                    "id": "repo-uuid-1",
                    "name": "cool-service",
                    "project": {"name": "ProjectA"},
                    "_links": {
                        "web": {"href": "https://myvstsaccount.visualstudio.com/_git/cool-service"}
                    },
                },
                {
                    "id": "repo-uuid-2",
                    "name": "other-service",
                    "project": {"name": "ProjectA"},
                    "_links": {
                        "web": {"href": "https://myvstsaccount.visualstudio.com/_git/other-service"}
                    },
                },
            ]
        }
        mock_get_client.return_value = mock_client

        with self.feature(
            ["organizations:vsts-repo-auto-sync", "organizations:vsts-repo-auto-sync-apply"]
        ):
            sync_repos_for_org(oi.id)

        with assume_test_silo_mode(SiloMode.CELL):
            repos = Repository.objects.filter(organization_id=self.organization.id).order_by("name")

        assert len(repos) == 2
        assert repos[0].provider == "integrations:vsts"
