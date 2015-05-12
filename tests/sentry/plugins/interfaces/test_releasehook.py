"""
sentry.plugins.base.structs
~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2013 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import, print_function

__all__ = ['ReleaseHook']

from sentry.models import Release
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
