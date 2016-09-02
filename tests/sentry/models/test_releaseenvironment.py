from __future__ import absolute_import

from datetime import timedelta
from django.utils import timezone

from sentry.models import Environment, Release, ReleaseEnvironment
from sentry.testutils import TestCase


class GetOrCreateTest(TestCase):
    def test_simple(self):
        project = self.create_project()
        datetime = timezone.now()

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
            datetime=datetime,
        )

        assert relenv.project_id == project.id
        assert relenv.release_id == release.id
        assert relenv.environment_id == env.id

        datetime_new = datetime + timedelta(days=1)

        relenv = ReleaseEnvironment.get_or_create(
            project=project,
            release=release,
            environment=env,
            datetime=datetime_new,
        )

        assert relenv.first_seen == datetime
        assert relenv.last_seen == datetime_new

        datetime_new2 = datetime_new + timedelta(seconds=1)

        # this should not update immediately as the window is too close
        relenv = ReleaseEnvironment.get_or_create(
            project=project,
            release=release,
            environment=env,
            datetime=datetime_new2,
        )

        assert relenv.first_seen == datetime
        assert relenv.last_seen == datetime_new
