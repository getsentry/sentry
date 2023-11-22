from sentry.models.environment import Environment
from sentry.models.project import Project
from sentry.models.release import Release
from sentry.models.releasecommit import ReleaseCommit
from sentry.models.releaseenvironment import ReleaseEnvironment
from sentry.models.releasefile import ReleaseFile
from sentry.silo import SiloMode
from sentry.tasks.deletion.hybrid_cloud import schedule_hybrid_cloud_foreign_key_jobs
from sentry.tasks.deletion.scheduled import run_scheduled_deletions
from sentry.testutils.cases import TransactionTestCase
from sentry.testutils.helpers import TaskRunner
from sentry.testutils.hybrid_cloud import HybridCloudTestMixin
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.silo import assume_test_silo_mode, region_silo_test


@region_silo_test
class DeleteReleaseTest(TransactionTestCase, HybridCloudTestMixin):
    def test_simple(self):
        org = self.create_organization()
        project = self.create_project(organization=org)
        env = self.create_environment(organization=org)
        release = self.create_release(project=project, environments=[env])
        file = self.create_release_file(release_id=release.id)

        self.ScheduledDeletion.schedule(instance=release, days=0)

        with self.tasks():
            run_scheduled_deletions()

        assert not Release.objects.filter(id=release.id).exists()
        assert not ReleaseCommit.objects.filter(release=release).exists()
        assert not ReleaseEnvironment.objects.filter(release=release).exists()
        assert not ReleaseFile.objects.filter(id=file.id).exists()

        # Shared objects should continue to exist.
        assert Environment.objects.filter(id=env.id).exists()
        assert Project.objects.filter(id=project.id).exists()

    def test_cascade_from_user(self):
        org = self.create_organization()
        project = self.create_project(organization=org)
        env = self.create_environment(organization=org)
        release1 = self.create_release(project=project, environments=[env])
        release1.update(owner_id=self.user.id)
        release2 = self.create_release(project=project, environments=[env])
        release2.update(owner_id=self.create_user().id)

        assert release1.owner_id
        assert release2.owner_id

        with assume_test_silo_mode(SiloMode.CONTROL), outbox_runner():
            self.user.delete()

        with TaskRunner():
            schedule_hybrid_cloud_foreign_key_jobs()

        release1.refresh_from_db()
        release2.refresh_from_db()
        assert release1.owner_id is None
        assert release2.owner_id is not None
