from unittest.mock import MagicMock, patch

import pytest
import responses
from taskbroker_client.retry import RetryTaskError

from sentry import audit_log
from sentry.constants import ObjectStatus
from sentry.integrations.github.integration import GitHubIntegrationProvider
from sentry.integrations.github.tasks.sync_repos import sync_repos_for_org
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.models.auditlogentry import AuditLogEntry
from sentry.models.repository import Repository
from sentry.silo.base import SiloMode
from sentry.testutils.cases import IntegrationTestCase
from sentry.testutils.silo import assume_test_silo_mode, assume_test_silo_mode_of, control_silo_test


@control_silo_test
@patch("sentry.integrations.github.client.get_jwt", return_value="jwt_token_1")
class SyncReposForOrgTestCase(IntegrationTestCase):
    provider = GitHubIntegrationProvider
    base_url = "https://api.github.com"
    key = "github"

    def setUp(self):
        super().setUp()
        self.oi = OrganizationIntegration.objects.get(
            organization_id=self.organization.id, integration=self.integration
        )

    def _add_repos_response(self, repos):
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
                {"id": 1, "full_name": "getsentry/sentry"},
                {"id": 2, "full_name": "getsentry/snuba"},
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
        self._add_repos_response([{"id": 1, "full_name": "getsentry/sentry"}])

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
        self._add_repos_response([{"id": 1, "full_name": "getsentry/sentry"}])

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

        self._add_repos_response([{"id": 1, "full_name": "getsentry/sentry"}])

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
                {"id": 1, "full_name": "getsentry/sentry"},
                {"id": 2, "full_name": "getsentry/snuba"},
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
