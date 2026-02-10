from sentry.constants import ObjectStatus
from sentry.seer.utils import filter_repo_by_provider
from sentry.testutils.cases import TestCase


class TestFilterRepoByProvider(TestCase):
    def test_matches_with_integrations_prefix(self):
        repo = self.create_repo(
            project=self.project,
            name="getsentry/sentry",
            provider="integrations:github",
            external_id="123",
        )
        qs = filter_repo_by_provider(self.organization.id, "github", "123", "getsentry", "sentry")
        assert list(qs) == [repo]

    def test_matches_with_exact_provider(self):
        repo = self.create_repo(
            project=self.project,
            name="getsentry/sentry",
            provider="integrations:github",
            external_id="123",
        )
        qs = filter_repo_by_provider(
            self.organization.id, "integrations:github", "123", "getsentry", "sentry"
        )
        assert list(qs) == [repo]

    def test_no_match_wrong_owner(self):
        self.create_repo(
            project=self.project,
            name="getsentry/sentry",
            provider="integrations:github",
            external_id="123",
        )
        qs = filter_repo_by_provider(self.organization.id, "github", "123", "wrong-owner", "sentry")
        assert not qs.exists()

    def test_no_match_wrong_name(self):
        self.create_repo(
            project=self.project,
            name="getsentry/sentry",
            provider="integrations:github",
            external_id="123",
        )
        qs = filter_repo_by_provider(
            self.organization.id, "github", "123", "getsentry", "wrong-name"
        )
        assert not qs.exists()

    def test_no_match_wrong_external_id(self):
        self.create_repo(
            project=self.project,
            name="getsentry/sentry",
            provider="integrations:github",
            external_id="123",
        )
        qs = filter_repo_by_provider(self.organization.id, "github", "999", "getsentry", "sentry")
        assert not qs.exists()

    def test_no_match_wrong_org(self):
        other_org = self.create_organization(owner=self.user)
        self.create_repo(
            project=self.project,
            name="getsentry/sentry",
            provider="integrations:github",
            external_id="123",
        )
        qs = filter_repo_by_provider(other_org.id, "github", "123", "getsentry", "sentry")
        assert not qs.exists()

    def test_excludes_inactive_repo(self):
        repo = self.create_repo(
            project=self.project,
            name="getsentry/sentry",
            provider="integrations:github",
            external_id="123",
        )
        repo.status = ObjectStatus.DISABLED
        repo.save()

        qs = filter_repo_by_provider(self.organization.id, "github", "123", "getsentry", "sentry")
        assert not qs.exists()

    def test_github_enterprise_provider(self):
        repo = self.create_repo(
            project=self.project,
            name="mycompany/internal-repo",
            provider="integrations:github_enterprise",
            external_id="789",
        )
        qs = filter_repo_by_provider(
            self.organization.id, "github_enterprise", "789", "mycompany", "internal-repo"
        )
        assert list(qs) == [repo]
