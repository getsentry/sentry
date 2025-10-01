from datetime import timedelta

from django.utils import timezone

from sentry.models.commit import Commit as OldCommit
from sentry.models.commitauthor import CommitAuthor
from sentry.models.environment import Environment
from sentry.models.release import Release
from sentry.models.releasecommit import ReleaseCommit
from sentry.models.releaseprojectenvironment import ReleaseProjectEnvironment
from sentry.models.repository import Repository
from sentry.releases.models import Commit
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.options import override_options


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


class BackfillTriggerTest(TestCase):
    def setUp(self):
        super().setUp()
        self.project = self.create_project()
        self.release = self.create_release(project=self.project, version="1.0.0")
        self.environment = Environment.objects.create(
            organization_id=self.project.organization_id, name="production"
        )
        self.repo = Repository.objects.create(
            name="test-repo",
            organization_id=self.project.organization_id,
        )
        self.author = CommitAuthor.objects.create(
            organization_id=self.project.organization_id,
            email="test@example.com",
            name="Test Author",
        )
        self.old_commit = OldCommit.objects.create(
            organization_id=self.project.organization_id,
            repository_id=self.repo.id,
            key="abc123",
            message="Test commit",
            author=self.author,
        )
        ReleaseCommit.objects.create(
            organization_id=self.project.organization_id,
            release=self.release,
            commit=self.old_commit,
            order=1,
        )

    def test_triggers_backfill_when_crossing_dual_write_start_date(self):
        dual_write_start = timezone.now() - timedelta(hours=1)
        with override_options({"commit.dual-write-start-date": dual_write_start.isoformat()}):
            old_last_seen = dual_write_start - timedelta(days=1)
            ReleaseProjectEnvironment.objects.create(
                project_id=self.project.id,
                release_id=self.release.id,
                environment_id=self.environment.id,
                first_seen=old_last_seen,
                last_seen=old_last_seen,
            )
            assert not Commit.objects.filter(id=self.old_commit.id).exists()
            new_last_seen = timezone.now()
            with self.tasks():
                ReleaseProjectEnvironment.get_or_create(
                    project=self.project,
                    release=self.release,
                    environment=self.environment,
                    datetime=new_last_seen,
                )
            assert Commit.objects.filter(id=self.old_commit.id).exists()
            new_commit = Commit.objects.get(id=self.old_commit.id)
            assert new_commit.key == "abc123"
            assert new_commit.message == "Test commit"

    def test_no_trigger_when_already_after_dual_write_start(self):
        dual_write_start = timezone.now() - timedelta(hours=2)
        with override_options({"commit.dual-write-start-date": dual_write_start.isoformat()}):
            old_last_seen = dual_write_start + timedelta(hours=1)
            ReleaseProjectEnvironment.objects.create(
                project_id=self.project.id,
                release_id=self.release.id,
                environment_id=self.environment.id,
                first_seen=old_last_seen,
                last_seen=old_last_seen,
            )
            new_last_seen = timezone.now()
            with self.tasks():
                ReleaseProjectEnvironment.get_or_create(
                    project=self.project,
                    release=self.release,
                    environment=self.environment,
                    datetime=new_last_seen,
                )
            assert not Commit.objects.filter(id=self.old_commit.id).exists()

    def test_no_trigger_when_dual_write_not_configured(self):
        old_last_seen = timezone.now() - timedelta(days=1)
        ReleaseProjectEnvironment.objects.create(
            project_id=self.project.id,
            release_id=self.release.id,
            environment_id=self.environment.id,
            first_seen=old_last_seen,
            last_seen=old_last_seen,
        )
        new_last_seen = timezone.now()
        with self.tasks():
            ReleaseProjectEnvironment.get_or_create(
                project=self.project,
                release=self.release,
                environment=self.environment,
                datetime=new_last_seen,
            )
        assert not Commit.objects.filter(id=self.old_commit.id).exists()

    def test_no_trigger_when_last_seen_not_bumped(self):
        dual_write_start = timezone.now() - timedelta(hours=1)
        with override_options({"commit.dual-write-start-date": dual_write_start.isoformat()}):
            old_last_seen = dual_write_start - timedelta(days=1)
            ReleaseProjectEnvironment.objects.create(
                project_id=self.project.id,
                release_id=self.release.id,
                environment_id=self.environment.id,
                first_seen=old_last_seen,
                last_seen=old_last_seen,
            )
            new_last_seen = old_last_seen + timedelta(seconds=30)
            with self.tasks():
                ReleaseProjectEnvironment.get_or_create(
                    project=self.project,
                    release=self.release,
                    environment=self.environment,
                    datetime=new_last_seen,
                )
            assert not Commit.objects.filter(id=self.old_commit.id).exists()
