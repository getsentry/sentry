from datetime import timedelta
from unittest.mock import patch

from django.db.utils import OperationalError
from django.utils import timezone

from sentry.models.environment import Environment
from sentry.models.release import Release
from sentry.models.releaseprojectenvironment import ReleaseProjectEnvironment
from sentry.testutils.cases import TestCase
from sentry.utils.cache import cache


class GetOrCreateTest(TestCase):
    def setUp(self) -> None:
        self.project = self.create_project(name="foo")
        self.datetime_now = timezone.now()

        self.release = Release.objects.create(
            organization_id=self.project.organization_id, version="42"
        )
        self.release.add_project(self.project)
        self.environment = Environment.objects.create(
            organization_id=self.project.organization_id, name="prod"
        )

    def test_create(self) -> None:
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

    def test_updates_last_seen(self) -> None:
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

    def test_no_update_too_close(self) -> None:
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

    def test_bump_skipped_when_cache_lock_held(self) -> None:
        """Second worker skips the DB update when another worker already holds the bump lock."""
        ReleaseProjectEnvironment.get_or_create(
            project=self.project,
            release=self.release,
            environment=self.environment,
            datetime=self.datetime_now,
        )

        datetime_next = self.datetime_now + timedelta(days=1)

        rpe = ReleaseProjectEnvironment.objects.get(
            project=self.project, release=self.release, environment=self.environment
        )
        bump_key = f"releaseprojectenv_bump:{rpe.id}"
        cache.set(bump_key, "1", timeout=60)

        with patch.object(
            ReleaseProjectEnvironment.objects,
            "filter",
            wraps=ReleaseProjectEnvironment.objects.filter,
        ) as mock_filter:
            result = ReleaseProjectEnvironment.get_or_create(
                project=self.project,
                release=self.release,
                environment=self.environment,
                datetime=datetime_next,
            )
            for call in mock_filter.call_args_list:
                assert "last_seen__lt" not in (call.kwargs or {})

        rpe.refresh_from_db()
        assert rpe.last_seen == self.datetime_now
        assert result is not None

    def test_bump_survives_operational_error(self) -> None:
        """OperationalError on the UPDATE doesn't prevent the instance from being returned."""
        ReleaseProjectEnvironment.get_or_create(
            project=self.project,
            release=self.release,
            environment=self.environment,
            datetime=self.datetime_now,
        )

        datetime_next = self.datetime_now + timedelta(days=1)

        with patch(
            "sentry.models.releaseprojectenvironment.ReleaseProjectEnvironment.objects"
        ) as mock_manager:
            mock_qs = mock_manager.filter.return_value
            mock_qs.update.side_effect = OperationalError("canceling statement due to user request")

            result = ReleaseProjectEnvironment.get_or_create(
                project=self.project,
                release=self.release,
                environment=self.environment,
                datetime=datetime_next,
            )

        assert result is not None
        rpe = ReleaseProjectEnvironment.objects.get(
            project=self.project, release=self.release, environment=self.environment
        )
        assert rpe.last_seen == self.datetime_now
