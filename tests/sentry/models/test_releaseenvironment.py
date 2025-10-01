from datetime import timedelta

from django.utils import timezone

from sentry.models.commit import Commit as OldCommit
from sentry.models.commitauthor import CommitAuthor
from sentry.models.environment import Environment
from sentry.models.release import Release
from sentry.models.releasecommit import ReleaseCommit
from sentry.models.releaseenvironment import ReleaseEnvironment
from sentry.models.repository import Repository
from sentry.releases.models import Commit
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.options import override_options


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
            ReleaseEnvironment.objects.create(
                organization_id=self.project.organization_id,
                project_id=self.project.id,
                release_id=self.release.id,
                environment_id=self.environment.id,
                first_seen=old_last_seen,
                last_seen=old_last_seen,
            )
            assert not Commit.objects.filter(id=self.old_commit.id).exists()

            new_last_seen = timezone.now()
            with self.tasks():
                ReleaseEnvironment.get_or_create(
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
            ReleaseEnvironment.objects.create(
                organization_id=self.project.organization_id,
                project_id=self.project.id,
                release_id=self.release.id,
                environment_id=self.environment.id,
                first_seen=old_last_seen,
                last_seen=old_last_seen,
            )
            new_last_seen = timezone.now()
            with self.tasks():
                ReleaseEnvironment.get_or_create(
                    project=self.project,
                    release=self.release,
                    environment=self.environment,
                    datetime=new_last_seen,
                )
            assert not Commit.objects.filter(id=self.old_commit.id).exists()

    def test_no_trigger_when_dual_write_not_configured(self):
        old_last_seen = timezone.now() - timedelta(days=1)
        ReleaseEnvironment.objects.create(
            organization_id=self.project.organization_id,
            project_id=self.project.id,
            release_id=self.release.id,
            environment_id=self.environment.id,
            first_seen=old_last_seen,
            last_seen=old_last_seen,
        )
        with self.tasks():
            ReleaseEnvironment.get_or_create(
                project=self.project,
                release=self.release,
                environment=self.environment,
                datetime=timezone.now(),
            )

        assert not Commit.objects.filter(id=self.old_commit.id).exists()

    def test_no_trigger_when_last_seen_not_bumped(self):
        dual_write_start = timezone.now() - timedelta(hours=1)

        with override_options({"commit.dual-write-start-date": dual_write_start.isoformat()}):
            old_last_seen = dual_write_start - timedelta(days=1)
            ReleaseEnvironment.objects.create(
                organization_id=self.project.organization_id,
                project_id=self.project.id,
                release_id=self.release.id,
                environment_id=self.environment.id,
                first_seen=old_last_seen,
                last_seen=old_last_seen,
            )

            new_last_seen = old_last_seen + timedelta(seconds=30)
            with self.tasks():
                ReleaseEnvironment.get_or_create(
                    project=self.project,
                    release=self.release,
                    environment=self.environment,
                    datetime=new_last_seen,
                )

            assert not Commit.objects.filter(id=self.old_commit.id).exists()
