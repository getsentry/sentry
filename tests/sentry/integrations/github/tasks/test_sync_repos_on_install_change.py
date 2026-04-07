from unittest.mock import MagicMock, patch

from sentry.constants import ObjectStatus
from sentry.integrations.github.integration import GitHubIntegrationProvider
from sentry.integrations.github.tasks.sync_repos_on_install_change import (
    sync_repos_on_install_change,
)
from sentry.models.repository import Repository
from sentry.silo.base import SiloMode
from sentry.testutils.cases import IntegrationTestCase
from sentry.testutils.silo import assume_test_silo_mode, control_silo_test

FEATURE_FLAG = "organizations:github-repo-auto-sync"


@control_silo_test
@patch("sentry.integrations.github.client.get_jwt", return_value="jwt_token_1")
class SyncReposOnInstallChangeTestCase(IntegrationTestCase):
    provider = GitHubIntegrationProvider
    base_url = "https://api.github.com"
    key = "github"

    def _make_repos_added(self):
        return [
            {"id": 1, "full_name": "getsentry/sentry", "private": False},
            {"id": 2, "full_name": "getsentry/snuba", "private": False},
        ]

    def _make_repos_removed(self):
        return [
            {"id": 3, "full_name": "getsentry/old-repo", "private": False},
        ]

    def test_repos_added(self, _: MagicMock) -> None:
        with self.feature(FEATURE_FLAG):
            sync_repos_on_install_change(
                integration_id=self.integration.id,
                action="added",
                repos_added=self._make_repos_added(),
                repos_removed=[],
                repository_selection="selected",
            )

        with assume_test_silo_mode(SiloMode.CELL):
            repos = Repository.objects.filter(organization_id=self.organization.id).order_by("name")

        assert len(repos) == 2
        assert repos[0].name == "getsentry/sentry"
        assert repos[0].provider == "integrations:github"
        assert repos[0].integration_id == self.integration.id
        assert repos[1].name == "getsentry/snuba"

    def test_repos_removed(self, _: MagicMock) -> None:
        with assume_test_silo_mode(SiloMode.CELL):
            repo = Repository.objects.create(
                organization_id=self.organization.id,
                name="getsentry/old-repo",
                external_id="3",
                provider="integrations:github",
                integration_id=self.integration.id,
                status=ObjectStatus.ACTIVE,
            )

        with self.feature(FEATURE_FLAG):
            sync_repos_on_install_change(
                integration_id=self.integration.id,
                action="removed",
                repos_added=[],
                repos_removed=self._make_repos_removed(),
                repository_selection="selected",
            )

        with assume_test_silo_mode(SiloMode.CELL):
            repo.refresh_from_db()
            assert repo.status == ObjectStatus.DISABLED

    def test_mixed_add_and_remove(self, _: MagicMock) -> None:
        with assume_test_silo_mode(SiloMode.CELL):
            old_repo = Repository.objects.create(
                organization_id=self.organization.id,
                name="getsentry/old-repo",
                external_id="3",
                provider="integrations:github",
                integration_id=self.integration.id,
                status=ObjectStatus.ACTIVE,
            )

        with self.feature(FEATURE_FLAG):
            sync_repos_on_install_change(
                integration_id=self.integration.id,
                action="added",
                repos_added=self._make_repos_added(),
                repos_removed=self._make_repos_removed(),
                repository_selection="selected",
            )

        with assume_test_silo_mode(SiloMode.CELL):
            old_repo.refresh_from_db()
            assert old_repo.status == ObjectStatus.DISABLED

            active_repos = Repository.objects.filter(
                organization_id=self.organization.id,
                status=ObjectStatus.ACTIVE,
            ).order_by("name")
            assert len(active_repos) == 2
            assert active_repos[0].name == "getsentry/sentry"
            assert active_repos[1].name == "getsentry/snuba"

    def test_multi_org(self, _: MagicMock) -> None:
        other_org = self.create_organization(owner=self.user)
        self.create_organization_integration(
            organization_id=other_org.id,
            integration=self.integration,
        )

        with self.feature(FEATURE_FLAG):
            sync_repos_on_install_change(
                integration_id=self.integration.id,
                action="added",
                repos_added=self._make_repos_added(),
                repos_removed=[],
                repository_selection="selected",
            )

        with assume_test_silo_mode(SiloMode.CELL):
            repos_org1 = Repository.objects.filter(organization_id=self.organization.id)
            repos_org2 = Repository.objects.filter(organization_id=other_org.id)

        assert len(repos_org1) == 2
        assert len(repos_org2) == 2

    def test_missing_integration(self, _: MagicMock) -> None:
        sync_repos_on_install_change(
            integration_id=0,
            action="added",
            repos_added=self._make_repos_added(),
            repos_removed=[],
            repository_selection="selected",
        )

        with assume_test_silo_mode(SiloMode.CELL):
            assert Repository.objects.count() == 0

    def test_inactive_integration(self, _: MagicMock) -> None:
        self.integration.update(status=ObjectStatus.DISABLED)

        sync_repos_on_install_change(
            integration_id=self.integration.id,
            action="added",
            repos_added=self._make_repos_added(),
            repos_removed=[],
            repository_selection="selected",
        )

        with assume_test_silo_mode(SiloMode.CELL):
            assert Repository.objects.count() == 0

    def test_feature_flag_off(self, _: MagicMock) -> None:
        sync_repos_on_install_change(
            integration_id=self.integration.id,
            action="added",
            repos_added=self._make_repos_added(),
            repos_removed=[],
            repository_selection="selected",
        )

        with assume_test_silo_mode(SiloMode.CELL):
            assert Repository.objects.count() == 0

    def test_empty_repos_is_noop(self, _: MagicMock) -> None:
        with self.feature(FEATURE_FLAG):
            sync_repos_on_install_change(
                integration_id=self.integration.id,
                action="added",
                repos_added=[],
                repos_removed=[],
                repository_selection="selected",
            )

        with assume_test_silo_mode(SiloMode.CELL):
            assert Repository.objects.count() == 0

    def test_does_not_disable_already_disabled_repos(self, _: MagicMock) -> None:
        with assume_test_silo_mode(SiloMode.CELL):
            repo = Repository.objects.create(
                organization_id=self.organization.id,
                name="getsentry/old-repo",
                external_id="3",
                provider="integrations:github",
                integration_id=self.integration.id,
                status=ObjectStatus.DISABLED,
            )

        with self.feature(FEATURE_FLAG):
            sync_repos_on_install_change(
                integration_id=self.integration.id,
                action="removed",
                repos_added=[],
                repos_removed=self._make_repos_removed(),
                repository_selection="selected",
            )

        with assume_test_silo_mode(SiloMode.CELL):
            repo.refresh_from_db()
            assert repo.status == ObjectStatus.DISABLED
