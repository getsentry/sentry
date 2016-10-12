"""
sentry.plugins.base.structs
~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2013 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import, print_function

__all__ = ['ReleaseHook']

from sentry.models import Commit, Release
from sentry.plugins import ReleaseHook
from sentry.testutils import TestCase


class StartReleaseTest(TestCase):
    def test_minimal(self):
        project = self.create_project()
        version = 'bbee5b51f84611e4b14834363b8514c2'

        hook = ReleaseHook(project)
        hook.start_release(version)

        release = Release.objects.get(
            project=project,
            version=version,
        )
        assert release.date_started


class FinishReleaseTest(TestCase):
    def test_minimal(self):
        project = self.create_project()
        version = 'bbee5b51f84611e4b14834363b8514c2'

        hook = ReleaseHook(project)
        hook.finish_release(version)

        release = Release.objects.get(
            project=project,
            version=version,
        )
        assert release.date_released


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
            project=project,
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
