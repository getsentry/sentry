from __future__ import absolute_import

from django.utils import timezone

from sentry.models import Environment, Release, ReleaseEnvironment
from sentry.testutils import TestCase


class GetOrCreateTest(TestCase):
    def test_simple(self):
        project = self.create_project()
        now = timezone.now()

        release = Release.objects.create(
            project=project,
            version='abcdef',
        )
        env = Environment.objects.create(
            project_id=project.id,
            name='prod',
        )
        relenv = ReleaseEnvironment.get_or_create(
            project=project,
            release=release,
            environment=env,
            datetime=now,
        )

        assert relenv.project_id == project.id
        assert relenv.release_id == release.id
        assert relenv.environment_id == env.id
