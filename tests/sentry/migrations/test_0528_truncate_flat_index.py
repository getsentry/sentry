import uuid

from sentry.models.artifactbundle import (
    ArtifactBundle,
    ArtifactBundleFlatFileIndex,
    ArtifactBundleIndexingState,
    FlatFileIndexState,
)
from sentry.models.file import File
from sentry.testutils.cases import TestMigrations


class RemoveFlatFileIndexFiles(TestMigrations):
    migrate_from = "0527_backfill_next_checkin_latest"
    migrate_to = "0528_truncate_flat_index"

    def setup_before_migration(self, apps):
        artifact_bundle = ArtifactBundle.objects.create(
            organization_id=self.organization.id,
            bundle_id=uuid.uuid4().hex,
            file=File.objects.create(name="bundle.zip", type="application/octet-stream"),
            artifact_count=10,
        )
        flat_file_index = ArtifactBundleFlatFileIndex.objects.create(
            project_id=self.project.id,
            release_name="foo",
            flat_file_index=File.objects.create(name="flat_file_index"),
        )
        FlatFileIndexState.objects.create(
            flat_file_index=flat_file_index,
            artifact_bundle=artifact_bundle,
            indexing_state=ArtifactBundleIndexingState.NOT_INDEXED.value,
        )

    def test_deletes_linked_files(self):
        assert ArtifactBundleFlatFileIndex.objects.count() == 0
        assert FlatFileIndexState.objects.count() == 0

        assert File.objects.count() == 1
