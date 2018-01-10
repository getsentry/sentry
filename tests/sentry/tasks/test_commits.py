from __future__ import absolute_import

from django.core import mail
from mock import patch
from social_auth.models import UserSocialAuth

from sentry.exceptions import InvalidIdentity, PluginError
from sentry.models import PullRequest, Commit, Deploy, Release, ReleaseHeadCommit, Repository
from sentry.tasks.commits import fetch_commits, handle_invalid_identity
from sentry.testutils import TestCase


class FetchCommitsTest(TestCase):
    def test_simple(self):
        self.login_as(user=self.user)
        org = self.create_organization(owner=self.user, name='baz')

        repo = Repository.objects.create(
            name='example',
            provider='dummy',
            organization_id=org.id,
        )
        release = Release.objects.create(
            organization_id=org.id,
            version='abcabcabc',
        )

        commit = Commit.objects.create(
            organization_id=org.id,
            repository_id=repo.id,
            key='a' * 40,
        )

        ReleaseHeadCommit.objects.create(
            organization_id=org.id,
            repository_id=repo.id,
            release=release,
            commit=commit,
        )

        refs = [{
            'repository': repo.name,
            'commit': 'b' * 40,
        }]

        release2 = Release.objects.create(
            organization_id=org.id,
            version='12345678',
        )

        deploy = Deploy.objects.create(
            organization_id=org.id,
            release=release2,
            environment_id=5,
        )

        with self.tasks():
            with patch.object(Deploy, 'notify_if_ready') as mock_notify_if_ready:
                fetch_commits(
                    release_id=release2.id,
                    user_id=self.user.id,
                    refs=refs,
                    previous_release_id=release.id,
                )

        commit_list = list(
            Commit.objects.filter(
                releasecommit__release=release2,
            ).order_by('releasecommit__order')
        )

        # see DummyRepositoryProvider.compare_commits
        assert len(commit_list) == 3
        assert commit_list[0].repository_id == repo.id
        assert commit_list[0].organization_id == org.id
        assert commit_list[0].key == '62de626b7c7cfb8e77efb4273b1a3df4123e6216'
        assert commit_list[1].repository_id == repo.id
        assert commit_list[1].organization_id == org.id
        assert commit_list[1].key == '58de626b7c7cfb8e77efb4273b1a3df4123e6345'
        assert commit_list[2].repository_id == repo.id
        assert commit_list[2].organization_id == org.id
        assert commit_list[2].key == 'b' * 40

        mock_notify_if_ready.assert_called_with(deploy.id, fetch_complete=True)

    @patch('sentry.tasks.commits.handle_invalid_identity')
    @patch('sentry.plugins.providers.dummy.repository.DummyRepositoryProvider.compare_commits')
    def test_fetch_error_invalid_identity(self, mock_compare_commits, mock_handle_invalid_identity):
        self.login_as(user=self.user)
        org = self.create_organization(owner=self.user, name='baz')

        repo = Repository.objects.create(
            name='example',
            provider='dummy',
            organization_id=org.id,
        )
        release = Release.objects.create(
            organization_id=org.id,
            version='abcabcabc',
        )

        commit = Commit.objects.create(
            organization_id=org.id,
            repository_id=repo.id,
            key='a' * 40,
        )

        ReleaseHeadCommit.objects.create(
            organization_id=org.id,
            repository_id=repo.id,
            release=release,
            commit=commit,
        )

        refs = [{
            'repository': repo.name,
            'commit': 'b' * 40,
        }]

        release2 = Release.objects.create(
            organization_id=org.id,
            version='12345678',
        )

        usa = UserSocialAuth.objects.create(
            user=self.user,
            provider='dummy',
        )

        mock_compare_commits.side_effect = InvalidIdentity(identity=usa)

        fetch_commits(
            release_id=release2.id,
            user_id=self.user.id,
            refs=refs,
            previous_release_id=release.id,
        )

        mock_handle_invalid_identity.assert_called_once_with(
            identity=usa,
            commit_failure=True,
        )

    @patch('sentry.plugins.providers.dummy.repository.DummyRepositoryProvider.compare_commits')
    def test_fetch_error_plugin_error(self, mock_compare_commits):
        self.login_as(user=self.user)
        org = self.create_organization(owner=self.user, name='baz')

        repo = Repository.objects.create(
            name='example',
            provider='dummy',
            organization_id=org.id,
        )
        release = Release.objects.create(
            organization_id=org.id,
            version='abcabcabc',
        )

        commit = Commit.objects.create(
            organization_id=org.id,
            repository_id=repo.id,
            key='a' * 40,
        )

        ReleaseHeadCommit.objects.create(
            organization_id=org.id,
            repository_id=repo.id,
            release=release,
            commit=commit,
        )

        refs = [{
            'repository': repo.name,
            'commit': 'b' * 40,
        }]

        release2 = Release.objects.create(
            organization_id=org.id,
            version='12345678',
        )

        UserSocialAuth.objects.create(
            user=self.user,
            provider='dummy',
        )

        mock_compare_commits.side_effect = Exception('secrets')

        with self.tasks():
            fetch_commits(
                release_id=release2.id,
                user_id=self.user.id,
                refs=refs,
                previous_release_id=release.id,
            )

        msg = mail.outbox[-1]
        assert msg.subject == 'Unable to Fetch Commits'
        assert msg.to == [self.user.email]
        assert 'secrets' not in msg.body

    @patch('sentry.plugins.providers.dummy.repository.DummyRepositoryProvider.compare_commits')
    def test_fetch_error_random_exception(self, mock_compare_commits):
        self.login_as(user=self.user)
        org = self.create_organization(owner=self.user, name='baz')

        repo = Repository.objects.create(
            name='example',
            provider='dummy',
            organization_id=org.id,
        )
        release = Release.objects.create(
            organization_id=org.id,
            version='abcabcabc',
        )

        commit = Commit.objects.create(
            organization_id=org.id,
            repository_id=repo.id,
            key='a' * 40,
        )

        ReleaseHeadCommit.objects.create(
            organization_id=org.id,
            repository_id=repo.id,
            release=release,
            commit=commit,
        )

        refs = [{
            'repository': repo.name,
            'commit': 'b' * 40,
        }]

        release2 = Release.objects.create(
            organization_id=org.id,
            version='12345678',
        )

        UserSocialAuth.objects.create(
            user=self.user,
            provider='dummy',
        )

        mock_compare_commits.side_effect = PluginError('You can read me')

        with self.tasks():
            fetch_commits(
                release_id=release2.id,
                user_id=self.user.id,
                refs=refs,
                previous_release_id=release.id,
            )

        msg = mail.outbox[-1]
        assert msg.subject == 'Unable to Fetch Commits'
        assert msg.to == [self.user.email]
        assert 'You can read me' in msg.body


class HandleInvalidIdentityTest(TestCase):
    def test_simple(self):
        usa = UserSocialAuth.objects.create(
            user=self.user,
            provider='dummy',
        )

        with self.tasks():
            handle_invalid_identity(usa)

        assert not UserSocialAuth.objects.filter(id=usa.id).exists()

        msg = mail.outbox[-1]
        assert msg.subject == 'Action Required'
        assert msg.to == [self.user.email]

    def test_commit_failure(self):
        usa = UserSocialAuth.objects.create(
            user=self.user,
            provider='dummy',
        )

        with self.tasks():
            handle_invalid_identity(usa, commit_failure=True)

        assert not UserSocialAuth.objects.filter(id=usa.id).exists()

        msg = mail.outbox[-1]
        assert msg.subject == 'Unable to Fetch Commits'
        assert msg.to == [self.user.email]


class FetchPRCommitsTest(TestCase):
    def test_simple(self):
        self.login_as(user=self.user)
        org = self.create_organization(owner=self.user, name='baz')

        repo = Repository.objects.create(
            name='example',
            provider='dummy',
            organization_id=org.id,
        )

        pull_request = PullRequest.objects.create(
            organization_id=org.id,
            repository_id=repo.id,
            key="10",
            title="cool pr",
            message="it does stuff",
        )

        Commit.objects.create(
            organization_id=org.id,
            repository_id=repo.id,
            key='62de626b7c7cfb8e77efb4273b1a3df4123e6216',
        )

        Commit.objects.create(
            organization_id=org.id,
            repository_id=repo.id,
            key='58de626b7c7cfb8e77efb4273b1a3df4123e6345',
        )

        with self.tasks():
            pull_request.fetch_commits(user=self.user)

        pull_request.save()
        commits = pull_request.commits.all()

        assert len(commits) == 2

    def test_missing_repo(self):
        self.login_as(user=self.user)
        org = self.create_organization(owner=self.user, name='baz')

        pull_request = PullRequest.objects.create(
            organization_id=org.id,
            repository_id=10,
            key="10",
            title="cool pr",
            message="it does stuff",
        )

        try:
            with self.tasks():
                pull_request.fetch_commits(user=self.user)
        except Repository.DoesNotExist as e:
            assert e

    @patch('sentry.plugins.providers.dummy.repository.DummyRepositoryProvider.get_pr_commits')
    def test_pr_fetch_error(self, mock_get_pr_commits):
        self.login_as(user=self.user)
        org = self.create_organization(owner=self.user, name='baz')

        repo = Repository.objects.create(
            name='example',
            provider='dummy',
            organization_id=org.id,
        )

        pull_request = PullRequest.objects.create(
            organization_id=org.id,
            repository_id=repo.id,
            key="1",
            title="cool pr",
            message="it does stuff",
        )

        mock_get_pr_commits.side_effect = PluginError('You can read me')

        with self.tasks():
            pull_request.fetch_commits(user=self.user)

        msg = mail.outbox[-1]
        assert msg.subject == 'Unable to Fetch Commits'
        assert msg.to == [self.user.email]
        assert 'You can read me' in msg.body
        assert 'pull request' in msg.body

    @patch('sentry.tasks.commits.handle_invalid_identity')
    @patch('sentry.plugins.providers.dummy.repository.DummyRepositoryProvider.get_pr_commits')
    def test_pr_identity_error(self, mock_get_pr_commits, mock_handle_invalid_identity):
        self.login_as(user=self.user)
        org = self.create_organization(owner=self.user, name='baz')

        repo = Repository.objects.create(
            name='example',
            provider='dummy',
            organization_id=org.id,
        )

        pull_request = PullRequest.objects.create(
            organization_id=org.id,
            repository_id=repo.id,
            key="1",
            title="cool pr",
            message="it does stuff",
        )

        usa = UserSocialAuth.objects.create(
            user=self.user,
            provider='dummy',
        )
        mock_get_pr_commits.side_effect = InvalidIdentity(identity=usa)

        with self.tasks():
            pull_request.fetch_commits(user=self.user)

        mock_handle_invalid_identity.assert_called_once_with(
            identity=usa,
            commit_failure=True,
        )
