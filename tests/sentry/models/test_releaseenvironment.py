from datetime import timedelta
from unittest.mock import patch

from django.db.utils import OperationalError
from django.utils import timezone

from sentry.models.environment import Environment
from sentry.models.release import Release
from sentry.models.releaseenvironment import ReleaseEnvironment
from sentry.testutils.cases import TestCase
from sentry.utils.cache import cache


class GetOrCreateTest(TestCase):
    def test_simple(self) -> None:
        project = self.create_project(name="foo")
        datetime = timezone.now()

        release = Release.objects.create(organization_id=project.organization_id, version="abcdef")
        release.add_project(project)
        env = Environment.objects.create(organization_id=project.organization_id, name="prod")
        relenv = ReleaseEnvironment.get_or_create(
            project=project, release=release, environment=env, datetime=datetime
        )

        assert relenv.organization_id == project.organization_id
        assert relenv.release_id == release.id
        assert relenv.environment_id == env.id

        datetime_new = datetime + timedelta(days=1)

        relenv = ReleaseEnvironment.get_or_create(
            project=project, release=release, environment=env, datetime=datetime_new
        )

        assert relenv.first_seen == datetime
        assert relenv.last_seen == datetime_new

        datetime_new2 = datetime_new + timedelta(seconds=1)

        # this should not update immediately as the window is too close
        relenv = ReleaseEnvironment.get_or_create(
            project=project, release=release, environment=env, datetime=datetime_new2
        )

        assert relenv.first_seen == datetime
        assert relenv.last_seen == datetime_new

        # shouldn't create new release env if same env, release and org
        project2 = self.create_project(name="bar", organization=project.organization)
        release.add_project(project2)

        relenv2 = ReleaseEnvironment.get_or_create(
            project=project2, release=release, environment=env, datetime=datetime
        )
        assert relenv.id == relenv2.id
        assert ReleaseEnvironment.objects.get(id=relenv.id).last_seen == relenv2.last_seen

    def test_bump_skipped_when_cache_lock_held(self) -> None:
        """Second worker skips the DB update when another worker already holds the bump lock."""
        project = self.create_project(name="foo")
        datetime_now = timezone.now()

        release = Release.objects.create(organization_id=project.organization_id, version="abcdef")
        release.add_project(project)
        env = Environment.objects.create(organization_id=project.organization_id, name="prod")

        ReleaseEnvironment.get_or_create(
            project=project, release=release, environment=env, datetime=datetime_now
        )

        datetime_next = datetime_now + timedelta(days=1)

        re = ReleaseEnvironment.objects.get(
            organization_id=project.organization_id, release=release, environment=env
        )
        bump_key = f"releaseenv_bump:{re.id}"
        cache.set(bump_key, "1", timeout=60)

        with patch.object(
            ReleaseEnvironment.objects,
            "filter",
            wraps=ReleaseEnvironment.objects.filter,
        ) as mock_filter:
            result = ReleaseEnvironment.get_or_create(
                project=project, release=release, environment=env, datetime=datetime_next
            )
            for call in mock_filter.call_args_list:
                assert "last_seen__lt" not in (call.kwargs or {})

        re.refresh_from_db()
        assert re.last_seen == datetime_now
        assert result is not None

    def test_bump_survives_operational_error(self) -> None:
        """OperationalError on the UPDATE doesn't prevent the instance from being returned."""
        project = self.create_project(name="foo")
        datetime_now = timezone.now()

        release = Release.objects.create(organization_id=project.organization_id, version="abcdef")
        release.add_project(project)
        env = Environment.objects.create(organization_id=project.organization_id, name="prod")

        ReleaseEnvironment.get_or_create(
            project=project, release=release, environment=env, datetime=datetime_now
        )

        datetime_next = datetime_now + timedelta(days=1)

        with patch("sentry.models.releaseenvironment.ReleaseEnvironment.objects") as mock_manager:
            mock_qs = mock_manager.filter.return_value
            mock_qs.update.side_effect = OperationalError("canceling statement due to user request")

            result = ReleaseEnvironment.get_or_create(
                project=project, release=release, environment=env, datetime=datetime_next
            )

        assert result is not None
        re = ReleaseEnvironment.objects.get(
            organization_id=project.organization_id, release=release, environment=env
        )
        assert re.last_seen == datetime_now
