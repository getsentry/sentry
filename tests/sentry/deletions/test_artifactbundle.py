from sentry.models import (
    ArtifactBundle,
    DebugIdArtifactBundle,
    File,
    ProjectArtifactBundle,
    ReleaseArtifactBundle,
    ScheduledDeletion,
    SourceFileType,
)
from sentry.tasks.deletion.scheduled import run_deletion
from sentry.testutils import TransactionTestCase


class DeleteArtifactBundleTest(TransactionTestCase):
    def test_simple(self):
        org = self.create_organization()
        project = self.create_project(organization=org)
        release = self.create_release(version="1.0", project=project)
        dist = release.add_dist("android")
        artifact_bundle = self.create_artifact_bundle(org=org)
        ReleaseArtifactBundle.objects.create(
            organization_id=org.id,
            release_name=release.version,
            dist_name=dist.name,
            artifact_bundle=artifact_bundle,
        )
        DebugIdArtifactBundle.objects.create(
            organization_id=org.id,
            debug_id="c29728de-4dbd-4c08-bd50-7509e1ee2535",
            source_file_type=SourceFileType.MINIFIED_SOURCE.value,
            artifact_bundle=artifact_bundle,
        )
        ProjectArtifactBundle.objects.create(
            organization_id=org.id, project_id=project.id, artifact_bundle=artifact_bundle
        )

        deletion = ScheduledDeletion.schedule(artifact_bundle, days=0)
        deletion.update(in_progress=True)

        with self.tasks():
            run_deletion(deletion.id)

        assert not ArtifactBundle.objects.filter(id=artifact_bundle.id).exists()
        assert not ReleaseArtifactBundle.objects.filter(artifact_bundle=artifact_bundle).exists()
        assert not DebugIdArtifactBundle.objects.filter(artifact_bundle=artifact_bundle).exists()
        assert not ProjectArtifactBundle.objects.filter(artifact_bundle=artifact_bundle).exists()
        assert not File.objects.filter(id=artifact_bundle.file.id).exists()
