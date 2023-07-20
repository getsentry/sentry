from sentry.models import ArtifactBundleFlatFileIndex
from sentry.testutils import TestCase
from sentry.testutils.silo import region_silo_test
from sentry.utils import json


@region_silo_test(stable=True)
class ArtifactBundleTest(TestCase):
    @staticmethod
    def mock_flat_file_index_contents_with_urls():
        return json.dumps(
            {
                "bundles": [{"1": 1234}, {"2": 5678}],
                "files_by_url": {"~/app.js": [0], "~/main.js": [1, 0]},
            }
        )

    @staticmethod
    def mock_flat_file_index_contents_with_debug_ids():
        return json.dumps(
            {
                "bundles": [{"1": 1234}, {"2": 5678}],
                "files_by_debug_id": {
                    "fe12f563-b005-4bc0-b76e-942cc0dac154": [0],
                    "89811d1f-f46c-46fe-bfd9-9ef186311e47": [1, 0],
                },
            }
        )

    def test_artifact_bundle_flat_index_is_created(self):
        file_contents = self.mock_flat_file_index_contents_with_urls()

        index = ArtifactBundleFlatFileIndex.create_flat_file_index(
            project_id=self.project.id,
            release="1.0",
            dist="android",
            file_contents=file_contents,
        )

        assert index.project_id == self.project.id
        assert index.release_name == "1.0"
        assert index.dist_name == "android"
        assert index.load_flat_file_index() == file_contents

    def test_artifact_bundle_flat_index_is_updated(self):
        index = ArtifactBundleFlatFileIndex.create_flat_file_index(
            project_id=self.project.id,
            release="1.0",
            dist="android",
            file_contents=self.mock_flat_file_index_contents_with_urls(),
        )

        updated_file_contents = self.mock_flat_file_index_contents_with_debug_ids()
        index.update_flat_file_index(updated_file_contents)

        assert index.project_id == self.project.id
        assert index.release_name == "1.0"
        assert index.dist_name == "android"
        assert index.load_flat_file_index() == updated_file_contents
