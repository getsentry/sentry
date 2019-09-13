from __future__ import absolute_import

from datetime import timedelta
from django.utils import timezone

from sentry.models import Environment, Release, ReleaseProjectEnvironment
from sentry.testutils import TestCase


class GetOrCreateTest(TestCase):
    def setUp(self):
        self.project = self.create_project(name="foo")
        self.datetime_now = timezone.now()

        self.release = Release.objects.create(
            organization_id=self.project.organization_id, version="42"
        )
        self.release.add_project(self.project)
        self.environment = Environment.objects.create(
            project_id=self.project.id, organization_id=self.project.organization_id, name="prod"
        )

    def test_create(self):
        release_project_env = ReleaseProjectEnvironment.get_or_create(
            project=self.project,
            release=self.release,
            environment=self.environment,
            datetime=self.datetime_now,
        )

        assert release_project_env.project_id == self.project.id
        assert release_project_env.release_id == self.release.id
        assert release_project_env.environment_id == self.environment.id
        assert release_project_env.first_seen == self.datetime_now
        assert release_project_env.last_seen == self.datetime_now
        assert release_project_env.new_issues_count == 0

    def test_updates_last_seen(self):
        release_project_env = ReleaseProjectEnvironment.get_or_create(
            project=self.project,
            release=self.release,
            environment=self.environment,
            datetime=self.datetime_now,
        )
        assert release_project_env.project_id == self.project.id
        assert release_project_env.release_id == self.release.id
        assert release_project_env.environment_id == self.environment.id

        datetime_next = self.datetime_now + timedelta(days=1)

        release_project_env = ReleaseProjectEnvironment.get_or_create(
            project=self.project,
            release=self.release,
            environment=self.environment,
            datetime=datetime_next,
        )
        assert release_project_env.first_seen == self.datetime_now
        assert release_project_env.last_seen == datetime_next

    def test_no_update_too_close(self):
        """
        Test ensures that ReleaseProjectEnvironment's last_seen is not updated if the next time
        it is seen is too close to the last time it was seen.
        """
        release_project_env = ReleaseProjectEnvironment.get_or_create(
            project=self.project,
            release=self.release,
            environment=self.environment,
            datetime=self.datetime_now,
        )
        assert release_project_env.project_id == self.project.id
        assert release_project_env.release_id == self.release.id
        assert release_project_env.environment_id == self.environment.id

        datetime_next = self.datetime_now + timedelta(seconds=1)

        release_project_env = ReleaseProjectEnvironment.get_or_create(
            project=self.project,
            release=self.release,
            environment=self.environment,
            datetime=datetime_next,
        )
        assert release_project_env.first_seen == self.datetime_now
        assert release_project_env.last_seen == self.datetime_now
