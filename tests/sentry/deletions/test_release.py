from sentry.models import (
    Environment,
    Project,
    Release,
    ReleaseCommit,
    ReleaseEnvironment,
    ReleaseFile,
    ScheduledDeletion,
)
from sentry.tasks.deletion import run_deletion
from sentry.testutils import TransactionTestCase


class DeleteReleaseTest(TransactionTestCase):
    def test_simple(self):
        org = self.create_organization()
        project = self.create_project(organization=org)
        env = self.create_environment(organization=org)
        release = self.create_release(project=project, environments=[env])
        file = self.create_release_file(release_id=release.id)

        deletion = ScheduledDeletion.schedule(release, days=0)
        deletion.update(in_progress=True)

        with self.tasks():
            run_deletion(deletion.id)

        assert not Release.objects.filter(id=release.id).exists()
        assert not ReleaseCommit.objects.filter(release=release).exists()
        assert not ReleaseEnvironment.objects.filter(release=release).exists()
        assert not ReleaseFile.objects.filter(id=file.id).exists()

        # Shared objects should continue to exist.
        assert Environment.objects.filter(id=env.id).exists()
        assert Project.objects.filter(id=project.id).exists()
