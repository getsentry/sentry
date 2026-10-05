from uuid import uuid4

from django.db import connection
from django.test.utils import CaptureQueriesContext

from sentry import deletions
from sentry.deletions.tasks.scheduled import run_scheduled_deletions
from sentry.models.artifactbundle import (
    ArtifactBundle,
    ArtifactBundleIndex,
    DebugIdArtifactBundle,
    ProjectArtifactBundle,
    ReleaseArtifactBundle,
    SourceFileType,
)
from sentry.models.files.file import File
from sentry.testutils.cases import TransactionTestCase
from sentry.testutils.hybrid_cloud import HybridCloudTestMixin


class DeleteArtifactBundleTest(TransactionTestCase, HybridCloudTestMixin):
    def test_simple(self) -> None:
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

        self.ScheduledDeletion.schedule(instance=artifact_bundle, days=0)

        with self.tasks():
            run_scheduled_deletions()

        assert not ArtifactBundle.objects.filter(id=artifact_bundle.id).exists()
        assert not ReleaseArtifactBundle.objects.filter(artifact_bundle=artifact_bundle).exists()
        assert not DebugIdArtifactBundle.objects.filter(artifact_bundle=artifact_bundle).exists()
        assert not ProjectArtifactBundle.objects.filter(artifact_bundle=artifact_bundle).exists()
        assert not File.objects.filter(id=artifact_bundle.file.id).exists()

    def test_debug_ids_are_deleted_by_cascade(self) -> None:
        org = self.create_organization()
        artifact_bundle = self.create_artifact_bundle(org=org)
        other_bundle = self.create_artifact_bundle(org=org)
        DebugIdArtifactBundle.objects.bulk_create(
            [
                DebugIdArtifactBundle(
                    organization_id=org.id,
                    artifact_bundle=bundle,
                    debug_id=uuid4(),
                    source_file_type=SourceFileType.MINIFIED_SOURCE.value,
                )
                for bundle in (artifact_bundle, other_bundle)
                for _ in range(3)
            ]
        )
        ArtifactBundleIndex.objects.bulk_create(
            [
                ArtifactBundleIndex(
                    organization_id=org.id,
                    artifact_bundle=bundle,
                    url="~/bundle.js",
                )
                for bundle in (artifact_bundle, other_bundle)
            ]
        )
        bundle_id = artifact_bundle.id
        file_id = artifact_bundle.file_id

        with self.tasks(), CaptureQueriesContext(connection) as queries:
            deletions.exec_sync(artifact_bundle)

        debug_id_deletes = [
            query["sql"]
            for query in queries
            if query["sql"].startswith('DELETE FROM "sentry_debugidartifactbundle"')
        ]
        assert len(debug_id_deletes) == 1
        assert '"artifact_bundle_id" IN' in debug_id_deletes[0]
        assert not DebugIdArtifactBundle.objects.filter(artifact_bundle_id=bundle_id).exists()
        assert not ArtifactBundleIndex.objects.filter(artifact_bundle_id=bundle_id).exists()
        assert not ArtifactBundle.objects.filter(id=bundle_id).exists()
        assert not File.objects.filter(id=file_id).exists()
        assert DebugIdArtifactBundle.objects.filter(artifact_bundle=other_bundle).count() == 3
        assert ArtifactBundleIndex.objects.filter(artifact_bundle=other_bundle).count() == 1
        assert ArtifactBundle.objects.filter(id=other_bundle.id).exists()
        assert File.objects.filter(id=other_bundle.file_id).exists()
