from datetime import timedelta
from unittest.mock import patch

from django.utils import timezone

from sentry.models.environment import Environment
from sentry.models.release import Release
from sentry.models.releaseprojectenvironment import (
    ReleaseProjectEnvironment,
    ReleaseProjectEnvironmentManager,
)
from sentry.signals import receivers_raise_on_send
from sentry.testutils.cases import TestCase


class GetOrCreateTest(TestCase):
    def setUp(self):
        self.project = self.create_project(name="foo")
        self.datetime_now = timezone.now()

        self.release = Release.objects.create(
            organization_id=self.project.organization_id, version="42"
        )
        self.release.add_project(self.project)
        self.environment = Environment.objects.create(
            organization_id=self.project.organization_id, name="prod"
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

    @receivers_raise_on_send()
    @patch.object(ReleaseProjectEnvironmentManager, "subscribe_project_to_alert_rule")
    def test_post_save_subscribes_project_to_alert_rule_if_created(
        self, mock_subscribe_project_to_alert_rule
    ):
        ReleaseProjectEnvironment.get_or_create(
            project=self.project,
            release=self.release,
            environment=self.environment,
            datetime=self.datetime_now,
        )

        assert mock_subscribe_project_to_alert_rule.call_count == 1
