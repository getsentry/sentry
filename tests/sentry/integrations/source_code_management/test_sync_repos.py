from unittest.mock import MagicMock, patch

import pytest
import responses
from requests.exceptions import TooManyRedirects
from taskbroker_client.retry import RetryTaskError

from sentry import audit_log
from sentry.auth.exceptions import IdentityNotValid
from sentry.constants import ObjectStatus
from sentry.integrations.github.integration import GitHubIntegrationProvider
from sentry.integrations.github_enterprise.integration import GitHubEnterpriseIntegrationProvider
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.integrations.source_code_management.sync_repos import (
    sync_repos_for_org,
)
from sentry.locks import locks
from sentry.models.auditlogentry import AuditLogEntry
from sentry.models.commit import Commit
from sentry.models.repository import Repository
from sentry.shared_integrations.exceptions import (
    ApiConnectionResetError,
    ApiError,
    ApiForbiddenError,
    ApiHostError,
    ApiPaginationTruncated,
    ApiRateLimitedError,
    ApiTimeoutError,
    ApiUnauthorized,
    IntegrationConfigurationError,
    IntegrationError,
    UnsupportedResponseType,
)
from sentry.silo.base import SiloMode
from sentry.testutils.cases import IntegrationTestCase, TestCase
from sentry.testutils.silo import assume_test_silo_mode, assume_test_silo_mode_of, control_silo_test
from sentry.users.models.identity import Identity


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
            with self.tasks():
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
            [
                "organizations:github-repo-auto-sync",
                "organizations:github-repo-auto-sync-apply",
                "organizations:scm-repo-auto-sync-removal",
            ]
        ):
            with self.tasks():
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
    def test_skips_disable_for_repo_with_recent_activity(self, _: MagicMock) -> None:
        # A repo that's missing from the provider's listing AND has a recent
        # commit row should NOT be disabled — the activity says it's still
        # live, so the provider listing is more likely wrong than the repo
        # being deleted. Used as a final safety guard before disable.
        with assume_test_silo_mode(SiloMode.CELL):
            still_active_repo = Repository.objects.create(
                organization_id=self.organization.id,
                name="getsentry/old-but-active-repo",
                external_id="99",
                provider="integrations:github",
                integration_id=self.integration.id,
                status=ObjectStatus.ACTIVE,
            )
            Commit.objects.create(
                organization_id=self.organization.id,
                repository_id=still_active_repo.id,
                key="abc123",
            )

        # Provider isn't returning the active repo
        self._add_repos_response([{"id": 1, "full_name": "getsentry/sentry", "name": "sentry"}])

        with self.feature(
            [
                "organizations:github-repo-auto-sync",
                "organizations:github-repo-auto-sync-apply",
                "organizations:scm-repo-auto-sync-removal",
            ]
        ):
            with self.tasks():
                sync_repos_for_org(self.oi.id)

        with assume_test_silo_mode(SiloMode.CELL):
            still_active_repo.refresh_from_db()
            assert still_active_repo.status == ObjectStatus.ACTIVE

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
            with self.tasks():
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
            with self.tasks():
                sync_repos_for_org(self.oi.id)

        with assume_test_silo_mode(SiloMode.CELL):
            repos = Repository.objects.filter(organization_id=self.organization.id)
            assert len(repos) == 1
            assert repos[0].status == ObjectStatus.ACTIVE

    @responses.activate
    def test_stamps_last_sync_on_org_integration(self, _: MagicMock) -> None:
        self.oi.config = {
            "last_sync": "2020-01-01T00:00:00+00:00",
            "last_repos_change": "2020-01-01T00:00:00+00:00",
        }
        self.oi.save()

        self._add_repos_response([{"id": 1, "full_name": "getsentry/sentry", "name": "sentry"}])

        with self.feature(
            ["organizations:github-repo-auto-sync", "organizations:github-repo-auto-sync-apply"]
        ):
            with self.tasks():
                sync_repos_for_org(self.oi.id)

        self.oi.refresh_from_db()
        assert self.oi.config["last_sync"] > "2020-01-01T00:00:00+00:00"
        assert self.oi.config["last_repos_change"] > "2020-01-01T00:00:00+00:00"

    @responses.activate
    def test_does_not_stamp_last_repos_change_when_no_diff(self, _: MagicMock) -> None:
        with assume_test_silo_mode(SiloMode.CELL):
            Repository.objects.create(
                organization_id=self.organization.id,
                name="getsentry/sentry",
                external_id="1",
                integration_id=self.integration.id,
                provider="integrations:github",
            )

        self.oi.config = {
            "last_sync": "2020-01-01T00:00:00+00:00",
            "last_repos_change": "2020-01-01T00:00:00+00:00",
        }
        self.oi.save()

        self._add_repos_response([{"id": 1, "full_name": "getsentry/sentry", "name": "sentry"}])

        with self.feature(
            ["organizations:github-repo-auto-sync", "organizations:github-repo-auto-sync-apply"]
        ):
            with self.tasks():
                sync_repos_for_org(self.oi.id)

        self.oi.refresh_from_db()
        assert self.oi.config["last_sync"] > "2020-01-01T00:00:00+00:00"
        assert self.oi.config["last_repos_change"] == "2020-01-01T00:00:00+00:00"

    def test_missing_org_integration(self, _: MagicMock) -> None:
        sync_repos_for_org(0)

        with assume_test_silo_mode(SiloMode.CELL):
            assert Repository.objects.count() == 0

    def test_inactive_integration(self, _: MagicMock) -> None:
        self.integration.update(status=ObjectStatus.DISABLED)

        with self.feature(
            ["organizations:github-repo-auto-sync", "organizations:github-repo-auto-sync-apply"]
        ):
            with self.tasks():
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
            with self.tasks():
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
    def test_rate_limited_halts_without_retry(self, _: MagicMock) -> None:
        responses.add(
            responses.GET,
            self.base_url + "/installation/repositories?per_page=100",
            status=403,
            json={
                "message": "API rate limit exceeded",
                "documentation_url": "https://docs.github.com/rest/overview/resources-in-the-rest-api#rate-limiting",
            },
        )

        with self.feature("organizations:github-repo-auto-sync"), self.tasks():
            sync_repos_for_org(self.oi.id)

        with assume_test_silo_mode(SiloMode.CELL):
            assert Repository.objects.count() == 0

    @patch("sentry.integrations.github.integration.GitHubIntegration.get_repositories")
    def test_installation_suspended_halts_without_retry(
        self, mock_get_repositories: MagicMock, _: MagicMock
    ) -> None:
        mock_get_repositories.side_effect = ApiForbiddenError(
            '{"message":"This installation has been suspended"}'
        )

        with self.feature("organizations:github-repo-auto-sync"), self.tasks():
            sync_repos_for_org(self.oi.id)

        with assume_test_silo_mode(SiloMode.CELL):
            assert Repository.objects.count() == 0

    @patch("sentry.integrations.github.client.GitHubBaseClient.get_repos")
    def test_truncated_fetch_skips_disable(self, mock_get_repos: MagicMock, _: MagicMock) -> None:
        with assume_test_silo_mode(SiloMode.CELL):
            repo = Repository.objects.create(
                organization_id=self.organization.id,
                name="getsentry/old-repo",
                external_id="99",
                provider="integrations:github",
                integration_id=self.integration.id,
                status=ObjectStatus.ACTIVE,
            )

        # Raw GitHub API response shape — the integration must transform this
        # into RepositoryInfo before it reaches sync_repos.
        mock_get_repos.side_effect = ApiPaginationTruncated(
            partial_data=[
                {"id": 1, "full_name": "getsentry/sentry", "name": "sentry"},
            ]
        )

        with self.feature(
            [
                "organizations:github-repo-auto-sync",
                "organizations:github-repo-auto-sync-apply",
                "organizations:scm-repo-auto-sync-removal",
            ]
        ):
            with self.tasks():
                sync_repos_for_org(self.oi.id)

        with assume_test_silo_mode(SiloMode.CELL):
            repo.refresh_from_db()
            assert repo.status == ObjectStatus.ACTIVE  # not disabled
            # Creation still runs on the transformed partial list
            assert Repository.objects.filter(
                organization_id=self.organization.id, external_id="1"
            ).exists()


@control_silo_test
class SyncReposForOrgGHETestCase(TestCase):
    @patch("sentry.integrations.github.client.GitHubBaseClient.get_repos")
    def test_creates_new_repos_for_ghe(self, mock_get_repos: MagicMock) -> None:
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
            with self.tasks():
                sync_repos_for_org(oi.id)

        with assume_test_silo_mode(SiloMode.CELL):
            repos = Repository.objects.filter(organization_id=self.organization.id).order_by("name")

        assert len(repos) == 2
        assert repos[0].provider == "integrations:github_enterprise"

    @patch("sentry.integrations.github.client.GitHubBaseClient.get_repos")
    def test_truncated_fetch_skips_disable_for_ghe(self, mock_get_repos: MagicMock) -> None:
        # Same partial-data transformation as the GitHub path: when GHE's
        # client raises ApiPaginationTruncated with raw API dicts, the
        # integration must transform them to RepositoryInfo before re-raising
        # so sync_repos doesn't KeyError on `external_id`.

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

        with assume_test_silo_mode(SiloMode.CELL):
            repo = Repository.objects.create(
                organization_id=self.organization.id,
                name="testorg/old-repo",
                external_id="99",
                provider="integrations:github_enterprise",
                integration_id=integration.id,
                status=ObjectStatus.ACTIVE,
            )

        # Raw GHE API dicts in partial_data — must be transformed by the
        # integration before sync_repos sees them.
        mock_get_repos.side_effect = ApiPaginationTruncated(
            partial_data=[{"id": 1, "full_name": "testorg/repo1", "name": "repo1"}]
        )

        with self.feature(
            [
                "organizations:github_enterprise-repo-auto-sync",
                "organizations:github_enterprise-repo-auto-sync-apply",
                "organizations:scm-repo-auto-sync-removal",
            ]
        ):
            with self.tasks():
                sync_repos_for_org(oi.id)

        with assume_test_silo_mode(SiloMode.CELL):
            repo.refresh_from_db()
            assert repo.status == ObjectStatus.ACTIVE  # not disabled
            # Creation still runs on the transformed partial list — fails
            # if partial_data wasn't run through the transform.
            assert Repository.objects.filter(
                organization_id=self.organization.id, external_id="1"
            ).exists()


@control_silo_test
class SyncReposForOrgGitLabTestCase(TestCase):
    @responses.activate
    def test_creates_new_repos_for_gitlab(self) -> None:
        integration = self.create_provider_integration(
            provider="gitlab",
            name="Example Gitlab",
            external_id="example.gitlab.com:group-x",
            metadata={
                "instance": "example.gitlab.com",
                "base_url": "https://example.gitlab.com",
                "domain_name": "example.gitlab.com/group-x",
                "verify_ssl": False,
                "group_id": 1,
                "webhook_secret": "secret123",
            },
        )
        identity = Identity.objects.create(
            idp=self.create_identity_provider(type="gitlab", config={}),
            user=self.user,
            external_id="gitlab123",
            data={"access_token": "123456789"},
        )
        integration.add_organization(self.organization, self.user, identity.id)

        oi = OrganizationIntegration.objects.get(
            organization_id=self.organization.id, integration=integration
        )

        responses.add(
            responses.GET,
            "https://example.gitlab.com/api/v4/groups/1/projects?search=&simple=True&include_subgroups=False&page=1&per_page=100&order_by=last_activity_at",
            json=[
                {
                    "id": 10,
                    "name_with_namespace": "getsentry / sentry",
                    "path_with_namespace": "getsentry/sentry",
                    "web_url": "https://example.gitlab.com/getsentry/sentry",
                },
                {
                    "id": 20,
                    "name_with_namespace": "getsentry / snuba",
                    "path_with_namespace": "getsentry/snuba",
                    "web_url": "https://example.gitlab.com/getsentry/snuba",
                },
            ],
        )

        # Webhook creation for each new repo
        responses.add(
            responses.POST,
            "https://example.gitlab.com/api/v4/projects/10/hooks",
            json={"id": 99},
        )
        responses.add(
            responses.POST,
            "https://example.gitlab.com/api/v4/projects/20/hooks",
            json={"id": 100},
        )

        with self.feature(
            ["organizations:gitlab-repo-auto-sync", "organizations:gitlab-repo-auto-sync-apply"]
        ):
            with self.tasks():
                sync_repos_for_org(oi.id)

        with assume_test_silo_mode(SiloMode.CELL):
            repos = Repository.objects.filter(organization_id=self.organization.id).order_by("name")

        assert len(repos) == 2
        assert repos[0].provider == "integrations:gitlab"


@control_silo_test
class SyncReposForOrgBitbucketTestCase(TestCase):
    @responses.activate
    def test_creates_new_repos_for_bitbucket(self) -> None:
        integration = self.create_provider_integration(
            provider="bitbucket",
            external_id="connect:1234567",
            name="sentryuser",
            metadata={
                "base_url": "https://api.bitbucket.org",
                "domain_name": "bitbucket.org/sentryuser",
                "shared_secret": "secret123",
                "subject": "connect:1234567",
            },
        )
        integration.add_organization(self.organization, self.user)

        oi = OrganizationIntegration.objects.get(
            organization_id=self.organization.id, integration=integration
        )

        responses.add(
            responses.GET,
            "https://api.bitbucket.org/2.0/repositories/sentryuser",
            json={
                "values": [
                    {"full_name": "sentryuser/repo1", "uuid": "{uuid-001}"},
                    {"full_name": "sentryuser/repo2", "uuid": "{uuid-002}"},
                ]
            },
        )

        # Webhook creation for each new repo
        responses.add(
            responses.POST,
            "https://api.bitbucket.org/2.0/repositories/sentryuser/repo1/hooks",
            json={"uuid": "{hook-001}"},
        )
        responses.add(
            responses.POST,
            "https://api.bitbucket.org/2.0/repositories/sentryuser/repo2/hooks",
            json={"uuid": "{hook-002}"},
        )

        with self.feature(
            [
                "organizations:bitbucket-repo-auto-sync",
                "organizations:bitbucket-repo-auto-sync-apply",
            ]
        ):
            with self.tasks():
                sync_repos_for_org(oi.id)

        with assume_test_silo_mode(SiloMode.CELL):
            repos = Repository.objects.filter(organization_id=self.organization.id).order_by("name")

        assert len(repos) == 2
        assert repos[0].provider == "integrations:bitbucket"


@control_silo_test
class SyncReposForOrgVstsTestCase(TestCase):
    @patch("sentry.integrations.vsts.integration.VstsIntegration.get_client")
    def test_creates_new_repos_for_vsts(self, mock_get_client: MagicMock) -> None:
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
                    "webUrl": "https://myvstsaccount.visualstudio.com/_git/cool-service",
                },
                {
                    "id": "repo-uuid-2",
                    "name": "other-service",
                    "project": {"name": "ProjectA"},
                    "webUrl": "https://myvstsaccount.visualstudio.com/_git/other-service",
                },
            ]
        }
        mock_get_client.return_value = mock_client

        with self.feature(
            ["organizations:vsts-repo-auto-sync", "organizations:vsts-repo-auto-sync-apply"]
        ):
            with self.tasks():
                sync_repos_for_org(oi.id)

        with assume_test_silo_mode(SiloMode.CELL):
            repos = Repository.objects.filter(organization_id=self.organization.id).order_by("name")

        assert len(repos) == 2
        assert repos[0].provider == "integrations:vsts"

    def _create_vsts_integration(self) -> OrganizationIntegration:
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
        return OrganizationIntegration.objects.get(
            organization_id=self.organization.id, integration=integration
        )

    @patch("sentry.integrations.vsts.integration.VstsIntegration.get_repositories")
    def test_vsts_wrapped_unauthorized_halts_without_retry(
        self, mock_get_repositories: MagicMock
    ) -> None:
        def _wrap_unauthorized(*args: object, **kwargs: object) -> None:
            # Mirror VSTS's real wrapping: raise IntegrationError from inside the
            # ApiUnauthorized except block so __context__ is populated.
            try:
                raise ApiUnauthorized("bad token")
            except ApiUnauthorized:
                raise IntegrationError(
                    "Unauthorized: either your access token was invalid or you do not have access"
                )

        mock_get_repositories.side_effect = _wrap_unauthorized

        oi = self._create_vsts_integration()
        with self.feature("organizations:vsts-repo-auto-sync"), self.tasks():
            sync_repos_for_org(oi.id)

        with assume_test_silo_mode(SiloMode.CELL):
            assert Repository.objects.count() == 0

    @patch("sentry.integrations.vsts.integration.VstsIntegration.get_repositories")
    def test_vsts_wrapped_identity_not_valid_halts_without_retry(
        self, mock_get_repositories: MagicMock
    ) -> None:
        # VSTS wraps IdentityNotValid in IntegrationError with ERR_INTERNAL,
        # so the message does NOT contain "Unauthorized". The sync code must
        # still halt by detecting the original via __context__.

        def _wrap_identity_not_valid(*args: object, **kwargs: object) -> None:
            try:
                raise IdentityNotValid()
            except IdentityNotValid:
                raise IntegrationError(
                    "An internal error occurred with the integration and the Sentry team has been notified"
                )

        mock_get_repositories.side_effect = _wrap_identity_not_valid

        oi = self._create_vsts_integration()
        with self.feature("organizations:vsts-repo-auto-sync"), self.tasks():
            sync_repos_for_org(oi.id)

        with assume_test_silo_mode(SiloMode.CELL):
            assert Repository.objects.count() == 0


@control_silo_test
class SyncReposForOrgBrokenIdentityTestCase(TestCase):
    @patch("sentry.integrations.gitlab.integration.GitlabIntegration.get_repositories")
    def test_identity_not_valid_halts_without_retry(self, mock_get_repositories: MagicMock) -> None:
        integration = self.create_provider_integration(
            provider="gitlab",
            name="Example Gitlab",
            external_id="example.gitlab.com:group-x",
            metadata={
                "instance": "example.gitlab.com",
                "base_url": "https://example.gitlab.com",
                "domain_name": "example.gitlab.com/group-x",
                "verify_ssl": False,
                "group_id": 1,
                "webhook_secret": "secret123",
            },
        )
        identity = Identity.objects.create(
            idp=self.create_identity_provider(type="gitlab", config={}),
            user=self.user,
            external_id="gitlab123",
            data={"access_token": "123456789"},
        )
        integration.add_organization(self.organization, self.user, identity.id)
        oi = OrganizationIntegration.objects.get(
            organization_id=self.organization.id, integration=integration
        )

        mock_get_repositories.side_effect = IdentityNotValid()

        with self.feature("organizations:gitlab-repo-auto-sync"), self.tasks():
            sync_repos_for_org(oi.id)

        with assume_test_silo_mode(SiloMode.CELL):
            assert Repository.objects.count() == 0


@control_silo_test
@patch("sentry.integrations.github.client.get_jwt", return_value="jwt_token_1")
class SyncReposLockTestCase(IntegrationTestCase):
    provider = GitHubIntegrationProvider
    base_url = "https://api.github.com"
    key = "github"

    def setUp(self) -> None:
        super().setUp()
        self.oi = OrganizationIntegration.objects.get(
            organization_id=self.organization.id, integration=self.integration
        )

    @responses.activate
    @patch("sentry.integrations.source_code_management.sync_repos._sync_repos_for_org")
    def test_skips_when_locked(self, mock_inner: MagicMock, _: MagicMock) -> None:
        lock = locks.get(
            f"repo-sync:{self.oi.id}",
            duration=300,
            name="sync_repos_for_org",
        )
        with lock.acquire():
            sync_repos_for_org(self.oi.id)

        mock_inner.assert_not_called()

    @responses.activate
    def test_lock_released_after_sync(self, _: MagicMock) -> None:
        responses.add(
            responses.GET,
            self.base_url + "/installation/repositories?per_page=100",
            status=200,
            json={"total_count": 0, "repositories": []},
        )

        with self.feature("organizations:github-repo-auto-sync"), self.tasks():
            sync_repos_for_org(self.oi.id)

        # A second call should succeed (lock was released).
        with self.feature("organizations:github-repo-auto-sync"), self.tasks():
            sync_repos_for_org(self.oi.id)


@control_silo_test
class IsBrokenIntegrationErrorTestCase(TestCase):
    """Tests for the RepositoryIntegration.is_broken_integration_error base implementation."""

    def setUp(self) -> None:
        super().setUp()
        self.integration = self.create_provider_integration(
            provider="github",
            external_id="12345",
            name="test-gh",
            metadata={
                "access_token": "xxx",
                "expires_at": "",
            },
        )
        self.integration.add_organization(self.organization, self.user)
        self.installation = self.integration.get_installation(organization_id=self.organization.id)

    def test_identity_not_valid(self) -> None:
        assert (
            self.installation.is_broken_integration_error(IdentityNotValid())
            == "identity_not_valid"
        )

    def test_identity_does_not_exist(self) -> None:
        assert (
            self.installation.is_broken_integration_error(Identity.DoesNotExist())
            == "identity_not_found"
        )

    def test_api_unauthorized(self) -> None:
        assert (
            self.installation.is_broken_integration_error(ApiUnauthorized("bad token"))
            == "unauthorized"
        )

    def test_api_forbidden_not_terminal(self) -> None:
        assert self.installation.is_broken_integration_error(ApiForbiddenError("forbidden")) is None

    def test_api_forbidden_suspended_returns_installation_suspended(self) -> None:
        exc = ApiForbiddenError('{"message":"This installation has been suspended"}')
        assert self.installation.is_broken_integration_error(exc) == "installation_suspended"

    def test_api_host_error(self) -> None:
        exc = ApiHostError.from_exception(Exception("host down"))
        assert self.installation.is_broken_integration_error(exc) == "host_unreachable"

    def test_api_timeout_error(self) -> None:
        exc = ApiTimeoutError("timed out")
        assert self.installation.is_broken_integration_error(exc) == "host_timeout"

    def test_api_connection_reset(self) -> None:
        assert (
            self.installation.is_broken_integration_error(
                ApiConnectionResetError("Connection reset")
            )
            == "connection_reset"
        )

    def test_unsupported_response_type(self) -> None:
        assert (
            self.installation.is_broken_integration_error(UnsupportedResponseType("text/html"))
            == "unsupported_response"
        )

    def test_api_rate_limited(self) -> None:
        assert (
            self.installation.is_broken_integration_error(ApiRateLimitedError("slow down"))
            == "rate_limited"
        )

    def test_integration_configuration_error(self) -> None:
        assert (
            self.installation.is_broken_integration_error(
                IntegrationConfigurationError("bad config")
            )
            == "configuration_error"
        )

    def test_integration_error_wrapping_terminal_cause(self) -> None:
        exc = IntegrationError("wrapped")
        exc.__context__ = IdentityNotValid()
        assert self.installation.is_broken_integration_error(exc) == "identity_not_valid"

    def test_integration_error_wrapping_non_terminal_cause(self) -> None:
        exc = IntegrationError("wrapped")
        exc.__context__ = ValueError("not terminal")
        assert self.installation.is_broken_integration_error(exc) is None

    def test_integration_error_without_context(self) -> None:
        assert self.installation.is_broken_integration_error(IntegrationError("plain")) is None

    def test_too_many_redirects(self) -> None:
        assert (
            self.installation.is_broken_integration_error(TooManyRedirects())
            == "too_many_redirects"
        )

    def test_generic_api_error_not_terminal(self) -> None:
        assert (
            self.installation.is_broken_integration_error(ApiError("server error", code=500))
            is None
        )

    def test_unrelated_exception_not_terminal(self) -> None:
        assert self.installation.is_broken_integration_error(RuntimeError("boom")) is None

    def test_rate_limited_via_is_rate_limited_error(self) -> None:
        exc = ApiForbiddenError('{"message":"API rate limit exceeded"}')
        with patch.object(type(self.installation), "is_rate_limited_error", return_value=True):
            assert self.installation.is_broken_integration_error(exc) == "rate_limited"


@control_silo_test
class GitlabIsBrokenIntegrationErrorTestCase(TestCase):
    """Tests for the GitlabIntegration.is_broken_integration_error override."""

    def setUp(self) -> None:
        super().setUp()
        self.integration = self.create_provider_integration(
            provider="gitlab",
            name="Example Gitlab",
            external_id="example.gitlab.com:group-x",
            metadata={
                "instance": "example.gitlab.com",
                "base_url": "https://example.gitlab.com",
                "domain_name": "example.gitlab.com/group-x",
                "verify_ssl": False,
                "group_id": 1,
                "webhook_secret": "secret123",
            },
        )
        identity = Identity.objects.create(
            idp=self.create_identity_provider(type="gitlab", config={}),
            user=self.user,
            external_id="gitlab123",
            data={"access_token": "123456789"},
        )
        self.integration.add_organization(self.organization, self.user, identity.id)
        self.installation = self.integration.get_installation(organization_id=self.organization.id)

    def test_api_error_403_returns_unauthorized(self) -> None:
        exc = ApiError("forbidden", code=403)
        assert self.installation.is_broken_integration_error(exc) == "unauthorized"

    def test_api_error_404_returns_configuration_error(self) -> None:
        exc = ApiError("not found", code=404)
        assert self.installation.is_broken_integration_error(exc) == "configuration_error"

    def test_api_forbidden_error_returns_unauthorized(self) -> None:
        exc = ApiForbiddenError("blocked")
        assert self.installation.is_broken_integration_error(exc) == "unauthorized"

    def test_api_error_500_not_terminal(self) -> None:
        exc = ApiError("server error", code=500)
        assert self.installation.is_broken_integration_error(exc) is None

    def test_api_error_no_code_not_terminal(self) -> None:
        exc = ApiError("something")
        assert self.installation.is_broken_integration_error(exc) is None

    def test_valueerror_html_response_returns_unsupported_response(self) -> None:
        exc = ValueError("Not a valid response type: <html><head><title>gitlab.support</title>")
        assert self.installation.is_broken_integration_error(exc) == "unsupported_response"

    def test_valueerror_unrelated_not_terminal(self) -> None:
        exc = ValueError("some other value error")
        assert self.installation.is_broken_integration_error(exc) is None

    def test_base_class_cases_still_work(self) -> None:
        assert (
            self.installation.is_broken_integration_error(ApiUnauthorized("bad token"))
            == "unauthorized"
        )
        assert (
            self.installation.is_broken_integration_error(IdentityNotValid())
            == "identity_not_valid"
        )
        assert self.installation.is_broken_integration_error(RuntimeError("boom")) is None


@control_silo_test
@patch("sentry.integrations.github.client.get_jwt", return_value="jwt_token_1")
class SyncReposForOrgNewErrorHandlingTestCase(IntegrationTestCase):
    """Tests that sync_repos_for_org halts correctly for newly-handled error types."""

    provider = GitHubIntegrationProvider
    base_url = "https://api.github.com"
    key = "github"

    def setUp(self) -> None:
        super().setUp()
        self.oi = OrganizationIntegration.objects.get(
            organization_id=self.organization.id, integration=self.integration
        )

    @patch("sentry.integrations.github.integration.GitHubIntegration.get_repositories")
    def test_api_host_error_halts(self, mock_get_repositories: MagicMock, _: MagicMock) -> None:
        mock_get_repositories.side_effect = ApiHostError.from_exception(
            Exception("Unable to reach host")
        )

        with self.feature("organizations:github-repo-auto-sync"), self.tasks():
            sync_repos_for_org(self.oi.id)

        with assume_test_silo_mode(SiloMode.CELL):
            assert Repository.objects.count() == 0

    @patch("sentry.integrations.github.integration.GitHubIntegration.get_repositories")
    def test_api_timeout_halts(self, mock_get_repositories: MagicMock, _: MagicMock) -> None:
        mock_get_repositories.side_effect = ApiTimeoutError("timed out")

        with self.feature("organizations:github-repo-auto-sync"), self.tasks():
            sync_repos_for_org(self.oi.id)

        with assume_test_silo_mode(SiloMode.CELL):
            assert Repository.objects.count() == 0

    @patch("sentry.integrations.github.integration.GitHubIntegration.get_repositories")
    def test_too_many_redirects_halts(self, mock_get_repositories: MagicMock, _: MagicMock) -> None:
        mock_get_repositories.side_effect = TooManyRedirects("Exceeded 30 redirects")

        with self.feature("organizations:github-repo-auto-sync"), self.tasks():
            sync_repos_for_org(self.oi.id)

        with assume_test_silo_mode(SiloMode.CELL):
            assert Repository.objects.count() == 0

    @patch("sentry.integrations.github.integration.GitHubIntegration.get_repositories")
    def test_integration_configuration_error_halts(
        self, mock_get_repositories: MagicMock, _: MagicMock
    ) -> None:
        mock_get_repositories.side_effect = IntegrationConfigurationError("Identity not found.")

        with self.feature("organizations:github-repo-auto-sync"), self.tasks():
            sync_repos_for_org(self.oi.id)

        with assume_test_silo_mode(SiloMode.CELL):
            assert Repository.objects.count() == 0

    @patch("sentry.integrations.github.integration.GitHubIntegration.get_repositories")
    def test_identity_does_not_exist_halts(
        self, mock_get_repositories: MagicMock, _: MagicMock
    ) -> None:
        mock_get_repositories.side_effect = Identity.DoesNotExist()

        with self.feature("organizations:github-repo-auto-sync"), self.tasks():
            sync_repos_for_org(self.oi.id)

        with assume_test_silo_mode(SiloMode.CELL):
            assert Repository.objects.count() == 0

    @patch("sentry.integrations.github.integration.GitHubIntegration.get_repositories")
    def test_generic_api_error_still_raises(
        self, mock_get_repositories: MagicMock, _: MagicMock
    ) -> None:
        mock_get_repositories.side_effect = ApiError("Internal Server Error", code=500)

        with self.feature("organizations:github-repo-auto-sync"), self.tasks():
            with pytest.raises((ApiError, RetryTaskError)):
                sync_repos_for_org(self.oi.id)


@control_silo_test
class VstsIsBrokenIntegrationErrorTestCase(TestCase):
    """Tests for VstsIntegration.is_broken_integration_error override."""

    def setUp(self) -> None:
        super().setUp()
        self.integration = self.create_provider_integration(
            provider="vsts",
            external_id="vsts-test-id",
            name="test-vsts",
            metadata={"domain_name": "https://test.visualstudio.com/"},
        )
        self.integration.add_organization(self.organization, self.user)
        self.installation = self.integration.get_installation(organization_id=self.organization.id)

    def test_integration_error_wrapping_403(self) -> None:
        exc = IntegrationError("Error Communicating with Azure DevOps (HTTP 403): unknown error")
        exc.__context__ = ApiForbiddenError("Identity is Disabled")
        assert self.installation.is_broken_integration_error(exc) == "unauthorized"

    def test_integration_error_wrapping_404(self) -> None:
        exc = IntegrationError("Error Communicating with Azure DevOps (HTTP 404): unknown error")
        exc.__context__ = ApiError("Not Found", code=404)
        assert self.installation.is_broken_integration_error(exc) == "configuration_error"

    def test_integration_error_wrapping_401(self) -> None:
        exc = IntegrationError("wrapped")
        exc.__context__ = ApiUnauthorized("bad token")
        assert self.installation.is_broken_integration_error(exc) == "unauthorized"

    def test_integration_error_wrapping_500_not_terminal(self) -> None:
        exc = IntegrationError("Error Communicating with Azure DevOps (HTTP 500): unknown error")
        exc.__context__ = ApiError("Internal Server Error", code=500)
        assert self.installation.is_broken_integration_error(exc) is None

    def test_integration_error_wrapping_identity_not_valid_delegates_to_base(self) -> None:
        exc = IntegrationError("wrapped")
        exc.__context__ = IdentityNotValid()
        assert self.installation.is_broken_integration_error(exc) == "identity_not_valid"

    def test_non_integration_error_delegates_to_base(self) -> None:
        assert (
            self.installation.is_broken_integration_error(ApiUnauthorized("bad token"))
            == "unauthorized"
        )
