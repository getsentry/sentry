from sentry.constants import ObjectStatus
from sentry.preprod.vcs.repo_utils import get_integrated_repository
from sentry.testutils.cases import TestCase


class GetIntegratedRepositoryTest(TestCase):
    def test_skips_repository_without_integration(self) -> None:
        linked = self.create_repo(
            project=self.project,
            name="owner/repo",
            provider="integrations:github",
            integration_id=123,
            external_id="1",
        )
        self.create_repo(
            project=self.project,
            name="owner/repo",
            provider="integrations:github",
            external_id="2",
        )

        assert get_integrated_repository(self.organization.id, "owner/repo", "github") == linked

    def test_skips_inactive_repository(self) -> None:
        active = self.create_repo(
            project=self.project,
            name="owner/repo",
            provider="integrations:github",
            integration_id=123,
            external_id="1",
        )
        disabled = self.create_repo(
            project=self.project,
            name="owner/repo",
            provider="integrations:github",
            integration_id=123,
            external_id="2",
        )
        disabled.update(status=ObjectStatus.DISABLED)

        assert get_integrated_repository(self.organization.id, "owner/repo", "github") == active

    def test_prefers_newest_of_duplicate_active_repositories(self) -> None:
        self.create_repo(
            project=self.project,
            name="owner/repo",
            provider="integrations:github",
            integration_id=123,
            external_id="1",
        )
        newest = self.create_repo(
            project=self.project,
            name="owner/repo",
            provider="integrations:github",
            integration_id=123,
            external_id="2",
        )

        assert get_integrated_repository(self.organization.id, "owner/repo", "github") == newest
