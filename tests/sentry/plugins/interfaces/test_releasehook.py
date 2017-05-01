"""
sentry.plugins.base.structs
~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2013 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import, print_function

__all__ = ['ReleaseHook']

from mock import patch

from django.utils import timezone

from datetime import timedelta

from sentry.models import Commit, Release, ReleaseCommit, ReleaseHeadCommit, ReleaseProject, Repository, User
from sentry.plugins import ReleaseHook
from sentry.testutils import TestCase


class StartReleaseTest(TestCase):
    def test_minimal(self):
        project = self.create_project()
        version = 'bbee5b51f84611e4b14834363b8514c2'

        hook = ReleaseHook(project)
        hook.start_release(version)

        release = Release.objects.get(
            organization_id=project.organization_id,
            version=version,
        )
        assert release.organization
        assert ReleaseProject.objects.get(release=release, project=project)

    def test_update_release(self):
        project = self.create_project()
        version = 'bbee5b51f84611e4b14834363b8514c2'
        r = Release.objects.create(organization_id=project.organization_id, version=version)
        r.add_project(project)

        hook = ReleaseHook(project)
        hook.start_release(version)

        release = Release.objects.get(
            organization_id=project.organization_id,
            projects=project,
            version=version,
        )
        assert release.organization == project.organization


class FinishReleaseTest(TestCase):
    def test_minimal(self):
        project = self.create_project()
        version = 'bbee5b51f84611e4b14834363b8514c2'

        hook = ReleaseHook(project)
        hook.finish_release(version)

        release = Release.objects.get(
            organization_id=project.organization_id,
            version=version,
        )
        assert release.date_released
        assert release.organization
        assert ReleaseProject.objects.get(release=release, project=project)

    def test_update_release(self):
        project = self.create_project()
        version = 'bbee5b51f84611e4b14834363b8514c2'
        r = Release.objects.create(organization_id=project.organization_id, version=version)
        r.add_project(project)

        hook = ReleaseHook(project)
        hook.start_release(version)

        release = Release.objects.get(
            projects=project,
            version=version,
        )
        assert release.organization == project.organization


class SetCommitsTest(TestCase):
    def test_minimal(self):
        project = self.create_project()
        version = 'bbee5b51f84611e4b14834363b8514c2'
        data_list = [
            {
                'id': 'c7155651831549cf8a5e47889fce17eb',
                'message': 'foo',
                'author_email': 'jane@example.com',
            },
            {
                'id': 'bbee5b51f84611e4b14834363b8514c2',
                'message': 'bar',
                'author_name': 'Joe^^',
            },
        ]

        hook = ReleaseHook(project)
        hook.set_commits(version, data_list)

        release = Release.objects.get(
            projects=project,
            version=version,
        )
        commit_list = list(Commit.objects.filter(
            releasecommit__release=release,
        ).select_related(
            'author',
        ).order_by('releasecommit__order'))

        assert len(commit_list) == 2
        assert commit_list[0].key == 'c7155651831549cf8a5e47889fce17eb'
        assert commit_list[0].message == 'foo'
        assert commit_list[0].author.name is None
        assert commit_list[0].author.email == 'jane@example.com'
        assert commit_list[1].key == 'bbee5b51f84611e4b14834363b8514c2'
        assert commit_list[1].message == 'bar'
        assert commit_list[1].author.name == 'Joe^^'
        assert commit_list[1].author.email == 'joe@localhost'


class SetRefsTest(TestCase):
    """
    tests that when finish_release is called on a release hook,
    we try to get the previous commits based on the version ref
    and that we create `ReleaseHeadCommit`s for the version
    """
    @patch('sentry.tasks.commits.fetch_commits')
    def test_minimal(self, mock_fetch_commits):
        project = self.create_project()
        version = 'bbee5b51f84611e4b14834363b8514c2'
        data_list = [
            {
                'id': 'c7155651831549cf8a5e47889fce17eb',
                'message': 'foo',
                'author_email': 'jane@example.com',
            },
            {
                'id': '62de626b7c7cfb8e77efb4273b1a3df4123e6216',
                'message': 'hello',
                'author_name': 'Jess',
            },
            {
                'id': '58de626b7c7cfb8e77efb4273b1a3df4123e6345',
                'message': 'bar',
                'author_name': 'Joe^^',
            },
            {
                'id': 'bbee5b51f84611e4b14834363b8514c2',
                'message': 'blah',
                'author_email': 'katie@example.com',
            },
        ]
        user = User.objects.create(email='stebe@sentry.io')
        repo = Repository.objects.create(
            organization_id=project.organization_id,
            name=project.name,
            provider='dummy',
        )
        for data in data_list:
            Commit.objects.create(
                key=data['id'],
                organization_id=self.project.organization_id,
                repository_id=repo.id
            )

        old_release = Release.objects.create(
            version='a' * 40,
            organization_id=project.organization_id,
            date_added=timezone.now() - timedelta(minutes=30),
        )
        old_release.add_project(project)

        ReleaseCommit.objects.create(
            organization_id=project.organization_id,
            project_id=project.id,
            release=old_release,
            commit=Commit.objects.get(key='c7155651831549cf8a5e47889fce17eb'),
            order=0,
        )
        ReleaseHeadCommit.objects.create(
            organization_id=project.organization_id,
            repository_id=repo.id,
            release=old_release,
            commit=Commit.objects.get(key='c7155651831549cf8a5e47889fce17eb'))
        release_heads = ReleaseHeadCommit.objects.filter(
            organization_id=project.organization_id,
            repository_id=repo.id,
            commit=Commit.objects.get(key='bbee5b51f84611e4b14834363b8514c2')
        )

        assert len(release_heads) == 0
        hook = ReleaseHook(project)
        hook.finish_release(version=version,
            owner=user,
        )

        release = Release.objects.get(
            projects=project,
            version=version,
        )

        new_release_heads = ReleaseHeadCommit.objects.filter(
            organization_id=project.organization_id,
            repository_id=repo.id,
            release=release,
            commit=Commit.objects.get(key='bbee5b51f84611e4b14834363b8514c2')
        )
        assert len(new_release_heads) == 1
        assert release.version == 'bbee5b51f84611e4b14834363b8514c2'

        mock_fetch_commits.apply_async.assert_called_with(
            kwargs={
                'release_id': release.id,
                'user_id': user.id,
                'refs': [
                    {'commit': 'bbee5b51f84611e4b14834363b8514c2', 'repository': repo.name},
                ],
                'prev_release_id': old_release.id,
            }
        )
