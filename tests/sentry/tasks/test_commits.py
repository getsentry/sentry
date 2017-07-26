from __future__ import absolute_import

from mock import patch

from sentry.models import Commit, Deploy, Release, ReleaseHeadCommit, Repository
from sentry.tasks.commits import fetch_commits
from sentry.testutils import TestCase


class FetchCommits(TestCase):
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
