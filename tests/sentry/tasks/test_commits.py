from unittest.mock import patch

from django.core import mail

from sentry.constants import ObjectStatus
from sentry.exceptions import InvalidIdentity, PluginError
from sentry.locks import locks
from sentry.models.commit import Commit
from sentry.models.deploy import Deploy
from sentry.models.integrations.integration import Integration
from sentry.models.latestreporeleaseenvironment import LatestRepoReleaseEnvironment
from sentry.models.release import Release
from sentry.models.releaseheadcommit import ReleaseHeadCommit
from sentry.models.repository import Repository
from sentry.silo import SiloMode
from sentry.tasks.commits import fetch_commits, handle_invalid_identity
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import assume_test_silo_mode, control_silo_test, region_silo_test
from social_auth.models import UserSocialAuth


@region_silo_test
class FetchCommitsTest(TestCase):
    def _test_simple_action(self, user, org):
        repo = Repository.objects.create(name="example", provider="dummy", organization_id=org.id)
        release = Release.objects.create(organization_id=org.id, version="abcabcabc")

        commit = Commit.objects.create(organization_id=org.id, repository_id=repo.id, key="a" * 40)

        ReleaseHeadCommit.objects.create(
            organization_id=org.id, repository_id=repo.id, release=release, commit=commit
        )

        refs = [{"repository": repo.name, "commit": "b" * 40}]

        release2 = Release.objects.create(organization_id=org.id, version="12345678")

        deploy = Deploy.objects.create(organization_id=org.id, release=release2, environment_id=5)

        with self.tasks():
            with patch.object(Deploy, "notify_if_ready") as mock_notify_if_ready:
                fetch_commits(
                    release_id=release2.id,
                    user_id=user.id,
                    refs=refs,
                    previous_release_id=release.id,
                )

        commit_list = list(
            Commit.objects.filter(releasecommit__release=release2).order_by("releasecommit__order")
        )

        # see DummyRepositoryProvider.compare_commits
        assert len(commit_list) == 3
        assert commit_list[0].repository_id == repo.id
        assert commit_list[0].organization_id == org.id
        assert commit_list[0].key == "62de626b7c7cfb8e77efb4273b1a3df4123e6216"
        assert commit_list[1].repository_id == repo.id
        assert commit_list[1].organization_id == org.id
        assert commit_list[1].key == "58de626b7c7cfb8e77efb4273b1a3df4123e6345"
        assert commit_list[2].repository_id == repo.id
        assert commit_list[2].organization_id == org.id
        assert commit_list[2].key == "b" * 40

        mock_notify_if_ready.assert_called_with(deploy.id, fetch_complete=True)

        latest_repo_release_environment = LatestRepoReleaseEnvironment.objects.get(
            repository_id=repo.id, environment_id=5
        )
        assert latest_repo_release_environment.deploy_id == deploy.id
        assert latest_repo_release_environment.release_id == release2.id
        assert latest_repo_release_environment.commit_id == commit_list[0].id

    def test_simple(self):
        self.login_as(user=self.user)
        org = self.create_organization(owner=self.user, name="baz")
        self._test_simple_action(user=self.user, org=org)

    def test_duplicate_repositories(self):
        self.login_as(user=self.user)
        org = self.create_organization(owner=self.user, name="baz")
        Repository.objects.create(
            name="example", provider="dummy", organization_id=org.id, status=ObjectStatus.DISABLED
        )
        Repository.objects.create(name="example", provider="dummy", organization_id=org.id)
        self._test_simple_action(user=self.user, org=org)

    def test_simple_owner_from_team(self):
        user = self.create_user()
        self.login_as(user=user)
        org = self.create_organization(name="baz")
        owner_team = self.create_team(organization=org, org_role="owner")
        self.create_member(organization=org, user=user, teams=[owner_team])
        self._test_simple_action(user=user, org=org)

    def test_release_locked(self):
        self.login_as(user=self.user)
        org = self.create_organization(owner=self.user, name="baz")
        repo = Repository.objects.create(name="example", provider="dummy", organization_id=org.id)

        old_release = Release.objects.create(organization_id=org.id, version="abcabcabc")
        commit = Commit.objects.create(organization_id=org.id, repository_id=repo.id, key="a" * 40)
        ReleaseHeadCommit.objects.create(
            organization_id=org.id, repository_id=repo.id, release=old_release, commit=commit
        )

        refs = [{"repository": repo.name, "commit": "b" * 40}]
        new_release = Release.objects.create(organization_id=org.id, version="12345678")

        lock = locks.get(Release.get_lock_key(org.id, new_release.id), duration=10, name="release")
        lock.acquire()

        with self.tasks():
            fetch_commits(
                release_id=new_release.id,
                user_id=self.user.id,
                refs=refs,
                previous_release_id=old_release.id,
            )
        count_query = ReleaseHeadCommit.objects.filter(release=new_release)
        # No release commits should be made as the task should return early.
        assert count_query.count() == 0

    @patch("sentry.tasks.commits.handle_invalid_identity")
    @patch("sentry.plugins.providers.dummy.repository.DummyRepositoryProvider.compare_commits")
    def test_fetch_error_invalid_identity(self, mock_compare_commits, mock_handle_invalid_identity):
        self.login_as(user=self.user)
        org = self.create_organization(owner=self.user, name="baz")

        repo = Repository.objects.create(name="example", provider="dummy", organization_id=org.id)
        release = Release.objects.create(organization_id=org.id, version="abcabcabc")

        commit = Commit.objects.create(organization_id=org.id, repository_id=repo.id, key="a" * 40)

        ReleaseHeadCommit.objects.create(
            organization_id=org.id, repository_id=repo.id, release=release, commit=commit
        )

        refs = [{"repository": repo.name, "commit": "b" * 40}]

        release2 = Release.objects.create(organization_id=org.id, version="12345678")

        with assume_test_silo_mode(SiloMode.CONTROL):
            usa = UserSocialAuth.objects.create(user=self.user, provider="dummy")

        mock_compare_commits.side_effect = InvalidIdentity(identity=usa)

        fetch_commits(
            release_id=release2.id, user_id=self.user.id, refs=refs, previous_release_id=release.id
        )

        mock_handle_invalid_identity.assert_called_once_with(identity=usa, commit_failure=True)

    @patch("sentry.plugins.providers.dummy.repository.DummyRepositoryProvider.compare_commits")
    def test_fetch_error_plugin_error(self, mock_compare_commits):
        self.login_as(user=self.user)
        org = self.create_organization(owner=self.user, name="baz")

        repo = Repository.objects.create(name="example", provider="dummy", organization_id=org.id)
        release = Release.objects.create(organization_id=org.id, version="abcabcabc")

        commit = Commit.objects.create(organization_id=org.id, repository_id=repo.id, key="a" * 40)

        ReleaseHeadCommit.objects.create(
            organization_id=org.id, repository_id=repo.id, release=release, commit=commit
        )

        refs = [{"repository": repo.name, "commit": "b" * 40}]

        release2 = Release.objects.create(organization_id=org.id, version="12345678")

        with assume_test_silo_mode(SiloMode.CONTROL):
            UserSocialAuth.objects.create(user=self.user, provider="dummy")

        mock_compare_commits.side_effect = Exception("secrets")

        with self.tasks():
            fetch_commits(
                release_id=release2.id,
                user_id=self.user.id,
                refs=refs,
                previous_release_id=release.id,
            )

        msg = mail.outbox[-1]
        assert msg.subject == "Unable to Fetch Commits"
        assert msg.to == [self.user.email]
        assert "secrets" not in msg.body

    @patch("sentry.plugins.providers.dummy.repository.DummyRepositoryProvider.compare_commits")
    def test_fetch_error_plugin_error_for_sentry_app(self, mock_compare_commits):
        org = self.create_organization(owner=self.user, name="baz")
        sentry_app = self.create_sentry_app(
            organization=org, published=True, verify_install=False, name="Super Awesome App"
        )

        repo = Repository.objects.create(name="example", provider="dummy", organization_id=org.id)
        release = Release.objects.create(organization_id=org.id, version="abcabcabc")

        commit = Commit.objects.create(organization_id=org.id, repository_id=repo.id, key="a" * 40)

        ReleaseHeadCommit.objects.create(
            organization_id=org.id, repository_id=repo.id, release=release, commit=commit
        )

        refs = [{"repository": repo.name, "commit": "b" * 40}]

        release2 = Release.objects.create(organization_id=org.id, version="12345678")

        mock_compare_commits.side_effect = Exception("secrets")

        with self.tasks():
            fetch_commits(
                release_id=release2.id,
                user_id=sentry_app.proxy_user_id,
                refs=refs,
                previous_release_id=release.id,
            )

        msg = mail.outbox[-1]
        assert msg.subject == "Unable to Fetch Commits"
        assert msg.to == [self.user.email]
        assert "secrets" not in msg.body

    @patch("sentry.plugins.providers.dummy.repository.DummyRepositoryProvider.compare_commits")
    def test_fetch_error_random_exception(self, mock_compare_commits):
        self.login_as(user=self.user)
        org = self.create_organization(owner=self.user, name="baz")

        repo = Repository.objects.create(name="example", provider="dummy", organization_id=org.id)
        release = Release.objects.create(organization_id=org.id, version="abcabcabc")

        commit = Commit.objects.create(organization_id=org.id, repository_id=repo.id, key="a" * 40)

        ReleaseHeadCommit.objects.create(
            organization_id=org.id, repository_id=repo.id, release=release, commit=commit
        )

        refs = [{"repository": repo.name, "commit": "b" * 40}]

        release2 = Release.objects.create(organization_id=org.id, version="12345678")

        with assume_test_silo_mode(SiloMode.CONTROL):
            UserSocialAuth.objects.create(user=self.user, provider="dummy")

        mock_compare_commits.side_effect = PluginError("You can read me")

        with self.tasks():
            fetch_commits(
                release_id=release2.id,
                user_id=self.user.id,
                refs=refs,
                previous_release_id=release.id,
            )

        msg = mail.outbox[-1]
        assert msg.subject == "Unable to Fetch Commits"
        assert msg.to == [self.user.email]
        assert "You can read me" in msg.body

    def test_fetch_error_random_exception_integration(self):
        self.login_as(user=self.user)
        org = self.create_organization(owner=self.user, name="baz")

        with assume_test_silo_mode(SiloMode.CONTROL):
            integration = Integration.objects.create(provider="example", name="Example")
            integration.add_organization(org)

        repo = Repository.objects.create(
            name="example",
            provider="integrations:example",
            organization_id=org.id,
            integration_id=integration.id,
        )
        release = Release.objects.create(organization_id=org.id, version="abcabcabc")

        commit = Commit.objects.create(organization_id=org.id, repository_id=repo.id, key="a" * 40)

        ReleaseHeadCommit.objects.create(
            organization_id=org.id, repository_id=repo.id, release=release, commit=commit
        )

        refs = [{"repository": repo.name, "commit": "b" * 40}]

        release2 = Release.objects.create(organization_id=org.id, version="12345678")

        with self.tasks():
            fetch_commits(
                release_id=release2.id,
                user_id=self.user.id,
                refs=refs,
                previous_release_id=release.id,
            )

        msg = mail.outbox[-1]
        assert msg.subject == "Unable to Fetch Commits"
        assert msg.to == [self.user.email]
        assert "Repository not found" in msg.body


@control_silo_test
class HandleInvalidIdentityTest(TestCase):
    def test_simple(self):
        usa = UserSocialAuth.objects.create(user=self.user, provider="dummy")

        with self.tasks():
            handle_invalid_identity(usa)

        assert not UserSocialAuth.objects.filter(id=usa.id).exists()

        msg = mail.outbox[-1]
        assert msg.subject == "Action Required"
        assert msg.to == [self.user.email]

    def test_commit_failure(self):
        usa = UserSocialAuth.objects.create(user=self.user, provider="dummy")

        with self.tasks():
            handle_invalid_identity(usa, commit_failure=True)

        assert not UserSocialAuth.objects.filter(id=usa.id).exists()

        msg = mail.outbox[-1]
        assert msg.subject == "Unable to Fetch Commits"
        assert msg.to == [self.user.email]
