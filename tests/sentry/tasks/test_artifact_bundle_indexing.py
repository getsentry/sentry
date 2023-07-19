from unittest.mock import patch

from sentry.debug_files.artifact_bundle_indexing import FlatFileIndexingState
from sentry.tasks.artifact_bundle_indexing import index_artifact_bundle
from sentry.testutils import TestCase


class ArtifactBundleIndexingTest(TestCase):
    @patch("sentry.tasks.artifact_bundle_indexing.index_bundle_in_flat_file")
    @patch("sentry.tasks.artifact_bundle_indexing.index_artifact_bundle.apply_async")
    def test_index_artifact_bundle_with_conflict(self, apply_async, index_bundle_in_flat_file):
        index_bundle_in_flat_file.return_value = FlatFileIndexingState.CONFLICT

        artifact_bundle = self.create_artifact_bundle(self.organization, artifact_count=2)

        with self.tasks():
            index_artifact_bundle(
                artifact_bundle_id=artifact_bundle.id,
                project_id=self.project.id,
                release="",
                dist="",
            )
            apply_async.assert_called_once()
